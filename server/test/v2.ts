/**
 * Изменения сервера для нового приложения (docs/server-changes-v2.md) на уровне разбора, без HTTP:
 * S3 — какой раз повторяющегося дела назван во фразе, S4 — «что я делаю…» и гейт по уровню API,
 * подсказки промпта, вид хотелки для владельца и для других (S1). Сквозные проверки — в e2e.ts.
 *   npm test
 */
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { signToken } from '../src/auth.js';
import { wishView } from '../src/api.js';
import { MemoryStore } from '../src/store/memory.js';
import { normalize } from '../src/parse.js';
import { buildMessages } from '../src/prompt.js';
import { occurrences, repeatShort } from '../src/recur.js';
import type { Wish } from '../src/store/types.js';
import type { ChangeDraft, Context, ParseResult } from '../src/types.js';

const TODAY = '2026-10-06'; // вторник
const yoga = { id: 'y1', title: 'Йога', date: '2026-09-05', time: '19:00', repeat: { freq: 'week' as const, every: 1, weekdays: [6] }, skipDates: ['2026-10-10'] };
const ctx = (api?: number): Context => ({
  today: TODAY,
  now: '12:00',
  me: { id: 'u1', name: 'Саша' },
  people: [{ id: 'u7', name: 'Карина' }],
  existing: { tasks: [yoga, { id: 'd1', title: 'Ужин у родителей', date: '2026-10-10', time: '19:00' }], watch: [], wishes: [] },
  ...(api && { api }),
});
const change = (r: ParseResult): ChangeDraft => {
  assert.equal(r.type, 'changes', JSON.stringify(r));
  if (r.type !== 'changes') throw new Error();
  return r.changes[0];
};
const plans = (r: ParseResult) => {
  assert.equal(r.type, 'queryPlans', JSON.stringify(r));
  if (r.type !== 'queryPlans') throw new Error();
  return r.plans;
};

/* ---------- перенос occurrences() из приложения ---------- */
assert.deepEqual(occurrences(yoga, '2026-10-01', '2026-10-20'), ['2026-10-03', '2026-10-17'], 'удалённый раз пропускается');
assert.deepEqual(occurrences({ date: '2026-10-01', repeat: { freq: 'day', every: 1, count: 3 } }, '2026-10-02', '2026-10-10'), ['2026-10-02', '2026-10-03']);
assert.equal(repeatShort(yoga.repeat), 'каждую сб');
assert.equal(repeatShort({ freq: 'week', every: 2, weekdays: [3] }), 'раз в 2 нед. ср');
assert.equal(repeatShort({ freq: 'month', every: 1, monthDays: [20] }), 'каждое 20 число');
assert.equal(repeatShort({ freq: 'day', every: 1 }), 'каждый день');

// Дело-«бомба» от участника группы: давняя дата + счётчик + редкий повтор. Перебор ограничен (REVIEW-v2, V2-1)
const bomb = { id: 'b1', title: 'Йога', date: '0100-01-01', time: null, repeat: { freq: 'year' as const, every: 99, count: 999 } };
let tBomb = Date.now();
assert.deepEqual(occurrences(bomb, '9998-01-01', '9999-02-01'), []);
assert.ok(Date.now() - tBomb < 300, `occurrences на «бомбе» — ${Date.now() - tBomb} мс`);
tBomb = Date.now();
normalize(
  Array.from({ length: 3 }, () => ({ intent: 'delete', target: ['b1'], query: '' })),
  { ...ctx(2), today: '9998-01-01', existing: { tasks: [bomb], watch: [], wishes: [] } },
  'Удали йогу в субботу',
);
assert.ok(Date.now() - tBomb < 500, `голосовой разбор с «бомбой» — ${Date.now() - tBomb} мс`);
assert.deepEqual(occurrences({ date: '2000-01-01', repeat: { freq: 'week', every: 1, count: 999 } }, '2019-02-01', '2019-02-28'), ['2019-02-02', '2019-02-09', '2019-02-16'], 'давняя серия со счётчиком считается как раньше');

/* ---------- S3: раз серии в голосовой правке ---------- */
const del = (text: string, target = 'y1', api?: number) => change(normalize([{ intent: 'delete', target: [target], query: '' }], ctx(api), text));
assert.equal(del('Удали йогу в субботу').occ, '2026-10-17', 'ближайшая суббота серии (10 октября уже удалено)');
assert.equal(del('Удали йогу 24 октября').occ, '2026-10-24');
assert.equal(del('Удали йогу 25 октября').occ, undefined, 'в этот день раза нет');
assert.equal(del('Удали йогу').occ, undefined, 'день не назван — вся серия, решает клиент');
assert.equal(del('Удали ужин у родителей в субботу', 'd1').occ, undefined, 'у обычного дела occ нет');
assert.equal(del('Удали йогу в субботу').patch, undefined, 'patch у delete как раньше');
// Отметка — последний прошедший такой раз
assert.equal(change(normalize([{ intent: 'mark', target: ['y1'], query: '' }], ctx(), 'Отметь йогу в субботу')).occ, '2026-10-03');
// Перенос: исходный день — до «на»; patch.date для старого приложения не меняется, для нового — от названного раза
const move = (api?: number) => change(normalize([{ intent: 'update', target: ['y1'], date: '2026-10-11', query: 'йога' }], ctx(api), 'Перенеси йогу в субботу на воскресенье'));
assert.deepEqual([move().occ, move().patch?.date], ['2026-10-17', '2026-10-11'], 'api 1: дата как раньше (от даты серии)');
assert.deepEqual([move(2).occ, move(2).patch?.date], ['2026-10-17', '2026-10-18'], 'api 2: воскресенье после названной субботы');
// Перенос без названного исходного дня — occ нет
assert.equal(change(normalize([{ intent: 'update', target: ['y1'], time: '20:00', query: 'йога' }], ctx(2), 'Перенеси йогу на восемь')).occ, undefined);
// Снятие повтора — правка всей серии
const stop = change(normalize([{ intent: 'update', target: ['y1'], query: 'йога' }], ctx(2), 'Больше не повторяй йогу в субботу'));
assert.deepEqual([stop.patch?.repeat, stop.occ], [null, undefined]);

/* ---------- S4: «что я делаю…», гейт по уровню API ---------- */
const ask = (raw: Record<string, unknown>, api?: number) => plans(normalize([{ intent: 'query_plans', from: '2026-10-10', to: '2026-10-11', query: '', ...raw }], ctx(api), 'вопрос'));
// Старый клиент: прежний вид ответа (без who, без kind 'me')
assert.deepEqual(ask({ scope: 'me' }), { scope: { kind: 'current' }, from: '2026-10-10', to: '2026-10-11', query: '' });
assert.deepEqual(ask({ scope: 'people', people: ['я'] }).scope, { kind: 'current' }, '«я» — не человек из групп');
assert.deepEqual(ask({ scope: 'people', people: ['me', 'Карина'] }).scope, { kind: 'people', names: ['Карина'] });
assert.equal(ask({ scope: 'current', who: ['Карина'] }).who, undefined, 'who старому клиенту не отдаём');
// Новый клиент
assert.deepEqual(ask({ scope: 'me' }, 2), { scope: { kind: 'me' }, from: '2026-10-10', to: '2026-10-11', query: '', who: ['u1'] });
assert.deepEqual(ask({ scope: 'people', people: ['Мне'] }, 2).scope, { kind: 'me' });
assert.deepEqual(ask({ scope: 'current', who: ['Карину'] }, 2).who, ['u7']);
assert.deepEqual(ask({ scope: 'us' }, 2), { scope: { kind: 'us' }, from: '2026-10-10', to: '2026-10-11', query: '' }, 'без «я» — как раньше');

/* ---------- промпт: повтор в строках, scope «me» и примеры ---------- */
const [sys, user] = buildMessages('удали йогу в субботу', ctx());
assert.match(user.text, /task:y1 \| Йога \| 2026-09-05 19:00 \| повтор: каждую сб/);
assert.match(user.text, /task:d1 \| Ужин у родителей \| 2026-10-10 19:00\n/, 'у обычного дела пометки нет');
assert.match(sys.text, /"me" — только сам говорящий/);
assert.match(sys.text, /«Удали йогу в субботу»/);
assert.match(sys.text, /«Перенеси стоматолога на пятницу на два и добавь Карину»/);
assert.match(sys.text, /«Что я делаю на выходных\?» → .*"scope":"me"/);

/* ---------- S1 через HTTP: проверка общей группы не читает все группы на каждую операцию (REVIEW-v2, V2-3) ---------- */
{
  // Импорт здесь, а не в шапке: блок не зависит от остального файла
  const { buildApp } = await import('../src/app.js');
  const { signToken } = await import('../src/auth.js');
  const { MemoryStore } = await import('../src/store/memory.js');
  const store = new MemoryStore();
  let groupReads = 0;
  const getGroups = store.getGroups.bind(store);
  store.getGroups = async (ids) => ((groupReads += ids.length), getGroups(ids));
  const app = await buildApp({ store });
  for (const [id, name] of [['o1', 'Оля'], ['a1', 'Аня'], ['x1', 'Чужой']]) await store.putUser({ id, name, createdAt: 'c' });
  const ops = async (uid: string, ...list: unknown[]) => {
    const r = await app.inject({ method: 'POST', url: '/ops', payload: { ops: list }, headers: { authorization: `Bearer ${signToken(uid)}` } });
    assert.equal(r.statusCode, 200, r.body);
    return JSON.parse(r.body).results;
  };
  const [g] = await ops('o1', { op: 'group.create', group: { id: 'g', name: 'Друзья', category: 'friends' } });
  await ops('a1', { op: 'group.join', code: g.group.inviteCode });
  await ops('o1', { op: 'wish.put', wish: { id: 'w', title: 'Наушники', note: '', link: '', receivedAt: null } });
  // У Ани — ещё 400 своих групп
  for (const p of ['ga', 'gb']) await ops('a1', ...Array.from({ length: 200 }, (_, i) => ({ op: 'group.create', group: { id: `${p}${i}`, name: 'g', category: 'other' } })));
  groupReads = 0;
  const res = await ops('a1', ...Array.from({ length: 200 }, (_, i) => ({ op: 'wish.gift', ownerId: 'o1', id: 'w', gifted: i % 2 === 0 })));
  assert.ok(res.every((r: { ok: boolean }) => r.ok), JSON.stringify(res[0]));
  assert.ok(groupReads <= 200 * 20, `200 операций wish.gift прочитали ${groupReads} групп`);
  // Права те же: без общей группы — forbidden; общая группа по спискам, но человека в ней уже нет — тоже
  assert.equal((await ops('x1', { op: 'wish.gift', ownerId: 'o1', id: 'w', gifted: true }))[0].error, 'forbidden');
  await store.addMembership('x1', 'g');
  assert.equal((await ops('x1', { op: 'wish.gift', ownerId: 'o1', id: 'w', gifted: true }))[0].error, 'forbidden', 'устаревшая запись членства прав не даёт');
  assert.equal((await ops('o1', { op: 'wish.put', wish: { id: 'w', title: 'Наушники', note: '', link: '', receivedAt: 'r', giftedBy: 'x1' } }))[0].error, 'bad_member');
  await app.close();
}

/* ---------- S1: хотелка глазами владельца и других ---------- */
const base: Wish = { id: 'w', ownerId: 'u1', title: 'Наушники', note: '', link: '', receivedAt: null, createdAt: 'c', updatedAt: 'u' };
const gifted: Wish = { ...base, giftedBy: 'u7', giftedAt: '2026-10-06T10:00:00.000Z' };
assert.deepEqual(wishView(gifted, 'u1', 2), base, 'владелец до «получил» не видит подарка');
assert.deepEqual(wishView(gifted, 'u1', 1), base);
assert.deepEqual(wishView({ ...gifted, receivedAt: 'r' }, 'u1', 2), { ...gifted, receivedAt: 'r' }, 'после «получил» — видит, от кого');
assert.deepEqual(wishView(gifted, 'u7', 2), gifted, 'другие видят как есть');
assert.equal(wishView(gifted, 'u7', 1).receivedAt, gifted.giftedAt, 'старое приложение — через receivedAt');
assert.deepEqual(wishView(base, 'u7', 1), base, 'без подарка ничего не меняется');

/* ---------- S1 через HTTP: подарок не выдаёт себя ревизией владельца (REVIEW-v2, V2-2) ---------- */
{
  const store = new MemoryStore();
  const app = await buildApp({ store });
  for (const [id, name] of [['o1', 'Оля'], ['b1', 'Боря']]) await store.putUser({ id, name, createdAt: 'c' });
  const req = async (url: string, uid: string, body: unknown) => {
    const r = await app.inject({ method: 'POST', url, payload: body as any, headers: { authorization: `Bearer ${signToken(uid)}`, 'x-kstati-api': '2' } });
    assert.equal(r.statusCode, 200, r.body);
    return JSON.parse(r.body);
  };
  const ops = async (uid: string, ...list: unknown[]) => (await req('/ops', uid, { ops: list })).results;
  const [g] = await ops('o1', { op: 'group.create', group: { id: 'g', name: 'Друзья', category: 'friends' } });
  await ops('b1', { op: 'group.join', code: g.group.inviteCode });
  await ops('o1', { op: 'wish.put', wish: { id: 'w', title: 'Наушники', note: '', link: '', receivedAt: null } });
  const known = async (uid: string) => {
    const s = await req('/sync', uid, {});
    return { groups: s.revs.groups, owners: s.revs.owners };
  };
  const [kO, kB] = [await known('o1'), await known('b1')];
  assert.deepEqual((await ops('b1', { op: 'wish.gift', ownerId: 'o1', id: 'w', gifted: true }))[0], { ok: true });
  const sO = await req('/sync', 'o1', kO);
  assert.equal(sO.revs.owners.o1, kO.owners.o1, 'ревизия владельца после подарка не меняется');
  assert.deepEqual(sO.wishes, {}, 'и хотелки владельцу заново не присылаются');
  const sB = await req('/sync', 'b1', kB);
  assert.notEqual(sB.revs.owners.o1, kB.owners.o1, 'остальные видят новую ревизию');
  assert.equal(sB.wishes.o1[0].giftedBy, 'b1', 'и получают подарок');
  // Владелец отметил «получил» — его ревизия растёт как обычно, и теперь он видит, от кого
  await ops('o1', { op: 'wish.put', wish: { id: 'w', title: 'Наушники', note: '', link: '', receivedAt: '2026-10-06T10:00:00.000Z' } });
  const sO2 = await req('/sync', 'o1', kO);
  assert.equal(sO2.wishes.o1[0].giftedBy, 'b1');
  const sB2 = await req('/sync', 'b1', { groups: sB.revs.groups, owners: sB.revs.owners });
  assert.ok(sB2.revs.owners.o1 > sB.revs.owners.o1, 'общая ревизия для остальных только растёт');
  await app.close();
}

console.log('✓ v2: повтор в правках, «что я делаю», промпт, подарки');
