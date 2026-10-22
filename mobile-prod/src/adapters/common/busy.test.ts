import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { FREE_DEFAULTS, absMinute, freeWindows } from '@/lib/calendarLayout';
import { FREE_OPTS, busyEvents, busyFor } from './busy';
import { TASKS, snapshot, task } from './fixture';
import { instancesIn } from './tasks';

describe('busyEvents', () => {
  test('только дела со временем, не длиннее суток и не планы с подзадачами', () => {
    const week = instancesIn(TASKS, ['g1'], '2026-10-05', '2026-10-11');
    const events = busyEvents(week, TASKS);
    assert.deepEqual(
      events.map((e) => e.id),
      ['dent', 'yoga@2026-10-05', 'train1', 'meet', 'lunch', 'cinema', 'night'],
    );
    const night = events.find((e) => e.id === 'night');
    assert.ok(night);
    assert.equal(night.start, absMinute('2026-10-09', '23:00'));
    assert.equal(night.end, absMinute('2026-10-10', '06:00'));
    assert.deepEqual(events.find((e) => e.id === 'cinema')?.people, ['s', 'k']);
  });

  test('без конца — end = start (30 минут считают функции занятости)', () => {
    const [e] = busyEvents([task('x', '2026-10-05', '12:00', 'Без конца', ['s'])]);
    assert.ok(e);
    assert.equal(e.end, e.start);
  });
});

describe('busyFor', () => {
  const s = snapshot();

  test('C-AskMove: перенос на пт 14:00 — «САНЯ ЗАНЯТ · Обед с Олегом · 14:00–16:30»', () => {
    const draft = { date: '2026-10-09', time: '14:00', endDate: null, endTime: '15:00' };
    assert.deepEqual(busyFor(s, draft, ['s', 'k'], 'dent'), [
      { personId: 's', title: 'Обед с Олегом', range: '14:00–16:30', key: 'lunch', date: '2026-10-09' },
    ]);
  });

  test('C-EditWho: пн 19:00 — Карина на йоге (раз серии)', () => {
    const draft = { date: '2026-10-05', time: '19:00', endDate: null, endTime: '20:00' };
    assert.deepEqual(busyFor(s, draft, ['s', 'k']), [
      { personId: 'k', title: 'Йога', range: '19:00–20:00', key: 'yoga@2026-10-05', date: '2026-10-05' },
    ]);
    // Само редактируемое дело со всеми повторами не мешает
    assert.deepEqual(busyFor(s, draft, ['s', 'k'], 'yoga'), []);
  });

  test('дело через полночь, несколько людей, порядок по началу', () => {
    const early = { date: '2026-10-10', time: '05:00', endDate: null, endTime: '06:30' };
    assert.deepEqual(busyFor(s, early, ['o']), [{ personId: 'o', title: 'Ночной поезд', range: '23:00–06:00', key: 'night', date: '2026-10-09' }]);
    const evening = { date: '2026-10-09', time: '15:00', endDate: null, endTime: '20:00' };
    assert.deepEqual(
      busyFor(s, evening, ['k', 's']).map((c) => [c.personId, c.key]),
      [['s', 'lunch'], ['k', 'cinema'], ['s', 'cinema']],
    );
  });

  test('без времени и без людей — пусто; план и полосы — не занятость', () => {
    assert.deepEqual(busyFor(s, { date: '2026-10-08', time: null, endDate: null, endTime: null }, ['s', 'k']), []);
    assert.deepEqual(busyFor(s, { date: '2026-10-08', time: '09:00', endDate: null, endTime: '10:00' }, []), []);
    // Командировка (план) идёт 7–9 окт, но занята Карина только подзадачами
    assert.deepEqual(
      busyFor(s, { date: '2026-10-08', time: '18:00', endDate: null, endTime: '19:00' }, ['k']),
      [],
    );
  });
});

describe('FREE_OPTS', () => {
  test('09:00–22:00, окна от часа; FREE_DEFAULTS прежние', () => {
    assert.deepEqual(FREE_OPTS, { dayStart: 540, dayEnd: 1320, minGap: 60 });
    assert.deepEqual(FREE_DEFAULTS, { dayStart: 480, dayEnd: 1380, minGap: 60 });
  });

  test('выходные Сани: короткое окно (40 мин) не показывается', () => {
    const extra = [
      task('water', '2026-10-10', '09:00', 'Полить грядки', ['s'], { endTime: '10:30' }),
      task('tea', '2026-10-10', '13:00', 'Чай', ['s'], { endTime: '14:00' }),
      task('x', '2026-10-10', '14:40', 'Звонок', ['s'], { endTime: '15:00' }),
    ];
    const all = [...TASKS, ...extra];
    const events = busyEvents(instancesIn(all, ['g1'], '2026-10-10', '2026-10-11'), all);
    const free = freeWindows(events, 's', absMinute('2026-10-10'), absMinute('2026-10-12'), FREE_OPTS);
    const hm = (m: number) => `${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    assert.deepEqual(
      free.map((w) => `${w.date} ${hm(w.start)}–${hm(w.end)}`),
      ['2026-10-10 10:30–13:00', '2026-10-10 15:00–22:00', '2026-10-11 09:00–22:00'],
    );
  });
});
