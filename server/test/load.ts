/**
 * Нагрузочный тест сервера (не входит в server-test.sh). Запуск: npx tsx test/load.ts [секунд на сценарий]
 * Как в облаке: один процесс Node (у контейнера 1 ядро), база — поддельный Document API в другом потоке
 * с задержкой 10 мс на вызов (YDB по сети). Пользователи — семьи по 4 человека, у каждого 300 дел.
 * Сценарии: фоновая синхронизация без изменений (её шлёт каждый открытый телефон раз в 15 с),
 * правки, синхронизация после правки, голосовая команда без модели.
 */
import { spawn } from 'node:child_process';
import { buildApp } from '../src/app.js';
import { config } from '../src/config.js';
import { YdbStore } from '../src/store/ydb.js';

const SECONDS = Number(process.argv[2] ?? 10);
const FAMILIES = 15;
config.ratePerMinute = 1e9;
config.authPerMinute = 1e9;
config.voiceDailyLimit = 1e9;

// База — отдельным процессом (test/load-db.ts), чтобы её работа не отнимала время у сервера
const db = spawn(process.execPath, [new URL('./load-db.js', import.meta.url).pathname, '0'], { stdio: ['ignore', 'pipe', 'inherit'] });
const dbUrl: string = await new Promise((resolve) => db.stdout.once('data', (d: Buffer) => resolve(d.toString().trim())));
const store = new YdbStore({ endpoint: dbUrl, accessKeyId: 't', secretAccessKey: 't' });
await store.ensureTables(() => {});
const app = await buildApp({
  store,
  parse: async () => ({ result: { type: 'unknown' }, raw: '{}', usage: { input: 1, output: 1, total: 2 }, attempts: 1 }),
});
const base = await app.listen({ port: 0, host: '127.0.0.1' });

const call = async (path: string, body?: unknown, token?: string): Promise<any> => {
  const r = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(body !== undefined && { 'content-type': 'application/json' }), ...(token && { authorization: `Bearer ${token}` }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${path} → ${r.status} ${(await r.text()).slice(0, 120)}`);
  return r.json();
};
const ops = (token: string, list: unknown[]) => call('/ops', { ops: list }, token);

// ---------- данные ----------
// Данные заведены «час назад», как у живых людей: иначе все дела моложе запаса дельты (DELTA_MARGIN_MS)
const RealDate = Date;
globalThis.Date = class extends RealDate {
  constructor(...a: unknown[]) {
    if (a.length) super(...(a as [number]));
    else super(RealDate.now() - 3_600_000);
  }
  static override now() {
    return RealDate.now() - 3_600_000;
  }
} as DateConstructor;
type U = { token: string; id: string; known: unknown };
const users: U[] = [];
const t0 = RealDate.now();
for (let f = 0; f < FAMILIES; f++) {
  const fam: U[] = [];
  for (let i = 0; i < 4; i++) {
    const email = `f${f}u${i}@load.ru`;
    const { devCode } = await call('/auth/email/code', { email, purpose: 'register' });
    const r = await call('/auth/register', { email, code: devCode, name: `Человек ${i}`, password: 'secret-123' });
    fam.push({ token: r.token, id: r.me.id, known: {} });
  }
  const [g] = (await ops(fam[0]!.token, [{ op: 'group.create', group: { id: `g${f}`, name: 'Семья', category: 'family' } }])).results;
  for (const u of fam.slice(1)) await ops(u.token, [{ op: 'group.join', code: g.group.inviteCode }]);
  for (const [i, u] of fam.entries()) {
    for (let b = 0; b < 300; b += 100)
      await ops(u.token, Array.from({ length: 100 }, (_, k) => ({ op: 'task.put', task: { id: `t${i}-${b + k}`, groupId: '@me', title: `Дело ${b + k}`, date: `2026-11-${String(((b + k) % 28) + 1).padStart(2, '0')}`, time: '10:00', doneAt: null } })));
    await ops(u.token, Array.from({ length: 40 }, (_, k) => ({ op: 'wish.put', wish: { id: `w${k}`, title: `Хотелка ${k}`, note: '', link: '', receivedAt: null } })));
  }
  users.push(...fam);
}
globalThis.Date = RealDate;
for (const u of users) {
  const s = await call('/sync', {}, u.token);
  u.known = { ...s.revs, ideas: s.ideaRevs, tasksAt: s.tasksAt, tasksSig: s.tasksSig };
}
// Дальше база отвечает с задержкой, как YDB по сети
await fetch(`${dbUrl}/__latency?ms=10`);
console.log(`Данные: ${users.length} человек, ${FAMILIES} семей, по 300 дел и 40 хотелок — ${((Date.now() - t0) / 1000).toFixed(0)} с`);

// ---------- нагрузка ----------
const pct = (a: number[], p: number) => a[Math.min(a.length - 1, Math.floor((a.length * p) / 100))]!.toFixed(0);
async function run(label: string, concurrency: number, req: (u: U, n: number) => Promise<unknown>) {
  const lat: number[] = [];
  let errors = 0;
  let n = 0;
  const end = Date.now() + SECONDS * 1000;
  await Promise.all(
    Array.from({ length: concurrency }, async (_, w) => {
      while (Date.now() < end) {
        const u = users[(w + n) % users.length]!;
        const t = performance.now();
        try {
          await req(u, n++);
          lat.push(performance.now() - t);
        } catch {
          errors++;
        }
      }
    }),
  );
  lat.sort((a, b) => a - b);
  const rps = lat.length / SECONDS;
  console.log(
    `${label.padEnd(44)} одновременно ${String(concurrency).padStart(3)}  ${rps.toFixed(0).padStart(5)} запр/с  p50 ${pct(lat, 50).padStart(4)} мс  p95 ${pct(lat, 95).padStart(4)} мс  p99 ${pct(lat, 99).padStart(5)} мс  ошибок ${errors}`,
  );
  return rps;
}

const idleSync = (u: U) => call('/sync', u.known, u.token);
for (const c of [8, 32, 128]) await run('/sync без изменений (фон, раз в 15 с)', c, idleSync);
await run('/ops — правка одного дела', 32, (u, n) => ops(u.token, [{ op: 'task.put', task: { id: `t${users.indexOf(u) % 4}-${n % 300}`, groupId: '@me', title: `Правка ${n}`, date: '2026-11-10', time: '12:00', doneAt: null } }]));
await run('/sync после правок (только изменённые дела)', 32, (u) => call('/sync', { ...(u.known as object), groups: {} }, u.token));
await run('/sync с нуля (новый телефон: 1200 дел семьи)', 32, (u) => call('/sync', { ...(u.known as object), groups: {}, tasksAt: undefined }, u.token));
await run('/voice/text без модели (контекст из базы)', 32, (u) => call('/voice/text', { groupId: `g${users.indexOf(u) >> 2}`, today: '2026-11-07', now: '12:00', text: 'перенеси дело 5 на завтра' }, u.token));

const mem = process.memoryUsage();
console.log(`Память процесса: ${(mem.rss / 1048576).toFixed(0)} МБ (heap ${(mem.heapUsed / 1048576).toFixed(0)} МБ)`);
await app.close();
db.kill();
process.exit(0);
