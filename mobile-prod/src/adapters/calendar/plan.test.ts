import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { planFixture } from '@/screens/fixtures/calendar/plan';
import { colorMap } from '../common/people';
import { CLOCK } from '../common/fixture';
import { calendarSnapshot, planTasks } from './mockup';
import { planGridProps } from './plan';

const s = calendarSnapshot(planTasks());
const colors = colorMap(s);

describe('planGridProps (C-Plan)', () => {
  test('данные макета: подпись, название, цвет и имя владельца, период — колонки, подзадачи со временем', () => {
    const f = planFixture();
    const p = planGridProps(s, CLOCK, colors, 'trip');
    assert.ok(p);
    assert.equal(p.caption, f.caption);
    assert.equal(p.title, f.title);
    assert.equal(p.color, f.color);
    assert.equal(p.ownerLabel, f.ownerLabel);
    assert.equal(p.startDate, f.startDate);
    assert.equal(p.endDate, f.endDate);
    // В макете у подзадач явное done: false
    assert.deepEqual(
      p.steps,
      f.steps.map(({ done, ...st }) => (done ? { ...st, done } : st)),
    );
  });

  test('период — у самого плана, с днями недели (в макете «7 ОКТ 06:00 → 9 ОКТ 15:00» — без них)', () => {
    assert.equal(planGridProps(s, CLOCK, colors, 'trip')?.rangeLabel, 'СР 7 ОКТ 06:00 → ПТ 9 ОКТ 15:00');
  });

  test('подзадача вне периода и без времени в сетку не попадают', () => {
    const ids = planGridProps(s, CLOCK, colors, 'trip')?.steps.map((st) => st.id) ?? [];
    assert.ok(!ids.includes('souvenir') && !ids.includes('tickets'));
  });

  test('план перенесли на день позже: колонки едут, подзадачи остаются на своих датах, первая выпала из периода', () => {
    const moved = planTasks().map((t) => (t.id === 'trip' ? { ...t, date: '2026-10-08', endDate: '2026-10-10' } : t));
    const p = planGridProps(calendarSnapshot(moved), CLOCK, colors, 'trip');
    assert.equal(p?.startDate, '2026-10-08');
    assert.equal(p?.endDate, '2026-10-10');
    assert.deepEqual(
      p?.steps.map((st) => [st.id, st.date]),
      [
        ['meeting', '2026-10-08'],
        ['team', '2026-10-08'],
        ['back', '2026-10-09'],
        ['souvenir', '2026-10-10'],
      ],
    );
  });

  test('нет плана — null; план без даты — период по подзадачам', () => {
    assert.equal(planGridProps(s, CLOCK, colors, 'nope'), null);
    const undated = planTasks().map((t) => (t.id === 'trip' ? { ...t, date: null, time: null, endDate: null, endTime: null } : t));
    const p = planGridProps(calendarSnapshot(undated), CLOCK, colors, 'trip');
    assert.equal(p?.rangeLabel, 'БЕЗ ДАТЫ');
    assert.equal(p?.startDate, '2026-10-07');
    assert.equal(p?.endDate, '2026-10-10');
  });
});
