/**
 * «Обучение» (src/practice.ts): согласие, выдача карточки, сверка попытки с образцом, отметка, выгрузка, удаление.
 *   npm test
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildApp } from '../src/app.js';
import { signToken } from '../src/auth.js';
import { deletePracticeOf, explainResult, makeDeck, pickCard, wantOf, type Card } from '../src/practice.js';
import { resultKey, sameResult, sameText } from '../src/practiceCheck.js';
import { MemoryStore } from '../src/store/memory.js';
import type { ParseResult } from '../src/types.js';

/* ---------- сравнение ---------- */
assert.ok(sameText('Запиши в пятницу в 18 00 Ёлку.', 'запиши в пятницу в 18:00 елку'), 'регистр, «ё», знаки и запись времени не мешают');
assert.ok(!sameText('в пятницу в семь', 'в пятницу в семя'));
const item = (title: string, date: string): ParseResult => ({ type: 'items', items: [{ key: Math.random().toString(), type: 'task', data: { title, date, time: null, note: '' } }] });
assert.ok(sameResult(item('Баня', '2026-11-20'), item('баня.', '2026-11-20')), 'ключ, регистр и точка не сравниваются');
assert.ok(!sameResult(item('Баня', '2026-11-20'), item('Сауна', '2026-11-20')));
assert.ok(sameResult(item('Баня', '2026-11-20'), item('Сауна', '2026-11-20'), true), 'мягко — без названий');
assert.ok(!sameResult(item('Баня', '2026-11-20'), item('Баня', '2026-11-21'), true), 'мягко — дата сверяется');

/* ---------- карточки ---------- */
const cards = readFileSync(new URL('../data/practice.ndjson', import.meta.url), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as Card);
assert.ok(cards.length > 500, 'карточки собраны (npx tsx train/practice-deck.ts)');
assert.equal(new Set(cards.map((c) => c.id)).size, cards.length, 'id не повторяются');
for (const c of cards.slice(0, 200)) assert.notEqual(resultKey(wantOf(c)), '', `образец разбирается: ${c.phrase}`);
const deck = makeDeck(cards);
const variants = [...deck.byVariant.keys()];
// Вид с ошибками выпадает чаще остальных
const stats = { [variants[0]!]: { n: 40, bad: 40 }, ...Object.fromEntries(variants.slice(1).map((v) => [v, { n: 40, bad: 0 }])) };
let seed = 1;
const rnd = () => ((seed = (seed * 16807) % 2147483647), seed / 2147483647);
const hits = Array.from({ length: 2000 }, () => pickCard(deck, [], stats, rnd)!.variant).filter((v) => v === variants[0]).length;
assert.ok(hits > (2000 / variants.length) * 3, `вид с ошибками — чаще (${hits})`);
const one = makeDeck(cards.slice(0, 2));
assert.equal(pickCard(one, [cards[0]!.id], {}, rnd)!.id, cards[1]!.id, 'виденные не повторяются, пока есть новые');

/* ---------- запросы ---------- */
const store = new MemoryStore();
await store.putUser({ id: 'u1', name: 'Саня', createdAt: new Date().toISOString() });
let reply: ParseResult = { type: 'unknown' };
const app = await buildApp({
  store,
  parse: async () => ({ result: reply, raw: '{}', usage: { input: 0, output: 0 } as never, attempts: 1, path: 'tuned' }),
  toOgg: async (b) => ({ ogg: Buffer.from(`ogg:${b.length}`), seconds: 2 }),
});
const T = signToken('u1');
const call = async (method: 'GET' | 'POST', url: string, body?: unknown, token = T) => {
  const r = await app.inject({ method, url, payload: body as never, headers: { authorization: `Bearer ${token}` } });
  return { status: r.statusCode, body: r.json() as any };
};
assert.equal((await call('GET', '/practice/next')).body.consent, false, 'без согласия карточек нет');
assert.equal((await call('POST', '/practice/attempt', { cardId: cards[0]!.id, mode: 'say', text: 'привет' })).status, 403);
await call('POST', '/practice/consent');
const next = (await call('GET', '/practice/next')).body;
assert.equal(next.consent, true);
const card = deck.byId.get(next.card.id)!;
assert.ok(card && (next.card.mode === 'say' ? next.card.text === card.phrase && !next.card.brief : !next.card.text && next.card.brief.length), 'фраза или задание');

// Услышано и разобрано верно; с записью голоса
reply = wantOf(card);
const good = (await call('POST', '/practice/attempt', { cardId: card.id, mode: 'say', text: card.phrase, alts: [card.phrase, 'другое'], audio: Buffer.from('wav').toString('base64'), device: 'test' })).body;
assert.deepEqual([good.sttOk, good.parseOk, good.progress.total], [true, true, 1]);
// Услышано с ошибкой, разбор другой
reply = { type: 'unknown' };
const bad = (await call('POST', '/practice/attempt', { cardId: card.id, mode: 'say', text: `${card.phrase} семя` })).body;
assert.deepEqual([bad.sttOk, bad.parseOk, bad.progress.today], [false, card.variant === 'unknown', 2]);
// Та же карточка ещё раз — только фразой
const again = (await call('GET', `/practice/next?again=${card.id}`)).body.card;
assert.deepEqual([again.id, again.mode], [card.id, 'say']);
// Отметки независимы. «Сказал иначе»: текст не сверяется, разбор — без названий; вердикт приходит заново
assert.equal(typeof good.did, 'string');
reply = wantOf(card);
const own = (await call('POST', '/practice/attempt', { cardId: card.id, mode: 'say', text: `${card.phrase} пожалуйста` })).body;
assert.equal(own.sttOk, false);
const f1 = (await call('POST', '/practice/flag', { id: own.id, said: true })).body;
assert.deepEqual([f1.sttOk, f1.parseOk, f1.said, f1.card], [null, true, true, false]);
const f2 = (await call('POST', '/practice/flag', { id: own.id, card: true })).body;
assert.deepEqual([f2.said, f2.card], [true, true], 'вторая отметка первую не снимает');
const f3 = (await call('POST', '/practice/flag', { id: own.id, said: false })).body;
assert.deepEqual([f3.sttOk, f3.said, f3.card], [false, false, true]);
assert.equal((await call('POST', '/practice/flag', { id: bad.id, flag: 'said' })).body.said, true, 'отметка первой версии приложения');
assert.equal((await call('POST', '/practice/flag', { id: bad.id, said: true }, signToken('u2'))).status, 401, 'чужая попытка');
// Карточка с двумя отметками «плохая» больше не выдаётся
await call('POST', '/practice/flag', { id: bad.id, card: true });
assert.deepEqual(await store.getTemp('practice#bad'), { [card.id]: 2 });
for (let i = 0; i < 30; i++) assert.notEqual((await call('GET', '/practice/next')).body.card.id, card.id, 'плохая карточка скрыта');

const log = await store.listLog<any>('practice', '', 10);
assert.equal(log.length, 3);
assert.deepEqual([log[0]!.value.audio, log[0]!.value.alts, log[1]!.value.said, log[1]!.value.card, log[2]!.value.card], [true, ['другое'], true, true, true]);
assert.equal((await store.listLog('practice-audio', '', 10)).length, 1, 'запись голоса сохранена');
assert.equal((await call('GET', '/admin/practice')).status, 401, 'выгрузка — только админу');

// Оценка человека: «неверно» при несовпадении — ошибка модели; «верно» при несовпадении — образец под вопросом
reply = { type: 'unknown' };
const rated = (await call('POST', '/practice/attempt', { cardId: cards[5]!.id, mode: 'say', text: cards[5]!.phrase })).body;
if (!rated.parseOk) {
  const r1 = (await call('POST', '/practice/flag', { id: rated.id, good: false, note: 'не то название' })).body;
  assert.deepEqual([r1.good, r1.card], [false, false]);
  const r2 = (await call('POST', '/practice/flag', { id: rated.id, good: true })).body;
  assert.deepEqual([r2.good, r2.card], [true, true]);
  const kept = (await store.listLog<any>('practice', '', 10)).at(-1)!.value;
  assert.deepEqual([kept.good, kept.note, kept.card], [true, undefined, true], 'комментарий — только у «неверно»');
}

// Итог словами
assert.equal(explainResult({ type: 'queryWatch', filters: { kind: ['cartoon'], genre: [], origin: [], fresh: [] } }, card.ctx), 'Что посмотреть: мультфильмы');
assert.equal(explainResult(item('Баня', '2026-11-20'), card.ctx), 'Дело «Баня» · 20 ноября, пятница');

await deletePracticeOf(store, 'u1');
assert.equal((await store.listLog('practice', '', 10)).length + (await store.listLog('practice-audio', '', 10)).length, 0, 'с аккаунтом стирается всё');
assert.equal((await call('GET', '/practice/next')).body.consent, false);
await app.close();
console.log('practice: ok');
