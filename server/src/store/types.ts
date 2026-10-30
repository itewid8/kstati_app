/**
 * Данные сервера. Одна модель для двух хранилищ:
 *   memory — для разработки на Mac (данные в файле server/.data/dev.json);
 *   ydb    — YDB в Yandex Cloud через Document API (продакшен).
 */
import type { GroupCategory } from '../types.js';

export type Gender = 'm' | 'f';

/**
 * Цвет человека в календаре и на иконке: ключ палитры стикеров (mobile-prod/src/lib/colors.ts)
 * или свой цвет «#rrggbb» с полосы спектра; нет — подбирается сам
 */
export const PERSON_COLORS = ['blue', 'pink', 'green', 'yellow', 'orange', 'violet', 'teal'] as const;
export type PersonColor = (typeof PERSON_COLORS)[number] | `#${string}`;

export type User = {
  id: string;
  name: string;
  nick?: string;
  gender?: Gender;
  color?: PersonColor;
  /** Символ на иконке: буква или эмодзи; нет — первая буква имени */
  avatar?: string;
  email?: string;
  /** scrypt: соль и хеш */
  passHash?: string;
  vkId?: string;
  createdAt: string;
};

/** То, что видят другие участники групп */
export type PublicUser = Pick<User, 'id' | 'name' | 'nick' | 'gender' | 'color' | 'avatar'>;
export const publicUser = (u: User): PublicUser => ({ id: u.id, name: u.name, nick: u.nick, gender: u.gender, color: u.color, avatar: u.avatar });

export type Group = {
  id: string;
  name: string;
  category: GroupCategory;
  inviteCode: string;
  ownerId: string;
  adminIds: string[];
  memberIds: string[];
  /** Участники с режимом «Только выбранные»: группе видны только их отмеченные дела (visibility.ts). Нет — у всех «Все» */
  selectOnly?: string[];
  createdAt: string;
};

/** Тип дела (в приложении — мини-иконка): обычное, день рождения, важный день, путешествие */
export const TASK_KINDS = ['task', 'birthday', 'important', 'trip'] as const;
export type TaskKind = (typeof TASK_KINDS)[number];
export type Celebrant = { id?: string; name: string };

export type Task = {
  id: string;
  /**
   * Раздел хранения. API 3: «u:<владелец>» — личный календарь владельца (visibility.ts).
   * Старые записи лежали в разделе группы — переносятся при первой синхронизации (api.ts, migrateGroup)
   */
  groupId: string;
  type: 'task';
  title: string;
  date: string | null;
  time: string | null;
  note?: string;
  createdBy: string;
  doneAt: string | null;
  /** Повтор (формат — mobile-prod/src/lib/types.ts, Repeat) */
  repeat?: { freq: 'day' | 'week' | 'month' | 'year'; every: number; weekdays?: number[]; monthDays?: number[]; months?: number[]; until?: string | null; count?: number | null } | null;
  doneDates?: string[];
  skipDates?: string[];
  /** Общие напоминания для всех участников */
  reminders?: string[] | null;
  /** Конец: время и (для многодневных) дата */
  endDate?: string | null;
  endTime?: string | null;
  /** Кто занят: участники группы; нет — автор */
  people?: string[];
  /** Подзадача плана: id большого дела того же владельца */
  /** Тип; нет — обычное дело */
  kind?: Exclude<TaskKind, 'task'>;
  /** Именинник (только у дня рождения): участник группы (id) или просто имя */
  celebrant?: Celebrant;
  parentId?: string | null;
  /** Группа, в которой дело создали; null — в личном календаре */
  home?: string | null;
  /** «Только я»: не видно ни одной группе */
  only?: boolean;
  /** Отметки по группам: true — показать, false — скрыть; нет — по режиму владельца в группе */
  share?: Record<string, boolean>;
  createdAt: string;
  updatedAt: string;
};

export type WatchItem = {
  id: string;
  groupId: string;
  type: 'watch';
  title: string;
  kind: string | null;
  genres: string[];
  origin: string | null;
  year: number | null;
  /** Рейтинг Кинопоиска (ПоискКино, films.ts); нет — не нашли или не искали */
  rating?: number | null;
  /** id фильма на Кинопоиске */
  kpId?: number | null;
  /** Короткое описание с Кинопоиска */
  description?: string;
  /** Точно такого названия нет — похоже, имели в виду этот фильм */
  suggestion?: { title: string; year: number | null } | null;
  /** Когда искали в ПоискКино; нет — ещё не искали (старые записи дополняются через /watch/enrich) */
  kpAt?: string;
  addedBy: string;
  watchedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Item = Task | WatchItem;

export type Wish = {
  id: string;
  ownerId: string;
  title: string;
  note: string;
  link: string;
  /** Владелец сам отметил «получил» */
  receivedAt: string | null;
  /**
   * Кто подарил и когда отметил (S1). Ставит другой участник общей группы (op wish.gift).
   * Сюрприз: владельцу эти поля не отдаются, пока он сам не отметит receivedAt (api.ts, wishView)
   */
  giftedBy?: string | null;
  giftedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Идеи: темы и записи в них. Принадлежат человеку (как хотелки) и по умолчанию видны только ему.
 * Тему можно открыть группам (groupIds) — участники видят её и идеи в ней, но менять не могут.
 * Идея без темы (topicId: null) — во «Без темы».
 */
export type Topic = {
  kind: 'topic';
  id: string;
  ownerId: string;
  title: string;
  groupIds: string[];
  /** Тема в архиве (S2): отметил владелец; нет — обычная */
  archivedAt?: string | null;
  /** Текст самой темы (тема — тоже заметка); нет — пустая */
  body?: string;
  createdAt: string;
  updatedAt: string;
};

export type Idea = {
  kind: 'idea';
  id: string;
  ownerId: string;
  topicId: string | null;
  text: string;
  createdAt: string;
  updatedAt: string;
};

export type Note = Topic | Idea;

/**
 * Личные настройки человека, общие для всех его телефонов: напоминания по умолчанию
 * и личные напоминания для отдельных дел (id дела → список, [] — не напоминать).
 */
export type Prefs = {
  reminders: { enabled: boolean; timed: string[]; allDay: string[] } | null;
  overrides: Record<string, string[]>;
  updatedAt: string;
};

/** Что произошло — для ленты активности */
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
  | 'group.rename'
  | 'topic.share';

/**
 * Запись ленты. scope — чья лента: id группы (дела, «Смотреть», участники) или «u:<id>» (хотелки человека).
 * id — «время#случайное»: по нему записи идут по порядку.
 */
export type Activity = {
  scope: string;
  id: string;
  at: string;
  actor: string;
  kind: ActivityKind;
  groupId?: string;
  itemId?: string;
  title?: string;
  /** Дата и время дела; у отметки повтора — дата этого раза */
  date?: string | null;
  time?: string | null;
  /** Что поменяли: title, date, time, note, repeat, reminders */
  fields?: string[];
  /** Кого исключили */
  target?: string;
};

/**
 * Хранилище. Счётчики ревизий — отдельные атомарные числа: по ним телефон понимает,
 * что в группе (grev) или у человека (urev: профиль, хотелки) что-то изменилось.
 */
export interface Store {
  getUser(id: string): Promise<User | null>;
  getUsers(ids: string[]): Promise<User[]>;
  putUser(u: User): Promise<void>;
  deleteUser(id: string): Promise<void>;

  /** Уникальные ключи: email#…, vk#…, nick#…, invite#… → id. false — ключ уже занят другим */
  claimKey(key: string, value: string): Promise<boolean>;
  getKey(key: string): Promise<string | null>;
  deleteKey(key: string): Promise<void>;

  getGroup(id: string): Promise<Group | null>;
  getGroups(ids: string[]): Promise<Group[]>;
  putGroup(g: Group): Promise<void>;
  deleteGroup(id: string): Promise<void>;

  listMemberships(userId: string): Promise<string[]>;
  addMembership(userId: string, groupId: string): Promise<void>;
  removeMembership(userId: string, groupId: string): Promise<void>;

  listItems(groupId: string): Promise<Item[]>;
  getItem(groupId: string, id: string): Promise<Item | null>;
  putItem(item: Item): Promise<void>;
  deleteItem(groupId: string, id: string): Promise<void>;

  listWishes(ownerId: string): Promise<Wish[]>;
  getWish(ownerId: string, id: string): Promise<Wish | null>;
  putWish(w: Wish): Promise<void>;
  deleteWish(ownerId: string, id: string): Promise<void>;

  /** Идеи человека: темы и записи (одна таблица, различаются полем kind) */
  listNotes(ownerId: string): Promise<Note[]>;
  getNote(ownerId: string, id: string): Promise<Note | null>;
  putNote(n: Note): Promise<void>;
  deleteNote(ownerId: string, id: string): Promise<void>;

  /** Атомарно +1 к счётчику, возвращает новое значение */
  incr(counter: string): Promise<number>;
  /** Значения счётчиков (нет — 0) */
  getCounters(counters: string[]): Promise<Record<string, number>>;
  /** +1, если значение меньше limit. null — лимит исчерпан */
  incrUpTo(counter: string, limit: number): Promise<number | null>;

  /** Личные настройки (напоминания) — одна запись на человека */
  getPrefs(userId: string): Promise<Prefs | null>;
  putPrefs(userId: string, p: Prefs): Promise<void>;
  deletePrefs(userId: string): Promise<void>;

  /** Лента активности: добавить запись и прочитать новые (свежие первыми) */
  addActivity(a: Activity): Promise<void>;
  listActivity(scope: string, since: string, limit: number): Promise<Activity[]>;

  /** Временные записи: коды из писем, состояния входа VK. ttl — секунды */
  putTemp(key: string, value: unknown, ttlSec: number): Promise<void>;
  getTemp<T>(key: string): Promise<T | null>;
  deleteTemp(key: string): Promise<void>;
}

export const grev = (groupId: string) => `grev#${groupId}`;
export const urev = (userId: string) => `urev#${userId}`;
/** Ревизия идей человека: меняется при любой правке его тем и идей */
export const irev = (userId: string) => `irev#${userId}`;
/**
 * Ревизия подарков чужих хотелок человека (wish.gift, S1). Отдельно от urev: владелец её не получает, иначе
 * «моя ревизия выросла, а я ничего не менял» выдаёт подарок (docs/security/REVIEW-v2.md, V2-2)
 */
export const giftrev = (userId: string) => `giftrev#${userId}`;
/** Ревизия дел человека (его личный календарь, API 3): меняется при любой правке его дел */
export const trev = (userId: string) => `trev#${userId}`;
/** Старые дела группы уже перенесены в разделы владельцев (1 — да) */
export const migrated = (groupId: string) => `mig#${groupId}`;
