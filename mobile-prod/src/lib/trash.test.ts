import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { addToTrash, daysLeft, removedEntries, restore, trashKey, trashTitle, type TrashLists } from './trash';
import type { Idea, Task, Topic } from './types';

const task = (id: string, parentId: string | null = null): Task => ({ id, groupId: 'g', title: id, date: null, time: null, createdBy: 'me', doneAt: null, createdAt: '2026-10-01', parentId });
const topic = (id: string): Topic => ({ id, ownerId: 'me', title: `Тема ${id}`, groupIds: [], createdAt: '2026-10-01' });
const idea = (id: string, topicId: string | null): Idea => ({ id, ownerId: 'me', topicId, text: `# Заметка ${id}\nтекст`, createdAt: '2026-10-01', updatedAt: '2026-10-01' });
const empty = (): TrashLists => ({ tasks: [], wishes: [], watch: [], topics: [], ideas: [] });
const NOW = '2026-10-31T10:00:00.000Z';

describe('недавно удалённые', () => {
  test('что исчезло — в корзину одной пачкой', () => {
    const before = { tasks: [task('a'), task('b')], ideas: [idea('i', null)] };
    const after = { ...empty(), tasks: [task('b')] };
    const got = removedEntries(before, after, NOW, 'p1');
    assert.deepEqual(got.map(trashKey), ['task:a', 'idea:i']);
    assert.ok(got.every((e) => e.batch === 'p1'));
  });

  test('тема возвращается с заметками, план — с подзадачами; потерянный план — без него', () => {
    const before = { topics: [topic('t')], ideas: [idea('i1', 't'), idea('i2', 't')], tasks: [task('p'), task('s', 'p')] };
    const trash = removedEntries(before, empty(), NOW, 'p1');
    const r = restore(empty(), trash, new Set(['topic:t', 'task:p']));
    assert.equal(r.count, 5);
    assert.equal(r.trash.length, 0);
    assert.deepEqual(r.lists.ideas.map((i) => i.topicId), ['t', 't']);
    const only = restore(empty(), trash, new Set(['task:s']));
    assert.equal(only.lists.tasks[0]!.parentId, null);
    const lone = restore(empty(), trash, new Set(['idea:i1']));
    assert.equal(lone.lists.ideas[0]!.topicId, null);
  });

  test('30 дней и без повторов', () => {
    const old = removedEntries({ tasks: [task('x')] }, empty(), '2026-09-01T00:00:00.000Z', 'p0');
    const fresh = removedEntries({ tasks: [task('x'), task('y')] }, empty(), NOW, 'p1');
    const t = addToTrash(old, fresh, Date.parse(NOW));
    assert.deepEqual(t.map(trashKey), ['task:x', 'task:y']);
    assert.equal(addToTrash(old, [], Date.parse(NOW)).length, 0, 'старше 30 дней — ушло');
    assert.equal(daysLeft({ deletedAt: NOW }, Date.parse(NOW) + 86_400_000 * 2.5), 28);
  });

  test('название заметки — из заголовка', () => {
    const [e] = removedEntries({ ideas: [idea('i', null)] }, empty(), NOW, 'p');
    assert.equal(trashTitle(e!), 'Заметка i');
  });
});
