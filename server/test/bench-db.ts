/**
 * Сколько обращений к базе (Document API) и сколько времени уходит на типовые запросы.
 * Не тест (в server-test.sh не входит). Запуск: npx tsx test/bench-db.ts
 * Семья: 4 человека, 2 группы; у каждого 300 дел, 40 хотелок, 30 заметок. Задержка базы — 0 (считаем вызовы, а не сеть):
 * в Яндекс Облаке каждый вызов — ~5–15 мс и строка в счёте.
 */
import { gzipSync } from 'node:zlib';
import { buildApp } from '../src/app.js';
import { config } from '../src/config.js';
import { YdbStore } from '../src/store/ydb.js';
import { startFakeDocApi } from './fake-docapi.js';

config.authPerMinute = 100_000;
// Страница Query — как в YDB (до 1 МБ ≈ тысячи записей), а не по 2, как в тестах
const fake = await startFakeDocApi({ pageSize: 1000 });
const store = new YdbStore({ endpoint: fake.url, accessKeyId: 't', secretAccessKey: 't' });
await store.ensureTables(() => {});
const app = await buildApp({
  store,
  parse: async () => ({ result: { type: 'unknown' }, raw: '{}', usage: { input: 1, output: 1, total: 2 }, attempts: 1 }),
});

let ip = 0;
const call = async (method: string, url: string, body?: unknown, token?: string) => {
  const r = await app.inject({ method: method as never, url, payload: body as never, remoteAddress: `10.0.${Math.floor(ip / 250)}.${(ip++ % 250) + 1}`, headers: token ? { authorization: `Bearer ${token}` } : {} });
  if (r.statusCode !== 200) throw new Error(`${method} ${url} → ${r.statusCode} ${r.body.slice(0, 200)}`);
  return r.json();
};
const ops = (token: string, list: unknown[]) => call('POST', '/ops', { ops: list }, token);

/** Обращения к базе и время одного запроса */
async function measure(label: string, fn: () => Promise<unknown>, rows: string[][]) {
  const before = fake.calls.length;
  const t = performance.now();
  const res = await fn();
  const ms = performance.now() - t;
  const json = JSON.stringify(res ?? null);
  // Ответы от 4 КБ уходят в gzip (app.ts), поэтому по сети — второе число
  const kb = `${(json.length / 1024).toFixed(1)} / ${(json.length < 4096 ? json.length / 1024 : gzipSync(json).length / 1024).toFixed(1)}`;
  const used = fake.calls.slice(before);
  const kinds = Object.entries(used.reduce<Record<string, number>>((a, k) => ((a[k] = (a[k] ?? 0) + 1), a), {}))
    .map(([k, n]) => `${k}×${n}`)
    .join(' ');
  rows.push([label, String(used.length), ms.toFixed(0), kb, kinds]);
}

// ---------- данные ----------
// Данные заведены «час назад»: иначе все дела моложе запаса DELTA_MARGIN_MS и /sync после правки отдаёт их целиком
const RealDate = Date;
const hourAgo = class extends RealDate {
  constructor(...a: unknown[]) {
    if (a.length) super(...(a as [number]));
    else super(RealDate.now() - 3_600_000);
  }
  static override now() {
    return RealDate.now() - 3_600_000;
  }
} as DateConstructor;
globalThis.Date = hourAgo;
const people: { token: string; id: string }[] = [];
for (let i = 0; i < 4; i++) {
  const email = `u${i}@bench.ru`;
  const { devCode } = await call('POST', '/auth/email/code', { email, purpose: 'register' });
  const r = await call('POST', '/auth/register', { email, code: devCode, name: `Человек ${i}`, password: 'secret-123' });
  people.push({ token: r.token, id: r.me.id });
}
const [g1] = (await ops(people[0]!.token, [{ op: 'group.create', group: { id: 'fam', name: 'Семья', category: 'family' } }])).results;
const [g2] = (await ops(people[0]!.token, [{ op: 'group.create', group: { id: 'fr', name: 'Друзья', category: 'friends' } }])).results;
for (const p of people.slice(1)) await ops(p.token, [{ op: 'group.join', code: g1.group.inviteCode }]);
await ops(people[2]!.token, [{ op: 'group.join', code: g2.group.inviteCode }]);
for (const [pi, p] of people.entries()) {
  for (let b = 0; b < 300; b += 100) {
    await ops(
      p.token,
      Array.from({ length: 100 }, (_, i) => ({
        op: 'task.put',
        task: { id: `t${pi}-${b + i}`, groupId: '@me', title: `Дело ${b + i}`, date: `2026-11-${String(((b + i) % 28) + 1).padStart(2, '0')}`, time: '10:00', doneAt: null },
      })),
    );
  }
  await ops(p.token, Array.from({ length: 40 }, (_, i) => ({ op: 'wish.put', wish: { id: `w${i}`, title: `Хотелка ${i}`, note: '', link: '', receivedAt: null } })));
  await ops(p.token, [{ op: 'topic.put', topic: { id: 'tp', title: 'Тема', groupIds: ['fam'] } }]);
  await ops(p.token, Array.from({ length: 30 }, (_, i) => ({ op: 'idea.put', idea: { id: `i${i}`, topicId: 'tp', text: `# Заметка ${i}\n- [ ] пункт` } })));
}
await ops(people[0]!.token, Array.from({ length: 20 }, (_, i) => ({ op: 'watch.put', watch: { id: `m${i}`, groupId: 'fam', title: `Фильм ${i}`, kind: 'movie', genres: [], origin: null, year: 2020, watchedAt: null } })));

globalThis.Date = RealDate;

// ---------- замеры ----------
const me = people[0]!;
const rows: string[][] = [];
let first: { revs: { groups: Record<string, number>; owners: Record<string, number> }; ideaRevs: Record<string, string>; tasksAt?: string; tasksSig?: string } | null = null;
await measure('Вход паролем', () => call('POST', '/auth/login', { email: 'u0@bench.ru', password: 'secret-123' }), rows);
await measure('/sync — первая (всё целиком)', async () => (first = await call('POST', '/sync', {}, me.token)), rows);
// Как телефон: ревизии, заметки и отметка, когда пришли дела (тогда после правки придут только изменённые)
const known = () => ({ ...first!.revs, ideas: first!.ideaRevs, tasksAt: first!.tasksAt, tasksSig: first!.tasksSig });
await measure('/sync — ничего не поменялось (каждые 15 с)', () => call('POST', '/sync', known(), me.token), rows);
await measure('/ops — правка одного дела', () => ops(me.token, [{ op: 'task.put', task: { id: 't0-1', groupId: '@me', title: 'Дело 1!', date: '2026-11-02', time: '11:00', doneAt: null } }]), rows);
await measure('/sync — после правки одного дела', () => call('POST', '/sync', known(), me.token), rows);
await measure('/sync — после правки, без tasksAt (все дела заново)', () => call('POST', '/sync', { ...first!.revs, ideas: first!.ideaRevs }, me.token), rows);
await measure('/ops — правка чужого дела (участник группы)', () => ops(people[1]!.token, [{ op: 'task.put', task: { id: 't0-2', groupId: '@me', ownerId: me.id, title: 'Дело 2', date: '2026-11-03', time: '10:00', doneAt: new Date().toISOString() } }]), rows);
await measure('/ops — 20 правок пачкой', () => ops(me.token, Array.from({ length: 20 }, (_, i) => ({ op: 'task.put', task: { id: `t0-${i + 50}`, groupId: '@me', title: `Пачка ${i}`, date: null, time: null, doneAt: null } }))), rows);
await measure('/ops — подарить хотелку', () => ops(people[1]!.token, [{ op: 'wish.gift', ownerId: me.id, id: 'w3', gifted: true }]), rows);
await measure('/activity — лента', () => call('GET', '/activity', undefined, me.token), rows);
await measure('/voice/text — голосовая команда (без модели)', () => call('POST', '/voice/text', { groupId: 'fam', today: '2026-11-07', now: '12:00', text: 'перенеси дело 5 на завтра' }, me.token), rows);
await measure('/voice/quota', () => call('GET', '/voice/quota', undefined, me.token), rows);
await measure('/me', () => call('GET', '/me', undefined, me.token), rows);

const w = [Math.max(...rows.map((r) => r[0]!.length)), 6, 6];
console.log(`${'Запрос'.padEnd(w[0]!)}  вызовов  мс   ответ, КБ (JSON / gzip)  операции`);
for (const r of rows) console.log(`${r[0]!.padEnd(w[0]!)}  ${r[1]!.padStart(6)}  ${r[2]!.padStart(4)}  ${r[3]!.padStart(14)}  ${r[4]}`);
await app.close();
fake.server.close();
