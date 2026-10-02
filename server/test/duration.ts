/**
 * Длительность, участники и подзадачи в голосе: разбор фраз кодом и нормализация ответа модели.
 *   npm test
 */
import assert from 'node:assert/strict';
import { endFrom, normalize } from '../src/parse.js';
import { spokenDateRange, spokenDuration, spokenSpan, spokenTime, spokenUntil } from '../src/spoken.js';
import type { Context } from '../src/types.js';

// Промежутки времени
assert.deepEqual(spokenSpan('футбол в среду с 18 до 20'), { start: '18:00', end: '20:00' });
assert.deepEqual(spokenSpan('с семи до девяти'), { start: '19:00', end: '21:00' });
assert.deepEqual(spokenSpan('созвон с 9:30 до 11'), { start: '09:30', end: '11:00' });
assert.deepEqual(spokenSpan('с 10 до 2'), { start: '10:00', end: '14:00' });
assert.deepEqual(spokenSpan('с 8 до 10 утра'), { start: '08:00', end: '10:00' });
assert.equal(spokenSpan('с 7 по 9 октября'), null, 'это даты, не время');
assert.equal(spokenUntil('продли футбол до 21'), '21:00');
assert.equal(spokenUntil('до девяти'), '09:00', 'без начала 9 — утро');

// Длительность
assert.equal(spokenDuration('баня на два часа'), 120);
assert.equal(spokenDuration('на час'), 60);
assert.equal(spokenDuration('на полтора часа'), 90);
assert.equal(spokenDuration('на полчаса'), 30);
assert.equal(spokenDuration('на 45 минут'), 45);
assert.equal(spokenDuration('на два с половиной часа'), 150);
assert.equal(spokenDuration('перенеси на час позже'), null);
// «На два часа» — не время начала
assert.equal(spokenTime('баня в субботу на два часа'), null);
assert.equal(spokenTime('баня в субботу в 15 на два часа'), '15:00');
assert.equal(spokenTime('столик на 7 часов вечера'), '19:00');

// Периоды дат
assert.deepEqual(spokenDateRange('поездка с 7 по 9 октября', '2026-10-02'), { from: '2026-10-07', to: '2026-10-09' });
assert.deepEqual(spokenDateRange('с 30 сентября по 2 октября', '2026-09-20'), { from: '2026-09-30', to: '2026-10-02' });
assert.deepEqual(spokenDateRange('дача с пятницы по воскресенье', '2026-10-02'), { from: '2026-10-02', to: '2026-10-04' });
assert.equal(spokenDateRange('в субботу в 10', '2026-10-02'), null);

assert.deepEqual(endFrom('2026-10-02', '18:00', 150), { endDate: null, endTime: '20:30' });
assert.deepEqual(endFrom('2026-10-02', '23:00', 120), { endDate: '2026-10-03', endTime: '01:00' });

const ctx = (extra: Partial<Context> = {}): Context => ({
  today: '2026-10-02',
  now: '12:00',
  me: { id: 'u1', name: 'Саша' },
  people: [{ id: 'u2', name: 'Карина' }],
  groupMembers: ['u1', 'u2'],
  existing: {
    tasks: [
      { id: 't9', title: 'Поездка в Питер', date: '2026-10-07', time: null, endDate: '2026-10-09', people: ['Саша', 'Карина'] },
      { id: 't1', title: 'Футбол', date: '2026-10-07', time: '19:00', endTime: '21:00', people: ['Саша'] },
    ],
    watch: [],
    wishes: [],
  },
  ...extra,
});
const task = (r: ReturnType<typeof normalize>) => {
  if (r.type !== 'items' || r.items[0].type !== 'task') throw new Error(JSON.stringify(r));
  return r.items[0].data;
};

// «С 18 до 20» — считаем кодом, даже если модель конец не дала
let d = task(normalize([{ intent: 'add', type: 'task', title: 'Футбол', date: '2026-10-07', time: '18:00' }], ctx(), 'футбол в среду с 18 до 20'));
assert.deepEqual([d.date, d.time, d.endTime, d.endDate], ['2026-10-07', '18:00', '20:00', undefined]);
// «На два часа» — конец от начала
d = task(normalize([{ intent: 'add', type: 'task', title: 'Баня', date: '2026-10-03', time: '15:00' }], ctx(), 'баня в субботу в 15 на два часа'));
assert.equal(d.endTime, '17:00');
// Многодневное и «мы с Кариной»
d = task(normalize([{ intent: 'add', type: 'task', title: 'Поездка в Питер', date: '2026-10-09', time: null, people: ['me', 'Карина'] }], ctx(), 'мы с кариной едем в питер с 7 по 9 октября'));
assert.deepEqual([d.date, d.endDate, d.people], ['2026-10-07', '2026-10-09', ['u1', 'u2']]);
// «Мы» — вся группа; чужие имена отбрасываются
d = task(normalize([{ intent: 'add', type: 'task', title: 'Ужин', date: '2026-10-03', time: '19:00', people: ['all', 'Вася'] }], ctx(), 'у нас ужин в субботу в семь'));
assert.deepEqual(d.people, ['u1', 'u2']);
// Подзадача: время без даты — в первый день плана
d = task(normalize([{ intent: 'add', type: 'task', title: 'Эрмитаж', date: null, time: '10:00', duration_min: 120, parent: 'task:t9' }], ctx(), 'в поездку в питер добавь эрмитаж в 10 на два часа'));
assert.deepEqual([d.parentId, d.date, d.time, d.endTime], ['t9', '2026-10-07', '10:00', '12:00']);
// Открыт план — новые дела в него, даже если модель план не назвала
d = task(normalize([{ intent: 'add', type: 'task', title: 'Заселение', date: null, time: null }], ctx({ currentParentId: 't9' }), 'заселение'));
assert.equal(d.parentId, 't9');
// Подзадача подзадачи не бывает
d = task(normalize([{ intent: 'add', type: 'task', title: 'X', date: null, time: null, parent: 't1' }], ctx(), 'x'));
assert.equal(d.parentId, 't1', 'обычное дело может стать планом');

// Правка длительности голосом
const ch = (r: ReturnType<typeof normalize>) => {
  if (r.type !== 'changes') throw new Error(JSON.stringify(r));
  return r.changes[0].patch;
};
assert.deepEqual(ch(normalize([{ intent: 'update', target: ['t1'], query: 'футбол' }], ctx(), 'продли футбол до 22')), { endTime: '22:00', endDate: null });
assert.deepEqual(ch(normalize([{ intent: 'update', target: ['t1'], query: 'футбол' }], ctx(), 'продли футбол до девяти')), { endTime: '21:00', endDate: null });
assert.deepEqual(ch(normalize([{ intent: 'update', target: ['t1'], query: 'футбол' }], ctx(), 'перенеси футбол на с 18 до 20')), { time: '18:00', endTime: '20:00', endDate: null });
assert.deepEqual(ch(normalize([{ intent: 'update', target: ['t1'], people: ['Карина'], query: 'футбол' }], ctx(), 'добавь карину в футбол')), { people: ['u1', 'u2'] });

console.log('✓ длительность, участники и подзадачи');
