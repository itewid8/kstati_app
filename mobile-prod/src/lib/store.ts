import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { API_URL } from './config';
import { errorText, failKind, opKey, request, type Op, type OpResult } from './net';
import { opsResults } from './http';
import { enqueue, sendOrQueue } from './outbox';
import {
  migrateQuarantine,
  quarantineAccept,
  quarantineReject,
  quarantineSupersede,
  quarantineTake,
  type Quarantined,
} from './quarantine';
import { fileStorage, flushStorage } from './storage';
import { shortDate, toISODate } from './dates';
import { nextOpen } from './recur';
import { DEFAULT_REMINDERS, migrateRules } from './remind';
import * as M from './mock';
import { applyChangeList, ownTopic, saveDraftItems, skipOcc, syncParent, toggleOcc, type Lists, type SavedIds } from './edits';
import { captureList, isEmptyUndo, revertList, type ListUndo } from './undo';
import type { Revs } from './remote';
import type { PlansAnswer } from './plans';
import {
  emptyFilters,
  NICK_RULE,
  canRemoveMember,
  type Activity,
  type ChangeDraft,
  type Gender,
  type PersonColor,
  type GroupCategory,
  type ThemePref, type MicMode,
  type DraftItem,
  type Group,
  type ID,
  type Idea,
  type Me,
  type Topic,
  type ReminderRule,
  type ReminderSettings,
  type Task,
  type TaskDraft,
  type TaskReminderOverride,
  type User,
  type VoiceLang,
  type WatchFilters,
  type WatchItem,
  type Wish,
} from './types';

import { uid } from './ids';
import { PERSONAL } from './visibility';
export { uid };
const code = () => {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => a[Math.floor(Math.random() * a.length)]).join('');
};

/** Сообщение внизу экрана: с отменой (после удаления) или просто текст (restore нет) */
export type Undo = { label: string; restore?: () => void; at: number };

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

export type { Me };

/** Счётчик голосовых команд за сегодня (GET /voice/quota и поле left в ответе /voice) */
export type VoiceQuota = { limit: number; used: number; left: number };

/** Черновик для окна дела, пришедший из голоса или «Изменить»: id — правка существующего */
export type EditorSeed = TaskDraft & { id?: ID };

export type { Revs, SavedIds };
const emptyRevs = (): Revs => ({ groups: {}, owners: {} });

/** Модуль синхронизации подключается сюда при запуске (чтобы не было циклического импорта) */
export const syncHooks = { kick: () => {} };

/**
 * Правки «как с сервера»: синхронизация не превращает их в операции очереди.
 * Так применяется ответ /sync и то, что сервер делает сам (исключение участника удаляет его записи в группе)
 */
let remoteDepth = 0;
export const isApplyingRemote = () => remoteDepth > 0;
export function applyRemote(fn: () => void): void {
  remoteDepth++;
  try {
    fn();
  } finally {
    remoteDepth--;
  }
}

type State = {
  me: Me | null;
  /** Токен входа на сервер */
  session: { token: string } | null;
  /**
   * Сервер отверг токен (401) и мы вышли из аккаунта: экраны переходят на вход.
   * Сбрасывается при входе и при обычном выходе
   */
  authLost: boolean;
  /** Изменения, ещё не отправленные на сервер (офлайн-очередь). Сохраняется на диск сразу при постановке */
  outbox: Op[];
  /** Сколько правок ждут отправки (outbox.length): для значка «не отправлено» в контейнерах */
  pendingCount: number;
  /**
   * Неотправленные правки аккаунтов, из которых вышли (сами или по 401): вернутся в очередь при входе в тот же аккаунт.
   * Иначе выход без связи (или истёкший токен) стирал бы правки
   */
  parked: Record<ID, Op[]>;
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
  /** Вкладки людей в календаре: чьи дела скрыты (дело скрыто, если скрыты все его люди) */
  calendarHidden: ID[];
  /**
   * Свёрнутые разделы: списка дел («past», «today»…) и экранов «wishes.list», «wishes.gifted», «watch.queue»,
   * «watch.watched», «ideas.topics», «ideas.archive». Нет ключа — раздел открыт
   */
  collapsedSections: string[];
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
  /** Язык распознавания голоса */
  voiceLang: VoiceLang;
  /** Голосовые команды за сегодня; null — ещё не знаем */
  voiceQuota: VoiceQuota | null;
  /** День (YYYY-MM-DD), за который известен voiceQuota: лимит действует только в этот день */
  voiceQuotaDay: string;
  /**
   * Операции, которые сервер окончательно отверг — убраны из очереди, хранятся для разбора (последние 50).
   * Отказ с временным кодом повторяется один раз после удачной синхронизации (quarantine.ts)
   */
  quarantine: readonly Quarantined[];
  /** Уровень API сервера (GET /health); null — ещё не проверяли */
  serverApi: number | null;
  /** Черновик для окна дела (голос → «Изменить»); окно забирает его при открытии */
  editorSeed: EditorSeed | null;
};

export type Profile = { name: string; nick: string; gender: Gender | null };

type Actions = {
  /** Демо-режим без сервера */
  demoLogin: () => void;
  demoRegister: (name: string) => void;
  /** Вход на сервер прошёл: сохраняем токен, данные придут синхронизацией */
  signIn: (token: string, me: Me) => void;
  logout: () => void;
  /** Сервер отверг токен (401): выход с флагом authLost — экраны переводят на вход */
  authExpired: () => void;
  /** null — удалено, иначе текст ошибки */
  deleteAccount: () => Promise<string | null>;
  /** В очередь на сервер (сразу на диск) */
  queue: (ops: Op[]) => void;
  /** Синхронизация: сервер ответил на эти операции — убрать из очереди */
  outboxSent: (done: readonly Op[]) => void;
  /** Синхронизация: сервер окончательно отверг операцию (code — код его ошибки) */
  quarantineOp: (op: Op, code: string) => void;
  /** Синхронизация, после удачного pull: один раз повторить отвергнутое с временным кодом */
  retryQuarantined: () => void;
  setNet: (n: 'ok' | 'offline') => void;
  setName: (name: string) => void;
  /** null — сохранено, иначе текст ошибки */
  setNick: (nick: string) => string | null;
  /** Имя, ник и пол разом. null — сохранено, иначе текст ошибки */
  saveProfile: (p: Profile) => Promise<string | null>;
  /** Иконка: свой цвет (null — подбирать самому) и символ (null — первая буква имени). Сразу на экране, на сервер — следом */
  setLook: (patch: { color?: PersonColor | null; avatar?: string | null }) => Promise<string | null>;
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
  /** Мой режим в группе: true — «Только выбранные», false — «Все, кроме скрытых» (lib/visibility.ts) */
  setShareMode: (groupId: ID, selectOnly: boolean) => void;
  /** Видимость моих дел: показать или скрыть группе (null — по режиму группы) */
  setTaskShare: (ids: readonly ID[], groupId: ID, visible: boolean | null) => void;

  /**
   * Сохранить карточку. Возвращает id сохранённых записей (новых — новые id, изменённых — прежние) по порядку;
   * [] — ничего не сохранено (например, новое дело без текущей группы и без плана).
   * ideaTopicId — тема первой идеи (куда перейти после сохранения)
   */
  saveItems: (items: DraftItem[]) => SavedIds;
  applyChanges: (changes: ChangeDraft[]) => void;
  /** occ — дата повтора: у серии отмечается только этот раз */
  toggleTask: (id: ID, occ?: string) => void;
  /** occ — удалить только этот повтор серии */
  deleteTask: (id: ID, occ?: string) => void;
  /** Завершить серию: больше не повторять после этой даты (включительно) */
  endSeries: (id: ID, lastDate: string) => void;
  deleteWish: (id: ID) => void;
  /** Своя хотелка: получил / не получил */
  setReceived: (id: ID, received: boolean) => void;
  /**
   * Подарок чужой хотелки — сразу на сервер (отказ надо показать). null — сохранено или ждёт связи в очереди,
   * иначе текст ошибки; при отказе отметка откатывается
   */
  giftWish: (ownerId: ID, id: ID, gifted: boolean) => Promise<string | null>;
  toggleWatched: (id: ID) => void;
  deleteWatch: (id: ID) => void;
  /** Идеи: удалить идею, тему (вместе с её идеями), переименовать / открыть группам */
  deleteIdea: (id: ID) => void;
  deleteTopic: (id: ID) => void;
  updateTopic: (id: ID, patch: Partial<Pick<Topic, 'title' | 'groupIds'>>) => void;
  /** Своя тема: в архив / из архива */
  archiveTopic: (id: ID, archived: boolean) => void;
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
  /** Вкладка человека в календаре: скрыть / показать его дела */
  toggleCalendarPerson: (id: ID) => void;
  setVoiceLang: (lang: VoiceLang) => void;
  /** Счётчик команд за сегодня; день запоминается сам (voiceQuotaDay) */
  setVoiceQuota: (q: VoiceQuota | null) => void;
  setServerApi: (api: number | null) => void;
  setEditorSeed: (seed: EditorSeed | null) => void;
  toggleSection: (key: string) => void;
  /** Короткое сообщение внизу экрана без кнопки */
  notice: (label: string) => void;
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
  pendingCount: 0,
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
  calendarHidden: [] as ID[],
  voiceQuota: null as VoiceQuota | null,
  voiceQuotaDay: '',
  editorSeed: null as EditorSeed | null,
  quarantine: [] as readonly Quarantined[],
});

const initial: State = {
  ...emptyData(),
  authLost: false,
  net: 'ok',
  parked: {},
  reminders: DEFAULT_REMINDERS,
  watchFilters: emptyFilters,
  undo: null,
  card: null,
  groupSheet: false,
  voice: 'idle',
  // При запуске — общая неделя, раскрыт сегодняшний день
  tasksView: 'week',
  collapsedSections: ['past'],
  menu: null,
  calendarDate: toISODate(new Date()),
  voiceTopicId: null,
  voiceParentId: null,
  theme: 'system',
  micMode: 'tap',
  voiceLang: 'ru-RU',
  serverApi: null,
};

export const useStore = create<State & Actions>()(
  persist((set, get) => {
  type UndoLists = Omit<Lists, 'overrides'>;
  /**
   * «ОТМЕНИТЬ» после действия: before — списки до него. Запоминаются только затронутые записи,
   * отмена сливает их с текущими списками по id (чужие правки, пришедшие за это время, остаются)
   */
  const withUndo = (label: string, before: Partial<UndoLists>) => {
    const after = get();
    const plan: { [K in keyof UndoLists]?: ListUndo<UndoLists[K][number]> } = {};
    if (before.tasks) plan.tasks = captureList(before.tasks, after.tasks);
    if (before.wishes) plan.wishes = captureList(before.wishes, after.wishes);
    if (before.watch) plan.watch = captureList(before.watch, after.watch);
    if (before.topics) plan.topics = captureList(before.topics, after.topics);
    if (before.ideas) plan.ideas = captureList(before.ideas, after.ideas);
    const restore = () => {
      const cur = get();
      const patch: Partial<UndoLists> = {};
      if (plan.tasks && !isEmptyUndo(plan.tasks)) patch.tasks = revertList(cur.tasks, plan.tasks);
      if (plan.wishes && !isEmptyUndo(plan.wishes)) patch.wishes = revertList(cur.wishes, plan.wishes);
      if (plan.watch && !isEmptyUndo(plan.watch)) patch.watch = revertList(cur.watch, plan.watch);
      if (plan.topics && !isEmptyUndo(plan.topics)) patch.topics = revertList(cur.topics, plan.topics);
      if (plan.ideas && !isEmptyUndo(plan.ideas)) patch.ideas = revertList(cur.ideas, plan.ideas);
      set({ ...patch, undo: null });
    };
    set({ undo: { label, at: Date.now(), restore } });
  };

  /** Профиль на экране: и me, и запись в users */
  const patchMe = (patch: Partial<User>) => {
    const cur = get().me;
    if (!cur) return;
    set({ me: { ...cur, ...patch }, users: get().users.map((u) => (u.id === cur.id ? { ...u, ...patch } : u)) });
  };

  /** Одна операция сразу на сервер (POST /ops); ответ не того вида — NetError, как нет связи */
  const sendOp = async <R extends OpResult = OpResult>(op: Op): Promise<R> => {
    const [r] = opsResults(await request<unknown>('/ops', { token: get().session?.token, body: { ops: [op] } }), 1);
    return (r ?? { ok: false }) as R;
  };

  /** Текст отказа сервера для человека */
  const refusal = (r: OpResult | null, e: unknown) => (r ? (r.message ?? 'Не удалось сохранить') : errorText(e));

  /** В очередь: supersede — новая правка делает неактуальными ожидающие повтора отказы тех же записей */
  const pushOps = (ops: Op[], supersede: boolean) => {
    if (DEMO || !get().session || !ops.length) return;
    if (supersede) {
      const q = quarantineSupersede(get().quarantine, ops);
      if (q !== get().quarantine) set({ quarantine: q });
    }
    enqueue(ops, {
      read: () => get().outbox,
      write: (outbox) => set({ outbox, pendingCount: outbox.length }),
      // Отложенная запись (0,4 с) не успела бы, если приложение закроют сразу после правки
      persistNow: flushStorage,
      kick: () => syncHooks.kick(),
      keyOf: opKey,
    });
  };

  /** Неотправленное текущего аккаунта — в parked (вернётся при входе в тот же аккаунт) */
  const parkOutbox = (): Record<ID, Op[]> => {
    const { me, session, outbox, parked } = get();
    if (!me || !session || !outbox.length) return parked;
    return { ...parked, [me.id]: [...(parked[me.id] ?? []), ...outbox] };
  };

  return {
    ...initial,

    demoLogin: () => set({ ...emptyData(), authLost: false, me: M.ME, users: M.USERS, groups: M.GROUPS, currentGroupId: 'g1', tasks: M.TASKS, wishes: M.WISHES, watch: M.WATCH }),
    demoRegister: (name) => set({ ...emptyData(), authLost: false, me: { id: M.ME.id, name: name.trim() || M.ME.name }, users: [] }),
    signIn: (token, me) => {
      // Правки, не отправленные до выхода из этого же аккаунта, снова в очередь
      const { [me.id]: outbox = [], ...parked } = get().parked;
      set({ ...emptyData(), authLost: false, session: { token }, me, users: [me], card: null, undo: null, outbox, pendingCount: outbox.length, parked });
      if (outbox.length) flushStorage();
      syncHooks.kick();
    },
    // Выход стирает данные с телефона: они хранятся на сервере и вернутся при входе. Неотправленное — в parked
    logout: () => {
      set({ ...emptyData(), parked: parkOutbox(), authLost: false, card: null, undo: null, groupSheet: false, menu: null });
      flushStorage();
    },
    authExpired: () => {
      set({ ...emptyData(), parked: parkOutbox(), authLost: true, card: null, undo: null, groupSheet: false, menu: null });
      flushStorage();
    },
    deleteAccount: async () => {
      const id = get().me?.id;
      if (!DEMO) {
        try {
          await request('/me', { method: 'DELETE', token: get().session?.token });
        } catch (e) {
          return errorText(e);
        }
      }
      get().logout();
      // Аккаунта больше нет — его неотправленные правки некуда отправлять
      if (id && get().parked[id]) {
        const { [id]: _gone, ...parked } = get().parked;
        set({ parked });
      }
      return null;
    },
    queue: (ops) => pushOps(ops, true),
    outboxSent: (done) => {
      const outbox = get().outbox.filter((o) => !done.includes(o));
      set({ outbox, pendingCount: outbox.length, quarantine: quarantineAccept(get().quarantine, done) });
    },
    quarantineOp: (op, code) => set({ quarantine: quarantineReject(get().quarantine, op, code, new Date().toISOString()) }),
    retryQuarantined: () => {
      const { list, ops } = quarantineTake(get().quarantine, get().outbox);
      if (list !== get().quarantine) set({ quarantine: list });
      pushOps(ops, false);
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
      const nickChanged = nick.toLowerCase() !== (me.nick ?? '').toLowerCase();
      if (!DEMO) {
        const op: Op = { op: 'profile', name: name.trim() || me.name, nick: nick || null, gender };
        type Saved = OpResult & { me?: Me };
        if (nickChanged) {
          // Новый ник сохраняем сразу на сервере: он должен быть уникальным. Нет связи — форма остаётся с введённым
          // и текстом ошибки, «Сохранить» можно нажать ещё раз
          try {
            const r = await sendOp<Saved>(op);
            if (!r.ok || !r.me) return refusal(r, null);
            patchMe(r.me);
            return null;
          } catch (e) {
            return errorText(e);
          }
        }
        // Ник прежний — проверять нечего: правка сразу на экране, без связи уходит в очередь и не теряется
        const prev: Partial<User> = { name: me.name, nick: me.nick, gender: me.gender };
        patchMe({ name: name.trim() || me.name, nick: nick || undefined, gender: gender ?? undefined });
        const res = await sendOrQueue<Saved>({
          send: () => sendOp<Saved>(op),
          classify: failKind,
          enqueue: () => get().queue([op]),
          rollback: () => patchMe(prev),
        });
        if (res.kind === 'rejected') return refusal(res.result, res.error);
        if (res.kind === 'sent' && res.result.me) patchMe(res.result.me);
        return null;
      }
      if (nickChanged && nick) {
        if (!NICK_RULE.test(nick)) return 'От 3 до 20 символов: буквы, цифры, «_» и «.»';
        const taken = get().users.some((u) => u.id !== me.id && u.nick?.toLowerCase() === nick.toLowerCase());
        if (taken) return 'Этот никнейм занят';
      }
      const next: Me = { ...me, name: name.trim() || me.name, nick: nick || undefined, gender: gender ?? undefined };
      set({ me: next, users: get().users.map((u) => (u.id === me.id ? next : u)) });
      return null;
    },
    setLook: async (patch) => {
      const me = get().me;
      if (!me) return 'Нет аккаунта';
      type Look = { color?: PersonColor; avatar?: string };
      const apply = (look: Look) => {
        const cur = get().me;
        if (!cur) return;
        set({ me: { ...cur, ...look }, users: get().users.map((u) => (u.id === cur.id ? { ...u, ...look } : u)) });
      };
      const prev: Look = { color: me.color, avatar: me.avatar };
      const next: Look = {};
      if (patch.color !== undefined) next.color = patch.color ?? undefined;
      if (patch.avatar !== undefined) next.avatar = patch.avatar?.trim() || undefined;
      apply(next);
      if (DEMO) return null;
      // Отказ сервера — откат; нет связи — в очередь (раньше откатывалось, и выбранный цвет терялся)
      const op: Op = { op: 'profile', ...patch };
      const res = await sendOrQueue({ send: () => sendOp(op), classify: failKind, enqueue: () => get().queue([op]), rollback: () => apply(prev) });
      return res.kind === 'rejected' ? refusal(res.result, res.error) : null;
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
      const me = get().me;
      if (!me) return;
      // Код приглашения придумывает сервер — появится после синхронизации
      const g: Group = { id: uid(), name: name.trim(), category, inviteCode: DEMO ? code() : '', memberIds: [me.id], ownerId: me.id, adminIds: [] };
      set({ groups: [...get().groups, g], currentGroupId: g.id });
      get().queue([{ op: 'group.create', group: { id: g.id, name: g.name, category } }]);
    },
    joinGroup: async (c) => {
      const codeIn = c.trim().toUpperCase();
      if (DEMO) {
        if (codeIn.length !== 6) return 'Код не подошёл';
        const me = get().me;
        if (!me) return 'Нет аккаунта';
        const g: Group = { id: uid(), name: 'Группа ' + codeIn, category: 'other', inviteCode: codeIn, memberIds: ['u2', me.id], ownerId: 'u2', adminIds: [] };
        set({ groups: [...get().groups, g], currentGroupId: g.id });
        return null;
      }
      // Вступление проверяет сервер — нужен ответ сразу. Нет связи — окно остаётся с кодом и текстом ошибки
      try {
        const r = await sendOp<OpResult & { group?: Group }>({ op: 'group.join', code: codeIn });
        if (!r.ok || !r.group) return r.message ?? 'Код не подошёл';
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
      const { groups: all, tasks, watch, me } = get();
      const groups = all.filter((g) => g.id !== id);
      // Свои дела остаются в личном календаре; чужие, видные только этой группе, пропадают.
      // Как с сервера: удалять на сервере ничего не нужно
      applyRemote(() =>
        set({
          groups,
          tasks: tasks.filter((t) => t.createdBy === me?.id || (t.in ?? [t.groupId]).some((g) => g !== id)),
          watch: watch.filter((w) => w.groupId !== id),
          // Хотелки личные — при выходе из группы остаются
          currentGroupId: get().currentGroupId === id ? (groups[0]?.id ?? PERSONAL) : get().currentGroupId,
        }),
      );
      get().queue([{ op: 'group.leave', id }]);
    },
    setShareMode: (groupId, selectOnly) => {
      const me = get().me;
      if (!me) return;
      set({
        groups: get().groups.map((g) => {
          if (g.id !== groupId) return g;
          const rest = (g.selectOnly ?? []).filter((m) => m !== me.id);
          return { ...g, selectOnly: selectOnly ? [...rest, me.id] : rest };
        }),
      });
      get().queue([{ op: 'group.mode', id: groupId, selectOnly }]);
    },
    setTaskShare: (ids, groupId, visible) => {
      const me = get().me;
      const set_ = new Set(ids);
      // Подзадачи — вместе с планом
      for (const t of get().tasks) if (t.parentId && set_.has(t.parentId)) set_.add(t.id);
      set({
        tasks: get().tasks.map((t) => {
          if (!set_.has(t.id) || t.createdBy !== me?.id) return t;
          const { [groupId]: _, ...rest } = t.share ?? {};
          return { ...t, share: visible === null ? rest : { ...rest, [groupId]: visible } };
        }),
      });
    },

    saveItems: (items) => {
      const { me, currentGroupId } = get();
      if (!me) return [];
      const { tasks, wishes, watch, overrides, topics, ideas } = get();
      const res = saveDraftItems({ tasks, wishes, watch, overrides, topics, ideas }, items, {
        meId: me.id,
        currentGroupId,
        now: new Date().toISOString(),
      });
      set(res.lists);
      return res.ids;
    },

    applyChanges: (changes) => {
      const { tasks, wishes, watch, topics, ideas, overrides } = get();
      const res = applyChangeList({ tasks, wishes, watch, topics, ideas, overrides }, changes, {
        meId: get().me?.id,
        now: new Date().toISOString(),
      });
      const { overrides: nextOverrides, ...lists } = res.lists;
      set({ ...lists, ...(nextOverrides !== overrides && { overrides: nextOverrides }) });
      if (res.deleted) withUndo(res.deleted > 1 ? `Удалено: ${res.deleted}` : 'Удалено', { tasks, wishes, watch, topics, ideas });
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
        set({ tasks: before.tasks.map((t) => (t.id === id ? skipOcc(t, occ) : t)) });
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
    setReceived: (id, received) => {
      const meId = get().me?.id;
      set({
        wishes: get().wishes.map((w) => {
          if (w.id !== id || w.ownerId !== meId || !!w.receivedAt === received) return w;
          if (received) return { ...w, receivedAt: new Date().toISOString() };
          // Сняли «получил» — сервер снимает подарок у всех; «от кого» тоже уходит
          const { giftedBy: _by, giftedAt: _at, ...rest } = w;
          return { ...rest, receivedAt: null };
        }),
      });
    },
    giftWish: async (ownerId, id, gifted) => {
      const me = get().me;
      if (!me || ownerId === me.id) return 'Нельзя';
      const find = () => get().wishes.find((w) => w.ownerId === ownerId && w.id === id);
      const w0 = find();
      if (!w0) return 'Хотелка не найдена';
      if (gifted && w0.giftedBy && w0.giftedBy !== me.id) return 'Уже подарили';
      if (!gifted && w0.giftedBy !== me.id) return w0.giftedBy ? 'Нельзя' : null;
      const put = (patch: Pick<Wish, 'giftedBy' | 'giftedAt'>) =>
        set({
          wishes: get().wishes.map((w) => {
            if (w.ownerId !== ownerId || w.id !== id) return w;
            const { giftedBy: _by, giftedAt: _at, ...rest } = w;
            return { ...rest, ...(patch.giftedBy && { giftedBy: patch.giftedBy }), ...(patch.giftedAt && { giftedAt: patch.giftedAt }) };
          }),
        });
      const prev = { giftedBy: w0.giftedBy, giftedAt: w0.giftedAt };
      put(gifted ? { giftedBy: me.id, giftedAt: new Date().toISOString() } : {});
      if (DEMO) return null;
      // Сразу на сервер, чтобы показать отказ (уже подарили). Нет связи — отметка остаётся, операция в очереди
      const op: Op = { op: 'wish.gift', ownerId, id, gifted };
      const res = await sendOrQueue({ send: () => sendOp(op), classify: failKind, enqueue: () => get().queue([op]), rollback: () => put(prev) });
      if (res.kind === 'sent') syncHooks.kick();
      if (res.kind !== 'rejected') return null;
      const r = res.result;
      return r?.error === 'already_gifted' ? 'Уже подарили' : r?.error === 'forbidden' ? 'Нельзя' : refusal(r, res.error);
    },
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
    archiveTopic: (id, archived) => {
      const meId = get().me?.id;
      set({
        topics: get().topics.map((t) =>
          t.id !== id || t.ownerId !== meId || !!t.archivedAt === archived ? t : { ...t, archivedAt: archived ? new Date().toISOString() : null },
        ),
      });
    },
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
    toggleCalendarPerson: (id) => {
      const cur = get().calendarHidden;
      set({ calendarHidden: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
    },
    setVoiceLang: (voiceLang) => set({ voiceLang }),
    setVoiceQuota: (voiceQuota) => set({ voiceQuota, voiceQuotaDay: voiceQuota ? toISODate(new Date()) : '' }),
    setServerApi: (serverApi) => get().serverApi !== serverApi && set({ serverApi }),
    setEditorSeed: (editorSeed) => set({ editorSeed }),
    toggleSection: (key) => {
      const cur = get().collapsedSections;
      set({ collapsedSections: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key] });
    },
    clearUndo: () => set({ undo: null }),
    notice: (label) => set({ undo: { label, at: Date.now() } }),
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
      // Всё, что человек добавил в этой группе, удаляется: дела и «Смотреть». Удаляет их сервер (group.remove) —
      // поэтому правка «как с сервера»: синхронизация не ставит в очередь item.delete на каждую запись.
      // Хотелки личные — остаются у него, но участникам этой группы больше не видны.
      applyRemote(() =>
        set({
          groups: get().groups.map((x) =>
            x.id === groupId
              ? { ...x, memberIds: x.memberIds.filter((m) => m !== userId), adminIds: x.adminIds.filter((m) => m !== userId) }
              : x,
          ),
          // Его дела, видные только этой группе, пропадают (у него они остаются)
          tasks: get().tasks.filter((t) => !(t.createdBy === userId && (t.in ?? [t.groupId]).every((g) => g === groupId))),
          watch: get().watch.filter((w) => !(w.groupId === groupId && w.addedBy === userId)),
          wishPersonId: get().wishPersonId === userId ? null : get().wishPersonId,
        }),
      );
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
    version: 4,
    // Версия 2: напоминания стали строками («d1@20:00», «m60») — переносим старые правила.
    // Версия 3: одна закладка calendarPerson заменена списком скрытых calendarHidden (новые поля берутся из начального состояния)
    // Версия 4: карантин — записи с кодом отказа (раньше просто операции)
    migrate: (old: unknown, version) => {
      if (!isRecord(old)) return old as State & Actions;
      if (version < 4) old.quarantine = migrateQuarantine(old.quarantine);
      if (version < 3) delete old.calendarPerson;
      if (version < 2) {
        const r = isRecord(old.reminders) ? old.reminders : null;
        const dayTime = typeof r?.dayTime === 'string' ? r.dayTime : '20:00';
        const sameDayTime = typeof r?.sameDayTime === 'string' ? r.sameDayTime : '09:00';
        if (r && Array.isArray(r.rules)) {
          const rules = r.rules.filter((x): x is ReminderRule => typeof x === 'string');
          old.reminders = {
            enabled: typeof r.enabled === 'boolean' ? r.enabled : true,
            timed: migrateRules(rules, dayTime, sameDayTime),
            allDay: migrateRules(rules.filter((x) => !x.startsWith('h')), dayTime, sameDayTime),
          };
        }
        if (isRecord(old.overrides)) {
          old.overrides = Object.fromEntries(
            Object.entries(old.overrides).map(([k, v]) => [
              k,
              migrateRules(Array.isArray(v) ? v.filter((x): x is ReminderRule => typeof x === 'string') : [], dayTime, sameDayTime),
            ]),
          );
        }
      }
      return old as State & Actions;
    },
    storage: createJSONStorage(() => fileStorage),
    // pendingCount не сохраняем — считаем по сохранённой очереди
    merge: (saved, current) => {
      const next: State & Actions = { ...current, ...(isRecord(saved) ? (saved as Partial<State>) : {}) };
      return { ...next, pendingCount: next.outbox.length };
    },
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
      theme: s.theme,
      micMode: s.micMode,
      collapsedSections: s.collapsedSections,
      activity: s.activity,
      activitySeen: s.activitySeen,
      calendarHidden: s.calendarHidden,
      voiceLang: s.voiceLang,
      quarantine: s.quarantine,
      parked: s.parked,
    }),
  },
  ),
);

/** Значение — объект с полями (для разбора сохранённых данных) */
function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

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
