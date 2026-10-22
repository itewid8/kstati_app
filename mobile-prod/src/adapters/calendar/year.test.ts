import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { yearFixture } from '@/screens/fixtures/calendar/year';
import { colorMap } from '../common/people';
import { CLOCK, FRIENDS, task } from '../common/fixture';
import { PAIR, WEEK_TASKS, calendarSnapshot } from './mockup';
import { yearLevel, yearProps } from './year';

const colors = colorMap(calendarSnapshot([]));

describe('yearProps (C-Year)', () => {
  test('легенда и сегодня как в макете (занятость в макете случайная — проверяется правило)', () => {
    const f = yearFixture();
    const y = yearProps(calendarSnapshot([], { groups: [PAIR, FRIENDS] }), CLOCK, colors, { year: 2026 });
    assert.deepEqual(y.people, f.people);
    assert.equal(y.year, f.year);
    assert.equal(y.today, f.today);
    assert.equal(y.total, 0);
    assert.deepEqual(y.monthCounts, Array.from({ length: 12 }, () => 0));
    assert.deepEqual(y.days, {});
  });

  test('уровень: 0.35 + 0.5·min(1, n/4)', () => {
    assert.equal(yearLevel(1), 0.475);
    assert.equal(yearLevel(4), 0.85);
    assert.equal(yearLevel(9), 0.85);
  });

  test('счёт дел: разы повторов и подзадачи считаются, планы — нет; без даты — нет', () => {
    const y = yearProps(calendarSnapshot(WEEK_TASKS), CLOCK, colors, { year: 2026 });
    // Йога каждый понедельник с 7 сентября: 4 раза в сентябре, 4 в октябре, 5 в ноябре, 4 в декабре
    assert.deepEqual(y.monthCounts, [0, 0, 0, 0, 0, 0, 0, 0, 4, 4 + 18, 5, 4]);
    assert.equal(y.total, 4 + 22 + 5 + 4);
  });

  test('день: все дела, которые его задевают; кто — по порядку группы, не больше двух; многодневное — в каждом дне', () => {
    const y = yearProps(calendarSnapshot(WEEK_TASKS), CLOCK, colors, { year: 2026 });
    // 8 октября: мама (с, к), встреча (к), тренировка (с), отчёт (о) — 4 дела, трое людей → первые двое
    assert.deepEqual(y.days['2026-10-08'], { people: ['s', 'k'], level: 0.85 });
    // 10 октября: мама + грядки + шашлыки + созвон + звонок маме (план «Дача» не считается)
    assert.deepEqual(y.days['2026-10-10'], { people: ['s', 'k'], level: 0.85 });
    assert.deepEqual(y.days['2026-10-12'], { people: ['k'], level: yearLevel(1) });
    assert.equal(y.days['2026-10-13'], undefined);
  });

  test('дело с прошлого года задевает 1 января, но в счёт года не входит', () => {
    const ny = task('ny', '2025-12-31', null, 'Новый год на даче', ['o'], { endDate: '2026-01-02' });
    const y = yearProps(calendarSnapshot([ny]), CLOCK, colors, { year: 2026 });
    assert.equal(y.total, 0);
    assert.deepEqual(Object.keys(y.days), ['2026-01-01', '2026-01-02']);
    assert.deepEqual(y.days['2026-01-01']?.people, ['o']);
  });
});
