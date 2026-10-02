/**
 * Синхронизация с сервером. Телефон — главный для своих правок, сервер — для общего.
 *
 * 1. Любая правка дел, «Смотреть» и своих хотелок в хранилище сама превращается в операцию
 *    (сравниваем списки до и после) и встаёт в очередь outbox. Группы и профиль ставят операции явно.
 * 2. Очередь отправляется пачкой на POST /ops; нет связи — лежит и ждёт (очередь сохраняется на телефоне).
 * 3. Когда очередь пуста — POST /sync: сервер присылает группы и людей, а записи — только там,
 *    где ревизия поменялась. Группы, по которым есть неотправленные правки, не перезаписываем.
 * Когда: при запуске, при возвращении в приложение, раз в 15 секунд, пока оно открыто, и сразу после правки.
 */
import { AppState } from 'react-native';
import { ApiError, NetError, request, type Op, type OpResult } from './net';
import { DEMO, syncHooks, useStore, type Me, type Revs } from './store';
import type { Activity, Group, ID, Idea, ReminderSettings, Task, TaskReminderOverride, Topic, User, WatchItem, Wish } from './types';

type ServerItem = (Task & { type: 'task'; updatedAt?: string }) | (WatchItem & { type: 'watch'; updatedAt?: string });
type SyncResponse = {
  me: Me;
  groups: Group[];
  users: User[];
  revs: Revs;
  items: Record<ID, ServerItem[]>;
  wishes: Record<ID, (Wish & { updatedAt?: string })[]>;
  /** Личные напоминания с сервера; null — ещё ни разу не сохраняли */
  prefs: { reminders: ReminderSettings | null; overrides: Record<ID, TaskReminderOverride> } | null;
  /** Идеи: ревизии людей и содержимое тех, у кого поменялось (чужие — только открытые нам темы) */
  ideaRevs?: Record<ID, string>;
  notes?: Record<ID, { topics: (Topic & { updatedAt?: string; kind?: string })[]; ideas: (Idea & { kind?: string })[] }>;
};

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

let applyingRemote = false;

const taskOp = (t: Task): Op => ({
  op: 'task.put',
  task: {
    id: t.id,
    groupId: t.groupId,
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
  },
});
const watchOp = (w: WatchItem): Op => ({
  op: 'watch.put',
  watch: { id: w.id, groupId: w.groupId, title: w.title, kind: w.kind, genres: w.genres, origin: w.origin, year: w.year, watchedAt: w.watchedAt },
});
const wishOp = (w: Wish): Op => ({ op: 'wish.put', wish: { id: w.id, title: w.title, note: w.note, link: w.link, receivedAt: w.receivedAt } });
const topicOp = (t: Topic): Op => ({ op: 'topic.put', topic: { id: t.id, title: t.title, groupIds: t.groupIds } });
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
  if (applyingRemote || DEMO || !s.session || s.session !== p.session) return;
  const meId = s.me?.id;
  const ops = [
    ...diff(p.tasks, s.tasks, taskOp, (t) => ({ op: 'item.delete', groupId: t.groupId, id: t.id })),
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
  const alive = new Set(s.groups.map((g) => g.id));
  const filtered = ops.filter((o) => o.op !== 'item.delete' || alive.has(o.groupId));
  if (filtered.length) s.queue(filtered);
});

/* ---------- отправка и получение ---------- */

let running: Promise<void> | null = null;
let again = false;
let failures = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

async function flush(token: string): Promise<boolean> {
  for (;;) {
    const outbox = useStore.getState().outbox;
    if (!outbox.length) return true;
    const batch = outbox.slice(0, 100);
    const { results } = await request<{ results: OpResult[] }>('/ops', { token, body: { ops: batch } });
    results.forEach((r, i) => {
      if (!r.ok) console.warn('Операция отклонена сервером', batch[i].op, r.error, r.message);
    });
    // Убираем отправленное (пока шёл запрос, в конец могли добавиться новые операции)
    const rest = useStore.getState().outbox;
    useStore.setState({ outbox: rest.filter((o) => !batch.includes(o)) });
  }
}

function pendingScopes(outbox: Op[], meId: string | undefined) {
  const groups = new Set<ID>();
  let wishes = false;
  let ideas = false;
  for (const o of outbox) {
    if (o.op.startsWith('topic.') || o.op.startsWith('idea.')) {
      ideas = true;
      continue;
    }
    if (o.op === 'task.put') groups.add(o.task.groupId);
    else if (o.op === 'watch.put') groups.add(o.watch.groupId);
    else if (o.op === 'item.delete') groups.add(o.groupId);
    else if (o.op === 'wish.put' || o.op === 'wish.delete') wishes = true;
    else if ('id' in o && typeof o.id === 'string') groups.add(o.id);
  }
  return { groups, owners: wishes && meId ? new Set([meId]) : new Set<ID>(), ideaOwners: ideas && meId ? new Set([meId]) : new Set<ID>() };
}

async function pull(token: string) {
  const s0 = useStore.getState();
  const res = await request<SyncResponse>('/sync', { token, body: { ...s0.revs, ideas: s0.ideaRevs } });
  const s = useStore.getState();
  if (s.session?.token !== token) return; // пока ждали — вышли из аккаунта
  // Правки, сделанные за время запроса, не затираем: эти группы заберём в следующий раз
  const pending = pendingScopes(s.outbox, s.me?.id);
  const groupIds = new Set(res.groups.map((g) => g.id));
  const ownerIds = new Set(Object.keys(res.revs.owners));

  const replace = <T extends { groupId: string }>(local: T[], type: 'task' | 'watch'): T[] => {
    const fromServer = Object.entries(res.items).filter(([gid]) => !pending.groups.has(gid));
    const replaced = new Set(fromServer.map(([gid]) => gid));
    const kept = local.filter((x) => groupIds.has(x.groupId) && !replaced.has(x.groupId));
    const fresh = fromServer.flatMap(([, list]) =>
      list.filter((i) => i.type === type).map(({ type: _t, updatedAt: _u, ...rest }) => rest as unknown as T),
    );
    return [...kept, ...fresh];
  };

  const wishFromServer = Object.entries(res.wishes).filter(([owner]) => !pending.owners.has(owner));
  const replacedOwners = new Set(wishFromServer.map(([o]) => o));
  const wishes = [
    ...s.wishes.filter((w) => ownerIds.has(w.ownerId) && !replacedOwners.has(w.ownerId)),
    ...wishFromServer.flatMap(([, list]) => list.map(({ updatedAt: _u, ...w }) => w as Wish)),
  ];

  // Идеи: люди, у которых поменялось, — заменяем целиком; людей не из моих групп — убираем
  const ideaRevsIn = res.ideaRevs ?? {};
  const notesIn = Object.entries(res.notes ?? {}).filter(([owner]) => !pending.ideaOwners.has(owner));
  const notesReplaced = new Set(notesIn.map(([o]) => o));
  const keepNote = (ownerId: ID) => ownerId in ideaRevsIn && !notesReplaced.has(ownerId);
  const topics = [
    ...s.topics.filter((t) => keepNote(t.ownerId)),
    ...notesIn.flatMap(([, n]) => n.topics.map(({ kind: _k, updatedAt: _u, ...t }) => t as Topic)),
  ];
  const ideas = [
    ...s.ideas.filter((i) => keepNote(i.ownerId)),
    ...notesIn.flatMap(([, n]) => n.ideas.map(({ kind: _k, ...i }) => i as Idea)),
  ];
  const ideaRevs = Object.fromEntries(
    Object.entries(ideaRevsIn).map(([o, r]) => [o, pending.ideaOwners.has(o) ? (s.ideaRevs[o] ?? '') : r]),
  );

  // Ревизии: для групп с неотправленными правками оставляем старые — заберём их заново
  const revs: Revs = {
    groups: Object.fromEntries(Object.entries(res.revs.groups).map(([g, r]) => [g, pending.groups.has(g) ? (s.revs.groups[g] ?? -1) : r])),
    owners: Object.fromEntries(Object.entries(res.revs.owners).map(([o, r]) => [o, pending.owners.has(o) ? (s.revs.owners[o] ?? -1) : r])),
  };

  // Группы, созданные на телефоне и ещё не отправленные, сохраняем
  const localOnly = s.groups.filter((g) => !groupIds.has(g.id) && s.outbox.some((o) => o.op === 'group.create' && o.group.id === g.id));
  const groups = [...res.groups, ...localOnly];
  const currentGroupId = groups.some((g) => g.id === s.currentGroupId) ? s.currentGroupId : (groups[0]?.id ?? null);

  // Личные напоминания: если сервер их ещё не знает — отправляем свои; если знает и у нас нет неотправленных правок — берём с сервера
  const pendingPrefs = s.outbox.some((o) => o.op === 'prefs');
  let prefsState: Partial<{ reminders: ReminderSettings; overrides: Record<ID, TaskReminderOverride> }> = {};
  if (res.prefs && !pendingPrefs) prefsState = { overrides: res.prefs.overrides ?? {}, ...(res.prefs.reminders && { reminders: res.prefs.reminders }) };
  const uploadPrefs = res.prefs === null && !pendingPrefs;

  applyingRemote = true;
  try {
    useStore.setState({
      ...prefsState,
      me: { ...s.me, ...res.me },
      users: res.users,
      groups,
      currentGroupId,
      tasks: replace(s.tasks, 'task'),
      watch: replace(s.watch, 'watch'),
      wishes,
      revs,
      // Сервер ещё не знает про идеи (старая версия) — ничего не трогаем
      ...(res.ideaRevs && { topics, ideas, ideaRevs }),
      wishPersonId: s.wishPersonId && ownerIds.has(s.wishPersonId) ? s.wishPersonId : null,
    });
  } finally {
    applyingRemote = false;
  }
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
  try {
    await flush(token);
    await pull(token);
    failures = 0;
    useStore.getState().setNet('ok');
    await fetchActivity();
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      // Токен больше не действует — просим войти заново
      useStore.getState().logout();
    } else if (e instanceof NetError || (e instanceof ApiError && e.status >= 500)) {
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

/** Запуск: из корневого экрана. Возвращает функцию остановки */
export function startSync(): () => void {
  if (DEMO) return () => {};
  let kickTimer: ReturnType<typeof setTimeout> | null = null;
  syncHooks.kick = () => {
    if (kickTimer) clearTimeout(kickTimer);
    kickTimer = setTimeout(syncNow, 400);
  };
  let interval: ReturnType<typeof setInterval> | null = null;
  const onActive = () => {
    syncNow();
    if (!interval) interval = setInterval(syncNow, 15_000);
  };
  const onBackground = () => {
    if (interval) clearInterval(interval);
    interval = null;
  };
  const sub = AppState.addEventListener('change', (st) => (st === 'active' ? onActive() : onBackground()));
  onActive();
  return () => {
    sub.remove();
    onBackground();
    syncHooks.kick = () => {};
  };
}
