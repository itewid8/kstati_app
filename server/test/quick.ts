/**
 * Простые команды без модели (src/quick.ts): что разбирается правилами и что обязательно уходит в модель.
 * Сегодня — пятница 25.09.2026, как в eval.
 */
import assert from 'node:assert/strict';
import { normalize } from '../src/parse.js';
import { quickParse } from '../src/quick.js';
import type { Context } from '../src/types.js';

const ctx: Context = {
  today: '2026-09-25',
  now: '12:00',
  me: { id: 'u1', name: 'Саша' },
  people: [
    { id: 'u2', name: 'Маша' },
    { id: 'u3', name: 'Дима' },
    { id: 'u7', name: 'Карина' },
  ],
  groups: [],
  existing: {
    tasks: [{ id: 't3', title: 'Ужин у родителей', date: '2026-09-26', time: '19:00' }],
    watch: [{ id: 'm1', title: 'Интерстеллар' }],
    wishes: [{ id: 'w1', title: 'Новые наушники' }],
  },
  api: 2,
};

type Exp = { type: 'task'; title: string; date: string | null; time: string | null; repeat?: string; end?: string } | { type: 'wish'; title: string };

const yes: [string, Exp][] = [
  ['Завтра в 7 йога', { type: 'task', title: 'Йога', date: '2026-09-26', time: '19:00' }],
  ['В субботу в семь ужин у родителей', { type: 'task', title: 'Ужин у родителей', date: '2026-09-26', time: '19:00' }],
  ['Через две недели забрать документы', { type: 'task', title: 'Забрать документы', date: '2026-10-09', time: null }],
  ['Надо позвонить в управляющую компанию', { type: 'task', title: 'Позвонить в управляющую компанию', date: null, time: null }],
  ['Завтра в 10 утра к стоматологу', { type: 'task', title: 'К стоматологу', date: '2026-09-26', time: '10:00' }],
  ['Послезавтра забрать машину из сервиса', { type: 'task', title: 'Забрать машину из сервиса', date: '2026-09-27', time: null }],
  ['купить молоко', { type: 'task', title: 'Купить молоко', date: null, time: null }],
  ['Запиши завтра в 7 вечера баню', { type: 'task', title: 'Баня', date: '2026-09-26', time: '19:00' }],
  ['Баня каждую субботу', { type: 'task', title: 'Баня', date: '2026-09-26', time: null, repeat: 'week' }],
  ['Каждую субботу в три баня', { type: 'task', title: 'Баня', date: '2026-09-26', time: '15:00', repeat: 'week' }],
  ['По будням зарядка в 8 утра', { type: 'task', title: 'Зарядка', date: '2026-09-25', time: '08:00', repeat: 'week' }],
  ['Каждый день пить витамины', { type: 'task', title: 'Пить витамины', date: '2026-09-25', time: null, repeat: 'day' }],
  ['Футбол в среду с семи до девяти', { type: 'task', title: 'Футбол', date: '2026-09-30', time: '19:00', end: '21:00' }],
  ['Оплатить интернет 3 октября', { type: 'task', title: 'Оплатить интернет', date: '2026-10-03', time: null }],
  ['В следующую субботу помыть машину', { type: 'task', title: 'Помыть машину', date: '2026-10-03', time: null }],
  ['Хочу новые наушники', { type: 'wish', title: 'Новые наушники' }],
  ['хочу наушники', { type: 'wish', title: 'Наушники' }],
  ['Хочу новую книгу', { type: 'wish', title: 'Новая книга' }],
];

const no = [
  'Запиши, что мы едем на дачу в следующую субботу',
  'Добавь в мой вишлист кроссовки, сорок второй размер',
  'Сохрани фильм Интерстеллар',
  'Было бы круто посмотреть Слово пацана',
  'Добавь Дюну и Аватар',
  'Что посмотрим?',
  'Что-нибудь смешное зарубежное',
  'Что подарить Маше?',
  'В воскресенье день рождения Димы',
  'Хочу посмотреть мультик Шрэк',
  'Перенеси дачу на воскресенье',
  'Перенеси ужин на восемь',
  'Мы посмотрели Интерстеллар',
  'Сделал оплату интернета',
  'Мне подарили наушники',
  'Удали ужин у родителей',
  'Переименуй лампочки в купить лампочки и батарейки',
  'Верни посылку в невыполненные',
  'Удали слона',
  'Ужин у родителей теперь каждое воскресенье',
  'Больше не повторяй ужин у родителей',
  'Какие у нас планы на завтра',
  'Когда у нас дача',
  'ммм',
  'Какая погода завтра',
  'молоко',
  'Карине к врачу завтра в 10',
  'Завтра Дима идёт в бассейн',
  'Мы с Кариной едем в Питер с 7 по 9 октября',
  'Купить хлеб и молоко',
  'Завтра в 7 баня, взять веники',
  'Запиши идею: виджет с погодой',
  'Запиши в заметки список продуктов молоко яйца хлеб',
  'Хочу в отпуск',
  'Хочу поехать на море',
  'Мне завтра к врачу',
  'Поставь напоминание что завтра мы едем на баню в 7 вечера',
  'Хочу кроссовки 42 размера',
];

let fail = 0;
for (const [phrase, exp] of yes) {
  const q = quickParse(phrase, ctx);
  const r = q ? normalize(q as never, ctx, phrase) : null;
  const it = r?.type === 'items' && r.items.length === 1 ? r.items[0] : null;
  let err = '';
  if (!it) err = `не разобрано правилами (${JSON.stringify(q)})`;
  else if (it.type !== exp.type) err = `тип ${it.type}`;
  else if (it.data.title !== exp.title) err = `название «${it.data.title}»`;
  else if (exp.type === 'task' && it.type === 'task') {
    const d = it.data;
    if (d.date !== exp.date) err = `дата ${d.date}`;
    else if (d.time !== exp.time) err = `время ${d.time}`;
    else if (exp.repeat && d.repeat?.freq !== exp.repeat) err = `повтор ${JSON.stringify(d.repeat)}`;
    else if (exp.end && d.endTime !== exp.end) err = `конец ${d.endTime}`;
  }
  if (err) {
    fail++;
    console.log(`✗ «${phrase}»: ${err}`);
  }
}
for (const phrase of no) {
  const q = quickParse(phrase, ctx);
  if (q) {
    fail++;
    console.log(`✗ «${phrase}» не должно разбираться правилами: ${JSON.stringify(q)}`);
  }
}
// Открыт план или тема — всегда модель
assert.equal(quickParse('Завтра в 7 йога', { ...ctx, currentParentId: 't3' }), null);
assert.equal(quickParse('купить молоко', { ...ctx, currentTopicId: 'x' }), null);
assert.equal(fail, 0, `${fail} ошибок`);
console.log(`✓ простые команды без модели: ${yes.length} разобрано, ${no.length} ушло в модель`);
