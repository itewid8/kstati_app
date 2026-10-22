/** Полосы, видимые часы, конфликты, свободные окна, ячейка месяца */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { packAllDayBars } from './allDayBars';
import { absMinute, conflicts, freeWindows, isoOfMinute } from './busy';
import { hourRange } from './hourRange';
import { monthCellItems } from './monthCell';
import type { BusyEvent } from './types';

describe('packAllDayBars', () => {
  test('полосы макета недели: жадно в первую свободную строку', () => {
    const { rowCount, bars } = packAllDayBars(
      [
        { id: 'Подарок Лене', startDate: '2026-10-05', endDate: '2026-10-05' },
        { id: 'Командировка', startDate: '2026-10-07', endDate: '2026-10-09' },
        { id: 'Мама в гостях', startDate: '2026-10-08', endDate: '2026-10-10' },
        { id: 'Дача', startDate: '2026-10-10', endDate: '2026-10-10' },
      ],
      '2026-10-05',
    );
    assert.equal(rowCount, 2);
    assert.deepEqual(
      bars.map((b) => [b.id, b.row, b.d0, b.d1]),
      [['Подарок Лене', 0, 0, 0], ['Командировка', 0, 2, 4], ['Мама в гостях', 1, 3, 5], ['Дача', 0, 5, 5]],
    );
  });

  test('обрезка по неделе, длинные первыми, вне недели — нет', () => {
    const { rowCount, bars } = packAllDayBars(
      [
        { id: 'короткая', startDate: '2026-10-05', endDate: '2026-10-05' },
        { id: 'с прошлой недели', startDate: '2026-10-01', endDate: '2026-10-06' },
        { id: 'до следующей', startDate: '2026-10-11', endDate: '2026-10-14' },
        { id: 'не эта неделя', startDate: '2026-10-12', endDate: '2026-10-12' },
      ],
      '2026-10-05',
    );
    assert.equal(rowCount, 2);
    assert.deepEqual(bars[0], { id: 'с прошлой недели', row: 0, d0: 0, d1: 1, cutStart: true, cutEnd: false });
    assert.deepEqual(bars[1], { id: 'короткая', row: 1, d0: 0, d1: 0, cutStart: false, cutEnd: false });
    assert.deepEqual(bars[2], { id: 'до следующей', row: 0, d0: 6, d1: 6, cutStart: false, cutEnd: true });
  });

  test('день (days = 1)', () => {
    const r = packAllDayBars([{ id: 'Мама', startDate: '2026-10-08', endDate: '2026-10-10' }], '2026-10-09', 1);
    assert.deepEqual(r.bars.map((b) => [b.d0, b.d1, b.cutStart, b.cutEnd]), [[0, 0, true, true]]);
  });
});

describe('hourRange', () => {
  const h = (a: number, b: number) => ({ start: a * 60, end: b * 60 });
  test('день макета C-Day: 08–23', () => {
    assert.deepEqual(hourRange([h(9.5, 10.5), h(13, 13.5), h(13, 14), h(19, 20), h(21, 22)], 17 * 60 + 52), { h0: 8, hEnd: 23 });
  });
  test('сейчас раздвигает сетку; без «сейчас» — только дела', () => {
    assert.deepEqual(hourRange([h(10, 11)], 7 * 60 + 10), { h0: 6, hEnd: 12 });
    assert.deepEqual(hourRange([h(10, 11)]), { h0: 9, hEnd: 12 });
  });
  test('края суток и пустой день', () => {
    assert.deepEqual(hourRange([h(0.5, 1), h(22, 24)]), { h0: 0, hEnd: 24 });
    assert.deepEqual(hourRange([]), { h0: 8, hEnd: 22 });
    assert.deepEqual(hourRange([], 23 * 60 + 30), { h0: 8, hEnd: 24 });
  });
});

const at = (date: string, from: string, to: string, id: string, people: string[], toDate = date): BusyEvent => ({
  id,
  start: absMinute(date, from),
  end: absMinute(toDate, to),
  people,
});

describe('conflicts', () => {
  test('сценарии макета без общих людей — конфликтов нет', () => {
    const week = [
      at('2026-10-08', '09:00', '15:00', 'Встреча', ['k']),
      at('2026-10-08', '10:15', '13:45', 'Тренировка', ['s']),
      at('2026-10-08', '11:15', '12:45', 'Отчёт', ['o']),
      at('2026-10-09', '13:00', '15:00', 'Поезд домой', ['k']),
      at('2026-10-09', '14:00', '16:30', 'Обед', ['s']),
      at('2026-10-10', '13:00', '15:30', 'Шашлыки', ['k']),
      at('2026-10-10', '14:00', '15:00', 'Созвон', ['o']),
    ];
    assert.deepEqual(conflicts(week), []);
  });

  test('общий человек и пересечение — конфликт; встык и в разные дни — нет', () => {
    const list = [
      at('2026-10-06', '19:00', '20:30', 'Ужин с Леной', ['s', 'k']),
      at('2026-10-06', '19:30', '20:15', 'Йога', ['k']),
      at('2026-10-06', '20:30', '21:00', 'встык', ['s']),
      at('2026-10-07', '19:30', '20:00', 'другой день', ['k']),
      at('2026-10-09', '23:00', '01:00', 'через полночь', ['s'], '2026-10-10'),
      at('2026-10-10', '00:30', '00:30', 'без конца', ['o', 's']),
    ];
    assert.deepEqual(conflicts(list), [
      { a: 'Ужин с Леной', b: 'Йога', people: ['k'] },
      { a: 'через полночь', b: 'без конца', people: ['s'] },
    ]);
  });
});

describe('freeWindows', () => {
  const weekend = [
    at('2026-10-10', '09:00', '10:30', 'Полить грядки', ['s']),
    at('2026-10-10', '13:00', '15:30', 'Шашлыки', ['k']),
    at('2026-10-10', '14:00', '15:00', 'Созвон', ['o']),
    at('2026-10-10', '17:00', '18:30', 'Звонок маме', ['s']),
    at('2026-10-11', '11:00', '13:00', 'Бранч у Ани', ['s', 'k']),
  ];
  const sat = absMinute('2026-10-10');
  const mon = absMinute('2026-10-12');
  const fmt = (w: ReturnType<typeof freeWindows>[number]) => {
    const t = (m: number) => `${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    return `${w.date} ${w.atDayStart ? 'ДО' : t(w.start)} ${w.atDayEnd ? '→' : t(w.end)}`;
  };

  test('выходные Сани: «СБ 18:30 →» и «ВС ДО 11:00» среди окон', () => {
    assert.deepEqual(freeWindows(weekend, 's', sat, mon).map(fmt), [
      '2026-10-10 ДО 09:00',
      '2026-10-10 10:30 17:00',
      '2026-10-10 18:30 →',
      '2026-10-11 ДО 11:00',
      '2026-10-11 13:00 →',
    ]);
  });

  test('чужие дела не мешают; дела других людей не считаются', () => {
    assert.deepEqual(freeWindows(weekend, 'o', sat, absMinute('2026-10-11')).map(fmt), ['2026-10-10 ДО 14:00', '2026-10-10 15:00 →']);
  });

  test('окна короче часа не показываются, ровно час — да', () => {
    const list = [at('2026-10-10', '09:00', '12:00', 'a', ['s']), at('2026-10-10', '12:59', '22:00', 'b', ['s'])];
    assert.deepEqual(freeWindows(list, 's', sat, absMinute('2026-10-11')).map(fmt), ['2026-10-10 ДО 09:00', '2026-10-10 22:00 →']);
  });

  test('период с середины дня и занятость через полночь', () => {
    const list = [at('2026-10-09', '22:00', '09:30', 'вечеринка', ['s'], '2026-10-10'), at('2026-10-10', '17:00', '18:30', 'c', ['s'])];
    const from = absMinute('2026-10-10', '15:20');
    assert.deepEqual(freeWindows(list, 's', from, mon).map(fmt), ['2026-10-10 15:20 17:00', '2026-10-10 18:30 →', '2026-10-11 ДО →']);
    assert.equal(freeWindows(list, 's', sat, from)[0].start, absMinute('2026-10-10', '09:30'));
  });

  test('настройки дня и isoOfMinute', () => {
    const w = freeWindows([], 's', sat, absMinute('2026-10-11'), { dayStart: 10 * 60, dayEnd: 12 * 60, minGap: 30 });
    assert.deepEqual(w.map((x) => [x.start - sat, x.end - sat, x.atDayStart, x.atDayEnd]), [[600, 720, true, true]]);
    assert.equal(isoOfMinute(absMinute('2026-10-11', '23:59')), '2026-10-11');
  });
});

describe('monthCellItems', () => {
  const list = (n: number) => Array.from({ length: n }, (_, i) => i);
  test('до 5 — все; больше — 4 и «+N»', () => {
    assert.deepEqual(monthCellItems(list(5)), { shown: [0, 1, 2, 3, 4], more: 0 });
    assert.deepEqual(monthCellItems(list(6)), { shown: [0, 1, 2, 3], more: 2 });
    assert.deepEqual(monthCellItems(list(7)), { shown: [0, 1, 2, 3], more: 3 });
    assert.deepEqual(monthCellItems([]), { shown: [], more: 0 });
  });
});
