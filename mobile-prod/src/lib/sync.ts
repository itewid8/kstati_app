/**
 * Синхронизация с сервером. Телефон — главный для своих правок, сервер — для общего.
 *
 * 1. Любая правка дел, «Смотреть» и своих хотелок в хранилище сама превращается в операцию
 *    (сравниваем списки до и после) и встаёт в очередь outbox. Группы и профиль ставят операции явно.
 * 2. Очередь отправляется пачкой на POST /ops; нет связи — лежит и ждёт (очередь сохраняется на телефоне).
 * 3. Когда очередь пуста — POST /sync: сервер присылает группы и людей, а записи — только там,
 *    где ревизия поменялась. Группы, по которым есть неотправленные правки, не перезаписываем.
 *    Разбор ответа и слияние — remote.ts (чистый модуль, с тестами); неизменённые данные сохраняют ссылки.
 * 4. Операции, которые наш сервер окончательно отверг (JSON с кодом ошибки: 4xx на пачку или ok:false в ответе),
 *    не держат очередь: плохая находится делением пачки и уходит в карантин (quarantine.ts) — не теряется,
 *    временные отказы повторяются один раз после удачной синхронизации. Всё остальное (нет связи, таймаут, 5xx,
 *    страница прокси или VPN вместо нашего JSON) — пачка ждёт в очереди и повторяется (http.ts).
 * Когда: при запуске, при возвращении в приложение, раз в 15 секунд, пока оно открыто, сразу после правки,
 * после ошибки — с растущей паузой, и при включении / выключении VPN (Android).
 */
import { AppState } from 'react-native';
import { isVpnActive } from '../../modules/kstati-net';
import { fetchHealth } from './api';
import { failCode, failKind, opsResults } from './http';
import { API_LEVEL, ApiError, NetError, request, type Op } from './net';
import { flushOutbox } from './outbox';
import { isEmptyPatch, mergePull, parseSync } from './remote';
import { flushStorage } from './storage';
import { applyRemote, DEMO, isApplyingRemote, syncHooks, undoHoldLeft, useStore } from './store';
import type { Activity, ID, Idea, ReminderSettings, Task, TaskReminderOverride, Topic, WatchItem, Wish } from './types';
import { PERSONAL } from './visibility';

/** Изменения личных напоминаний → операция prefs (только то, что поменялось) */
function prefsOp(
  before: { reminders: ReminderSettings; overrides: Record<ID, TaskReminderOverride> },
  after: { reminders: ReminderSettings; overrides: Record<ID, TaskReminderOverride> },
): Op | null {
  const op: Extract<Op, { op: 'prefs' }> = { op: 'prefs' };
  if (before.reminders !== after.reminders) op.reminders = after.reminders;
  if (before.overrides !== after.overrides) {
    const changed: Record<string, string[] | null> = {};
    for (const [id, v] of Object.entries(after.overrides)) if (before.overrides[id] !== v) changed[id] = v;
    for (const id of Object.keys(before.overrides)) if (!(id in after.overrides)) changed[id] = null;
    if (Object.keys(changed).length) op.overrides = changed;
  }
  return op.reminders || op.overrides ? op : null;
}

/* ---------- правки в хранилище → операции ---------- */

const taskOp = (t: Task): Op => ({
  op: 'task.put',
  task: {
    id: t.id,
    groupId: t.groupId,
    ...(t.createdBy && { ownerId: t.createdBy }),
    // Видимость шлём только своих дел: сервер чужую всё равно не примет
    ...(t.createdBy === useStore.getState().me?.id && { only: !!t.only, share: t.share ?? {} }),
    title: t.title,
    date: t.date,
    time: t.time,
    note: t.note ?? '',
    doneAt: t.doneAt,
    repeat: t.repeat ?? null,
    doneDates: t.doneDates ?? [],
    skipDates: t.skipDates ?? [],
    reminders: t.reminders ?? null,
    endDate: t.endDate ?? null,
    endTime: t.endTime ?? null,
    people: t.people ?? [],
    parentId: t.parentId ?? null,
    kind: t.kind ?? 'task',
    celebrant: t.kind === 'birthday' ? (t.celebrant ?? null) : null,
    ...(t.ext !== undefined && t.createdBy === useStore.getState().me?.id && { ext: t.ext }),
  },
});
const watchOp = (w: WatchItem): Op => ({
  op: 'watch.put',
  watch: { id: w.id, groupId: w.groupId, title: w.title, kind: w.kind, genres: w.genres, origin: w.origin, year: w.year, watchedAt: w.watchedAt },
});
const wishOp = (w: Wish): Op => ({ op: 'wish.put', wish: { id: w.id, title: w.title, note: w.note, link: w.link, receivedAt: w.receivedAt } });
// archivedAt уходит, только если его трогали: старый сервер без поля и чужие правки его не стирают
const topicOp = (t: Topic): Op => ({
  op: 'topic.put',
  topic: { id: t.id, title: t.title, groupIds: t.groupIds, body: t.body ?? '', ...(t.archivedAt !== undefined && { archivedAt: t.archivedAt }) },
});
const ideaOp = (i: Idea): Op => ({ op: 'idea.put', idea: { id: i.id, topicId: i.topicId, text: i.text } });

function diff<T extends { id: string }>(before: T[], after: T[], put: (x: T) => Op, del: (x: T) => Op): Op[] {
  if (before === after) return [];
  const prev = new Map(before.map((x) => [x.id, x]));
  const ops: Op[] = [];
  for (const x of after) {
    // Объекты в хранилище не меняются на месте: другая ссылка — значит, запись изменили
    if (prev.get(x.id) !== x) ops.push(put(x));
    prev.delete(x.id);
  }
  for (const x of prev.values()) ops.push(del(x));
  return ops;
}

useStore.subscribe((s, p) => {
  if (isApplyingRemote() || DEMO || !s.session || s.session !== p.session) return;
  const meId = s.me?.id;
  const ops = [
    ...diff(p.tasks, s.tasks, taskOp, (t) => ({ op: 'item.delete', groupId: t.groupId, id: t.id, ...(t.createdBy && { ownerId: t.createdBy }) })),
    ...diff(p.watch, s.watch, watchOp, (w) => ({ op: 'item.delete', groupId: w.groupId, id: w.id })),
    ...diff(
      p.wishes.filter((w) => w.ownerId === meId),
      s.wishes.filter((w) => w.ownerId === meId),
      wishOp,
      (w) => ({ op: 'wish.delete', id: w.id }),
    ),
    // Сначала темы: новая идея может ссылаться на только что созданную тему
    ...diff(
      p.topics.filter((t) => t.ownerId === meId),
      s.topics.filter((t) => t.ownerId === meId),
      topicOp,
      (t) => ({ op: 'topic.delete', id: t.id }),
    ),
    ...diff(
      p.ideas.filter((i) => i.ownerId === meId),
      s.ideas.filter((i) => i.ownerId === meId),
      ideaOp,
      (i) => ({ op: 'idea.delete', id: i.id }),
    ),
  ];
  const prefs = prefsOp(p, s);
  if (prefs) ops.push(prefs);
  // Записи групп, из которых ушли (выход, исключение) — удалять на сервере не нужно, это делает сервер
  // (дела живут в личном календаре владельца — их удаление отправляем всегда, кроме чужих из ушедших групп)
  const alive = new Set([...s.groups.map((g) => g.id), PERSONAL]);
  const filtered = ops.filter((o) => o.op !== 'item.delete' || alive.has(o.groupId) || o.ownerId === meId);
  if (filtered.length) s.queue(filtered);
});

/* ---------- отправка и получение ---------- */

let running: Promise<void> | null = null;
let again = false;
let failures = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

/** Размер пачки: после таймаута уменьшаем (медленный VPN не успевает передать 100 операций), после успеха — снова 100 */
const BATCH_MAX = 100;
let batchSize = BATCH_MAX;

function flush(token: string): Promise<void> {
  return flushOutbox<Op>({
    read: () => useStore.getState().outbox,
    send: async (batch) => {
      // Ответ не того вида (страница прокси с кодом 200, обрыв) — NetError: пачка остаётся в очереди
      const results = opsResults(await request<unknown>('/ops', { token, body: { ops: batch }, timeoutMs: 30_000 }), batch.length);
      results.forEach((r, i) => {
        const op = batch[i];
        if (r.ok || !op) return;
        console.warn('Операция отклонена сервером — в карантин', op.op, r.error, r.message);
        useStore.getState().quarantineOp(op, r.error ?? 'unknown');
      });
    },
    // Убираем отправленное (пока шёл запрос, в конец могли добавиться новые операции)
    remove: (done) => useStore.getState().outboxSent(done),
    classify: failKind,
    onReject: (op, e) => {
      console.warn('Сервер не принял операцию — в карантин', op.op, e instanceof ApiError ? `${e.status} ${e.code} ${e.message}` : e);
      useStore.getState().quarantineOp(op, failCode(e));
    },
    batchSize,
  });
}

async function pull(token: string) {
  const s0 = useStore.getState();
  const raw = await request<unknown>('/sync', { token, body: { ...s0.revs, ideas: s0.ideaRevs } });
  const s = useStore.getState();
  if (s.session?.token !== token) return; // пока ждали — вышли из аккаунта
  const { patch, uploadPrefs } = mergePull(s, parseSync(raw));
  // Ничего не поменялось — не трогаем хранилище: ни перерисовок, ни записи на диск
  if (!isEmptyPatch(patch)) applyRemote(() => useStore.setState(patch));
  if (uploadPrefs) {
    const cur = useStore.getState();
    cur.queue([{ op: 'prefs', reminders: cur.reminders, overrides: Object.fromEntries(Object.entries(cur.overrides)) }]);
  }
}

/** Отправить очередь и забрать новое. Повторные вызовы во время работы склеиваются и ждут общего окончания */
export function syncNow(): Promise<void> {
  if (DEMO) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        await syncOnce();
      } while (again);
    } finally {
      running = null;
    }
  })();
  return running;
}

async function syncOnce(): Promise<void> {
  const token = useStore.getState().session?.token;
  if (!token) return;
  // Висит «ВЕРНУТЬ» — ждём её конца: удалённое и отмеченное уходят на сервер, только когда их уже не вернут
  const hold = undoHoldLeft(useStore.getState().undo);
  if (hold > 0) {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(syncNow, hold + 50);
    return;
  }
  try {
    await flush(token);
    batchSize = BATCH_MAX;
    await pull(token);
    failures = 0;
    useStore.getState().setNet('ok');
    // Отказы, которые бывают из-за гонки (группу ещё не создали), — один раз снова в очередь
    if (useStore.getState().session?.token === token) useStore.getState().retryQuarantined();
    await fetchActivity();
  } catch (e) {
    const kind = failKind(e);
    if (kind === 'auth') {
      // Токен больше не действует — выходим (неотправленное откладывается до входа), экраны по authLost переводят на вход
      if (useStore.getState().session?.token === token) useStore.getState().authExpired();
    } else if (kind === 'retry') {
      if (e instanceof NetError && e.message === 'timeout') batchSize = Math.max(10, Math.floor(batchSize / 2));
      failures++;
      useStore.getState().setNet('offline');
      // Повтор с растущей паузой: 5 с, 10 с … до минуты
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(syncNow, Math.min(60_000, 5_000 * 2 ** Math.min(failures - 1, 4)));
    } else {
      console.warn('Синхронизация', e);
    }
  }
}

/* ---------- лента активности ---------- */

let activityAt = 0;

/**
 * Забрать новые записи ленты (только те, что свежее последней известной).
 * Не чаще раза в минуту; force — сразу (открыли ленту, потянули вниз). Ошибки ленты молча пропускаем.
 */
export async function fetchActivity(force = false): Promise<void> {
  const s = useStore.getState();
  const token = s.session?.token;
  if (DEMO || !token) return;
  if (!force && Date.now() - activityAt < 60_000) return;
  activityAt = Date.now();
  try {
    const since = s.activity[0]?.id;
    const r = await request<{ events: Activity[] }>(`/activity${since ? `?since=${encodeURIComponent(since)}` : ''}`, { token });
    if (useStore.getState().session?.token === token) useStore.getState().mergeActivity(r.events);
  } catch {
    /* нет связи или лента ещё не готова на сервере */
  }
}

/* ---------- уровень API сервера ---------- */

let serverChecked = false;

/**
 * GET /health → serverApi. Сервер ниже API 2 молча срежет подарки и архив тем — тогда один раз говорим об этом,
 * а экраны не показывают эти действия. Нет связи — проверим при следующем возвращении в приложение
 */
async function checkServer(): Promise<void> {
  if (serverChecked) return;
  const h = await fetchHealth();
  if (!h) return;
  serverChecked = true;
  const s = useStore.getState();
  s.setServerApi(h.api);
  if (h.api < API_LEVEL) s.notice('Сервер устарел');
}

/** Запуск: из корневого экрана. Возвращает функцию остановки */
export function startSync(): () => void {
  if (DEMO) return () => {};
  let kickTimer: ReturnType<typeof setTimeout> | null = null;
  syncHooks.kick = () => {
    if (kickTimer) clearTimeout(kickTimer);
    kickTimer = setTimeout(syncNow, 400);
  };
  let interval: ReturnType<typeof setInterval> | null = null;
  // VPN включили или выключили — связь с сервером могла появиться: очередь отправляем сразу, без паузы
  let vpn = isVpnActive();
  let vpnTimer: ReturnType<typeof setInterval> | null = null;
  const checkVpn = () => {
    const now = isVpnActive();
    if (now === vpn) return;
    vpn = now;
    failures = 0;
    syncNow();
  };
  const onActive = () => {
    void checkServer();
    failures = 0;
    vpn = isVpnActive();
    syncNow();
    if (!interval) interval = setInterval(syncNow, 15_000);
    if (!vpnTimer) vpnTimer = setInterval(checkVpn, 5_000);
  };
  const onBackground = () => {
    if (interval) clearInterval(interval);
    interval = null;
    if (vpnTimer) clearInterval(vpnTimer);
    vpnTimer = null;
  };
  const sub = AppState.addEventListener('change', (st) => {
    if (st === 'active') return onActive();
    onBackground();
    // iOS может остановить приложение сразу после ухода в фон: отложенная запись на диск не успела бы
    if (st === 'background' || st === 'inactive') flushStorage();
  });
  onActive();
  return () => {
    sub.remove();
    onBackground();
    if (kickTimer) clearTimeout(kickTimer);
    kickTimer = null;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
    syncHooks.kick = () => {};
  };
}
