import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { API_URL } from './config';
import { errorText, opKey, request, type Op } from './net';
import { fileStorage } from './storage';
import { shortDate, toISODate } from './dates';
import { nextOpen } from './recur';
import { DEFAULT_REMINDERS, migrateRules } from './remind';
import * as M from './mock';
import { normTitle } from './dupes';
import { daysBetween, shiftIso } from './span';
import type { PlansAnswer } from './plans';
import {
  emptyFilters,
  NICK_RULE,
  canRemoveMember,
  type Activity,
  type ChangeDraft,
  type Gender,
  type GroupCategory,
  type ThemePref, type MicMode,
  type DraftItem,
  type Group,
  type ID,
  type Idea,
  type Topic,
  type ReminderRule,
  type ReminderSettings,
  type Task,
  type TaskReminderOverride,
  type User,
  type WatchFilters,
  type WatchItem,
  type Wish,
} from './types';

import { uid } from './ids';
export { uid };
const code = () => {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => a[Math.floor(Math.random() * a.length)]).join('');
};

export type Undo = { label: string; restore: () => void; at: number };

/** Состояние карточки (bottom sheet) */
export type Card =
  | {
      source: 'voice' | 'manual' | 'edit';
      transcript?: string;
      items: DraftItem[];
      editing: boolean;
    }
  | { source: 'voice'; transcript: string; changes: ChangeDraft[] }
  | { source: 'voice'; transcript: string; plans: PlansAnswer }
  | {
      source: 'voice';
      transcript: string;
      problem: 'notUnderstood' | 'silence' | 'unknownPerson' | 'notFound' | 'offline' | 'server' | 'micDenied' | 'info';
      person?: string;
      query?: string;
      /** техническая причина — видна под текстом ошибки */
      detail?: string;
    };

export type VoicePhase = 'idle' | 'recording' | 'processing';
export type TasksView = 'list' | 'day' | 'week' | 'month' | 'year';

/** Меню действий по долгому нажатию */
export type MenuAction = { label: string; danger?: boolean; onPress: () => void };
export type Menu = { title: string; actions: MenuAction[] };

export type NickStatus = 'free' | 'taken' | 'invalid' | 'same';

/** Без адреса сервера приложение работает в демо-режиме на выдуманных данных — для работы над дизайном */
export const DEMO = !API_URL;

/** Я: публичный профиль плюс то, что видно только мне */
export type Me = User & { email?: string | null; hasPassword?: boolean; vk?: boolean };

export type Revs = { groups: Record<ID, number>; owners: Record<ID, number> };
const emptyRevs = (): Revs => ({ groups: {}, owners: {} });

/** Модуль синхронизации подключается сюда при запуске (чтобы не было циклического импорта) */
export const syncHooks = { kick: () => {} };

type State = {
  me: Me | null;
  /** Токен входа на сервер */
  session: { token: string } | null;
  /** Изменения, ещё не отправленные на сервер (офлайн-очередь) */
  outbox: Op[];
  /** Какие ревизии групп и людей уже скачаны */
  revs: Revs;
  /** offline — последняя попытка связи с сервером не удалась */
  net: 'ok' | 'offline';
  users: User[];
  groups: Group[];
  currentGroupId: ID | null;
  tasks: Task[];
  wishes: Wish[];
  watch: WatchItem[];
  /** Идеи: мои темы и темы, которые мне открыли другие (только чтение) */
  topics: Topic[];
  ideas: Idea[];
  /** Какие ревизии идей людей уже скачаны (строки сервера) */
  ideaRevs: Record<ID, string>;
  /** Открытая на экране тема: голос кладёт идеи в неё */
  voiceTopicId: ID | null;
  /** Открытый план большого дела: голос добавляет подзадачи в него */
  voiceParentId: ID | null;
  overrides: Record<ID, TaskReminderOverride>;
  reminders: ReminderSettings;
  watchFilters: WatchFilters;
  wishPersonId: ID | null;
  undo: Undo | null;
  card: Card | null;
  groupSheet: boolean;
  voice: VoicePhase;
  tasksView: TasksView;
  menu: Menu | null;
  /** Выбранный день календаря — общий для экрана «Дела» и ответа ассистента */
  calendarDate: string;
  theme: ThemePref;
  micMode: MicMode;
  /** Лента активности: что сделали другие (свежие первыми) */
  activity: Activity[];
  /** id последней записи ленты, которую человек уже видел (для точки на колокольчике) */
  activitySeen: string;
  /** Аккаунт, из которого вышли: при входе снова данные остаются на месте */
  lastMe: User | null;
};

export type Profile = { name: string; nick: string; gender: Gender | null };

type Actions = {
  /** Демо-режим без сервера */
  demoLogin: () => void;
  demoRegister: (name: string) => void;
  /** Вход на сервер прошёл: сохраняем токен, данные придут синхронизацией */
  signIn: (token: string, me: Me) => void;
  logout: () => void;
  /** null — удалено, иначе текст ошибки */
  deleteAccount: () => Promise<string | null>;
  /** В очередь на сервер */
  queue: (ops: Op[]) => void;
  setNet: (n: 'ok' | 'offline') => void;
  setName: (name: string) => void;
  /** null — сохранено, иначе текст ошибки */
  setNick: (nick: string) => string | null;
  /** Имя, ник и пол разом. null — сохранено, иначе текст ошибки */
  saveProfile: (p: Profile) => Promise<string | null>;
  setTheme: (t: ThemePref) => void;
  setMicMode: (m: MicMode) => void;
  /** Добавить свежие записи ленты (с сервера) */
  mergeActivity: (list: Activity[]) => void;
  markActivitySeen: () => void;

  selectGroup: (id: ID) => void;
  createGroup: (name: string, category?: GroupCategory) => void;
  setGroupCategory: (id: ID, category: GroupCategory) => void;
  /** null — вступили, иначе текст ошибки */
  joinGroup: (code: string) => Promise<string | null>;
  renameGroup: (id: ID, name: string) => void;
  leaveGroup: (id: ID) => void;

  /** Сохранить карточку. Возвращает тему первой идеи (куда перейти после сохранения) */
  saveItems: (items: DraftItem[]) => { ideaTopicId?: ID | null };
  applyChanges: (changes: ChangeDraft[]) => void;
  /** occ — дата повтора: у серии отмечается только этот раз */
  toggleTask: (id: ID, occ?: string) => void;
  /** occ — удалить только этот повтор серии */
  deleteTask: (id: ID, occ?: string) => void;
  /** Завершить серию: больше не повторять после этой даты (включительно) */
  endSeries: (id: ID, lastDate: string) => void;
  deleteWish: (id: ID) => void;
  toggleWish: (id: ID) => void;
  toggleWatched: (id: ID) => void;
  deleteWatch: (id: ID) => void;
  /** Идеи: удалить идею, тему (вместе с её идеями), переименовать / открыть группам */
  deleteIdea: (id: ID) => void;
  deleteTopic: (id: ID) => void;
  updateTopic: (id: ID, patch: Partial<Pick<Topic, 'title' | 'groupIds'>>) => void;
  /** Новая тема; если такая уже есть — её id */
  createTopic: (title: string) => ID | null;
  setVoiceTopic: (id: ID | null) => void;
  setVoiceParent: (id: ID | null) => void;

  setReminders: (p: Partial<ReminderSettings>) => void;
  setOverride: (taskId: ID, o: TaskReminderOverride | undefined) => void;

  setWatchFilters: (f: WatchFilters) => void;
  setWishPerson: (id: ID | null) => void;

  setCard: (c: Card | null) => void;
  setGroupSheet: (v: boolean) => void;
  setVoice: (v: VoicePhase) => void;
  setTasksView: (v: TasksView) => void;
  clearUndo: () => void;
  setMenu: (m: Menu | null) => void;
  setCalendarDate: (iso: string) => void;
  /** Назначить / снять админа — только создатель группы */
  setAdmin: (groupId: ID, userId: ID, admin: boolean) => void;
  /** Исключить участника — создатель и админы (см. canRemoveMember) */
  removeMember: (groupId: ID, userId: ID) => void;
  /** Проверка ника: на сервере — GET /nick/check; в демо — среди известных людей */
  checkNick: (nick: string) => Promise<NickStatus>;
};

/** Данные аккаунта — стираются при выходе */
const emptyData = () => ({
  me: null as Me | null,
  session: null as State['session'],
  outbox: [] as Op[],
  revs: emptyRevs(),
  users: [] as User[],
  groups: [] as Group[],
  currentGroupId: null as ID | null,
  tasks: [] as Task[],
  wishes: [] as Wish[],
  watch: [] as WatchItem[],
  topics: [] as Topic[],
  ideas: [] as Idea[],
  ideaRevs: {} as Record<ID, string>,
  overrides: {} as Record<ID, TaskReminderOverride>,
  wishPersonId: null as ID | null,
  lastMe: null as User | null,
  activity: [] as Activity[],
  activitySeen: '',
});

const initial: State = {
  ...emptyData(),
  net: 'ok',
  reminders: DEFAULT_REMINDERS,
  watchFilters: emptyFilters,
  undo: null,
  card: null,
  groupSheet: false,
  voice: 'idle',
  tasksView: 'list',
  menu: null,
  calendarDate: toISODate(new Date()),
  voiceTopicId: null,
  voiceParentId: null,
  theme: 'system',
  micMode: 'tap',
};

/** Отметить (или снять отметку) у одного повтора серии */
function toggleOcc(t: Task, occ: string | null, done: boolean): Task {
  if (!occ) return t;
  const set = new Set(t.doneDates ?? []);
  if (done) set.add(occ);
  else set.delete(occ);
  // Храним только недавние отметки: старше года — не нужны
  const yearAgo = toISODate(new Date(Date.now() - 366 * 86400000));
  return { ...t, doneDates: [...set].filter((d) => d >= yearAgo).sort() };
}
/** Конец не раньше начала: дата конца — только если позже даты, время конца — если есть начало или это многодневное */
function cleanEnd<T extends Pick<Task, 'date' | 'time' | 'endDate' | 'endTime'>>(t: T): T {
  let endDate = t.endDate && t.date && t.endDate > t.date ? t.endDate : null;
  // «С 22 до 01» в тот же день — значит, конец ночью следующего дня
  if (!endDate && t.date && t.time && t.endTime && t.endTime < t.time) endDate = shiftIso(t.date, 1);
  const endTime = t.endTime && (endDate || (t.time && t.endTime > t.time)) ? t.endTime : null;
  return { ...t, endDate, endTime };
}

/** Перенос голосом меняет только начало — конец едет на столько же (длительность не теряется) */
function keepDuration(old: Task, next: Task, p: { date?: string | null; time?: string | null; endDate?: string | null; endTime?: string | null }): Task {
  const out = { ...next };
  if (p.date !== undefined && p.endDate === undefined && old.date && old.endDate && next.date) out.endDate = shiftIso(old.endDate, daysBetween(old.date, next.date));
  const multi = !!old.endDate && !!old.date && old.endDate > old.date;
  if (p.time !== undefined && p.endTime === undefined && !multi && old.time && old.endTime && next.time) {
    const m = (x: string) => Number(x.slice(0, 2)) * 60 + Number(x.slice(3));
    const e = m(old.endTime) - m(old.time) + m(next.time);
    out.endTime = e < 24 * 60 ? `${String(Math.floor(e / 60)).padStart(2, '0')}:${String(e % 60).padStart(2, '0')}` : null;
  }
  return out;
}

/** План перенесли на другую дату — подзадачи с датами сдвигаются на столько же дней */
function shiftChildren(before: Task[], after: Task[]): Task[] {
  const old = new Map(before.map((t) => [t.id, t]));
  const delta = new Map<ID, number>();
  for (const t of after) {
    const o = old.get(t.id);
    if (o && o !== t && !t.parentId && o.date && t.date && o.date !== t.date) delta.set(t.id, daysBetween(o.date, t.date));
  }
  if (!delta.size) return after;
  return after.map((t) => {
    const n = t.parentId ? delta.get(t.parentId) : undefined;
    if (!n || !t.date) return t;
    // Подзадачу, которую поправили в той же карточке, не трогаем
    if (old.get(t.id) !== t) return t;
    return { ...t, date: shiftIso(t.date, n), endDate: shiftIso(t.endDate, n) };
  });
}

/** Все подзадачи плана сделаны — план отмечается сам; подзадачу вернули — план снова открыт */
function syncParent(tasks: Task[], parentId: ID | null | undefined): Task[] {
  if (!parentId) return tasks;
  const kids = tasks.filter((t) => t.parentId === parentId);
  if (!kids.length) return tasks;
  const all = kids.every((t) => t.doneAt);
  return tasks.map((t) => {
    if (t.id !== parentId || t.repeat) return t;
    if (all && !t.doneAt) return { ...t, doneAt: new Date().toISOString() };
    if (!all && t.doneAt) return { ...t, doneAt: null };
    return t;
  });
}

/** Моя тема с таким названием (без учёта регистра и знаков) */
const ownTopic = (topics: Topic[], meId: ID, title: string) => topics.find((t) => t.ownerId === meId && normTitle(t.title) === normTitle(title));

const lastDone = (t: Task) => (t.doneDates?.length ? t.doneDates[t.doneDates.length - 1] : null);

export const useStore = create<State & Actions>()(
  persist((set, get) => {
  const withUndo = (label: string, before: Partial<State>) =>
    set({ undo: { label, at: Date.now(), restore: () => set({ ...before, undo: null }) } });

  return {
    ...initial,

    demoLogin: () => set({ ...emptyData(), me: M.ME, users: M.USERS, groups: M.GROUPS, currentGroupId: 'g1', tasks: M.TASKS, wishes: M.WISHES, watch: M.WATCH }),
    demoRegister: (name) => set({ ...emptyData(), me: { id: M.ME.id, name: name.trim() || M.ME.name }, users: [] }),
    signIn: (token, me) => {
      set({ ...emptyData(), session: { token }, me, users: [me], card: null, undo: null });
      syncHooks.kick();
    },
    // Выход стирает данные с телефона: они хранятся на сервере и вернутся при входе
    logout: () => set({ ...emptyData(), card: null, undo: null, groupSheet: false, menu: null }),
    deleteAccount: async () => {
      if (!DEMO) {
        try {
          await request('/me', { method: 'DELETE', token: get().session?.token });
        } catch (e) {
          return errorText(e);
        }
      }
      get().logout();
      return null;
    },
    queue: (ops) => {
      if (DEMO || !get().session || !ops.length) return;
      // Новая правка той же записи заменяет прежнюю, ещё не отправленную
      const keys = new Set(ops.map(opKey).filter(Boolean));
      const outbox = [...get().outbox.filter((o) => !keys.has(opKey(o))), ...ops];
      set({ outbox });
      syncHooks.kick();
    },
    setNet: (net) => get().net !== net && set({ net }),
    setName: (name) => {
      const me = get().me;
      if (!me) return;
      const next = { ...me, name };
      set({ me: next, users: get().users.map((u) => (u.id === me.id ? next : u)) });
    },

    setNick: (raw) => {
      const me = get().me;
      if (!me) return 'Нет аккаунта';
      const nick = raw.trim().replace(/^@/, '');
      if (!NICK_RULE.test(nick)) return 'От 3 до 20 символов: буквы, цифры, «_» и «.»';
      // Заглушка проверки уникальности: среди известных пользователей. На сервере — уникальный индекс по lower(nick).
      const taken = get().users.some((u) => u.id !== me.id && u.nick?.toLowerCase() === nick.toLowerCase());
      if (taken) return 'Этот никнейм занят';
      const next = { ...me, nick };
      set({ me: next, users: get().users.map((u) => (u.id === me.id ? next : u)) });
      return null;
    },

    saveProfile: async ({ name, nick: rawNick, gender }) => {
      const me = get().me;
      if (!me) return 'Нет аккаунта';
      const nick = rawNick.trim().replace(/^@/, '');
      if (!DEMO) {
        // Профиль сохраняем сразу на сервере: ник должен быть уникальным
        try {
          const { results } = await request<{ results: { ok: boolean; message?: string; me?: Me }[] }>('/ops', {
            token: get().session?.token,
            body: { ops: [{ op: 'profile', name: name.trim() || me.name, nick: nick || null, gender }] },
          });
          const r = results[0];
          if (!r?.ok || !r.me) return r?.message ?? 'Не удалось сохранить';
          const next = { ...me, ...r.me };
          set({ me: next, users: get().users.map((u) => (u.id === me.id ? { ...u, ...r.me } : u)) });
          return null;
        } catch (e) {
          return errorText(e);
        }
      }
      const nickChanged = nick.toLowerCase() !== (me.nick ?? '').toLowerCase();
      if (nickChanged && nick) {
        if (!NICK_RULE.test(nick)) return 'От 3 до 20 символов: буквы, цифры, «_» и «.»';
        const taken = get().users.some((u) => u.id !== me.id && u.nick?.toLowerCase() === nick.toLowerCase());
        if (taken) return 'Этот никнейм занят';
      }
      const next: Me = { ...me, name: name.trim() || me.name, nick: nick || undefined, gender: gender ?? undefined };
      set({ me: next, users: get().users.map((u) => (u.id === me.id ? next : u)) });
      return null;
    },
    setTheme: (theme) => set({ theme }),
    setMicMode: (micMode) => set({ micMode }),
    mergeActivity: (list) => {
      if (!list.length) return;
      const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const byId = new Map([...get().activity, ...list].map((a) => [a.id, a]));
      const activity = [...byId.values()].filter((a) => a.at >= monthAgo).sort((a, b) => b.id.localeCompare(a.id)).slice(0, 200);
      // Первая загрузка на этом телефоне: старое не считаем новым
      set({ activity, ...(!get().activitySeen && { activitySeen: activity[0]?.id ?? '' }) });
    },
    markActivitySeen: () => set({ activitySeen: get().activity[0]?.id ?? get().activitySeen }),

    selectGroup: (id) => set({ currentGroupId: id }),
    createGroup: (name, category = 'other') => {
      const me = get().me!;
      // Код приглашения придумывает сервер — появится после синхронизации
      const g: Group = { id: uid(), name: name.trim(), category, inviteCode: DEMO ? code() : '', memberIds: [me.id], ownerId: me.id, adminIds: [] };
      set({ groups: [...get().groups, g], currentGroupId: g.id });
      get().queue([{ op: 'group.create', group: { id: g.id, name: g.name, category } }]);
    },
    joinGroup: async (c) => {
      const codeIn = c.trim().toUpperCase();
      if (DEMO) {
        if (codeIn.length !== 6) return 'Код не подошёл';
        const me = get().me!;
        const g: Group = { id: uid(), name: 'Группа ' + codeIn, category: 'other', inviteCode: codeIn, memberIds: ['u2', me.id], ownerId: 'u2', adminIds: [] };
        set({ groups: [...get().groups, g], currentGroupId: g.id });
        return null;
      }
      try {
        const { results } = await request<{ results: { ok: boolean; message?: string; group?: Group }[] }>('/ops', {
          token: get().session?.token,
          body: { ops: [{ op: 'group.join', code: codeIn }] },
        });
        const r = results[0];
        if (!r?.ok || !r.group) return r?.message ?? 'Код не подошёл';
        const g = r.group;
        set({ groups: [...get().groups.filter((x) => x.id !== g.id), g], currentGroupId: g.id });
        syncHooks.kick();
        return null;
      } catch (e) {
        return errorText(e);
      }
    },
    setGroupCategory: (id, category) => {
      set({ groups: get().groups.map((g) => (g.id === id ? { ...g, category } : g)) });
      get().queue([{ op: 'group.update', id, category }]);
    },
    renameGroup: (id, name) => {
      set({ groups: get().groups.map((g) => (g.id === id ? { ...g, name } : g)) });
      get().queue([{ op: 'group.update', id, name }]);
    },
    leaveGroup: (id) => {
      // Если уходит создатель, группа переходит первому админу, иначе первому участнику.
      // Пустая группа удаляется вместе с делами и «Смотреть» — это делает сервер.
      const { groups: all, tasks, watch } = get();
      const groups = all.filter((g) => g.id !== id);
      set({
        groups,
        tasks: tasks.filter((t) => t.groupId !== id),
        watch: watch.filter((w) => w.groupId !== id),
        // Хотелки личные — при выходе из группы остаются
        currentGroupId: get().currentGroupId === id ? (groups[0]?.id ?? null) : get().currentGroupId,
      });
      get().queue([{ op: 'group.leave', id }]);
    },

    saveItems: (items) => {
      const { me, currentGroupId } = get();
      if (!me) return {};
      const now = new Date().toISOString();
      let { tasks, wishes, watch, overrides, topics, ideas } = get();
      const tasksBefore = tasks;
      let ideaTopicId: ID | null | undefined;
      // Новая тема из карточки создаётся один раз, даже если её назвали у нескольких идей
      const topicFor = (title: string): ID => {
        const name = title.trim();
        const found = ownTopic(topics, me.id, name);
        if (found) return found.id;
        const t: Topic = { id: uid(), ownerId: me.id, title: name, groupIds: [], createdAt: now };
        topics = [...topics, t];
        return t.id;
      };
      for (const it of items) {
        if (it.type === 'task') {
          const { mine, shared, repeat, ...data } = it.data;
          // Повтор без даты не бывает; повторяющееся дело не отмечается целиком
          const rep = data.date ? (repeat ?? null) : null;
          const fields = cleanEnd({ ...data, repeat: rep, ...(shared !== undefined && { reminders: shared }) });
          // Подзадача живёт в группе своего плана
          const parent = fields.parentId ? tasks.find((t) => t.id === fields.parentId && !t.parentId) : null;
          if (!parent) fields.parentId = null;
          const groupId = parent?.groupId ?? currentGroupId;
          let id = it.id;
          // Подзадачу вынули из плана или перенесли в другой — прежний план пересчитываем
          const oldParent = id ? tasks.find((t) => t.id === id)?.parentId : null;
          if (id) {
            tasks = tasks.map((t) => (t.id === id ? { ...t, ...fields, ...(rep && { doneAt: null }) } : t));
          } else if (groupId) {
            id = uid();
            tasks = [...tasks, { id, groupId, createdBy: me.id, doneAt: null, createdAt: now, ...fields }];
          }
          if (parent) tasks = syncParent(tasks, parent.id);
          if (oldParent && oldParent !== parent?.id) tasks = syncParent(tasks, oldParent);
          if (id) {
            overrides = { ...overrides };
            if (mine) overrides[id] = mine;
            else delete overrides[id];
          }
        } else if (it.type === 'wish') {
          if (it.id) wishes = wishes.map((w) => (w.id === it.id ? { ...w, ...it.data } : w));
          else wishes = [{ id: uid(), ownerId: me.id, receivedAt: null, createdAt: now, ...it.data }, ...wishes];
        } else if (it.type === 'watch') {
          if (it.id) watch = watch.map((w) => (w.id === it.id ? { ...w, ...it.data } : w));
          else if (currentGroupId)
            watch = [{ id: uid(), groupId: currentGroupId, addedBy: me.id, watchedAt: null, createdAt: now, ...it.data }, ...watch];
        } else if (it.type === 'topic') {
          const title = it.data.title.trim();
          if (it.id) topics = topics.map((t) => (t.id === it.id ? { ...t, title } : t));
          else topicFor(title);
        } else {
          const topicId = it.data.newTopic?.trim() ? topicFor(it.data.newTopic) : it.data.topicId;
          const text = it.data.title.trim();
          if (it.id) ideas = ideas.map((x) => (x.id === it.id ? { ...x, text, topicId, updatedAt: now } : x));
          else ideas = [{ id: uid(), ownerId: me.id, topicId, text, createdAt: now, updatedAt: now }, ...ideas];
          if (ideaTopicId === undefined) ideaTopicId = topicId;
        }
      }
      tasks = shiftChildren(tasksBefore, tasks);
      set({ tasks, wishes, watch, overrides, topics, ideas });
      return ideaTopicId === undefined ? {} : { ideaTopicId };
    },

    applyChanges: (changes) => {
      const before = { tasks: get().tasks, wishes: get().wishes, watch: get().watch, topics: get().topics, ideas: get().ideas };
      let { tasks, wishes, watch, topics, ideas } = before;
      const meId = get().me?.id;
      const now = new Date().toISOString();
      let deleted = 0;
      for (const ch of changes) {
        const id = ch.chosen;
        if (ch.action === 'delete') {
          deleted++;
          if (ch.type === 'task') {
            const parentId = tasks.find((t) => t.id === id)?.parentId;
            tasks = syncParent(tasks.filter((t) => t.id !== id && t.parentId !== id), parentId);
          }
          if (ch.type === 'wish') wishes = wishes.filter((w) => w.id !== id);
          if (ch.type === 'watch') watch = watch.filter((w) => w.id !== id);
          if (ch.type === 'idea') ideas = ideas.filter((x) => x.id !== id);
          continue;
        }
        // Перенос идеи в другую тему (новая тема создаётся)
        if (ch.type === 'idea') {
          const p = ch.patch ?? {};
          let topicId = p.topicId ?? null;
          if (p.newTopic?.trim() && meId) {
            const found = ownTopic(topics, meId, p.newTopic);
            if (found) topicId = found.id;
            else {
              const t: Topic = { id: uid(), ownerId: meId, title: p.newTopic.trim(), groupIds: [], createdAt: now };
              topics = [...topics, t];
              topicId = t.id;
            }
          }
          if (p.topicId !== undefined || p.newTopic) ideas = ideas.map((x) => (x.id === id ? { ...x, topicId, updatedAt: now } : x));
          continue;
        }
        const stamp = ch.action === 'mark' ? now : ch.action === 'unmark' ? null : undefined;
        const p = ch.patch ?? {};
        if (ch.type === 'task')
          tasks = tasks.map((t) =>
            t.id !== id
              ? t
              : t.repeat && stamp !== undefined
                ? // Серия: голосом отмечается ближайший раз
                  toggleOcc(t, stamp ? nextOpen(t, toISODate(new Date())) : lastDone(t), !!stamp)
                : {
                  ...t,
                  ...(p.title !== undefined && { title: p.title }),
                  ...(p.date !== undefined && { date: p.date }),
                  ...(p.time !== undefined && { time: p.time }),
                  ...(p.repeat !== undefined && { repeat: p.repeat, doneAt: null }),
                  ...(p.endDate !== undefined && { endDate: p.endDate }),
                  ...(p.endTime !== undefined && { endTime: p.endTime }),
                  ...(p.people !== undefined && { people: p.people }),
                  ...(stamp !== undefined && { doneAt: stamp }),
                },
          );
        if (ch.type === 'wish')
          wishes = wishes.map((w) =>
            w.id !== id
              ? w
              : { ...w, ...(p.title !== undefined && { title: p.title }), ...(stamp !== undefined && { receivedAt: stamp }) },
          );
        if (ch.type === 'watch')
          watch = watch.map((w) =>
            w.id !== id
              ? w
              : { ...w, ...(p.title !== undefined && { title: p.title }), ...(stamp !== undefined && { watchedAt: stamp }) },
          );
      }
      const prev = new Map(before.tasks.map((t) => [t.id, t]));
      const patchOf = new Map(changes.filter((ch) => ch.type === 'task' && ch.action === 'update').map((ch) => [ch.chosen, ch.patch ?? {}]));
      tasks = tasks.map((t) => {
        const o = prev.get(t.id);
        if (!o || o === t) return t;
        const p = patchOf.get(t.id);
        return cleanEnd(p ? keepDuration(o, t, p) : t);
      });
      tasks = shiftChildren(before.tasks, tasks);
      for (const ch of changes) if (ch.type === 'task' && (ch.action === 'mark' || ch.action === 'unmark')) tasks = syncParent(tasks, tasks.find((t) => t.id === ch.chosen)?.parentId);
      set({ tasks, wishes, watch, topics, ideas });
      if (deleted) withUndo(deleted > 1 ? `Удалено: ${deleted}` : 'Удалено', before);
    },

    toggleTask: (id, occ) => {
      const t0 = get().tasks.find((t) => t.id === id);
      if (!t0) return;
      if (t0.repeat && occ) {
        const done = !t0.doneDates?.includes(occ);
        const before = { tasks: get().tasks };
        const next = toggleOcc(t0, occ, done);
        set({ tasks: before.tasks.map((t) => (t.id === id ? next : t)) });
        // Подсказываем, когда следующий раз: строка в списке сразу переезжает на новую дату
        if (done) {
          const n = nextOpen(next, toISODate(new Date()));
          withUndo(n ? `Готово · следующий раз ${shortDate(n)}` : 'Готово · повторов больше нет', before);
        }
        return;
      }
      const toggled = get().tasks.map((t) => (t.id === id ? { ...t, doneAt: t.doneAt ? null : new Date().toISOString() } : t));
      set({ tasks: syncParent(toggled, t0.parentId) });
    },
    deleteTask: (id, occ) => {
      const before = { tasks: get().tasks };
      const t0 = before.tasks.find((t) => t.id === id);
      if (t0?.repeat && occ) {
        set({ tasks: before.tasks.map((t) => (t.id === id ? { ...t, skipDates: [...new Set([...(t.skipDates ?? []), occ])] } : t)) });
        withUndo('Удалён один раз', before);
        return;
      }
      // План удаляется вместе с подзадачами (отмена вернёт всё); удалили подзадачу — план пересчитываем
      const kids = before.tasks.filter((t) => t.parentId === id).length;
      set({ tasks: syncParent(before.tasks.filter((t) => t.id !== id && t.parentId !== id), t0?.parentId) });
      withUndo(kids ? 'План удалён вместе с подзадачами' : 'Дело удалено', before);
    },
    endSeries: (id, lastDate) => {
      const before = { tasks: get().tasks };
      const t0 = before.tasks.find((t) => t.id === id);
      // Завершить раньше первого раза — значит удалить серию целиком
      if (t0?.date && lastDate < t0.date) {
        set({ tasks: before.tasks.filter((t) => t.id !== id) });
        withUndo('Дело удалено', before);
        return;
      }
      set({
        tasks: before.tasks.map((t) => (t.id === id && t.repeat ? { ...t, repeat: { ...t.repeat, until: lastDate, count: null } } : t)),
      });
      withUndo('Повторы завершены', before);
    },
    deleteWish: (id) => {
      const before = { wishes: get().wishes };
      set({ wishes: before.wishes.filter((w) => w.id !== id) });
      withUndo('Удалено', before);
    },
    toggleWish: (id) =>
      set({ wishes: get().wishes.map((w) => (w.id === id ? { ...w, receivedAt: w.receivedAt ? null : new Date().toISOString() } : w)) }),
    toggleWatched: (id) =>
      set({ watch: get().watch.map((w) => (w.id === id ? { ...w, watchedAt: w.watchedAt ? null : new Date().toISOString() } : w)) }),
    deleteWatch: (id) => {
      const before = { watch: get().watch };
      set({ watch: before.watch.filter((w) => w.id !== id) });
      withUndo('Удалено', before);
    },

    deleteIdea: (id) => {
      const before = { ideas: get().ideas };
      set({ ideas: before.ideas.filter((x) => x.id !== id) });
      withUndo('Идея удалена', before);
    },
    deleteTopic: (id) => {
      const before = { topics: get().topics, ideas: get().ideas };
      set({ topics: before.topics.filter((t) => t.id !== id), ideas: before.ideas.filter((x) => x.topicId !== id) });
      withUndo('Тема удалена', before);
    },
    updateTopic: (id, patch) => set({ topics: get().topics.map((t) => (t.id === id ? { ...t, ...patch } : t)) }),
    createTopic: (title) => {
      const me = get().me;
      const name = title.trim();
      if (!me || !name) return null;
      const found = ownTopic(get().topics, me.id, name);
      if (found) return found.id;
      const t: Topic = { id: uid(), ownerId: me.id, title: name, groupIds: [], createdAt: new Date().toISOString() };
      set({ topics: [...get().topics, t] });
      return t.id;
    },
    setVoiceTopic: (voiceTopicId) => set({ voiceTopicId }),
    setVoiceParent: (voiceParentId) => set({ voiceParentId }),

    setReminders: (p) => set({ reminders: { ...get().reminders, ...p } }),
    setOverride: (taskId, o) => {
      const overrides = { ...get().overrides };
      if (o) overrides[taskId] = o;
      else delete overrides[taskId];
      set({ overrides });
    },

    setWatchFilters: (watchFilters) => set({ watchFilters }),
    setWishPerson: (wishPersonId) => set({ wishPersonId }),

    setCard: (card) => set({ card }),
    setGroupSheet: (groupSheet) => set({ groupSheet }),
    setVoice: (voice) => set({ voice }),
    setTasksView: (tasksView) => set({ tasksView }),
    clearUndo: () => set({ undo: null }),
    setMenu: (menu) => set({ menu }),
    setCalendarDate: (calendarDate) => set({ calendarDate }),
    setAdmin: (groupId, userId, admin) => {
      const me = get().me;
      set({
        groups: get().groups.map((g) => {
          if (g.id !== groupId || g.ownerId !== me?.id || userId === g.ownerId) return g;
          const rest = g.adminIds.filter((x) => x !== userId);
          return { ...g, adminIds: admin ? [...rest, userId] : rest };
        }),
      });
      get().queue([{ op: 'group.admin', id: groupId, userId, admin }]);
    },
    removeMember: (groupId, userId) => {
      const me = get().me;
      const g = get().groups.find((x) => x.id === groupId);
      if (!me || !g || !canRemoveMember(g, me.id, userId)) return;
      set({
        groups: get().groups.map((x) =>
          x.id === groupId
            ? { ...x, memberIds: x.memberIds.filter((m) => m !== userId), adminIds: x.adminIds.filter((m) => m !== userId) }
            : x,
        ),
        // Всё, что человек добавил в этой группе, удаляется: дела и «Смотреть».
        // Хотелки личные — остаются у него, но участникам этой группы больше не видны.
        tasks: get().tasks.filter((t) => !(t.groupId === groupId && t.createdBy === userId)),
        watch: get().watch.filter((w) => !(w.groupId === groupId && w.addedBy === userId)),
        wishPersonId: get().wishPersonId === userId ? null : get().wishPersonId,
      });
      get().queue([{ op: 'group.remove', id: groupId, userId }]);
    },
    checkNick: async (raw) => {
      const nick = raw.trim().replace(/^@/, '');
      const me = get().me;
      if (!NICK_RULE.test(nick)) return 'invalid';
      if (me?.nick?.toLowerCase() === nick.toLowerCase()) return 'same';
      if (!DEMO) {
        try {
          const r = await request<{ status: NickStatus }>(`/nick/check?nick=${encodeURIComponent(nick)}`, { token: get().session?.token });
          return r.status;
        } catch {
          return 'free'; // нет связи — окончательно проверит сервер при сохранении
        }
      }
      await new Promise((r) => setTimeout(r, 250));
      return get().users.some((u) => u.id !== me?.id && u.nick?.toLowerCase() === nick.toLowerCase()) ? 'taken' : 'free';
    },
  };
  },
  {
    name: 'kstati-state',
    version: 2,
    // Версия 2: напоминания стали строками («d1@20:00», «m60») — переносим старые правила
    migrate: (old: any, version) => {
      if (version < 2 && old) {
        const r = old.reminders;
        if (r && Array.isArray(r.rules)) {
          const rules = r.rules as ReminderRule[];
          old.reminders = {
            enabled: r.enabled ?? true,
            timed: migrateRules(rules, r.dayTime ?? '20:00', r.sameDayTime ?? '09:00'),
            allDay: migrateRules(rules.filter((x) => !x.startsWith('h')), r.dayTime ?? '20:00', r.sameDayTime ?? '09:00'),
          };
        }
        if (old.overrides) {
          old.overrides = Object.fromEntries(
            Object.entries(old.overrides as Record<string, ReminderRule[]>).map(([k, v]) => [k, migrateRules(v, r?.dayTime ?? '20:00', r?.sameDayTime ?? '09:00')]),
          );
        }
      }
      return old;
    },
    storage: createJSONStorage(() => fileStorage),
    // Сохраняем данные и настройки; экранное состояние (карточки, запись, отмена) — нет
    partialize: (s) => ({
      me: s.me,
      session: s.session,
      outbox: s.outbox,
      revs: s.revs,
      lastMe: s.lastMe,
      users: s.users,
      groups: s.groups,
      currentGroupId: s.currentGroupId,
      tasks: s.tasks,
      wishes: s.wishes,
      watch: s.watch,
      topics: s.topics,
      ideas: s.ideas,
      ideaRevs: s.ideaRevs,
      overrides: s.overrides,
      reminders: s.reminders,
      tasksView: s.tasksView,
      theme: s.theme,
      micMode: s.micMode,
      activity: s.activity,
      activitySeen: s.activitySeen,
    }),
  },
  ),
);

/* Селекторы */
export const useCurrentGroup = () =>
  useStore((s) => s.groups.find((g) => g.id === s.currentGroupId) ?? null);

export function userName(users: User[], id: ID): string {
  return users.find((u) => u.id === id)?.name ?? '—';
}

/** Люди из всех моих групп, без меня, по алфавиту */
export function groupmates(s: Pick<State, 'me' | 'users' | 'groups'>): User[] {
  if (!s.me) return [];
  const ids = new Set<ID>();
  s.groups.forEach((g) => g.memberIds.forEach((m) => m !== s.me!.id && ids.add(m)));
  return s.users.filter((u) => ids.has(u.id)).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}
