/** ПоискКино: выбор фильма из ответа поиска, кэш и лимит (сеть подменена) */
import assert from 'node:assert/strict';
import { config } from '../src/config.js';
import { Data } from '../src/api.js';
import { lookupFilm, pickFilm, searchResult } from '../src/films.js';
import { MemoryStore } from '../src/store/memory.js';

const docs = [
  { id: 1, name: 'Дюна', year: 1984, type: 'movie', rating: { kp: 6.6 }, votes: { kp: 30000 }, genres: [{ name: 'фантастика' }], countries: [{ name: 'США' }] },
  { id: 2, name: 'Дюна', year: 2021, type: 'movie', rating: { kp: 7.77 }, votes: { kp: 400000 }, genres: [{ name: 'фантастика' }, { name: 'драма' }, { name: 'боевик' }, { name: 'приключения' }], countries: [{ name: 'США' }, { name: 'Канада' }] },
  { id: 3, name: 'Дюна: Часть вторая', year: 2024, type: 'movie', rating: { kp: 8.3 }, votes: { kp: 500000 } },
  { id: 4, name: 'Брат', shortDescription: 'Демобилизованный Данила едет в Петербург', year: 1997, type: 'movie', rating: { kp: 8.3 }, votes: { kp: 600000 }, genres: [{ name: 'криминал' }], countries: [{ name: 'Россия' }] },
];

assert.deepEqual(pickFilm(docs, 'дюна', null), { kpId: 2, rating: 7.8, year: 2021, genres: ['scifi', 'drama', 'action'], kind: 'movie', origin: 'foreign', description: '' }, 'самый известный с таким названием');
assert.equal(pickFilm(docs, 'Дюна', 1984)?.kpId, 1, 'год назван — этот год');
assert.equal(pickFilm(docs, 'Брат', null)?.origin, 'ru');
assert.equal(pickFilm(docs, 'Дюна часть вторая', null)?.kpId, 3, 'знаки препинания не мешают');
assert.equal(pickFilm(docs, 'Интерстеллар', null), null, 'другое название — не берём');
assert.equal(pickFilm('мусор', 'Дюна', null), null);
assert.equal(pickFilm(docs, 'Брат', null)?.description, 'Демобилизованный Данила едет в Петербург');
assert.deepEqual(searchResult(docs, 'Дюнна', null), { film: null, suggest: { title: 'Дюна', year: 1984 } }, 'опечатка — подсказка');

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
assert.equal((await lookupFilm(store, 'Дюна', null, { fetch: fake }))?.film?.kpId, 2);
assert.equal((await lookupFilm(store, 'дюна', null, { fetch: fake }))?.film?.kpId, 2, 'повтор — из кэша');
assert.equal(calls, 1);
assert.equal((await lookupFilm(store, 'Интерстеллар', null, { fetch: fake }))?.film, null);
assert.equal(await lookupFilm(store, 'Брат', null, { fetch: fake }), null, 'лимит на сутки исчерпан — не искали');
assert.equal(calls, 2);

/* ---------- «Смотреть»: новая запись и старые (enrich) ---------- */
config.poiskkinoDaily = 100;
const now = new Date().toISOString();
const S = { id: 's', name: 'Саня', createdAt: now };
await store.putUser(S);
await store.putGroup({ id: 'g', name: 'g', category: 'family', inviteCode: 'G', ownerId: 's', adminIds: [], memberIds: ['s'], createdAt: now });
await store.addMembership('s', 'g');
const data = new Data(store, { fetch: fake });
const watch = async (id: string) => (await store.getItem('g', id)) as any;
await data.apply(S, { op: 'watch.put', watch: { id: 'w1', groupId: 'g', title: 'Брат', kind: null, genres: [], origin: null, year: null, watchedAt: null } } as any);
let w = await watch('w1');
assert.deepEqual([w.rating, w.year, w.origin, w.genres, w.description, w.suggestion], [8.3, 1997, 'ru', ['thriller'], 'Демобилизованный Данила едет в Петербург', null]);
await data.apply(S, { op: 'watch.put', watch: { id: 'w1', groupId: 'g', title: 'Брат', kind: 'movie', genres: ['drama'], origin: 'ru', year: 1997, watchedAt: now } } as any);
w = await watch('w1');
assert.deepEqual([w.rating, w.genres], [8.3, ['drama']], 'название то же — рейтинг остаётся, свои жанры — свои');
await data.apply(S, { op: 'watch.put', watch: { id: 'w2', groupId: 'g', title: 'Дюнна', kind: null, genres: [], origin: null, year: null, watchedAt: null } } as any);
assert.deepEqual((await watch('w2')).suggestion, { title: 'Дюна', year: 1984 }, 'опечатка — подсказка в записи');
// Старая запись без поиска — дополняется
await store.putItem({ type: 'watch', id: 'w3', groupId: 'g', title: 'Дюна', kind: null, genres: [], origin: null, year: null, addedBy: 's', watchedAt: null, createdAt: now, updatedAt: now });
assert.deepEqual(await data.enrichWatch(S as any, 'g'), { updated: 1, left: 0 });
assert.equal((await watch('w3')).rating, 7.8);
assert.deepEqual(await data.enrichWatch(S as any, 'g'), { updated: 0, left: 0 }, 'второй раз — нечего');
Object.assign(config, saved);

console.log('✓ ПоискКино: выбор фильма, кэш, лимит');
