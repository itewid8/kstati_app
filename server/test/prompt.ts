/**
 * Компактный промпт (src/prompt.ts): нужные части правил на месте, лишних нет, промпт заметно короче полного.
 */
import assert from 'node:assert/strict';
import { normalize, worthFullRetry } from '../src/parse.js';
import { buildCompactMessages, buildMessages, pickBlocks } from '../src/prompt.js';
import type { Context } from '../src/types.js';

const ctx: Context = {
  today: '2026-09-25',
  now: '12:00',
  me: { id: 'u1', name: 'Саша' },
  people: [{ id: 'u7', name: 'Карина' }],
  groups: [{ name: 'Друзья', category: 'friends' }],
  topics: [{ id: 'p1', title: 'Список продуктов', body: '- [ ] Молоко\n- [ ] Хлеб' }],
  existing: {
    tasks: [
      { id: 't3', title: 'Ужин у родителей', date: '2026-09-26', time: '19:00' },
      { id: 't9', title: 'Поездка в Питер', date: '2026-10-07', time: null, endDate: '2026-10-09' },
      ...Array.from({ length: 40 }, (_, i) => ({ id: `x${i}`, title: `Дело номер ${i}`, date: null, time: null })),
    ],
    watch: [{ id: 'm1', title: 'Интерстеллар' }],
    wishes: [{ id: 'w1', title: 'Новые наушники' }],
  },
  api: 2,
};

const blocks = (p: string) => [...pickBlocks(p, ctx).blocks].sort().join(',');
assert.equal(blocks('Добавь Дюну и Аватар'), 'task,watch,wish');
assert.equal(blocks('Перенеси ужин на восемь'), 'change,task');
assert.equal(blocks('Мы посмотрели Интерстеллар'), 'change,task,watch');
assert.equal(blocks('Мне подарили наушники'), 'change,task,wish');
assert.equal(blocks('Что посмотрим?'), 'qwatch');
assert.equal(blocks('Что подарить Маше?'), 'qwish');
assert.equal(blocks('Какие у нас планы на выходные?'), 'plans');
assert.match(blocks('Запиши идею: виджет с погодой'), /ideas/);
assert.match(blocks('Добавь в список продуктов сыр'), /ideas/);
assert.match(blocks('В поездку в Питер добавь Эрмитаж в пятницу'), /parent/);

let full = 0;
let compact = 0;
for (const p of ['Добавь Дюну и Аватар', 'Перенеси ужин на восемь', 'Что посмотрим?', 'Мы с Кариной едем в Питер с 7 по 9 октября', 'Какие у нас планы на выходные?', 'Запиши идею: виджет с погодой']) {
  const [fs, fu] = buildMessages(p, ctx);
  const [cs, cu] = buildCompactMessages(p, ctx);
  full += fs.text.length + fu.text.length;
  compact += cs.text.length + cu.text.length;
  assert.ok(cs.text.includes('"intent":"unknown"'), 'правило «непонятно» есть всегда');
}
// «Перенеси ужин»: правила правок и только похожие записи
const [cs, cu] = buildCompactMessages('Перенеси ужин на восемь', ctx);
assert.match(cs.text, /update \/ mark \/ unmark \/ delete — только при глаголе/);
assert.doesNotMatch(cs.text, /query_plans/);
assert.match(cu.text, /task:t3 \| Ужин у родителей/);
assert.doesNotMatch(cu.text, /Дело номер/);
// «Добавь Дюну»: без записей, календаря и тем
const [, du] = buildCompactMessages('Добавь Дюну и Аватар', ctx);
assert.doesNotMatch(du.text, /Существующие записи|Дни:|Мои темы/);
assert.ok(compact < full * 0.6, `компактный ${compact} против полного ${full}`);
// «Перенеси стоматолога на пятницу на два» — день берём из «на пятницу», а не из последнего «на два» (eval 01.11)
{
  const c2 = { ...ctx, existing: { ...ctx.existing, tasks: [{ id: 't6', title: 'Стоматолог', date: '2026-09-29', time: '10:00' }] } };
  const r = normalize([{ intent: 'update', target: ['t6'], date: '2026-09-25', time: '14:00', people: ['Карина'], query: 'стоматолог' }] as never, c2, 'Перенеси стоматолога на пятницу на два и добавь Карину');
  assert.equal(r.type, 'changes');
  if (r.type === 'changes') assert.equal(r.changes[0].patch?.date, '2026-10-02');
}
// «Купить молоко» при теме со списком продуктов — дело: правил заметок нет (пункт темы — только с глаголом правки)
{
  const c3 = { ...ctx, topics: [{ id: 'p1', title: 'Покупки', body: '- [ ] Молоко' }] };
  assert.doesNotMatch([...pickBlocks('Завтра купить молоко', c3).blocks].join(), /ideas/);
  assert.match([...pickBlocks('Молоко купил', c3).blocks].join(), /ideas/);
}
// Дни — одной строкой на две недели вперёд, без таблицы на 5 недель
{
  const [, u] = buildCompactMessages('Перенеси ужин на субботу', ctx);
  assert.match(u.text, /Дни: сб 2026-09-26, вс 2026-09-27,/);
  assert.equal((u.text.match(/\d{4}-\d{2}-\d{2}/g) ?? []).length, 1 + 14 + 1, 'сегодня + 14 дней + дело с датой');
}
// Повтор полным промптом — только для настоящих фраз
assert.equal(worthFullRetry('э', { attempts: 1, raw: '' }), false);
assert.equal(worthFullRetry('так это', { attempts: 1, raw: '' }), false);
assert.equal(worthFullRetry('позвонить в банк про кредит', { attempts: 1, raw: '' }), true);
assert.equal(worthFullRetry('позвонить в банк про кредит', { attempts: 2, raw: '' }), false, 'модель дважды не дала JSON');
console.log(`✓ компактный промпт: ${Math.round((100 * compact) / full)}% от полного на 6 фразах`);
