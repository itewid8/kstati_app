import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { taskKey } from '@/lib/recur';
import { TASKS, task } from './fixture';
import { instancesIn, isPlan, kidsOf, parseKey, planIds } from './tasks';

const keys = (list: { id: string; occ?: string }[]) => list.map((t) => (t.occ ? `${t.id}@${t.occ}` : t.id));

describe('instancesIn', () => {
  test('неделя 05—11 окт: разы повторов, многодневные, без даты не попадают; по началу', () => {
    assert.deepEqual(keys(instancesIn(TASKS, ['g1'], '2026-10-05', '2026-10-11')), [
      'gift',
      'dent',
      'yoga@2026-10-05',
      'trip',
      'train1',
      'mom',
      'meet',
      'lunch',
      'cinema',
      'night',
    ]);
  });

  test('многодневное, начатое раньше периода, попадает', () => {
    assert.deepEqual(keys(instancesIn(TASKS, ['g1'], '2026-10-10', '2026-10-10')), ['mom', 'night']);
    assert.deepEqual(keys(instancesIn(TASKS, ['g1'], '2026-10-09', '2026-10-09')), ['trip', 'mom', 'lunch', 'cinema', 'night']);
  });

  test('раз многодневной серии, начатый до периода', () => {
    const weekend = task('wk', '2026-09-26', null, 'Дача на выходные', ['s'], { endDate: '2026-09-28', repeat: { freq: 'week', every: 1 } });
    const got = instancesIn([weekend], ['g1'], '2026-10-05', '2026-10-06');
    assert.deepEqual(keys(got), ['wk@2026-10-03']);
    assert.equal(got[0]?.endDate, '2026-10-05');
    assert.equal(got.map(taskKey)[0], 'wk@2026-10-03');
  });

  test('только выбранные группы, пропущенные разы серии', () => {
    assert.deepEqual(instancesIn(TASKS, ['g2'], '2026-10-05', '2026-10-11'), []);
    const skipped = TASKS.map((t) => (t.id === 'yoga' ? { ...t, skipDates: ['2026-10-05'] } : t));
    assert.ok(!keys(instancesIn(skipped, ['g1'], '2026-10-05', '2026-10-11')).includes('yoga@2026-10-05'));
  });
});

describe('parseKey', () => {
  test('обратная к taskKey', () => {
    assert.deepEqual(parseKey('yoga@2026-10-05'), { id: 'yoga', occ: '2026-10-05' });
    assert.deepEqual(parseKey('dent'), { id: 'dent' });
    assert.deepEqual(parseKey('a@b'), { id: 'a@b' });
    assert.deepEqual(parseKey('@2026-10-05'), { id: '@2026-10-05' });
  });
});

describe('планы', () => {
  test('kidsOf, isPlan, planIds', () => {
    assert.deepEqual(kidsOf(TASKS, 'trip').map((t) => t.id), ['train1', 'meet']);
    const trip = TASKS.find((t) => t.id === 'trip');
    const train = TASKS.find((t) => t.id === 'train1');
    const dent = TASKS.find((t) => t.id === 'dent');
    assert.ok(trip && train && dent);
    assert.equal(isPlan(trip, TASKS), true);
    assert.equal(isPlan(train, TASKS), false);
    assert.equal(isPlan(dent, TASKS), false);
    assert.deepEqual([...planIds(TASKS)], ['trip']);
  });
});
