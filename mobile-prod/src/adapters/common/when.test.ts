import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { dateOfStamp, dayMonth, dayMonthShort, dayShort, periodLabel, rangeDays, timeOfStamp, timeSpan, whenLabel } from './when';

describe('дни', () => {
  test('dayShort, dayMonth, dayMonthShort', () => {
    assert.equal(dayShort('2026-10-05'), 'ПН 05');
    assert.equal(dayShort('2026-10-11'), 'ВС 11');
    assert.equal(dayMonth('2026-10-10'), 'СБ 10 ОКТ');
    assert.equal(dayMonth('2026-10-07'), 'СР 7 ОКТ');
    assert.equal(dayMonthShort('2026-09-28'), '28 СЕН');
  });

  test('whenLabel', () => {
    assert.equal(whenLabel('2026-10-10', '19:00'), 'СБ 10 ОКТ · 19:00');
    assert.equal(whenLabel('2026-10-10', null), 'СБ 10 ОКТ');
    assert.equal(whenLabel(null, null), 'БЕЗ ДАТЫ');
    assert.equal(whenLabel(null, '10:00'), 'БЕЗ ДАТЫ');
  });

  test('rangeDays: план «7—9», раздел списка «07—11», ответ ассистента «05—11 ОКТ»', () => {
    assert.equal(rangeDays('2026-10-07', '2026-10-09'), '7—9');
    assert.equal(rangeDays('2026-10-07', '2026-10-11', { pad: true }), '07—11');
    assert.equal(rangeDays('2026-10-05', '2026-10-11', { pad: true, month: true }), '05—11 ОКТ');
    assert.equal(rangeDays('2026-10-07', '2026-10-07'), '7');
    assert.equal(rangeDays('2026-09-28', '2026-10-04'), '28 СЕН—4 ОКТ');
  });
});

describe('periodLabel', () => {
  test('многодневное — C-EditPlan', () => {
    assert.equal(
      periodLabel({ date: '2026-10-07', time: '07:00', endDate: '2026-10-09', endTime: '15:00' }),
      'СР 7 ОКТ 07:00 → ПТ 9 ОКТ 15:00',
    );
    assert.equal(periodLabel({ date: '2026-10-07', time: null, endDate: '2026-10-09', endTime: null }), 'СР 7 ОКТ → ПТ 9 ОКТ');
  });

  test('в один день и без даты', () => {
    assert.equal(periodLabel({ date: '2026-10-10', time: '10:00', endDate: null, endTime: '11:30' }), 'СБ 10 ОКТ · 10:00–11:30');
    assert.equal(periodLabel({ date: '2026-10-10', time: '10:00', endDate: null, endTime: null }), 'СБ 10 ОКТ · 10:00');
    assert.equal(periodLabel({ date: '2026-10-10', time: null, endDate: '2026-10-10', endTime: null }), 'СБ 10 ОКТ');
    assert.equal(periodLabel({ date: null, time: null, endDate: null, endTime: null }), 'БЕЗ ДАТЫ');
  });

  test('timeSpan', () => {
    assert.equal(timeSpan('19:00', '20:00'), '19:00–20:00');
    assert.equal(timeSpan('19:00', '18:00'), '19:00');
    assert.equal(timeSpan(null, '18:00'), '');
  });
});

describe('моменты времени (TZ=Europe/Moscow в scripts/test.sh)', () => {
  test('местная дата и время', () => {
    assert.equal(dateOfStamp('2026-10-04T21:30:00.000Z'), '2026-10-05');
    assert.equal(timeOfStamp('2026-10-05T14:52:00.000Z'), '17:52');
  });
});
