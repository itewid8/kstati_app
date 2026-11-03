/** saveItems → saveDraftItems: id сохранённых записей; [] — ничего не сохранено */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TASKS } from '@/adapters/common/fixture';
import { applyChangeList, editSeriesOcc, saveDraftItems, type Lists } from './edits';
import type { DraftItem, Task } from './types';

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

  test('нет текущей группы и нет плана — дело в личном календаре, «Смотреть» не сохраняется', () => {
    const r = saveDraftItems(lists(), [newTask('Купить хлеб')], ctx(null));
    assert.equal(r.ids.length, 1);
    assert.equal(r.lists.tasks.find((x) => x.id === r.ids[0])?.groupId, '@me');
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

  test('список голосом: новая тема с пунктами; правка — текст существующей темы', () => {
    const body = '- [ ] Молоко\n- [ ] Хлеб';
    const r = saveDraftItems(lists(), [{ key: 'l', type: 'topic', data: { title: 'Список продуктов', body } }], ctx('g1'));
    assert.equal(r.lists.topics.find((t) => t.id === r.ids[0])?.body, body);
    const id = r.ids[0]!;
    const e = saveDraftItems(r.lists, [{ key: 'e', type: 'topic', id, data: { title: 'Список продуктов', body: '- [ ] Молоко', changes: ['− Хлеб'] } }], ctx('g1'));
    assert.deepEqual([...e.ids], [id]);
    assert.equal(e.lists.topics.find((t) => t.id === id)?.body, '- [ ] Молоко');
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

describe('editSeriesOcc (правка раза серии из окна)', () => {
  const yoga: Task = {
    id: 'yoga', groupId: 'g1', createdBy: 's', title: 'Йога', date: '2026-10-05', time: '19:00', endTime: '20:00', doneAt: null, createdAt: '',
    repeat: { freq: 'week', every: 1, weekdays: [1] }, doneDates: ['2026-10-05', '2026-10-26'], skipDates: ['2026-11-02'],
  };
  const base = (): Lists => ({ ...lists(), tasks: [yoga], overrides: { yoga: ['m15'] } as Lists['overrides'] });
  const item = (data: Partial<Extract<DraftItem, { type: 'task' }>['data']>): Extract<DraftItem, { type: 'task' }> => ({
    key: 'yoga', type: 'task', id: 'yoga', data: { title: 'Йога', date: '2026-10-19', time: '19:00', endTime: '20:00', note: '', repeat: yoga.repeat, ...data },
  });

  test('только этот раз: раз выпадает из серии, вместо него — отдельное дело с правками, в той же группе', () => {
    const r = editSeriesOcc(base(), 'yoga', '2026-10-19', 'one', item({ time: '20:00', endTime: '21:00' }), '2026-10-10T10:00:00.000Z');
    const s = r.lists.tasks.find((t) => t.id === 'yoga')!;
    const one = r.lists.tasks.find((t) => t.id === r.id)!;
    assert.deepEqual(s.skipDates, ['2026-10-19', '2026-11-02']);
    assert.deepEqual([one.date, one.time, one.endTime, one.repeat, one.groupId, one.doneAt], ['2026-10-19', '20:00', '21:00', null, 'g1', null]);
    assert.deepEqual(r.lists.overrides[r.id!], ['m15'], 'свои напоминания — как у серии');
  });

  test('только этот раз, отмеченный сделанным: новое дело тоже сделано', () => {
    const r = editSeriesOcc(base(), 'yoga', '2026-10-26', 'one', item({ date: '2026-10-26', title: 'Йога в зале' }), '2026-10-27T10:00:00.000Z');
    const one = r.lists.tasks.find((t) => t.id === r.id)!;
    assert.equal(one.title, 'Йога в зале');
    assert.ok(one.doneAt);
  });

  test('этот и все следующие: прежняя серия кончается накануне, новая — с правками; отметки после раза переезжают', () => {
    const r = editSeriesOcc(base(), 'yoga', '2026-10-19', 'following', item({ date: '2026-10-20', time: '08:00', endTime: '09:00', repeat: { freq: 'week', every: 1, weekdays: [2] } }), '');
    const old = r.lists.tasks.find((t) => t.id === 'yoga')!;
    const next = r.lists.tasks.find((t) => t.id === r.id)!;
    assert.equal(old.repeat?.until, '2026-10-18');
    assert.deepEqual([old.doneDates, old.skipDates], [['2026-10-05'], []]);
    assert.deepEqual([next.date, next.time, next.repeat?.weekdays], ['2026-10-20', '08:00', [2]]);
    assert.deepEqual([next.doneDates, next.skipDates], [['2026-10-27'], ['2026-11-03']], 'со сдвигом на день');
  });

  test('этот и следующие у серии со счётчиком: счётчик становится датой последнего раза', () => {
    const counted: Task = { ...yoga, repeat: { freq: 'week', every: 1, weekdays: [1], count: 4 }, doneDates: [], skipDates: [] };
    const r = editSeriesOcc({ ...base(), tasks: [counted] }, 'yoga', '2026-10-19', 'following', item({ repeat: counted.repeat }), '');
    const next = r.lists.tasks.find((t) => t.id === r.id)!;
    assert.deepEqual([next.repeat?.count, next.repeat?.until], [null, '2026-10-26']);
  });

  test('не серия — ничего не меняется', () => {
    const r = editSeriesOcc({ ...base(), tasks: [{ ...yoga, repeat: null }] }, 'yoga', '2026-10-19', 'one', item({}), '');
    assert.equal(r.id, null);
  });
});
