export type ID = string;

export type User = {
  id: ID;
  name: string;
  /** Уникальный никнейм без @: буквы (кириллица, латиница), цифры, «_» и «.» */
  nick?: string;
  /** Пол — для правильных слов: «её дела», «добавила» */
  gender?: Gender;
};

export type Gender = 'm' | 'f';

/** «его» / «её» / «его или её» */
export const hisHer = (u?: Pick<User, 'gender'> | null) => (u?.gender === 'f' ? 'её' : u?.gender === 'm' ? 'его' : 'его или её');
/** Окончание прошедшего времени: «добавил» / «добавила» / «добавил(а)» */
export const pastEnd = (u?: Pick<User, 'gender'> | null) => (u?.gender === 'f' ? 'а' : u?.gender === 'm' ? '' : '(а)');

export type ThemePref = 'system' | 'light' | 'dark';

/** Кнопка микрофона: tap — нажать, чтобы начать, и ещё раз, чтобы закончить; hold — записывать, пока палец на кнопке */
export type MicMode = 'tap' | 'hold';

/** Цвет элемента виджета: как в теме телефона, светлый или тёмный */
export type WidgetTone = 'auto' | 'light' | 'dark';
/** Виджет на рабочем столе: микрофон и его цвет, фон (цвет и непрозрачность 0…1), цвет названий и времени */
export type WidgetPrefs = { mic: boolean; opacity: number; bg: WidgetTone; text: WidgetTone; time: WidgetTone; micTone: WidgetTone };
export const DEFAULT_WIDGET: WidgetPrefs = { mic: true, opacity: 1, bg: 'auto', text: 'auto', time: 'auto', micTone: 'auto' };

export const NICK_RULE = /^[A-Za-zА-Яа-яЁё0-9_.]{3,20}$/;

/** Категория группы: по ней ассистент понимает «мы», «наши друзья», «родители» */
export type GroupCategory = 'couple' | 'family' | 'parents' | 'friends' | 'other';
export const CATEGORY_LABEL: Record<GroupCategory, string> = {
  couple: 'Пара',
  family: 'Семья',
  parents: 'Родители',
  friends: 'Друзья',
  other: 'Другое',
};
export const CATEGORIES: GroupCategory[] = ['couple', 'family', 'parents', 'friends', 'other'];

export type Group = {
  id: ID;
  name: string;
  category: GroupCategory;
  inviteCode: string;
  memberIds: ID[];
  /** Создатель: назначает и снимает админов */
  ownerId: ID;
  /** Админы: те же права, что у создателя (приглашать, переименовывать), кроме назначения админов */
  adminIds: ID[];
};

export const canManageGroup = (g: Group, userId: ID) => g.ownerId === userId || g.adminIds.includes(userId);

/**
 * Кого может исключить userId: создатель — любого, кроме себя; админ — только обычных участников
 * (не создателя и не других админов).
 */
export const canRemoveMember = (g: Group, userId: ID, targetId: ID) => {
  if (targetId === userId || targetId === g.ownerId) return false;
  if (g.ownerId === userId) return true;
  return g.adminIds.includes(userId) && !g.adminIds.includes(targetId);
};

/** Старые правила напоминаний (до версии 2 хранилища) — нужны только для переноса настроек */
export type ReminderRule = 'week' | 'days3' | 'dayBefore' | 'sameDay' | 'h1' | 'h2' | 'h3' | 'h6';

/**
 * Одно напоминание — короткая строка (так проще хранить и проверять на сервере):
 *   m90        — за 90 минут до начала (только для дел со временем; m0 — в момент начала)
 *   d1@20:00   — за 1 день, в 20:00 (d0@09:00 — в день события в 09:00)
 *   M1@20:00   — за 1 месяц, в 20:00
 */
export type ReminderSpec = string;

/**
 * Повтор дела. Первый раз — дата дела (task.date), дальше по правилу.
 *   day   — каждые every дней
 *   week  — каждые every недель, по дням weekdays (1 = пн … 7 = вс; нет — день недели первой даты)
 *   month — каждые every месяцев, по числам monthDays (-1 = последний день; нет — число первой даты)
 *   year  — каждые every лет, в месяцы months (1…12) по числам monthDays
 * Конец: until (включительно) или count повторов; нет обоих — бессрочно.
 */
export type Repeat = {
  freq: 'day' | 'week' | 'month' | 'year';
  every: number;
  weekdays?: number[];
  monthDays?: number[];
  months?: number[];
  until?: string | null;
  count?: number | null;
};

export type Task = {
  id: ID;
  groupId: ID;
  title: string;
  date: string | null; // YYYY-MM-DD
  time: string | null; // HH:MM
  /** Описание — видно только в карточке дела */
  note?: string;
  createdBy: ID;
  doneAt: string | null;
  createdAt: string;
  /** Повтор; у повторяющегося дела doneAt не используется — отмечаются отдельные разы */
  repeat?: Repeat | null;
  /** Даты повторов, отмеченных «сделано» */
  doneDates?: string[];
  /** Даты повторов, удалённых по одному («только этот раз») */
  skipDates?: string[];
  /** Общие напоминания для всех участников группы; null/нет — у каждого свои настройки по умолчанию */
  reminders?: ReminderSpec[] | null;
  /** Только в приложении: дата конкретного повтора, если это «развёрнутый» повтор серии */
  occ?: string;
};

/** Личные напоминания для дела (только мои): undefined — как у всех, [] — не напоминать */
export type TaskReminderOverride = ReminderSpec[];

export type Wish = {
  id: ID;
  /** Хотелки принадлежат человеку, а не группе: во всех его группах видны одни и те же */
  ownerId: ID;
  title: string;
  note: string;
  link: string;
  /** Отметка «подарили» — ставит владелец */
  receivedAt: string | null;
  createdAt: string;
};

export type Kind = 'movie' | 'series' | 'cartoon' | 'show' | 'standup';
export type Genre =
  | 'comedy'
  | 'drama'
  | 'action'
  | 'thriller'
  | 'horror'
  | 'scifi'
  | 'detective'
  | 'romance'
  | 'adventure'
  | 'documentary';
export type Origin = 'ru' | 'foreign';
export type Freshness = 'new' | 'old';

export type WatchItem = {
  id: ID;
  groupId: ID;
  title: string;
  kind: Kind | null;
  genres: Genre[];
  origin: Origin | null;
  year: number | null;
  addedBy: ID;
  watchedAt: string | null;
  createdAt: string;
};

export type WatchFilters = {
  kind: Kind[];
  genre: Genre[];
  origin: Origin[];
  fresh: Freshness[];
};

export const emptyFilters: WatchFilters = { kind: [], genre: [], origin: [], fresh: [] };

/** Напоминания по умолчанию: отдельно для дел со временем и на весь день (как в Google Календаре) */
export type ReminderSettings = {
  enabled: boolean;
  timed: ReminderSpec[];
  allDay: ReminderSpec[];
};

export const KIND_LABEL: Record<Kind, string> = {
  movie: 'фильм',
  series: 'сериал',
  cartoon: 'мультфильм',
  show: 'шоу',
  standup: 'стендап',
};

export const GENRE_LABEL: Record<Genre, string> = {
  comedy: 'комедия',
  drama: 'драма',
  action: 'боевик',
  thriller: 'триллер',
  horror: 'ужасы',
  scifi: 'фантастика',
  detective: 'детектив',
  romance: 'мелодрама',
  adventure: 'приключения',
  documentary: 'документальное',
};

export const ORIGIN_LABEL: Record<Origin, string> = { ru: 'наше', foreign: 'зарубежное' };
export const FRESH_LABEL: Record<Freshness, string> = { new: 'новое', old: 'не новое' };


/** Запись ленты активности (приходит с сервера, GET /activity) */
export type ActivityKind =
  | 'task.add'
  | 'task.done'
  | 'task.undone'
  | 'task.edit'
  | 'task.delete'
  | 'watch.add'
  | 'watch.done'
  | 'watch.delete'
  | 'wish.add'
  | 'wish.done'
  | 'wish.delete'
  | 'member.join'
  | 'member.leave'
  | 'member.remove'
  | 'group.rename';

export type Activity = {
  scope: string;
  /** «время#случайное» — по нему порядок и «что уже видели» */
  id: string;
  at: string;
  actor: ID;
  kind: ActivityKind;
  groupId?: ID;
  itemId?: ID;
  title?: string;
  date?: string | null;
  time?: string | null;
  fields?: string[];
  target?: ID;
};

/* Черновики для карточки подтверждения */
export type TaskDraft = {
  title: string;
  date: string | null;
  time: string | null;
  note?: string;
  repeat?: Repeat | null;
  /** Мои личные напоминания (undefined — как у всех) */
  mine?: TaskReminderOverride;
  /** Общие напоминания группы (null — у каждого свои по умолчанию) */
  shared?: ReminderSpec[] | null;
};
export type WishDraft = { title: string; note: string; link: string };
export type WatchDraft = {
  title: string;
  kind: Kind | null;
  genres: Genre[];
  origin: Origin | null;
  year: number | null;
};

export type DraftItem =
  | { key: string; type: 'task'; id?: ID; force?: boolean; data: TaskDraft }
  | { key: string; type: 'wish'; id?: ID; force?: boolean; data: WishDraft }
  | { key: string; type: 'watch'; id?: ID; force?: boolean; data: WatchDraft };

export type ItemType = DraftItem['type'];

/* Голосовые изменения существующих записей */
export type ChangeAction = 'update' | 'mark' | 'unmark' | 'delete';

export type ChangePatch = Partial<TaskDraft> & Partial<WishDraft> & Partial<WatchDraft>;

export type ChangeDraft = {
  key: string;
  action: ChangeAction;
  type: ItemType;
  /** Подходящие записи, лучшие первыми (до 3). Если их несколько, человек выбирает. */
  candidates: ID[];
  chosen: ID;
  /** Для update: только изменяемые поля */
  patch?: ChangePatch;
};

/* Вопросы о планах: «какие у нас планы на выходные» */
export type PlansScope =
  | { kind: 'us' } // «мы», «у нас» — группа категории «Пара»
  | { kind: 'current' } // не сказано — текущая группа
  | { kind: 'category'; category: GroupCategory } // «наши друзья» — все группы категории
  | { kind: 'groups'; names: string[] } // «в Футболе» — по названию
  | { kind: 'people'; names: string[] }; // «у нас с Кариной» — самая маленькая общая группа

export type PlansQuery = { scope: PlansScope; from: string; to: string; query: string };
