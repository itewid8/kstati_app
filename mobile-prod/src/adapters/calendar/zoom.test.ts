import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { ViewFrame } from '@/lib/calendarLayout';
import { monthWeeks, zoomTarget, type ZoomInput } from './zoom';

/** Стенд сверки: 390 × 844, навигация снизу 98; сегодня 2026-10-05 (понедельник) */
const FRAME: ViewFrame = { width: 390, height: 844, top: 0, bottom: 98 };
const TODAY = '2026-10-05';
/** Колонка недели i: середина */
const colX = (i: number) => 44 + (320 / 7) * (i + 0.5);

const at = (p: Pick<ZoomInput, 'view' | 'date' | 'dir'> & Partial<ZoomInput>) =>
  zoomTarget({ x: 195, y: 400, frame: FRAME, today: TODAY, ...p });

describe('zoomTarget', () => {
  test('дальше некуда: год свести, день развести', () => {
    assert.equal(at({ view: 'year', date: TODAY, dir: 1 }), null);
    assert.equal(at({ view: 'day', date: TODAY, dir: -1 }), null);
    assert.equal(at({ view: 'week', date: TODAY, dir: 0 }), null);
  });

  test('неделя → месяц: месяц дня под пальцами (неделя на стыке месяцев)', () => {
    // 28 сен — 4 окт 2026
    assert.deepEqual(at({ view: 'week', date: '2026-10-01', dir: 1, x: colX(1) }), { view: 'month', date: '2026-09-29' });
    assert.deepEqual(at({ view: 'week', date: '2026-10-01', dir: 1, x: colX(5) }), { view: 'month', date: '2026-10-03' });
  });

  test('неделя → день: день колонки под пальцами, за краем — крайний', () => {
    assert.deepEqual(at({ view: 'week', date: '2026-10-08', dir: -1, x: colX(4) }), { view: 'day', date: '2026-10-09' });
    assert.deepEqual(at({ view: 'week', date: '2026-10-08', dir: -1, x: 2 }), { view: 'day', date: '2026-10-05' });
  });

  test('месяц → неделя: неделя ячейки под пальцами', () => {
    // Октябрь 2026: сетка с понедельника 28 сен, 5 недель по 77, черта сетки 168 + 1.5
    const y = (row: number) => 169.5 + 77 * row + 30;
    const x = (col: number) => 16 + (358 / 7) * (col + 0.5);
    assert.equal(monthWeeks('2026-10-20'), 5);
    assert.deepEqual(at({ view: 'month', date: '2026-10-20', dir: -1, x: x(2), y: y(1) }), { view: 'week', date: '2026-10-07' });
    assert.deepEqual(at({ view: 'month', date: '2026-10-20', dir: -1, x: x(0), y: y(0) }), { view: 'week', date: '2026-09-28' });
    assert.deepEqual(at({ view: 'month', date: '2026-10-20', dir: -1, x: x(6), y: y(4) }), { view: 'week', date: '2026-11-01' });
  });

  test('месяц → неделя: пальцы на панели дня — неделя выбранного дня', () => {
    assert.deepEqual(at({ view: 'month', date: '2026-10-20', dir: -1, y: 620 }), { view: 'week', date: '2026-10-20' });
  });

  test('месяц → год и день → неделя: тот же день', () => {
    assert.deepEqual(at({ view: 'month', date: '2026-10-20', dir: 1 }), { view: 'year', date: '2026-10-20' });
    assert.deepEqual(at({ view: 'day', date: '2026-10-20', dir: 1 }), { view: 'week', date: '2026-10-20' });
  });

  test('год → месяц: карточка под пальцами; текущий месяц — сегодня, другой — первое число', () => {
    // Строки карточек 138 + 6 с 174, колонки по (358 − 12) / 3
    assert.deepEqual(at({ view: 'year', date: '2026-03-14', dir: -1, x: 300, y: 174 + 3 * 144 + 50 }), { view: 'month', date: '2026-12-01' });
    assert.deepEqual(at({ view: 'year', date: '2026-03-14', dir: -1, x: 30, y: 174 + 3 * 144 + 50 }), { view: 'month', date: TODAY });
    assert.deepEqual(at({ view: 'year', date: '2027-03-14', dir: -1, x: 30, y: 180 }), { view: 'month', date: '2027-01-01' });
  });

  test('год → месяц с прокруткой сетки', () => {
    assert.deepEqual(at({ view: 'year', date: '2026-01-01', dir: -1, x: 200, y: 180, yearScroll: 144 }), { view: 'month', date: '2026-05-01' });
  });

  test('6 недель: месяц на стыке', () => {
    assert.equal(monthWeeks('2026-03-01'), 6);
    assert.equal(monthWeeks('2027-02-10'), 4);
  });
});
