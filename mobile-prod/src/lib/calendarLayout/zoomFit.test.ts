/** Текст целыми строками, геометрия видов (что под пальцами), щипок между видами */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutDayColumn } from './dayColumn';
import { fitRows, fitTextLines, linesOf, textRoom } from './textFit';
import { monthCellAt, monthLayout, weekColumnAt, yearLayout, yearMonthAt, type ViewFrame } from './viewGeometry';
import { ZOOM, zoomCommits, zoomDir, zoomEnterScale, zoomExitScale, zoomFollow, zoomNext, zoomProgress, zoomShift } from './zoom';

/** Дело недели: название 9.5, время и кто 8.5, зазор 1 */
const week = (title: number, time = 1, who = 1) => [
  { lineHeight: 9.5, lines: title },
  { lineHeight: 8.5, lines: time, gapBefore: 1 },
  { lineHeight: 8.5, lines: who, gapBefore: 1 },
];

describe('fitTextLines', () => {
  test('всё влезает — все строки, высота без лишнего', () => {
    assert.deepEqual(fitTextLines(40, week(1)), { height: 28.5, lines: [1, 1, 1] });
  });

  test('блок ниже одной строки — ничего не рисуется', () => {
    assert.deepEqual(fitTextLines(9, week(1)), { height: 0, lines: [0, 0, 0] });
    assert.deepEqual(fitTextLines(0, week(1)), { height: 0, lines: [0, 0, 0] });
    assert.deepEqual(fitTextLines(-3, week(1)), { height: 0, lines: [0, 0, 0] });
  });

  test('ровно строка названия — только она', () => {
    assert.deepEqual(fitTextLines(9.5, week(1)), { height: 9.5, lines: [1, 0, 0] });
  });

  test('время влезает только вместе с зазором', () => {
    assert.deepEqual(fitTextLines(18.9, week(1)), { height: 9.5, lines: [1, 0, 0] });
    assert.deepEqual(fitTextLines(19, week(1)), { height: 19, lines: [1, 1, 0] });
  });

  test('длинное название: целые строки, ниже ничего', () => {
    assert.deepEqual(fitTextLines(25, week(3)), { height: 19, lines: [2, 0, 0] });
  });

  test('перенесённое время: видна только целая первая строка', () => {
    assert.deepEqual(fitTextLines(20, week(1, 2)), { height: 19, lines: [1, 1, 0] });
  });

  test('пустой кусок пропускается вместе с зазором', () => {
    const day = [
      { lineHeight: 14, lines: 1 },
      { lineHeight: 13, lines: 0, gapBefore: 2 },
      { lineHeight: 11, lines: 1, gapBefore: 2 },
    ];
    assert.deepEqual(fitTextLines(27, day), { height: 27, lines: [1, 0, 1] });
  });

  test('дробная высота часа не теряет строку из-за округления', () => {
    assert.deepEqual(fitTextLines(28.499, week(1)), { height: 28.5, lines: [1, 1, 1] });
  });
});

describe('textRoom', () => {
  const bands = [
    { y0: 0, y1: 30, left: 0, right: 40 },
    { y0: 30, y1: 50, left: 0, right: 2 },
    { y0: 50, y1: 80, left: 0, right: 40 },
  ];

  test('до узкой полосы основы под гостем: ниже строку срезал бы верх гостя', () => {
    assert.equal(textRoom(bands, 3, 2), 27);
  });

  test('полосы подряд шире полосы основы — одно место', () => {
    assert.equal(textRoom([{ y0: 0, y1: 20, left: 0, right: 40 }, { y0: 20, y1: 45, left: 0, right: 20 }], 3, 2), 42);
  });

  test('текст в нижней полосе: от её начала до конца блока', () => {
    assert.equal(textRoom(bands, 53, 2), 27);
  });

  test('встреча с гостем в 10:15 (макет недели): текст только над гостем', () => {
    const hourPx = 40;
    const [base] = layoutDayColumn(
      [
        { id: 'a', start: 9 * 60, end: 15 * 60 },
        { id: 'b', start: 10 * 60 + 15, end: 13 * 60 + 45 },
      ],
      { colWidth: 45, hourPx, h0: 6, hEnd: 23 },
    );
    const room = textRoom(base.bands, base.textInsetTop, 2);
    // Гость с 10:15 — через 1¼ часа после начала: над ним место меньше 50px, а не весь блок (6 часов)
    assert.ok(room > 1.25 * hourPx - 8 && room < 1.25 * hourPx, String(room));
  });
});

describe('linesOf, fitRows', () => {
  test('строки по измеренной высоте', () => {
    assert.equal(linesOf(0, 9.5), 0);
    assert.equal(linesOf(9.5, 9.5), 1);
    assert.equal(linesOf(19.2, 9.5), 2);
    assert.equal(linesOf(5, 9.5), 1);
  });

  test('дела в ячейке месяца: 77 — пять, 64 — четыре строки по 9 с зазором 1', () => {
    assert.equal(fitRows(77 - 21, 9, 1, 5), 5);
    assert.equal(fitRows(64 - 21, 9, 1, 5), 4);
    assert.equal(fitRows(5, 9, 1, 5), 0);
  });
});

/** Стенд сверки: 390 × 844 без safe area, навигация снизу 98 */
const MOCK: ViewFrame = { width: 390, height: 844, top: 0, bottom: 98 };
/** iPhone 15: safe area 59 / 34 */
const PHONE: ViewFrame = { width: 393, height: 852, top: 59, bottom: 34 + 98 };
/** iPhone SE */
const SE: ViewFrame = { width: 375, height: 667, top: 20, bottom: 98 };

describe('geometry', () => {
  test('неделя: колонка под пальцем, за краями — крайняя', () => {
    assert.equal(weekColumnAt(44 + 1, 390), 0);
    assert.equal(weekColumnAt(44 + 320 / 7 + 1, 390), 1);
    assert.equal(weekColumnAt(363, 390), 6);
    assert.equal(weekColumnAt(10, 390), 0);
    assert.equal(weekColumnAt(389, 390), 6);
  });

  test('месяц по макету: панель 552, строка 77 (5 недель) и 64 (6 недель)', () => {
    assert.deepEqual(monthLayout(5, MOCK), { gridTop: 156, rowH: 77, panelTop: 552, panelMax: 194 });
    assert.equal(monthLayout(6, MOCK).rowH, 64);
  });

  test('месяц на низком экране: панель дня поднимается над навигацией', () => {
    const l = monthLayout(5, SE);
    assert.equal(l.panelTop, 667 - 98 - 87);
    assert.equal(l.panelMax, 87);
    assert.ok(156 + 20 + 1.5 + 5 * l.rowH + 8 <= l.panelTop);
  });

  test('месяц: ячейка под пальцем, вне сетки по высоте — null', () => {
    assert.deepEqual(monthCellAt(16 + 1, 158, 5, MOCK), { row: 0, col: 0 });
    assert.deepEqual(monthCellAt(374, 157.5 + 77 * 2 + 5, 5, MOCK), { row: 2, col: 6 });
    assert.equal(monthCellAt(200, 148, 5, MOCK), null);
    assert.equal(monthCellAt(200, 600, 5, MOCK), null);
  });

  test('год по макету: строка 138, квадраты 12', () => {
    assert.deepEqual(yearLayout(MOCK), { gridTop: 162, rowH: 138, dayH: 12, gridH: 570 });
  });

  test('год на телефоне: декабрь над навигацией', () => {
    for (const f of [PHONE, SE]) {
      const l = yearLayout(f);
      assert.ok(l.gridTop + l.gridH <= f.height - f.bottom, `${f.width}×${f.height}`);
      assert.ok(l.dayH >= 6 && l.dayH <= 12);
    }
    assert.equal(yearLayout(PHONE).dayH, 12);
  });

  test('год: месяц под пальцем', () => {
    assert.equal(yearMonthAt(20, 180, MOCK), 1);
    assert.equal(yearMonthAt(200, 180, MOCK), 2);
    assert.equal(yearMonthAt(380, 740, MOCK), 12);
    assert.equal(yearMonthAt(200, 100, MOCK), 2);
    assert.equal(yearMonthAt(200, 180 + 144, MOCK), 5);
    assert.equal(yearMonthAt(200, 180, MOCK, 144), 5);
  });
});

describe('zoom', () => {
  test('порядок видов и края', () => {
    assert.equal(zoomNext('week', 1), 'month');
    assert.equal(zoomNext('month', 1), 'year');
    assert.equal(zoomNext('year', 1), null);
    assert.equal(zoomNext('year', -1), 'month');
    assert.equal(zoomNext('month', -1), 'week');
    assert.equal(zoomNext('week', -1), 'day');
    assert.equal(zoomNext('day', -1), null);
    assert.equal(zoomNext('day', 1), 'week');
    assert.equal(zoomNext('week', 0), null);
  });

  test('направление: свели пальцы — крупнее, дрожание — нет', () => {
    assert.equal(zoomDir(0.9), 1);
    assert.equal(zoomDir(1.1), -1);
    assert.equal(zoomDir(0.99), 0);
    assert.equal(zoomDir(1.01), 0);
  });

  test('ход перехода: 0 в начале, 1 на полном масштабе, против направления — 0', () => {
    assert.equal(zoomProgress(1, 1), 0);
    assert.equal(zoomProgress(Math.exp(-ZOOM.full), 1), 1);
    assert.equal(zoomProgress(0.3, 1), 1);
    assert.ok(Math.abs(zoomProgress(Math.exp(ZOOM.full / 2), -1) - 0.5) < 1e-9);
    assert.equal(zoomProgress(1.2, 1), 0);
  });

  test('пороги как в старом приложении: 0.88 и 1.14', () => {
    assert.equal(zoomCommits(0.88, 0, 1), true);
    assert.equal(zoomCommits(0.9, 0, 1), false);
    assert.equal(zoomCommits(1.14, 0, -1), true);
    assert.equal(zoomCommits(1.12, 0, -1), false);
    assert.equal(zoomCommits(0.5, 0, 0), false);
  });

  test('резкий щипок переключает и до порога, движение назад — нет', () => {
    assert.equal(zoomCommits(0.93, -1, 1), true);
    assert.equal(zoomCommits(0.97, -1, 1), false);
    assert.equal(zoomCommits(1.07, 1.2, -1), true);
    assert.equal(zoomCommits(0.8, 1.5, 1), false);
  });

  test('масштаб под пальцами: до конца перехода, дальше стоит; без следующего вида — резинка', () => {
    assert.equal(zoomFollow(0.8, true), 0.8);
    assert.ok(Math.abs(zoomFollow(0.2, true) - Math.exp(-ZOOM.full)) < 1e-9);
    assert.ok(zoomFollow(2, false) < 1.15 && zoomFollow(2, false) > 1);
    assert.ok(Math.abs(zoomExitScale(1) - Math.exp(-ZOOM.full)) < 1e-9);
    assert.ok(zoomExitScale(-1) > 1);
  });

  test('новый вид проступает из e^(±0.2) к 1', () => {
    assert.ok(Math.abs(zoomEnterScale(0, 1) - Math.exp(0.2)) < 1e-9);
    assert.ok(Math.abs(zoomEnterScale(0, -1) - Math.exp(-0.2)) < 1e-9);
    assert.equal(zoomEnterScale(1, 1), 1);
    assert.equal(zoomEnterScale(2, -1), 1);
  });

  test('масштаб вокруг точки щипка: точка остаётся на месте', () => {
    const s = 0.7;
    const { x, y } = zoomShift(s, 100, 600, 390, 844);
    // RN масштабирует вокруг центра слоя: p → c + s·(p − c) + shift
    assert.ok(Math.abs(195 + s * (100 - 195) + x - 100) < 1e-9);
    assert.ok(Math.abs(422 + s * (600 - 422) + y - 600) < 1e-9);
  });
});
