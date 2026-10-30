/** ПоискКино: выбор фильма из ответа поиска, кэш и лимит (сеть подменена) */
import assert from 'node:assert/strict';
import { config } from '../src/config.js';
import { lookupFilm, pickFilm } from '../src/films.js';
import { MemoryStore } from '../src/store/memory.js';

const docs = [
  { id: 1, name: 'Дюна', year: 1984, type: 'movie', rating: { kp: 6.6 }, votes: { kp: 30000 }, genres: [{ name: 'фантастика' }], countries: [{ name: 'США' }] },
  { id: 2, name: 'Дюна', year: 2021, type: 'movie', rating: { kp: 7.77 }, votes: { kp: 400000 }, genres: [{ name: 'фантастика' }, { name: 'драма' }, { name: 'боевик' }, { name: 'приключения' }], countries: [{ name: 'США' }, { name: 'Канада' }] },
  { id: 3, name: 'Дюна: Часть вторая', year: 2024, type: 'movie', rating: { kp: 8.3 }, votes: { kp: 500000 } },
  { id: 4, name: 'Брат', year: 1997, type: 'movie', rating: { kp: 8.3 }, votes: { kp: 600000 }, genres: [{ name: 'криминал' }], countries: [{ name: 'Россия' }] },
];

assert.deepEqual(pickFilm(docs, 'дюна', null), { kpId: 2, rating: 7.8, year: 2021, genres: ['scifi', 'drama', 'action'], kind: 'movie', origin: 'foreign' }, 'самый известный с таким названием');
assert.equal(pickFilm(docs, 'Дюна', 1984)?.kpId, 1, 'год назван — этот год');
assert.equal(pickFilm(docs, 'Брат', null)?.origin, 'ru');
assert.equal(pickFilm(docs, 'Дюна часть вторая', null)?.kpId, 3, 'знаки препинания не мешают');
assert.equal(pickFilm(docs, 'Интерстеллар', null), null, 'другое название — не берём');
assert.equal(pickFilm('мусор', 'Дюна', null), null);

const store = new MemoryStore();
let calls = 0;
const fake = (async () => {
  calls++;
  return new Response(JSON.stringify({ docs }), { status: 200 });
}) as typeof fetch;

const saved = { ...config };
config.poiskkinoKey = '';
assert.equal(await lookupFilm(store, 'Дюна', null, { fetch: fake }), null, 'без ключа не ищем');
assert.equal(calls, 0);
config.poiskkinoKey = 'test';
config.poiskkinoDaily = 2;
assert.equal((await lookupFilm(store, 'Дюна', null, { fetch: fake }))?.kpId, 2);
assert.equal((await lookupFilm(store, 'дюна', null, { fetch: fake }))?.kpId, 2, 'повтор — из кэша');
assert.equal(calls, 1);
assert.equal(await lookupFilm(store, 'Интерстеллар', null, { fetch: fake }), null);
assert.equal(await lookupFilm(store, 'Брат', null, { fetch: fake }), null, 'лимит на сутки исчерпан');
assert.equal(calls, 2);
Object.assign(config, saved);

console.log('✓ ПоискКино: выбор фильма, кэш, лимит');
