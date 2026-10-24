/** Личный календарь: видимость дел в группах (то же правило — на сервере, server/src/visibility.ts) */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { FRIENDS, US, task } from '@/adapters/common/fixture';
import { canEditTask, inScope, newTaskShare, PERSONAL, taskGroups, visibleCount, visibleIn } from './visibility';

const SEL = { ...FRIENDS, selectOnly: ['s'] };

describe('visibleIn', () => {
  test('режим «Все»: видно; «Только выбранные»: видно созданное там и отмеченное', () => {
    const mine = task('a', null, null, 'Футбол', ['s']);
    assert.equal(visibleIn(mine, US), true);
    assert.equal(visibleIn(mine, FRIENDS), true);
    assert.equal(visibleIn(mine, SEL), false);
    assert.equal(visibleIn({ ...mine, share: { g2: true } }, SEL), true);
    assert.equal(visibleIn({ ...mine, groupId: 'g2' }, SEL), true, 'создано в группе');
  });
  test('«Только я» сильнее всего; скрыто — не видно; не участник — не видно', () => {
    const mine = task('a', null, null, 'Психолог', ['s']);
    assert.equal(visibleIn({ ...mine, only: true, share: { g1: true } }, US), false);
    assert.equal(visibleIn({ ...mine, share: { g1: false } }, US), false);
    assert.equal(visibleIn(task('b', null, null, 'x', ['zz']), US), false);
  });
});

describe('taskGroups, inScope, canEditTask', () => {
  test('своё — считаем; чужое — из in (только мои группы)', () => {
    const mine = task('a', null, null, 'x', ['s'], { groupId: PERSONAL });
    assert.deepEqual(taskGroups(mine, [US, FRIENDS], 's'), ['g1', 'g2']);
    assert.deepEqual(taskGroups({ ...mine, only: true }, [US, FRIENDS], 's'), []);
    const theirs = task('b', null, null, 'y', ['k'], { in: ['g1', 'g9'] });
    assert.deepEqual(taskGroups(theirs, [US, FRIENDS], 's'), ['g1']);
  });
  test('личный вид — мои и те, где я занят', () => {
    const scope = { viewId: PERSONAL, groups: [US], meId: 's' };
    assert.equal(inScope(task('a', null, null, 'x', ['s'], { only: true }), scope), true);
    assert.equal(inScope(task('b', null, null, 'y', ['k', 's']), scope), true);
    assert.equal(inScope(task('c', null, null, 'z', ['k']), scope), false);
  });
  test('править чужое — только админ группы, где оно видно', () => {
    const theirs = task('b', null, null, 'y', ['k'], { in: ['g1'] });
    assert.equal(canEditTask(theirs, [US], 's'), true, 'Саня — создатель g1');
    assert.equal(canEditTask(theirs, [{ ...US, ownerId: 'k' }], 's'), false);
    assert.equal(canEditTask(theirs, [{ ...US, ownerId: 'k', adminIds: ['s'] }], 's'), true);
  });
  test('новое дело: из группы — отмечено для неё; иначе — личное', () => {
    assert.deepEqual(newTaskShare('g1'), { groupId: 'g1', share: { g1: true } });
    assert.deepEqual(newTaskShare(PERSONAL), { groupId: PERSONAL });
    assert.deepEqual(newTaskShare(null), { groupId: PERSONAL });
  });
  test('счётчик: сколько моих дел видно группе', () => {
    const tasks = [task('a', null, null, 'a', ['s']), task('b', null, null, 'b', ['s'], { share: { g1: false } }), task('c', null, null, 'c', ['k'])];
    assert.deepEqual(visibleCount(tasks, US, 's'), { visible: 1, total: 2 });
  });
});
