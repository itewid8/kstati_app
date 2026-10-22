/** answerPlans для API 2: scope «me», who, многодневные дела в периоде */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { FRIENDS, KARINA, SANYA, TASKS, US, task } from '@/adapters/common/fixture';
import { answerPlans } from './plans';
import type { PlansQuery } from './types';

const state = (tasks = TASKS) => ({ me: SANYA, users: [SANYA, KARINA], groups: [US, FRIENDS], tasks, currentGroupId: 'g1' });
const ask = (q: Partial<PlansQuery>, tasks = TASKS) => {
  const r = answerPlans({ scope: { kind: 'current' }, from: '2026-10-10', to: '2026-10-11', query: '', ...q }, state(tasks));
  assert.ok(r.ok);
  return r.answer;
};

describe('answerPlans', () => {
  test('scope me: все мои группы, только мои дела', () => {
    const party = { ...task('party', '2026-10-10', '18:00', 'Вечеринка', ['d']), groupId: 'g2' };
    const mine = { ...task('ride', '2026-10-11', '10:00', 'Велопрогулка', ['s', 'd']), groupId: 'g2' };
    const a = ask({ scope: { kind: 'me' } }, [...TASKS, party, mine]);
    assert.deepEqual(a.groupNames, ['Мы с Кариной', 'Друзья']);
    assert.deepEqual(a.who, ['s']);
    assert.deepEqual(
      a.sections.map((x) => [x.groupId, x.taskIds]),
      [['g1', ['mom']], ['g2', ['ride']]],
    );
  });

  test('многодневное, начатое до периода, попадает в ответ', () => {
    const a = ask({ from: '2026-10-10', to: '2026-10-11' });
    assert.deepEqual(a.sections[0]?.taskIds, ['mom', 'night']);
    const weekend = task('wk', '2026-09-26', null, 'Дача', ['s'], { endDate: '2026-09-28', repeat: { freq: 'week', every: 1 } });
    assert.deepEqual(ask({ from: '2026-10-05', to: '2026-10-05' }, [weekend]).sections[0]?.taskIds, ['wk@2026-10-03']);
  });

  test('who: участие = peopleOf', () => {
    const a = ask({ from: '2026-10-09', to: '2026-10-09', who: ['k'] });
    assert.deepEqual(a.sections[0]?.taskIds, ['trip', 'mom', 'cinema']);
    assert.deepEqual(a.who, ['k']);
    assert.equal(ask({ from: '2026-10-09', to: '2026-10-09' }).who, undefined);
  });
});
