import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { FRIENDS, US, snapshot, task } from '../common/fixture';
import { colorMap } from '../common/people';
import { allState, shareAsk, shareProps } from './share';

describe('shareProps (C-ShareMine, C-ShareJoin)', () => {
  const tasks = [
    task('a', '2026-10-28', '18:00', 'Футбол', ['s']),
    task('b', '2026-10-31', null, 'Подарок Карине', ['s'], { share: { g1: false } }),
    task('c', '2026-11-03', '19:00', 'Психолог', ['s'], { only: true }),
    task('d', null, null, 'Без даты', ['s']),
    task('k', '2026-10-29', null, 'Карины', ['k']),
  ];
  const s = snapshot({ tasks });
  test('мои дела по времени, без даты — в конце; отметка видимости и замок', () => {
    const p = shareProps(s, colorMap(s), 'g1', 'group');
    assert.ok(p);
    assert.deepEqual(p.tasks.map((t) => [t.key, t.visible, t.onlyMe]), [
      ['a', true, false],
      ['b', false, false],
      ['c', false, true],
      ['d', true, false],
    ]);
    assert.equal(p.tasks[0]?.meta, 'СР 28 ОКТ · 18:00');
    assert.deepEqual([p.visible, p.total], [2, 4]);
    assert.equal(p.caption, 'ГРУППА · МЫ С КАРИНОЙ');
  });
  test('при вступлении — другая подпись и заголовок', () => {
    const p = shareProps(s, colorMap(s), 'g2', 'join');
    assert.equal(p?.caption, 'ВЫ В ГРУППЕ · ДРУЗЬЯ');
    assert.equal(p?.title, 'Мои дела');
  });
  test('подтверждение «Все»: сколько видно сейчас и станет', () => {
    const g = { ...FRIENDS, selectOnly: ['s'] };
    const a = shareAsk(snapshot({ tasks, groups: [US, g] }), g);
    assert.deepEqual(a, { group: 'Друзья', now: 0, next: 3, total: 4 });
  });
  test('«ВСЕ ДЕЛА»: все / ни одного / часть; «Только я» не в счёт', () => {
    const t = (visible: boolean, onlyMe = false) => ({ key: 'x', title: 'x', meta: '', colors: [], visible, onlyMe });
    assert.equal(allState([t(true), t(false, true)]), 'all');
    assert.equal(allState([t(false), t(false)]), 'none');
    assert.equal(allState([t(true), t(false)]), 'some');
    assert.equal(shareProps(s, colorMap(s), 'g1', 'group')?.all, 'some');
  });
});
