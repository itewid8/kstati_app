/**
 * Ответ POST /sync → данные приложения. Чистый модуль (без Expo и хранилища): его проверяют тесты.
 *
 *  - Мапперы (toTask, toWatch, toWish, toTopic, toIdea, toGroup, toUser, toMe) разбирают ответ сервера
 *    без слепых приведений типов: неизвестные поля отбрасываются, недостающие получают значения по умолчанию,
 *    запись без id пропускается.
 *  - mergePull сливает ответ с тем, что на телефоне, и возвращает только поменявшиеся поля хранилища.
 *    Неизменённые записи остаются прежними объектами, а неизменённые списки — прежними массивами:
 *    иначе каждые 15 секунд перерисовывались бы все экраны.
 */
import { reuse, reuseList } from './merge';
import type { Op } from './ops';
import {
  CATEGORIES,
  PERSON_COLORS,
  type Gender,
  type Genre,
  type Group,
  type GroupCategory,
  type ID,
  type Idea,
  type Kind,
  type Me,
  type Origin,
  type PersonColor,
  type ReminderSettings,
  type Repeat,
  type Task,
  type TaskReminderOverride,
  type Topic,
  type User,
  type WatchItem,
  type Wish,
} from './types';
import { PERSONAL } from './visibility';

/** Какие ревизии групп и людей уже скачаны */
export type Revs = { groups: Record<ID, number>; owners: Record<ID, number> };

/* ---------- разбор значений ---------- */

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : {});
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const strOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const strs = (v: unknown): string[] => list(v).filter((x): x is string => typeof x === 'string');
const nums = (v: unknown): number[] => list(v).filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
const oneOf = <T extends string>(v: unknown, all: readonly T[]): T | null => (typeof v === 'string' && (all as readonly string[]).includes(v) ? (v as T) : null);
const record = <T>(v: unknown, item: (x: unknown) => T | null): Record<string, T> => {
  const out: Record<string, T> = {};
  for (const [k, x] of Object.entries(obj(v))) {
    const m = item(x);
    if (m !== null) out[k] = m;
  }
  return out;
};

const FREQS = ['day', 'week', 'month', 'year'] as const;
const KINDS: readonly Kind[] = ['movie', 'series', 'cartoon', 'show', 'standup'];
const GENRES: readonly Genre[] = ['comedy', 'drama', 'action', 'thriller', 'horror', 'scifi', 'detective', 'romance', 'adventure', 'documentary'];
const ORIGINS: readonly Origin[] = ['ru', 'foreign'];
const GENDERS: readonly Gender[] = ['m', 'f'];

export function toRepeat(v: unknown): Repeat | null {
  const r = obj(v);
  const freq = oneOf(r.freq, FREQS);
  if (!freq) return null;
  const every = numOrNull(r.every);
  return {
    freq,
    every: every && every >= 1 ? every : 1,
    ...(Array.isArray(r.weekdays) && { weekdays: nums(r.weekdays) }),
    ...(Array.isArray(r.monthDays) && { monthDays: nums(r.monthDays) }),
    ...(Array.isArray(r.months) && { months: nums(r.months) }),
    ...('until' in r && { until: strOrNull(r.until) }),
    ...('count' in r && { count: numOrNull(r.count) }),
  };
}

/** Дело с сервера; groupId — группа, под которой оно пришло (если в записи нет своей) */
export function toTask(v: unknown, groupId: ID): Task | null {
  const r = obj(v);
  const id = strOrNull(r.id);
  if (!id) return null;
  return {
    id,
    groupId: str(r.groupId, groupId),
    title: str(r.title),
    date: strOrNull(r.date),
    time: strOrNull(r.time),
    note: str(r.note),
    createdBy: str(r.createdBy),
    doneAt: strOrNull(r.doneAt),
    createdAt: str(r.createdAt),
    repeat: toRepeat(r.repeat),
    doneDates: strs(r.doneDates),
    skipDates: strs(r.skipDates),
    reminders: Array.isArray(r.reminders) ? strs(r.reminders) : null,
    endDate: strOrNull(r.endDate),
    endTime: strOrNull(r.endTime),
    people: strs(r.people),
    parentId: strOrNull(r.parentId),
    ...(r.only === true && { only: true }),
    ...(r.share !== undefined && r.share !== null && { share: record(r.share, (x) => (typeof x === 'boolean' ? x : null)) }),
    ...(Array.isArray(r.in) && { in: strs(r.in) }),
  };
}

export function toWatch(v: unknown, groupId: ID): WatchItem | null {
  const r = obj(v);
  const id = strOrNull(r.id);
  if (!id) return null;
  return {
    id,
    groupId: str(r.groupId, groupId),
    title: str(r.title),
    kind: oneOf(r.kind, KINDS),
    genres: strs(r.genres).filter((g): g is Genre => (GENRES as readonly string[]).includes(g)),
    origin: oneOf(r.origin, ORIGINS),
    year: numOrNull(r.year),
    addedBy: str(r.addedBy),
    watchedAt: strOrNull(r.watchedAt),
    createdAt: str(r.createdAt),
  };
}

/** Хотелка; ownerId — человек, под которым она пришла */
export function toWish(v: unknown, ownerId: ID): Wish | null {
  const r = obj(v);
  const id = strOrNull(r.id);
  if (!id) return null;
  const giftedBy = strOrNull(r.giftedBy);
  const giftedAt = strOrNull(r.giftedAt);
  return {
    id,
    ownerId: str(r.ownerId, ownerId),
    title: str(r.title),
    note: str(r.note),
    link: str(r.link),
    receivedAt: strOrNull(r.receivedAt),
    createdAt: str(r.createdAt),
    ...(giftedBy && { giftedBy }),
    ...(giftedAt && { giftedAt }),
  };
}

export function toTopic(v: unknown, ownerId: ID): Topic | null {
  const r = obj(v);
  const id = strOrNull(r.id);
  if (!id) return null;
  return {
    id,
    ownerId: str(r.ownerId, ownerId),
    title: str(r.title),
    groupIds: strs(r.groupIds),
    createdAt: str(r.createdAt),
    // Нет поля (старый сервер) — не трогаем архив; null — не в архиве
    ...('archivedAt' in r && { archivedAt: strOrNull(r.archivedAt) }),
  };
}

export function toIdea(v: unknown, ownerId: ID): Idea | null {
  const r = obj(v);
  const id = strOrNull(r.id);
  if (!id) return null;
  const createdAt = str(r.createdAt);
  return {
    id,
    ownerId: str(r.ownerId, ownerId),
    topicId: strOrNull(r.topicId),
    text: str(r.text),
    createdAt,
    updatedAt: str(r.updatedAt, createdAt),
  };
}

export function toGroup(v: unknown): Group | null {
  const r = obj(v);
  const id = strOrNull(r.id);
  if (!id) return null;
  return {
    id,
    name: str(r.name),
    category: oneOf<GroupCategory>(r.category, CATEGORIES) ?? 'other',
    inviteCode: str(r.inviteCode),
    memberIds: strs(r.memberIds),
    ownerId: str(r.ownerId),
    adminIds: strs(r.adminIds),
    ...(Array.isArray(r.selectOnly) && { selectOnly: strs(r.selectOnly) }),
  };
}

const toColor = (v: unknown): PersonColor | null =>
  oneOf(v, PERSON_COLORS) ?? (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? (v as PersonColor) : null);

export function toUser(v: unknown): User | null {
  const r = obj(v);
  const id = strOrNull(r.id);
  if (!id) return null;
  const nick = strOrNull(r.nick);
  const gender = oneOf(r.gender, GENDERS);
  const color = toColor(r.color);
  const avatar = strOrNull(r.avatar);
  return {
    id,
    name: str(r.name),
    ...(nick && { nick }),
    ...(gender && { gender }),
    ...(color && { color }),
    ...(avatar && { avatar }),
  };
}

/** Мой профиль: только поля, которые сервер прислал (остальное на телефоне не трогаем) */
export function toMe(v: unknown): Partial<Me> {
  const r = obj(v);
  const u = toUser(v);
  return {
    ...(u ?? {}),
    ...('email' in r && { email: strOrNull(r.email) }),
    ...(typeof r.hasPassword === 'boolean' && { hasPassword: r.hasPassword }),
    ...(typeof r.vk === 'boolean' && { vk: r.vk }),
  };
}

export function toReminderSettings(v: unknown): ReminderSettings | null {
  const r = obj(v);
  if (!Array.isArray(r.timed) && !Array.isArray(r.allDay)) return null;
  return { enabled: typeof r.enabled === 'boolean' ? r.enabled : true, timed: strs(r.timed), allDay: strs(r.allDay) };
}

const mapList = <T>(v: unknown, key: ID, map: (x: unknown, key: ID) => T | null): T[] =>
  list(v).flatMap((x) => {
    const m = map(x, key);
    return m ? [m] : [];
  });

/* ---------- ответ /sync ---------- */

export type SyncResponse = {
  me: Partial<Me>;
  groups: Group[];
  users: User[];
  revs: Revs;
  /** Дела и «Смотреть» групп, где ревизия поменялась */
  items: Record<ID, { tasks: Task[]; watch: WatchItem[] }>;
  /** API 3: все видимые мне дела одним списком (только если что-то поменялось); нет — дела не менялись или старый сервер */
  tasks?: Task[];
  wishes: Record<ID, Wish[]>;
  /** Личные напоминания; null — сервер их ещё не знает */
  prefs: { reminders: ReminderSettings | null; overrides: Record<ID, TaskReminderOverride> } | null;
  /** Нет — сервер не знает про идеи (старая версия) */
  ideaRevs?: Record<ID, string>;
  notes: Record<ID, { topics: Topic[]; ideas: Idea[] }>;
};

const revNum = (x: unknown) => numOrNull(x);

export function parseSync(v: unknown): SyncResponse {
  const r = obj(v);
  const revs = obj(r.revs);
  const items: SyncResponse['items'] = {};
  for (const [gid, raw] of Object.entries(obj(r.items))) {
    const all = list(raw);
    items[gid] = {
      tasks: mapList(all.filter((x) => obj(x).type === 'task'), gid, toTask),
      watch: mapList(all.filter((x) => obj(x).type === 'watch'), gid, toWatch),
    };
  }
  const wishes: SyncResponse['wishes'] = {};
  for (const [owner, raw] of Object.entries(obj(r.wishes))) wishes[owner] = mapList(raw, owner, toWish);
  const notes: SyncResponse['notes'] = {};
  for (const [owner, raw] of Object.entries(obj(r.notes))) {
    const n = obj(raw);
    notes[owner] = { topics: mapList(n.topics, owner, toTopic), ideas: mapList(n.ideas, owner, toIdea) };
  }
  const p = r.prefs === null || r.prefs === undefined ? null : obj(r.prefs);
  return {
    me: toMe(r.me),
    groups: mapList(r.groups, '', toGroup),
    users: mapList(r.users, '', toUser),
    revs: { groups: record(revs.groups, revNum), owners: record(revs.owners, revNum) },
    items,
    ...(Array.isArray(r.tasks) && { tasks: mapList(r.tasks, PERSONAL, toTask) }),
    wishes,
    prefs: p && { reminders: toReminderSettings(p.reminders), overrides: record(p.overrides, (x) => (Array.isArray(x) ? strs(x) : null)) },
    ...(r.ideaRevs !== undefined && r.ideaRevs !== null && { ideaRevs: record(r.ideaRevs, strOrNull) }),
    notes,
  };
}

/* ---------- слияние ---------- */

/** Группы и люди, по которым есть неотправленные правки: их записи с сервера не берём */
export function pendingScopes(outbox: readonly Op[], meId: string | undefined) {
  const groups = new Set<ID>();
  const owners = new Set<ID>();
  let ideas = false;
  for (const o of outbox) {
    if (o.op.startsWith('topic.') || o.op.startsWith('idea.')) {
      ideas = true;
      continue;
    }
    if (o.op === 'task.put') groups.add(o.task.groupId);
    else if (o.op === 'watch.put') groups.add(o.watch.groupId);
    else if (o.op === 'item.delete') groups.add(o.groupId);
    else if (o.op === 'wish.put' || o.op === 'wish.delete') {
      if (meId) owners.add(meId);
    }
    // Подарок меняет хотелку владельца, а не группу
    else if (o.op === 'wish.gift') owners.add(o.ownerId);
    else if ('id' in o && typeof o.id === 'string') groups.add(o.id);
  }
  return { groups, owners, ideaOwners: ideas && meId ? new Set([meId]) : new Set<ID>() };
}

/** Что из хранилища нужно для слияния */
export type LocalData = {
  me: Me | null;
  users: User[];
  groups: Group[];
  currentGroupId: ID | null;
  tasks: Task[];
  watch: WatchItem[];
  wishes: Wish[];
  topics: Topic[];
  ideas: Idea[];
  revs: Revs;
  ideaRevs: Record<ID, string>;
  reminders: ReminderSettings;
  overrides: Record<ID, TaskReminderOverride>;
  wishPersonId: ID | null;
  outbox: readonly Op[];
};

export type PullPatch = Partial<Omit<LocalData, 'outbox' | 'me'>> & { me?: Me };

/**
 * Слить ответ /sync с телефоном. patch — только поля, которые действительно поменялись (пусто — setState не нужен).
 * uploadPrefs — сервер ещё не знает личных напоминаний: их надо отправить
 */
export function mergePull(s: LocalData, res: SyncResponse): { patch: PullPatch; uploadPrefs: boolean } {
  // Правки, сделанные за время запроса, не затираем: эти группы заберём в следующий раз
  const pending = pendingScopes(s.outbox, s.me?.id);
  const ownerIds = new Set(Object.keys(res.revs.owners));

  // Группы, созданные на телефоне и ещё не отправленные, сохраняем
  const serverGroupIds = new Set(res.groups.map((g) => g.id));
  const localOnly = s.groups.filter((g) => !serverGroupIds.has(g.id) && s.outbox.some((o) => o.op === 'group.create' && o.group.id === g.id));
  const groups = [...res.groups, ...localOnly];
  // Записи живых групп (включая только что созданные на телефоне) остаются
  const alive = new Set(groups.map((g) => g.id));
  const currentGroupId = alive.has(s.currentGroupId ?? '') || s.currentGroupId === PERSONAL ? s.currentGroupId : (groups[0]?.id ?? PERSONAL);

  const fromServer = Object.entries(res.items).filter(([gid]) => !pending.groups.has(gid));
  const replaced = new Set(fromServer.map(([gid]) => gid));
  const keep = <T extends { groupId: ID }>(local: T[]) => local.filter((x) => alive.has(x.groupId) && !replaced.has(x.groupId));
  const watch = [...keep(s.watch), ...fromServer.flatMap(([, x]) => x.watch)];
  // Дела. Сервер API 3 (есть ревизия «@me») шлёт все видимые дела одним списком, когда что-то поменялось.
  // Есть неотправленные правки дел — свой список не трогаем, а ревизию личного календаря сбрасываем: заберём заново
  const v3 = PERSONAL in res.revs.groups;
  const pendingTasks = v3 && s.outbox.some((o) => o.op === 'task.put' || (o.op === 'item.delete' && !s.watch.some((w) => w.id === o.id)));
  const tasks = !v3
    ? [...keep(s.tasks), ...fromServer.flatMap(([, x]) => x.tasks)]
    : res.tasks && !pendingTasks
      ? res.tasks
      : s.tasks;

  const wishFromServer = Object.entries(res.wishes).filter(([owner]) => !pending.owners.has(owner));
  const replacedOwners = new Set(wishFromServer.map(([o]) => o));
  const wishes = [
    ...s.wishes.filter((w) => ownerIds.has(w.ownerId) && !replacedOwners.has(w.ownerId)),
    ...wishFromServer.flatMap(([, l]) => l),
  ];

  // Ревизии: для групп с неотправленными правками оставляем старые — заберём их заново
  const revs: Revs = {
    groups: Object.fromEntries(
      Object.entries(res.revs.groups).map(([g, r]) => [g, pending.groups.has(g) || (g === PERSONAL && pendingTasks) ? (g === PERSONAL ? -1 : (s.revs.groups[g] ?? -1)) : r]),
    ),
    owners: Object.fromEntries(Object.entries(res.revs.owners).map(([o, r]) => [o, pending.owners.has(o) ? (s.revs.owners[o] ?? -1) : r])),
  };

  const merged: PullPatch = {
    users: reuseList(s.users, res.users),
    groups: reuseList(s.groups, groups),
    currentGroupId,
    tasks: reuseList(s.tasks, tasks),
    watch: reuseList(s.watch, watch),
    wishes: reuseList(s.wishes, wishes),
    revs: reuse(s.revs, revs),
    wishPersonId: s.wishPersonId && ownerIds.has(s.wishPersonId) ? s.wishPersonId : null,
  };
  if (s.me) merged.me = reuse(s.me, { ...s.me, ...res.me });
  else if (res.me.id) merged.me = { ...res.me, id: res.me.id, name: res.me.name ?? '' };

  // Идеи: люди, у которых поменялось, — заменяем целиком; людей не из моих групп — убираем.
  // Сервер ещё не знает про идеи (старая версия) — ничего не трогаем
  if (res.ideaRevs) {
    const ideaRevsIn = res.ideaRevs;
    const notesIn = Object.entries(res.notes).filter(([owner]) => !pending.ideaOwners.has(owner));
    const notesReplaced = new Set(notesIn.map(([o]) => o));
    const keepNote = (ownerId: ID) => ownerId in ideaRevsIn && !notesReplaced.has(ownerId);
    merged.topics = reuseList(s.topics, [...s.topics.filter((t) => keepNote(t.ownerId)), ...notesIn.flatMap(([, n]) => n.topics)]);
    merged.ideas = reuseList(s.ideas, [...s.ideas.filter((i) => keepNote(i.ownerId)), ...notesIn.flatMap(([, n]) => n.ideas)]);
    const ideaRevs = Object.fromEntries(
      Object.entries(ideaRevsIn).map(([o, r]) => [o, pending.ideaOwners.has(o) ? (s.ideaRevs[o] ?? '') : r]),
    );
    merged.ideaRevs = reuse(s.ideaRevs, ideaRevs);
  }

  // Личные напоминания: если сервер их ещё не знает — отправляем свои; если знает и у нас нет неотправленных правок — берём с сервера
  const pendingPrefs = s.outbox.some((o) => o.op === 'prefs');
  if (res.prefs && !pendingPrefs) {
    merged.overrides = reuse(s.overrides, res.prefs.overrides);
    if (res.prefs.reminders) merged.reminders = reuse(s.reminders, res.prefs.reminders);
  }
  const uploadPrefs = res.prefs === null && !pendingPrefs;

  // В патч — только то, что поменялось по ссылке
  const patch: PullPatch = {};
  const cur = s as unknown as Record<string, unknown>;
  const out = patch as Record<string, unknown>;
  for (const [k, v] of Object.entries(merged)) if (v !== undefined && cur[k] !== v) out[k] = v;
  return { patch, uploadPrefs };
}

/** Есть ли что применять */
export const isEmptyPatch = (p: PullPatch) => Object.keys(p).length === 0;
