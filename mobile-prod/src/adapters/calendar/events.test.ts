import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { task } from '../common/fixture';
import { barMeta, isDone, monthAnchor, mondayOf, shiftMonth, toBar, visibleFor } from './events';

describe('events', () => {
  test('mondayOf', () => {
    assert.equal(mondayOf('2026-10-05'), '2026-10-05');
    assert.equal(mondayOf('2026-10-11'), '2026-10-05');
    assert.equal(mondayOf('2026-11-01'), '2026-10-26');
  });

  test('monthAnchor, shiftMonth: переход по месяцам и годам', () => {
    assert.equal(monthAnchor(2026, 10, '2026-10-05'), '2026-10-05');
    assert.equal(monthAnchor(2026, 11, '2026-10-05'), '2026-11-01');
    assert.equal(monthAnchor(2025, 10, '2026-10-05'), '2025-10-01');
    assert.deepEqual(shiftMonth(2026, 1, -1), { y: 2025, m: 12 });
    assert.deepEqual(shiftMonth(2026, 12, 1), { y: 2027, m: 1 });
    assert.deepEqual(shiftMonth(2026, 10, 1), { y: 2026, m: 11 });
  });

  test('barMeta: как в макете C-Week и через месяц', () => {
    const t = (date: string, time: string | null, endDate: string | null, endTime: string | null) => ({ date, time, endDate, endTime });
    assert.equal(barMeta(t('2026-10-07', '07:00', '2026-10-09', '15:00')), ' · 7 окт 07:00 → 9 окт 15:00');
    assert.equal(barMeta(t('2026-10-08', null, '2026-10-10', null)), ' · 8–10 окт');
    assert.equal(barMeta(t('2026-10-10', '09:00', null, '20:00')), ' 09–20');
    assert.equal(barMeta(t('2026-10-10', '09:30', null, '20:00')), ' 09:30–20');
    assert.equal(barMeta(t('2026-10-05', null, null, null)), undefined);
    assert.equal(barMeta(t('2026-04-30', null, '2026-05-02', null)), ' · 30 апр – 2 мая');
    assert.equal(barMeta(t('2026-10-07', '07:00', '2026-10-09', null)), ' · 7 окт 07:00 → 9 окт');
  });

  test('isDone: дело и раз серии', () => {
    assert.ok(isDone(task('a', '2026-10-05', null, 'A', ['s'], { doneAt: '2026-10-05T10:00:00.000Z' })));
    assert.ok(isDone(task('b', '2026-10-05', null, 'B', ['s'], { occ: '2026-10-05', doneDates: ['2026-10-05'] })));
    assert.ok(!isDone(task('c', '2026-10-05', null, 'C', ['s'], { occ: '2026-10-12', doneDates: ['2026-10-05'] })));
  });

  test('visibleFor: скрыто, только если скрыты все люди дела; без людей — автор', () => {
    const v = visibleFor(['k']);
    assert.ok(!v({ people: ['k'], createdBy: 'k' }));
    assert.ok(v({ people: ['s', 'k'], createdBy: 'k' }));
    assert.ok(!v({ people: [], createdBy: 'k' }));
    assert.ok(visibleFor([])({ people: ['k'], createdBy: 'k' }));
  });

  test('toBar: план с подзадачами — с первого до последнего дня', () => {
    const trip = task('trip', '2026-10-07', '07:00', 'Командировка', ['k'], { endDate: '2026-10-09', endTime: '15:00' });
    assert.deepEqual(toBar(trip), {
      id: 'trip',
      title: 'Командировка',
      meta: ' · 7 окт 07:00 → 9 окт 15:00',
      startDate: '2026-10-07',
      endDate: '2026-10-09',
      people: ['k'],
    });
  });
});
