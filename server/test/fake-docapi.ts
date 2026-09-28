/**
 * Поддельный Document API (протокол DynamoDB) в памяти — только для тестов YdbStore.
 * Понимает ровно те операции и выражения, которые использует src/store/ydb.ts.
 */
import { createServer, type Server } from 'node:http';

type AV = { S?: string; N?: string };
type Row = Record<string, AV>;
type Table = { hash: string; range?: string; rows: Map<string, Row> };

export function startFakeDocApi(): Promise<{ url: string; server: Server; calls: string[] }> {
  const tables = new Map<string, Table>();
  const calls: string[] = [];
  const keyOf = (t: Table, k: Row) => `${k[t.hash]?.S}|${t.range ? k[t.range]?.S : ''}`;
  const val = (a?: AV) => (a?.S !== undefined ? a.S : a?.N !== undefined ? Number(a.N) : undefined);

  // Выражения из ydb.ts: attribute_not_exists(#x) [OR #y = :v | OR #n < :lim]
  function cond(expr: string | undefined, row: Row | undefined, names: Record<string, string> = {}, values: Record<string, AV> = {}): boolean {
    if (!expr) return true;
    return expr.split(/\s+OR\s+/).some((part) => {
      let m = part.match(/^attribute_not_exists\((#\w+)\)$/);
      if (m) return !row || row[names[m[1]]] === undefined;
      m = part.match(/^(#\w+)\s*(=|<)\s*(:\w+)$/);
      if (m) {
        if (!row) return false;
        const a = val(row[names[m[1]]]);
        const b = val(values[m[3]]);
        if (a === undefined || b === undefined) return false;
        return m[2] === '=' ? a === b : (a as number) < (b as number);
      }
      throw new Error(`fake: не понимаю условие ${part}`);
    });
  }

  const handlers: Record<string, (b: any) => unknown> = {
    ListTables: () => ({ TableNames: [...tables.keys()] }),
    CreateTable: (b) => {
      const hash = b.KeySchema.find((k: any) => k.KeyType === 'HASH').AttributeName;
      const range = b.KeySchema.find((k: any) => k.KeyType === 'RANGE')?.AttributeName;
      tables.set(b.TableName, { hash, range, rows: new Map() });
      return {};
    },
    GetItem: (b) => {
      const t = tables.get(b.TableName)!;
      const r = t.rows.get(keyOf(t, b.Key));
      return r ? { Item: r } : {};
    },
    PutItem: (b) => {
      const t = tables.get(b.TableName)!;
      const k = keyOf(t, b.Item);
      if (!cond(b.ConditionExpression, t.rows.get(k), b.ExpressionAttributeNames, b.ExpressionAttributeValues)) throw { type: 'ConditionalCheckFailedException' };
      t.rows.set(k, b.Item);
      return {};
    },
    DeleteItem: (b) => {
      const t = tables.get(b.TableName)!;
      t.rows.delete(keyOf(t, b.Key));
      return {};
    },
    BatchGetItem: (b) => {
      const Responses: Record<string, Row[]> = {};
      for (const [name, req] of Object.entries<any>(b.RequestItems)) {
        const t = tables.get(name)!;
        if (req.Keys.length > 100) throw { type: 'ValidationException' };
        Responses[name] = req.Keys.map((k: Row) => t.rows.get(keyOf(t, k))).filter(Boolean);
      }
      return { Responses, UnprocessedKeys: {} };
    },
    Query: (b) => {
      const t = tables.get(b.TableName)!;
      const pk = b.ExpressionAttributeValues[':p'].S;
      const all = [...t.rows.values()].filter((r) => r[t.hash].S === pk).sort((x, y) => (x[t.range!]?.S ?? '').localeCompare(y[t.range!]?.S ?? ''));
      // Постранично по 2 записи — чтобы проверить LastEvaluatedKey
      const start = b.ExclusiveStartKey ? all.findIndex((r) => keyOf(t, r) === keyOf(t, b.ExclusiveStartKey)) + 1 : 0;
      const page = all.slice(start, start + 2);
      const more = start + 2 < all.length;
      return { Items: page, ...(more && { LastEvaluatedKey: { [t.hash]: page.at(-1)![t.hash], ...(t.range && { [t.range]: page.at(-1)![t.range] }) } }) };
    },
    UpdateItem: (b) => {
      const t = tables.get(b.TableName)!;
      const k = keyOf(t, b.Key);
      const row = t.rows.get(k);
      if (!cond(b.ConditionExpression, row, b.ExpressionAttributeNames, b.ExpressionAttributeValues)) throw { type: 'ConditionalCheckFailedException' };
      const m = String(b.UpdateExpression).match(/^ADD (#\w+) (:\w+)$/);
      if (!m) throw new Error('fake: только ADD');
      const attr = b.ExpressionAttributeNames[m[1]];
      const next = { ...(row ?? b.Key) };
      next[attr] = { N: String(Number(row?.[attr]?.N ?? 0) + Number(b.ExpressionAttributeValues[m[2]].N)) };
      t.rows.set(k, next);
      return { Attributes: { [attr]: next[attr] } };
    },
  };

  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const target = String(req.headers['x-amz-target'] ?? '').split('.').pop()!;
      calls.push(target);
      const send = (status: number, obj: unknown) => {
        res.writeHead(status, { 'content-type': 'application/x-amz-json-1.0' });
        res.end(JSON.stringify(obj));
      };
      if (!String(req.headers.authorization ?? '').startsWith('AWS4-HMAC-SHA256 Credential=')) return send(403, { __type: 'MissingAuthenticationToken' });
      const h = handlers[target];
      if (!h) return send(400, { __type: `UnknownOperation`, message: target });
      try {
        send(200, h(JSON.parse(body)));
      } catch (e: any) {
        send(400, { __type: `com.amazonaws.dynamodb.v20120810#${e.type ?? 'InternalFailure'}`, message: e.message ?? '' });
      }
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${(server.address() as any).port}/ru-central1/b1g/etn`, server, calls })));
}
