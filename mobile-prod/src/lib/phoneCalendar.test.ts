import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { celebrantName, eventDays, eventHash, isBirthdayCalendar, isHolidayCalendar, repeatOf, ruleSupported, ruleText, toDraft, type PhoneEvent } from './phoneCalendar';

// Часовой пояс тестов — Москва (scripts/test.sh): 10:00 MSK = 07:00Z
const ev = (p: Partial<PhoneEvent>): PhoneEvent => ({
  id: 'e1',
  calendarId: 'c1',
  title: 'Стоматолог',
  start: '2026-10-27T11:00:00.000Z',
  end: '2026-10-27T12:00:00.000Z',
  allDay: false,
  ...p,
});

describe('phoneCalendar', () => {
  test('дело со временем: дата, время, конец по часам телефона', () => {
    const d = toDraft(ev({ notes: 'Взять снимок', location: 'Ленина, 14' }));
    assert.deepEqual(d, {
      title: 'Стоматолог',
      date: '2026-10-27',
      time: '14:00',
      endDate: null,
      endTime: '15:00',
      note: 'Взять снимок\nЛенина, 14',
      repeat: null,
    });
  });

  test('через полночь — многодневное, конец ровно в полночь — тот же день', () => {
    const d = toDraft(ev({ start: '2026-10-27T19:00:00.000Z', end: '2026-10-28T01:00:00.000Z' }));
    assert.equal(d.endDate, '2026-10-28');
    assert.equal(d.endTime, '04:00');
    assert.deepEqual(eventDays(ev({ start: '2026-10-27T18:00:00.000Z', end: '2026-10-27T21:00:00.000Z' })), { date: '2026-10-27', endDate: '2026-10-27' });
  });

  test('весь день: по UTC, конец не входит', () => {
    const one = toDraft(ev({ allDay: true, start: '2026-11-03T00:00:00.000Z', end: '2026-11-04T00:00:00.000Z' }));
    assert.equal(one.date, '2026-11-03');
    assert.equal(one.time, null);
    assert.equal(one.endDate, null);
    const three = toDraft(ev({ allDay: true, start: '2026-11-05T00:00:00.000Z', end: '2026-11-08T00:00:00.000Z' }));
    assert.equal(three.endDate, '2026-11-07');
  });

  test('повторы: частота, интервал, дни недели (вс = 7), конец', () => {
    assert.deepEqual(repeatOf({ frequency: 'weekly', interval: 2, daysOfTheWeek: [{ dayOfTheWeek: 2 }, { dayOfTheWeek: 1 }] }), {
      freq: 'week',
      every: 2,
      weekdays: [1, 7],
    });
    assert.deepEqual(repeatOf({ frequency: 'daily', occurrence: 5 }), { freq: 'day', every: 1, count: 5 });
    assert.deepEqual(repeatOf({ frequency: 'monthly', daysOfTheMonth: [15], endDate: '2027-01-31T20:59:00.000Z' }), {
      freq: 'month',
      every: 1,
      monthDays: [15],
      until: '2027-01-31',
    });
    assert.equal(repeatOf({ frequency: 'monthly', daysOfTheWeek: [{ dayOfTheWeek: 3, weekNumber: 2 }] }), null, 'второй вторник — не ложится');
    assert.equal(ruleSupported({ frequency: 'hourly' }), false);
    assert.equal(repeatOf(null), null);
  });

  test('подпись серии', () => {
    assert.equal(ruleText({ freq: 'week', every: 1 }, '2026-11-02'), 'КАЖДЫЙ ПН');
    assert.equal(ruleText({ freq: 'week', every: 2, weekdays: [1, 3] }, '2026-11-02'), 'КАЖДЫЕ 2 НЕД. · ПН, СР');
    assert.equal(ruleText({ freq: 'year', every: 1 }, '2026-11-02'), 'КАЖДЫЙ ГОД');
    assert.equal(ruleText({ freq: 'month', every: 1 }, '2026-11-15'), 'КАЖДЫЙ МЕСЯЦ · 15-ГО');
  });

  test('дни рождения: тип, каждый год, именинник', () => {
    const d = toDraft(ev({ title: 'День рождения Пети', allDay: true, start: '2026-11-03T00:00:00.000Z', end: '2026-11-04T00:00:00.000Z' }), { birthdays: true });
    assert.equal(d.kind, 'birthday');
    assert.deepEqual(d.repeat, { freq: 'year', every: 1 });
    assert.deepEqual(d.celebrant, { name: 'Пети' });
    assert.equal(celebrantName("Petya's birthday"), 'Petya');
    assert.equal(celebrantName('Маша'), 'Маша');
    assert.ok(isBirthdayCalendar('Дни рождения'));
    assert.ok(isBirthdayCalendar('Contacts', 'addressbook#contacts@group.v.calendar.google.com'));
    assert.ok(!isBirthdayCalendar('Работа'));
    assert.ok(isHolidayCalendar('Праздники России'));
  });

  test('отпечаток меняется вместе с содержимым', () => {
    const a = eventHash(ev({}));
    assert.equal(a, eventHash(ev({})));
    assert.notEqual(a, eventHash(ev({ title: 'Стоматолог!' })));
    assert.notEqual(a, eventHash(ev({ end: '2026-10-27T12:30:00.000Z' })));
    assert.notEqual(a, eventHash(ev({ rule: { frequency: 'weekly' } })));
  });
});
