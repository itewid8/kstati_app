/** saveItems → saveDraftItems: id сохранённых записей; [] — ничего не сохранено */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TASKS } from '@/adapters/common/fixture';
import { applyChangeList, saveDraftItems, type Lists } from './edits';
import type { DraftItem } from './types';

const lists = (): Lists => ({
  tasks: TASKS,
  wishes: [{ id: 'w1', ownerId: 's', title: 'Книга', note: '', link: '', receivedAt: null, createdAt: '' }],
  watch: [],
  topics: [{ id: 't1', ownerId: 's', title: 'Отпуск', groupIds: [], createdAt: '' }],
  ideas: [],
  overrides: {},
});
const ctx = (currentGroupId: string | null) => ({ meId: 's', currentGroupId, now: '2026-10-05T10:00:00.000Z' });
const newTask = (title: string, parentId: string | null = null): DraftItem => ({ key: title, type: 'task', data: { title, date: null, time: null, parentId } });

describe('saveDraftItems', () => {
  test('новое дело: id созданной записи', () => {
    const r = saveDraftItems(lists(), [newTask('Купить хлеб')], ctx('g1'));
    assert.equal(r.ids.length, 1);
    const t = r.lists.tasks.find((x) => x.id === r.ids[0]);
    assert.equal(t?.title, 'Купить хлеб');
    assert.equal(t?.groupId, 'g1');
  });

  test('нет текущей группы и нет плана — ничего не сохранено, []', () => {
    const r = saveDraftItems(lists(), [newTask('Купить хлеб')], ctx(null));
    assert.deepEqual([...r.ids], []);
    assert.equal(r.lists.tasks.length, TASKS.length);
    const w = saveDraftItems(lists(), [{ key: 'm', type: 'watch', data: { title: 'Кино', kind: null, genres: [], origin: null, year: null } }], ctx(null));
    assert.deepEqual([...w.ids], []);
  });

  test('подзадача без текущей группы сохраняется в группу плана', () => {
    const r = saveDraftItems(lists(), [newTask('Билеты', 'trip')], ctx(null));
    assert.equal(r.ids.length, 1);
    assert.equal(r.lists.tasks.find((x) => x.id === r.ids[0])?.groupId, 'g1');
  });

  test('правка: прежний id; записи уже нет — не сохранено', () => {
    const edit: DraftItem = { key: 'gift', type: 'task', id: 'gift', data: { title: 'Подарок', date: null, time: null } };
    assert.deepEqual([...saveDraftItems(lists(), [edit], ctx('g1')).ids], ['gift']);
    assert.deepEqual([...saveDraftItems(lists(), [{ ...edit, id: 'gone' }], ctx('g1')).ids], []);
  });

  test('несколько записей — id по порядку; ideaTopicId — тема первой идеи', () => {
    const items: DraftItem[] = [
      { key: 'w', type: 'wish', data: { title: 'Хочу', note: '', link: '' } },
      { key: 'i', type: 'idea', data: { title: 'Море', topicId: null, newTopic: 'Отпуск' } },
      newTask('Дело'),
    ];
    const r = saveDraftItems(lists(), items, ctx('g1'));
    assert.equal(r.ids.length, 3);
    assert.equal(r.lists.wishes.find((x) => x.id === r.ids[0])?.title, 'Хочу');
    assert.equal(r.lists.ideas.find((x) => x.id === r.ids[1])?.text, 'Море');
    assert.equal(r.lists.tasks.find((x) => x.id === r.ids[2])?.title, 'Дело');
    assert.equal(r.ids.ideaTopicId, 't1');
    assert.ok(Array.isArray(r.ids));
  });
});

describe('applyChangeList', () => {
  test('перенос одного раза серии: раз выпадает, появляется отдельное дело с той же длительностью', () => {
    const r = applyChangeList(
      lists(),
      [{ key: 'a', action: 'update', type: 'task', candidates: ['yoga'], chosen: 'yoga', occ: '2026-10-05', patch: { time: '18:00' } }],
      { meId: 's', now: '2026-10-05T10:00:00.000Z' },
    );
    const yoga = r.lists.tasks.find((t) => t.id === 'yoga');
    assert.deepEqual(yoga?.skipDates, ['2026-10-05']);
    const moved = r.lists.tasks.find((t) => t.title === 'Йога' && t.id !== 'yoga');
    assert.equal(moved?.date, '2026-10-05');
    assert.equal(moved?.time, '18:00');
    assert.equal(moved?.endTime, '19:00');
    assert.equal(moved?.repeat, null);
    assert.equal(r.deleted, 0);
  });
});
