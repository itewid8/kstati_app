/**
 * Хранилище в памяти с сохранением в JSON-файл — для разработки на Mac без облака.
 * Файл по умолчанию: server/.data/dev.json. Не для продакшена: один процесс, без блокировок.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Activity, Group, Item, Prefs, Store, User, Wish } from './types.js';

type Dump = {
  users: Record<string, User>;
  keys: Record<string, string>;
  groups: Record<string, Group>;
  members: Record<string, string[]>;
  items: Record<string, Record<string, Item>>;
  wishes: Record<string, Record<string, Wish>>;
  counters: Record<string, number>;
  temp: Record<string, { v: unknown; exp: number }>;
  activity: Record<string, Activity[]>;
  prefs: Record<string, Prefs>;
};

const empty = (): Dump => ({ users: {}, keys: {}, groups: {}, members: {}, items: {}, wishes: {}, counters: {}, temp: {}, activity: {}, prefs: {} });
const clone = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));

export class MemoryStore implements Store {
  private d: Dump;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private file?: string) {
    this.d = empty();
    if (file && existsSync(file)) {
      try {
        this.d = { ...empty(), ...JSON.parse(readFileSync(file, 'utf8')) };
      } catch {
        /* повреждённый файл — начинаем с пустого */
      }
    }
  }

  private save() {
    if (!this.file) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      mkdirSync(dirname(this.file!), { recursive: true });
      writeFileSync(this.file!, JSON.stringify(this.d));
    }, 200);
  }

  async getUser(id: string) {
    return clone(this.d.users[id]) ?? null;
  }
  async getUsers(ids: string[]) {
    return ids.map((id) => this.d.users[id]).filter(Boolean).map(clone);
  }
  async putUser(u: User) {
    this.d.users[u.id] = clone(u);
    this.save();
  }
  async deleteUser(id: string) {
    delete this.d.users[id];
    this.save();
  }

  async claimKey(key: string, value: string) {
    const cur = this.d.keys[key];
    if (cur !== undefined && cur !== value) return false;
    this.d.keys[key] = value;
    this.save();
    return true;
  }
  async getKey(key: string) {
    return this.d.keys[key] ?? null;
  }
  async deleteKey(key: string) {
    delete this.d.keys[key];
    this.save();
  }

  async getGroup(id: string) {
    return clone(this.d.groups[id]) ?? null;
  }
  async getGroups(ids: string[]) {
    return ids.map((id) => this.d.groups[id]).filter(Boolean).map(clone);
  }
  async putGroup(g: Group) {
    this.d.groups[g.id] = clone(g);
    this.save();
  }
  async deleteGroup(id: string) {
    delete this.d.groups[id];
    delete this.d.items[id];
    this.save();
  }

  async listMemberships(userId: string) {
    return [...(this.d.members[userId] ?? [])];
  }
  async addMembership(userId: string, groupId: string) {
    const list = this.d.members[userId] ?? [];
    if (!list.includes(groupId)) list.push(groupId);
    this.d.members[userId] = list;
    this.save();
  }
  async removeMembership(userId: string, groupId: string) {
    this.d.members[userId] = (this.d.members[userId] ?? []).filter((g) => g !== groupId);
    this.save();
  }

  async listItems(groupId: string) {
    return Object.values(this.d.items[groupId] ?? {}).map(clone);
  }
  async getItem(groupId: string, id: string) {
    return clone(this.d.items[groupId]?.[id]) ?? null;
  }
  async putItem(item: Item) {
    (this.d.items[item.groupId] ??= {})[item.id] = clone(item);
    this.save();
  }
  async deleteItem(groupId: string, id: string) {
    delete this.d.items[groupId]?.[id];
    this.save();
  }

  async listWishes(ownerId: string) {
    return Object.values(this.d.wishes[ownerId] ?? {}).map(clone);
  }
  async getWish(ownerId: string, id: string) {
    return clone(this.d.wishes[ownerId]?.[id]) ?? null;
  }
  async putWish(w: Wish) {
    (this.d.wishes[w.ownerId] ??= {})[w.id] = clone(w);
    this.save();
  }
  async deleteWish(ownerId: string, id: string) {
    delete this.d.wishes[ownerId]?.[id];
    this.save();
  }

  async incr(counter: string) {
    const v = (this.d.counters[counter] ?? 0) + 1;
    this.d.counters[counter] = v;
    this.save();
    return v;
  }
  async getCounters(counters: string[]) {
    return Object.fromEntries(counters.map((c) => [c, this.d.counters[c] ?? 0]));
  }
  async incrUpTo(counter: string, limit: number) {
    const cur = this.d.counters[counter] ?? 0;
    if (cur >= limit) return null;
    return this.incr(counter);
  }

  async getPrefs(userId: string) {
    return clone(this.d.prefs[userId]) ?? null;
  }
  async putPrefs(userId: string, p: Prefs) {
    this.d.prefs[userId] = clone(p);
    this.save();
  }
  async deletePrefs(userId: string) {
    delete this.d.prefs[userId];
    this.save();
  }

  async addActivity(a: Activity) {
    const list = (this.d.activity[a.scope] ??= []);
    list.push(clone(a));
    // Храним последние 500 записей на ленту
    if (list.length > 500) list.splice(0, list.length - 500);
    this.save();
  }
  async listActivity(scope: string, since: string, limit: number) {
    return (this.d.activity[scope] ?? [])
      .filter((a) => a.id > since)
      .sort((a, b) => b.id.localeCompare(a.id))
      .slice(0, limit)
      .map(clone);
  }

  async putTemp(key: string, value: unknown, ttlSec: number) {
    this.d.temp[key] = { v: clone(value), exp: Date.now() + ttlSec * 1000 };
    this.save();
  }
  async getTemp<T>(key: string) {
    const t = this.d.temp[key];
    if (!t) return null;
    if (t.exp < Date.now()) {
      delete this.d.temp[key];
      return null;
    }
    return clone(t.v) as T;
  }
  async deleteTemp(key: string) {
    delete this.d.temp[key];
    this.save();
  }
}
