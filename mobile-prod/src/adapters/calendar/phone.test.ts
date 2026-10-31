import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { PhoneEvent } from '@/lib/phoneCalendar';
import { task } from '../common/fixture';
import { notImported, phoneAgendaOn, phoneBarsIn, phoneKey, phoneMonthItems, phoneSlotsOn } from './phone';

// Москва: 11:00Z = 14:00
const ev = (p: Partial<PhoneEvent>): PhoneEvent => ({ id: 'e1', calendarId: 'c', title: 'Стоматолог', start: '2026-10-27T11:00:00.000Z', end: '2026-10-27T12:00:00.000Z', allDay: false, ...p });

describe('слой календаря телефона', () => {
  test('сетка дня: минуты, через полночь — по частям', () => {
    assert.deepEqual(phoneSlotsOn([ev({})], '2026-10-27'), [{ id: phoneKey(ev({})), title: 'Стоматолог', start: 14 * 60, end: 15 * 60 }]);
    const night = ev({ start: '2026-10-27T19:00:00.000Z', end: '2026-10-27T22:00:00.000Z' });
    assert.deepEqual(phoneSlotsOn([night], '2026-10-27').map((s) => [s.start, s.end]), [[22 * 60, 24 * 60]]);
    assert.deepEqual(phoneSlotsOn([night], '2026-10-28').map((s) => [s.start, s.end]), [[0, 60]]);
    const toMidnight = ev({ start: '2026-10-27T18:00:00.000Z', end: '2026-10-27T21:00:00.000Z' });
    assert.deepEqual(phoneSlotsOn([toMidnight], '2026-10-28'), [], 'конец ровно в полночь — следующий день не задет');
  });

  test('весь день и долгие — полосы, не сетка', () => {
    const all = ev({ allDay: true, start: '2026-11-03T00:00:00.000Z', end: '2026-11-04T00:00:00.000Z' });
    assert.deepEqual(phoneSlotsOn([all], '2026-11-03'), []);
    const b = phoneBarsIn([all], '2026-11-02', '2026-11-08')[0]!;
    assert.equal(b.startDate, '2026-11-03');
    assert.equal(b.endDate, '2026-11-03');
    assert.equal(b.phone, true);
    assert.deepEqual(phoneBarsIn([all], '2026-11-04', '2026-11-08'), []);
  });

  test('месяц: строки по дням и панель дня', () => {
    const trip = ev({ id: 't', allDay: true, title: 'Дача', start: '2026-11-05T00:00:00.000Z', end: '2026-11-08T00:00:00.000Z' });
    const items = phoneMonthItems([trip], '2026-11-01', '2026-11-30');
    assert.deepEqual(Object.keys(items), ['2026-11-05', '2026-11-06', '2026-11-07']);
    const rows = phoneAgendaOn([ev({ start: '2026-11-06T07:00:00.000Z', end: '2026-11-06T08:00:00.000Z' }), trip], '2026-11-06');
    assert.deepEqual(rows.map((r) => [r.time, r.title]), [['—', 'Дача'], ['10:00', 'Стоматолог']]);
  });

  test('перенесённое в слое не показывается', () => {
    const t = task('x', '2026-10-27', null, 'Стоматолог', [], { createdBy: 's', ext: { cal: 'c', id: 'e1', h: 'h' } });
    assert.deepEqual(notImported([ev({}), ev({ id: 'e2' })], [t], 's').map((e) => e.id), ['e2']);
    assert.equal(notImported([ev({})], [t], 'k').length, 1, 'чужое дело не считается');
  });
});
