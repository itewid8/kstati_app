/** Голос и связи: «что нужно купить», «что я покупал на свадьбу», «привяжи список к ужину» */
import assert from 'node:assert/strict';
import { linkRules } from '../src/linkVoice.js';
import { normalize } from '../src/parse.js';
import type { Context } from '../src/types.js';

const ctx: Context = {
  today: '2026-11-14',
  now: '12:00',
  me: { id: 'u1', name: 'Саша' },
  people: [{ id: 'u2', name: 'Карина' }],
  existing: {
    tasks: [
      { id: 't1', title: 'Ужин у родителей', date: '2026-11-15', time: '20:00' },
      { id: 't2', title: 'Свадьба', date: '2026-05-22', time: null },
      { id: 't3', title: 'Поход на Алтай', date: '2026-12-01', time: null },
      { id: 't4', title: 'Стрижка', date: '2026-11-16', time: null },
    ],
    watch: [{ id: 'm1', title: 'Ирония судьбы' }],
    wishes: [],
    ideas: [{ id: 'i1', text: 'Что взять в поход: палатка, спальник', topicId: null }],
  },
  topics: [
    { id: 'p1', title: 'Продукты к ужину', body: '- [ ] Хлеб' },
    { id: 'p2', title: 'Покупки на свадьбу', body: '- [x] Кольца' },
  ],
  links: [
    { a: { type: 'task', id: 't1' }, b: { type: 'note', id: 'p1' } },
    { a: { type: 'note', id: 'p2' }, b: { type: 'task', id: 't2' } },
    { a: { type: 'task', id: 't3' }, b: { type: 'note', id: 'i1' } },
    { a: { type: 'task', id: 't1' }, b: { type: 'watch', id: 'm1' } },
  ],
};
const run = (text: string) => normalize(linkRules(text) as never, ctx, text);

// Не сказано, к чему, — ближайшее предстоящее дело со списком; только списки
assert.deepEqual(run('Что нужно купить?'), { type: 'queryLinked', anchor: { type: 'task', id: 't1' }, items: [{ type: 'note', id: 'p1' }], want: 'note' });
// Названо — по словам, хоть в прошлом
assert.deepEqual(run('что я покупал на свадьбу'), { type: 'queryLinked', anchor: { type: 'task', id: 't2' }, items: [{ type: 'note', id: 'p2' }], want: 'note' });
assert.equal((run('что взять в поход') as { anchor: { id: string } }).anchor.id, 't3');
// Всё связанное
assert.deepEqual((run('что связано с ужином') as { items: unknown[] }).items, [{ type: 'note', id: 'p1' }, { type: 'watch', id: 'm1' }]);
// Нет такого
assert.deepEqual(run('что купить к рыбалке'), { type: 'notFound', query: 'рыбалке' });
// Привязать
assert.deepEqual(run('Привяжи покупки на свадьбу к стрижке'), { type: 'link', a: { type: 'note', id: 'p2' }, b: { type: 'task', id: 't4' } });
assert.equal(run('привяжи стрижку к ужину').type, 'notFound', 'дело с делом не связать');
// Обычные команды правила связей не трогают
assert.equal(linkRules('Завтра купить хлеб'), null);
assert.equal(linkRules('Что у нас на выходных'), null);
// От модели — тот же разбор
assert.equal(normalize([{ intent: 'query_linked', about: 'ужин', want: 'note' }] as never, ctx, 'а что там к ужину купить').type, 'queryLinked');

console.log('✓ связи голосом: вопросы о связанном и «привяжи»');
