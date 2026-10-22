/**
 * Сценарии макета C-Week (неделя 5–11 октября 2026). Высота часа 60 px, ширина колонки 46 px (блок 44 px),
 * поэтому все координаты целые. Видимые часы — как в макете: 06–23.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { COLUMN, layoutDayColumn, type Band, type ColumnBlock, type ColumnOptions } from './dayColumn';
import { hourRange } from './hourRange';

const OPTS: ColumnOptions = { colWidth: 46, hourPx: 60, h0: 6, hEnd: 23 };
const W = 44;
/** Дело по часам: ev('Футбол', 18, 21) */
const ev = (id: string, a: number, b: number) => ({ id, start: Math.round(a * 60), end: Math.round(b * 60) });
const band = (y0: number, y1: number, left: number, right: number): Band => ({ y0, y1, left, right });

const layout = (events: ReturnType<typeof ev>[], opts = OPTS) => {
  const out = layoutDayColumn(events, opts);
  const byId = new Map(out.map((b) => [b.id, b]));
  const get = (id: string): ColumnBlock => {
    const b = byId.get(id);
    if (!b) throw new Error(`нет блока ${id}`);
    return b;
  };
  return { out, get };
};

describe('layoutDayColumn — сценарии макета', () => {
  test('видимые часы недели макета: 06–23', () => {
    const week = [
      ev('Стоматолог', 9.5, 10.5), ev('Йога', 19, 20), ev('МФЦ', 16, 17), ev('Ужин', 19, 20.5), ev('Поезд', 7, 9),
      ev('Футбол', 18, 21), ev('Встреча', 9, 15), ev('Кино', 19.5, 22), ev('Бранч', 11, 13),
    ];
    assert.deepEqual(hourRange(week, 17 * 60 + 52), { h0: OPTS.h0, hEnd: OPTS.hEnd });
  });

  test('СР: без пересечений — прямоугольники на всю ширину', () => {
    const { get } = layout([ev('Поезд в Казань', 7, 9), ev('Футбол', 18, 21)]);
    const f = get('Футбол');
    assert.deepEqual([f.x, f.y, f.w, f.h], [1, 12 * 60 + 1, W, 178]);
    assert.deepEqual(f.bands, [band(0, 178, 0, W)]);
    assert.equal(f.path, 'M 0 0 L 0 178 L 44 178 L 44 0 Z');
    assert.equal(f.edgePath, 'M 0 0 L 0 178');
    assert.deepEqual([f.textInsetTop, f.textInsetLeft, f.textWidth], [3, 6, 38]);
  });

  test('ЧТ: цепочка из трёх — каждый огибает полосы всех предыдущих', () => {
    const { get } = layout([ev('Встреча', 9, 15), ev('Тренировка', 10.25, 13.75), ev('Отчёт', 11.25, 12.75)]);
    const a = get('Встреча');
    const b = get('Тренировка');
    const c = get('Отчёт');
    // Основа: сужается до полосы STRIP за GAP до начала первого гостя и расширяется через GAP после него
    assert.deepEqual(a.bands, [band(0, 72, 0, W), band(72, 286, 0, COLUMN.STRIP), band(286, 358, 0, W)]);
    // Второй: справа от полосы основы с зазором; сам сужается под третьего
    assert.deepEqual(b.bands, [band(0, 57, 4, W), band(57, 151, 4, 6), band(151, 208, 4, W)]);
    // Третий: справа от обеих полос, верх прямой
    assert.deepEqual(c.bands, [band(0, 88, 8, W)]);
    // Ступенька основы — выше верха гостя (верх гостя прямой), зазор по вертикали
    assert.ok(a.y + 72 < b.y && b.y - (a.y + 72) === COLUMN.GAP + 1);
    assert.ok(b.y + 57 < c.y);
    assert.deepEqual([c.textInsetTop, c.textInsetLeft, c.textWidth], [3, 14, 30]);
  });

  test('ПТ: основа кончается во время гостя — гость ступенькой возвращает всю ширину', () => {
    const { get } = layout([ev('Поезд домой', 13, 15), ev('Обед с Олегом', 14, 16.5), ev('Кино', 19.5, 22)]);
    const host = get('Поезд домой');
    const guest = get('Обед с Олегом');
    assert.deepEqual(host.bands, [band(0, 57, 0, W), band(57, 118, 0, 2)]);
    assert.deepEqual(guest.bands, [band(0, 61, 4, W), band(61, 148, 0, W)]);
    // Ступенька гостя — через GAP после конца основы
    assert.equal(guest.y + 61, 15 * 60 - 6 * 60 + COLUMN.GAP);
    assert.equal(host.path, 'M 0 0 L 0 118 L 2 118 L 2 61 Q 2 57 6 57 L 40 57 Q 44 57 44 53 L 44 0 Z');
    assert.equal(guest.path, 'M 4 0 L 4 59 Q 4 61 2 61 L 2 61 Q 0 61 0 63 L 0 148 L 44 148 L 44 0 Z');
    assert.equal(guest.edgePath, 'M 4 0 L 4 59 Q 4 61 2 61 L 2 61 Q 0 61 0 63 L 0 148');
    assert.deepEqual(get('Кино').bands, [band(0, 148, 0, W)]);
  });

  test('СБ: подзадачи — обычные дела; Созвон внутри Шашлыков, основа расширяется обратно', () => {
    const { get } = layout([ev('Полить грядки', 9, 10.5), ev('Шашлыки', 13, 15.5), ev('Созвон', 14, 15), ev('Звонок маме', 17, 18.5)]);
    assert.deepEqual(get('Шашлыки').bands, [band(0, 57, 0, W), band(57, 121, 0, 2), band(121, 148, 0, W)]);
    assert.deepEqual(get('Созвон').bands, [band(0, 58, 4, W)]);
    assert.deepEqual(get('Полить грядки').bands, [band(0, 88, 0, W)]);
    assert.deepEqual(get('Звонок маме').bands, [band(0, 88, 0, W)]);
    assert.equal((get('Шашлыки').path.match(/Q/g) ?? []).length, 4);
  });
});

describe('layoutDayColumn — края', () => {
  test('одновременное начало: основа — более длинное, её текст — под гостем', () => {
    const { get } = layout([ev('Созвон', 13, 13.5), ev('Посылка', 13, 14)]);
    const host = get('Посылка');
    assert.deepEqual(host.bands, [band(0, 31, 0, 2), band(31, 58, 0, W)]);
    assert.deepEqual(get('Созвон').bands, [band(0, 28, 4, W)]);
    assert.deepEqual([host.textInsetTop, host.textInsetLeft], [34, 6]);
  });

  test('полное совпадение: основа — первое во входе; порядок результата — порядок входа', () => {
    const { out } = layout([ev('A', 10, 11), ev('B', 10, 11)]);
    assert.deepEqual(out.map((b) => b.id), ['A', 'B']);
    assert.equal(out[0].bands[0].right, 2);
    assert.equal(out[1].bands[0].left, 4);
  });

  test('гости близко друг к другу: основа не расширяется в щель', () => {
    const { get } = layout([ev('H', 9, 12), ev('G1', 10, 10.5), ev('G2', 10 + 37 / 60, 11)]);
    assert.deepEqual(get('H').bands, [band(0, 57, 0, W), band(57, 121, 0, 2), band(121, 178, 0, W)]);
    assert.deepEqual(get('G2').bands, [band(0, 21, 4, W)]);
  });

  test('основа кончается сразу после начала гостя: текст гостя — после ступеньки', () => {
    const { get } = layout([ev('H', 9, 10), ev('G', 9 + 59 / 60, 11)]);
    const g = get('G');
    assert.deepEqual(g.bands, [band(0, 2, 4, W), band(2, 59, 0, W)]);
    assert.deepEqual([g.textInsetTop, g.textInsetLeft], [5, 6]);
    // Сужение основы у самого низа доходит до края — без «козырька»
    assert.deepEqual(get('H').bands, [band(0, 56, 0, W), band(56, 58, 0, 2)]);
  });

  test('обрезка по видимым часам, дело без конца — 30 минут, невидимые пропускаются', () => {
    const { out, get } = layout([ev('рано', 5, 9), { id: 'без конца', start: 600, end: 600 }, ev('ночь', 23.5, 24)]);
    assert.deepEqual([get('рано').y, get('рано').h], [1, 178]);
    assert.equal(get('без конца').h, 28);
    assert.deepEqual(out.map((b) => b.id), ['рано', 'без конца']);
  });

  test('глубокая цепочка не выходит за колонку', () => {
    const many = Array.from({ length: 30 }, (_, i) => ev(`e${i}`, 9 + i / 60, 12));
    for (const b of layoutDayColumn(many, OPTS)) {
      for (const s of b.bands) assert.ok(s.left >= 0 && s.right <= W && s.right > s.left, `${b.id}: ${JSON.stringify(s)}`);
      assert.ok(!b.path.includes('NaN'));
    }
  });
});
