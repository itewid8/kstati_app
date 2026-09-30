/**
 * Повторы голосом: распознавание («каждую субботу», «по будням»…) и разбор фразы с повтором.
 * Без сети и без модели: ответ модели подставляется вручную.
 *   npm test
 */
import assert from 'node:assert/strict';
import { normalize } from '../src/parse.js';
import { changesRepeat, firstDate, spokenRepeat, stripRepeat } from '../src/repeat.js';
import { normalizeTimes } from '../src/spoken.js';
const T = '2026-09-25'; // пятница
const cases: [string, object | null, string?][] = [
  ['Баня каждую субботу', { freq: 'week', every: 1, weekdays: [6] }, '2026-09-26'],
  ['По будням зарядка в 8 утра', { freq: 'week', every: 1, weekdays: [1, 2, 3, 4, 5] }, '2026-09-25'],
  ['Каждый день пить витамины', { freq: 'day', every: 1 }, '2026-09-25'],
  ['Ежедневно гулять с собакой в семь', { freq: 'day', every: 1 }],
  ['Раз в две недели по средам уборка', { freq: 'week', every: 2, weekdays: [3] }, '2026-09-30'],
  ['Каждые 3 дня поливать цветы', { freq: 'day', every: 3 }],
  ['Через день бассейн', { freq: 'day', every: 2 }],
  ['Оплатить интернет каждое 20 число', { freq: 'month', every: 1, monthDays: [20] }, '2026-10-20'],
  ['Каждый месяц 1 и 15 числа зарплата', { freq: 'month', every: 1, monthDays: [1, 15] }, '2026-10-01'],
  ['Платить за квартиру в последний день месяца каждый месяц', { freq: 'month', every: 1, monthDays: [-1] }, '2026-09-30'],
  ['Каждое 8 марта поздравить маму', { freq: 'year', every: 1, months: [3], monthDays: [8] }, '2027-03-08'],
  ['Каждый год 15 мая годовщина', { freq: 'year', every: 1, months: [5], monthDays: [15] }, '2027-05-15'],
  ['По понедельникам и четвергам тренировка', { freq: 'week', every: 1, weekdays: [1, 4] }, '2026-09-28'],
  ['Каждую субботу баня до конца года', { freq: 'week', every: 1, weekdays: [6], until: '2026-12-31' }],
  ['Каждую среду английский до 1 декабря', { freq: 'week', every: 1, weekdays: [3], until: '2026-12-01' }],
  ['Каждый вторник массаж 10 раз', { freq: 'week', every: 1, weekdays: [2], count: 10 }],
  ['Раз в полгода к стоматологу', { freq: 'month', every: 6 }],
  ['По выходным завтрак у родителей', { freq: 'week', every: 1, weekdays: [6, 7] }, '2026-09-26'],
  ['Еженедельно созвон с командой', { freq: 'week', every: 1 }],
  // Не повтор
  ['В субботу баня', null],
  ['Два раза в неделю бегать', null],
  ['Ужин у родителей в воскресенье', null],
];
for (const [text, exp, first] of cases) {
  const r = spokenRepeat(text, T);
  assert.deepEqual(r, exp, text);
  if (r && first) assert.equal(firstDate(r, null, T), first, `${text}: первый раз`);
}
assert.equal(stripRepeat('Баня каждую субботу'), 'Баня');
assert.equal(stripRepeat('Каждый день пить витамины'), 'Пить витамины');
assert.equal(stripRepeat('Уборка раз в две недели по средам'), 'Уборка');
assert.equal(stripRepeat('Тренировка по понедельникам и четвергам'), 'Тренировка');
assert.equal(stripRepeat('Зарядка по будням'), 'Зарядка');
assert.equal(stripRepeat('Баня'), 'Баня');
assert.equal(stripRepeat('Оплатить интернет каждое 20 число'), 'Оплатить интернет');
assert.equal(stripRepeat('Зарплата 1 и 15 числа'), 'Зарплата');
assert.equal(stripRepeat('Платить за квартиру в последний день месяца'), 'Платить за квартиру');
assert.equal(stripRepeat('Поздравить маму каждое 8 марта'), 'Поздравить маму');
assert.equal(stripRepeat('Поздравить маму 8 марта'), 'Поздравить маму 8 марта', 'без «каждое» дату в названии не трогаем');
assert.equal(firstDate({ freq: 'week', every: 1, weekdays: [6] }, '2026-10-03', T), '2026-10-03', 'названная дата подходит');
assert.ok(changesRepeat('Баню теперь каждое воскресенье'));
assert.ok(changesRepeat('Больше не повторяй зарядку'));
assert.ok(!changesRepeat('Баня каждую субботу'));

const ctx: any = {
  today: '2026-09-25', now: '12:00', me: { id: 'u1', name: 'Саша' }, people: [],
  existing: { tasks: [{ id: 't3', title: 'Ужин у родителей', date: '2026-09-26', time: '19:00' }, { id: 't8', title: 'Баня', date: '2026-09-26', time: null }], watch: [], wishes: [] },
};
const add = (title: string, date: string | null, time: string | null = null) => [{ intent: 'add', type: 'task', title, date, time, note: '' }];
// Модель оставила повтор в названии и не дала дату
let r: any = normalize(add('Баня каждую субботу', null) as any, ctx, 'Баня каждую субботу');
assert.equal(r.type, 'items');
assert.deepEqual(r.items[0].data, { title: 'Баня', date: '2026-09-26', time: null, note: '', repeat: { freq: 'week', every: 1, weekdays: [6] } });
r = normalize(add('Зарядка', '2026-09-25', '08:00') as any, ctx, 'По будням зарядка в 8 утра');
assert.deepEqual(r.items[0].data.repeat, { freq: 'week', every: 1, weekdays: [1, 2, 3, 4, 5] });
assert.equal(r.items[0].data.date, '2026-09-25');
// Модель решила «добавить» — а это правка повтора существующей бани
r = normalize(add('Баня', '2026-09-27') as any, ctx, 'Баню теперь каждое воскресенье');
assert.equal(r.type, 'changes', JSON.stringify(r));
assert.equal(r.changes[0].chosen, 't8');
assert.deepEqual(r.changes[0].patch.repeat, { freq: 'week', every: 1, weekdays: [7] });
assert.equal(r.changes[0].patch.date, '2026-09-27');
// Модель поняла как update без полей
r = normalize([{ intent: 'update', target: ['t3'], query: 'ужин' }] as any, ctx, 'Ужин у родителей теперь каждое воскресенье');
assert.equal(r.type, 'changes', JSON.stringify(r));
assert.deepEqual(r.changes[0].patch.repeat.weekdays, [7]);
// «Больше не повторяй» — модель сказала delete
r = normalize([{ intent: 'delete', target: ['t3'], query: 'ужин' }] as any, ctx, 'Больше не повторяй ужин у родителей');
assert.equal(r.type, 'changes');
assert.equal(r.changes[0].action, 'update');
assert.equal(r.changes[0].patch.repeat, null);
// «Каждую пятницу» в пятницу — начиная с сегодня; «с понедельника каждый день» — с понедельника
r = normalize(add('Футбол', '2026-10-02', '18:00') as any, ctx, 'Футбол каждую пятницу в 6 вечера');
assert.equal(r.items[0].data.date, '2026-09-25');
r = normalize(add('Зарядка', '2026-09-28') as any, ctx, 'Зарядка каждый день с понедельника');
assert.equal(r.items[0].data.date, '2026-09-28');
// Время, записанное распознаванием через пробел
{
  assert.equal(normalizeTimes('Добавь сегодня в 18 0 0 футбол'), 'Добавь сегодня в 18:00 футбол');
  assert.equal(normalizeTimes('ужин в 19 30'), 'ужин в 19:30');
  assert.equal(normalizeTimes('встреча 18 00'), 'встреча 18:00');
  assert.equal(normalizeTimes('на 15 30 числа'), 'на 15 30 числа', 'числа — не время');
  assert.equal(normalizeTimes('за 8 30 минут'), 'за 8 30 минут');
  assert.equal(normalizeTimes('купить 2 00 рублей'), 'купить 2 00 рублей');
}
// Модель приняла дело со временем за передачу в «Смотреть»
r = normalize([{ intent: 'add', type: 'watch', title: 'Футбол', kind: 'show' }] as any, ctx, 'Добавь сегодня в 18:00 футбол');
assert.equal(r.items[0].type, 'task', JSON.stringify(r));
assert.equal(r.items[0].data.time, '18:00');
r = normalize([{ intent: 'add', type: 'watch', title: 'Дюна', kind: 'movie' }] as any, ctx, 'Посмотреть Дюну в субботу');
assert.equal(r.items[0].type, 'watch', 'со словом «посмотреть» — это «Смотреть»');
// Обычное дело без повтора не трогаем
r = normalize(add('Баня', '2026-09-26') as any, ctx, 'В субботу баня');
assert.equal(r.items[0].data.repeat, undefined);
console.log('✓ повторы голосом: все проверки пройдены');
