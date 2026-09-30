/**
 * Данные сервера. Одна модель для двух хранилищ:
 *   memory — для разработки на Mac (данные в файле server/.data/dev.json);
 *   ydb    — YDB в Yandex Cloud через Document API (продакшен).
 */
import type { GroupCategory } from '../types.js';

export type Gender = 'm' | 'f';

export type User = {
  id: string;
  name: string;
  nick?: string;
  gender?: Gender;
  email?: string;
  /** scrypt: соль и хеш */
  passHash?: string;
  vkId?: string;
  createdAt: string;
};

/** То, что видят другие участники групп */
export type PublicUser = Pick<User, 'id' | 'name' | 'nick' | 'gender'>;
export const publicUser = (u: User): PublicUser => ({ id: u.id, name: u.name, nick: u.nick, gender: u.gender });

export type Group = {
  id: string;
  name: string;
  category: GroupCategory;
  inviteCode: string;
  ownerId: string;
  adminIds: string[];
  memberIds: string[];
  createdAt: string;
};

export type Task = {
  id: string;
  groupId: string;
  type: 'task';
  title: string;
  date: string | null;
  time: string | null;
  note?: string;
  createdBy: string;
  doneAt: string | null;
  /** Повтор (формат — mobile/src/lib/types.ts, Repeat) */
  repeat?: { freq: 'day' | 'week' | 'month' | 'year'; every: number; weekdays?: number[]; monthDays?: number[]; months?: number[]; until?: string | null; count?: number | null } | null;
  doneDates?: string[];
  skipDates?: string[];
  /** Общие напоминания для всех участников */
  reminders?: string[] | null;
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
  receivedAt: string | null;
  createdAt: string;
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
  | 'group.rename';

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

  /** Атомарно +1 к счётчику, возвращает новое значение */
  incr(counter: string): Promise<number>;
  /** Значения счётчиков (нет — 0) */
  getCounters(counters: string[]): Promise<Record<string, number>>;
  /** +1, если значение меньше limit. null — лимит исчерпан */
  incrUpTo(counter: string, limit: number): Promise<number | null>;

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
