/**
 * Разбор голосовых команд про идеи: куда ложится идея, новые темы, перенос и «покажи».
 * Модель не вызывается — проверяем нормализацию её ответа (parse.ts → normalize).
 *   npm test
 */
import assert from 'node:assert/strict';
import { findTopic, normalize } from '../src/parse.js';
import type { Context } from '../src/types.js';

const topics = [
  { id: 'tp1', title: 'Идеи для приложения' },
  { id: 'tp2', title: 'Идеи для подарков' },
  { id: 'tp3', title: 'Мысли' },
];
const ctx = (extra: Partial<Context> = {}): Context => ({
  today: '2026-10-02',
  now: '12:00',
  me: { id: 'u1', name: 'Саша' },
  people: [{ id: 'u2', name: 'Маша' }],
  existing: { tasks: [], watch: [], wishes: [], ideas: [{ id: 'i1', text: 'Погода в виджете', topicId: null }] },
  topics,
  ...extra,
});
const one = (r: ReturnType<typeof normalize>) => {
  assert.equal(r.type, 'items');
  if (r.type !== 'items') throw new Error();
  return r.items[0];
};

// Поиск темы по названию: точно, по основам, «подарки» = «Идеи для подарков»
assert.equal(findTopic('Идеи для приложения', topics)?.id, 'tp1');
assert.equal(findTopic('подарки', topics)?.id, 'tp2');
assert.equal(findTopic('в приложение', topics)?.id, 'tp1');
assert.equal(findTopic('мысли', topics)?.id, 'tp3');
assert.equal(findTopic('рецепты', topics), null);

// Тема подобрана моделью по смыслу — в неё
let it = one(normalize([{ intent: 'add', type: 'idea', text: 'показывать погоду в виджете', topic: 'Идеи для приложения' }], ctx(), 'запиши идею показывать погоду в виджете'));
assert.deepEqual(it, { key: it.key, type: 'idea', data: { title: 'Показывать погоду в виджете', topicId: 'tp1', newTopic: null } });

// Названа новая тема — создастся при сохранении
it = one(normalize([{ intent: 'add', type: 'idea', text: 'Стих про кролика.', topic: 'Поздравления с Новым годом' }], ctx(), 'добавь в поздравления с новым годом стих про кролика'));
assert.equal(it.type === 'idea' && it.data.newTopic, 'Поздравления с Новым годом');
assert.equal(it.type === 'idea' && it.data.topicId, null);

// Модель выдумала тему, которой во фразе не было, — «Без темы»
it = one(normalize([{ intent: 'add', type: 'idea', text: 'Купить велосипед летом.', topic: 'Спорт' }], ctx(), 'мысль купить велосипед летом'));
assert.deepEqual(it.type === 'idea' && [it.data.topicId, it.data.newTopic], [null, null]);

// Открыта тема — идея без названной темы идёт в неё, даже если модель подобрала другую
it = one(normalize([{ intent: 'add', type: 'idea', text: 'Шарф.', topic: 'Идеи для приложения' }], ctx({ currentTopicId: 'tp2' }), 'шарф'));
assert.equal(it.type === 'idea' && it.data.topicId, 'tp2');
// …а если другая тема названа явно — в названную
it = one(normalize([{ intent: 'add', type: 'idea', text: 'Тёмная тема.', topic: 'Идеи для приложения' }], ctx({ currentTopicId: 'tp2' }), 'в идеи для приложения тёмная тема'));
assert.equal(it.type === 'idea' && it.data.topicId, 'tp1');

// Создать тему
it = one(normalize([{ intent: 'add', type: 'topic', title: 'идеи для свадьбы' }], ctx(), 'создай тему идеи для свадьбы'));
assert.deepEqual(it.type === 'topic' && it.data, { title: 'Идеи для свадьбы' });

// Показать тему
assert.deepEqual(normalize([{ intent: 'query_ideas', topic: 'подарки' }], ctx(), 'покажи идеи для подарков'), { type: 'queryIdeas', topicId: 'tp2' });
assert.deepEqual(normalize([{ intent: 'query_ideas', topic: 'без темы' }], ctx(), 'покажи идеи без темы'), { type: 'queryIdeas', topicId: 'inbox' });
assert.deepEqual(normalize([{ intent: 'query_ideas', topic: 'рецепты' }], ctx(), 'покажи рецепты'), { type: 'notFound', query: 'рецепты' });

// Перенос идеи голосом
const mv = normalize([{ intent: 'update', target: ['idea:i1'], topic: 'приложение', query: 'погода' }], ctx(), 'перенеси идею про погоду в приложение');
assert.equal(mv.type, 'changes');
if (mv.type === 'changes') assert.deepEqual([mv.changes[0].type, mv.changes[0].chosen, mv.changes[0].patch], ['idea', 'i1', { topicId: 'tp1' }]);
// Идею не «отмечают»
assert.notEqual(normalize([{ intent: 'mark', target: ['i1'], query: 'погода' }], ctx(), 'отметь идею про погоду').type, 'changes');

console.log('✓ идеи: разбор голосовых команд');
