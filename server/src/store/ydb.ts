/**
 * YDB (бессерверный режим) через Document API — протокол, совместимый с Amazon DynamoDB.
 * Обычный HTTPS + подпись SigV4 статическим ключом сервисного аккаунта, без SDK.
 *
 * Таблицы (создаёт scripts/ydb-tables.ts):
 *   kv       k (S)                    — пользователи, группы, уникальные ключи, счётчики, временные записи
 *   members  userId (S) + groupId (S) — в каких группах человек
 *   items    groupId (S) + id (S)     — дела и «Смотреть» группы
 *   wishes   ownerId (S) + id (S)     — хотелки человека
 * Сам объект лежит в атрибуте v (JSON-строка), счётчик — в n, срок жизни временной записи — в exp.
 */
import { signV4 } from '../sigv4.js';
import type { Group, Item, Store, User, Wish } from './types.js';

type AV = { S?: string; N?: string };
type Row = Record<string, AV>;

export type YdbConfig = { endpoint: string; accessKeyId: string; secretAccessKey: string; region?: string; prefix?: string };

export class DocApiError extends Error {
  constructor(
    public type: string,
    message: string,
    public status: number,
  ) {
    super(`YDB ${type}: ${message}`);
  }
}

const S = (s: string): AV => ({ S: s });
const chunk = <T>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

export class YdbStore implements Store {
  private t: { kv: string; members: string; items: string; wishes: string };

  constructor(private cfg: YdbConfig) {
    // Имена таблиц: не короче 3 символов (требование Document API), поэтому с приставкой: kstati_kv, kstati_items…
    const p = cfg.prefix ?? 'kstati_';
    this.t = { kv: `${p}kv`, members: `${p}members`, items: `${p}items`, wishes: `${p}wishes` };
  }

  /** Один вызов Document API: Target — имя операции DynamoDB (PutItem, Query…) */
  async call<T = any>(target: string, body: unknown): Promise<T> {
    const payload = JSON.stringify(body);
    const headers = { 'content-type': 'application/x-amz-json-1.0', 'x-amz-target': `DynamoDB_20120810.${target}` };
    for (let attempt = 0; ; attempt++) {
      const signed = signV4({
        method: 'POST',
        url: this.cfg.endpoint,
        headers,
        body: payload,
        region: this.cfg.region ?? 'ru-central1',
        service: 'dynamodb',
        accessKeyId: this.cfg.accessKeyId,
        secretAccessKey: this.cfg.secretAccessKey,
      });
      const res = await fetch(this.cfg.endpoint, { method: 'POST', headers: { ...headers, ...signed }, body: payload, signal: AbortSignal.timeout(10_000) });
      const text = await res.text();
      if (res.ok) return (text ? JSON.parse(text) : {}) as T;
      let type = `HTTP${res.status}`;
      let message = text.slice(0, 300);
      try {
        const j = JSON.parse(text);
        type = String(j.__type ?? type).split('#').pop()!;
        message = j.message ?? j.Message ?? message;
        // «1 validation error(s) found.» — подробности бывают в соседних полях ответа
        if (/validation error/i.test(message)) message = `${message} ${text.slice(0, 500)}`;
      } catch {
        /* не JSON */
      }
      // Перегрузка и временные сбои — до трёх повторов с паузой
      const retryable = res.status >= 500 || /Throughput|Throttl|Unavailable|Overloaded/i.test(type);
      if (retryable && attempt < 3) {
        await new Promise((r) => setTimeout(r, 150 * 2 ** attempt));
        continue;
      }
      throw new DocApiError(type, message, res.status);
    }
  }

  /* ---------- kv ---------- */

  private async kvGet(k: string): Promise<Row | null> {
    const r = await this.call<{ Item?: Row }>('GetItem', { TableName: this.t.kv, Key: { k: S(k) }, ConsistentRead: true });
    return r.Item ?? null;
  }

  private async kvBatch(keys: string[]): Promise<Map<string, Row>> {
    const out = new Map<string, Row>();
    for (const part of chunk([...new Set(keys)], 100)) {
      let request: Record<string, unknown> | null = { [this.t.kv]: { Keys: part.map((k) => ({ k: S(k) })), ConsistentRead: true } };
      for (let i = 0; request && i < 5; i++) {
        const r: { Responses?: Record<string, Row[]>; UnprocessedKeys?: Record<string, unknown> } = await this.call('BatchGetItem', { RequestItems: request });
        for (const row of r.Responses?.[this.t.kv] ?? []) out.set(row.k.S!, row);
        request = r.UnprocessedKeys && Object.keys(r.UnprocessedKeys).length ? r.UnprocessedKeys : null;
      }
    }
    return out;
  }

  private async kvPutJson(k: string, value: unknown, extra: Row = {}) {
    await this.call('PutItem', { TableName: this.t.kv, Item: { k: S(k), v: S(JSON.stringify(value)), ...extra } });
  }

  private async kvDelete(k: string) {
    await this.call('DeleteItem', { TableName: this.t.kv, Key: { k: S(k) } });
  }

  private parse<T>(row: Row | null | undefined): T | null {
    return row?.v?.S ? (JSON.parse(row.v.S) as T) : null;
  }

  async getUser(id: string) {
    return this.parse<User>(await this.kvGet(`user#${id}`));
  }
  async getUsers(ids: string[]) {
    const rows = await this.kvBatch(ids.map((id) => `user#${id}`));
    return ids.map((id) => this.parse<User>(rows.get(`user#${id}`))).filter((u): u is User => !!u);
  }
  async putUser(u: User) {
    await this.kvPutJson(`user#${u.id}`, u);
  }
  async deleteUser(id: string) {
    await this.kvDelete(`user#${id}`);
  }

  async claimKey(key: string, value: string) {
    try {
      await this.call('PutItem', {
        TableName: this.t.kv,
        Item: { k: S(`key#${key}`), v: S(value) },
        ConditionExpression: 'attribute_not_exists(#k) OR #v = :v',
        ExpressionAttributeNames: { '#k': 'k', '#v': 'v' },
        ExpressionAttributeValues: { ':v': S(value) },
      });
      return true;
    } catch (e) {
      if (e instanceof DocApiError && /ConditionalCheckFailed/.test(e.type)) return false;
      throw e;
    }
  }
  async getKey(key: string) {
    return (await this.kvGet(`key#${key}`))?.v?.S ?? null;
  }
  async deleteKey(key: string) {
    await this.kvDelete(`key#${key}`);
  }

  async getGroup(id: string) {
    return this.parse<Group>(await this.kvGet(`group#${id}`));
  }
  async getGroups(ids: string[]) {
    const rows = await this.kvBatch(ids.map((id) => `group#${id}`));
    return ids.map((id) => this.parse<Group>(rows.get(`group#${id}`))).filter((g): g is Group => !!g);
  }
  async putGroup(g: Group) {
    await this.kvPutJson(`group#${g.id}`, g);
  }
  async deleteGroup(id: string) {
    for (const it of await this.listItems(id)) await this.deleteItem(id, it.id);
    await this.kvDelete(`group#${id}`);
  }

  /* ---------- составные таблицы ---------- */

  private async query(table: string, pkName: string, pk: string): Promise<Row[]> {
    const out: Row[] = [];
    let start: Row | undefined;
    do {
      const r: { Items?: Row[]; LastEvaluatedKey?: Row } = await this.call('Query', {
        TableName: table,
        KeyConditionExpression: '#p = :p',
        ExpressionAttributeNames: { '#p': pkName },
        ExpressionAttributeValues: { ':p': S(pk) },
        ConsistentRead: true,
        ...(start && { ExclusiveStartKey: start }),
      });
      out.push(...(r.Items ?? []));
      start = r.LastEvaluatedKey;
    } while (start);
    return out;
  }

  async listMemberships(userId: string) {
    return (await this.query(this.t.members, 'userId', userId)).map((r) => r.groupId.S!);
  }
  async addMembership(userId: string, groupId: string) {
    await this.call('PutItem', { TableName: this.t.members, Item: { userId: S(userId), groupId: S(groupId) } });
  }
  async removeMembership(userId: string, groupId: string) {
    await this.call('DeleteItem', { TableName: this.t.members, Key: { userId: S(userId), groupId: S(groupId) } });
  }

  async listItems(groupId: string) {
    return (await this.query(this.t.items, 'groupId', groupId)).map((r) => JSON.parse(r.v.S!) as Item);
  }
  async getItem(groupId: string, id: string) {
    const r = await this.call<{ Item?: Row }>('GetItem', { TableName: this.t.items, Key: { groupId: S(groupId), id: S(id) }, ConsistentRead: true });
    return this.parse<Item>(r.Item);
  }
  async putItem(item: Item) {
    await this.call('PutItem', { TableName: this.t.items, Item: { groupId: S(item.groupId), id: S(item.id), v: S(JSON.stringify(item)) } });
  }
  async deleteItem(groupId: string, id: string) {
    await this.call('DeleteItem', { TableName: this.t.items, Key: { groupId: S(groupId), id: S(id) } });
  }

  async listWishes(ownerId: string) {
    return (await this.query(this.t.wishes, 'ownerId', ownerId)).map((r) => JSON.parse(r.v.S!) as Wish);
  }
  async getWish(ownerId: string, id: string) {
    const r = await this.call<{ Item?: Row }>('GetItem', { TableName: this.t.wishes, Key: { ownerId: S(ownerId), id: S(id) }, ConsistentRead: true });
    return this.parse<Wish>(r.Item);
  }
  async putWish(w: Wish) {
    await this.call('PutItem', { TableName: this.t.wishes, Item: { ownerId: S(w.ownerId), id: S(w.id), v: S(JSON.stringify(w)) } });
  }
  async deleteWish(ownerId: string, id: string) {
    await this.call('DeleteItem', { TableName: this.t.wishes, Key: { ownerId: S(ownerId), id: S(id) } });
  }

  /* ---------- счётчики ---------- */

  async incr(counter: string) {
    const r = await this.call<{ Attributes?: Row }>('UpdateItem', {
      TableName: this.t.kv,
      Key: { k: S(`cnt#${counter}`) },
      UpdateExpression: 'ADD #n :one',
      ExpressionAttributeNames: { '#n': 'n' },
      ExpressionAttributeValues: { ':one': { N: '1' } },
      ReturnValues: 'UPDATED_NEW',
    });
    return Number(r.Attributes?.n?.N ?? 1);
  }
  async getCounters(counters: string[]) {
    const rows = await this.kvBatch(counters.map((c) => `cnt#${c}`));
    return Object.fromEntries(counters.map((c) => [c, Number(rows.get(`cnt#${c}`)?.n?.N ?? 0)]));
  }
  async incrUpTo(counter: string, limit: number) {
    try {
      const r = await this.call<{ Attributes?: Row }>('UpdateItem', {
        TableName: this.t.kv,
        Key: { k: S(`cnt#${counter}`) },
        UpdateExpression: 'ADD #n :one',
        ConditionExpression: 'attribute_not_exists(#n) OR #n < :lim',
        ExpressionAttributeNames: { '#n': 'n' },
        ExpressionAttributeValues: { ':one': { N: '1' }, ':lim': { N: String(limit) } },
        ReturnValues: 'UPDATED_NEW',
      });
      return Number(r.Attributes?.n?.N ?? 1);
    } catch (e) {
      if (e instanceof DocApiError && /ConditionalCheckFailed/.test(e.type)) return null;
      throw e;
    }
  }

  /* ---------- временные записи ---------- */

  async putTemp(key: string, value: unknown, ttlSec: number) {
    await this.kvPutJson(`tmp#${key}`, value, { exp: { N: String(Math.floor(Date.now() / 1000) + ttlSec) } });
  }
  async getTemp<T>(key: string) {
    const row = await this.kvGet(`tmp#${key}`);
    if (!row) return null;
    if (Number(row.exp?.N ?? 0) * 1000 < Date.now()) return null;
    return this.parse<T>(row);
  }
  async deleteTemp(key: string) {
    await this.kvDelete(`tmp#${key}`);
  }

  /** Создать таблицы, если их нет (scripts/ydb-tables.ts) */
  async ensureTables(log: (s: string) => void = console.log) {
    const have = new Set<string>(((await this.call<{ TableNames?: string[] }>('ListTables', {})).TableNames ?? []).map(String));
    const specs: [string, [string, string?]][] = [
      [this.t.kv, ['k']],
      [this.t.members, ['userId', 'groupId']],
      [this.t.items, ['groupId', 'id']],
      [this.t.wishes, ['ownerId', 'id']],
    ];
    for (const [name, [hash, range]] of specs) {
      if (have.has(name)) {
        log(`✓ ${name} уже есть`);
        continue;
      }
      await this.call('CreateTable', {
        TableName: name,
        AttributeDefinitions: [{ AttributeName: hash, AttributeType: 'S' }, ...(range ? [{ AttributeName: range, AttributeType: 'S' }] : [])],
        KeySchema: [{ AttributeName: hash, KeyType: 'HASH' }, ...(range ? [{ AttributeName: range, KeyType: 'RANGE' }] : [])],
      });
      log(`+ ${name} создана`);
    }
  }
}
