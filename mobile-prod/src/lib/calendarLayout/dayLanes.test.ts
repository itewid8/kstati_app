/** Дорожки дня (C-Day): сетка 320 px, 08–23, высота часа 554/15 px — как в макете */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutDayLanes, type LaneOptions } from './dayLanes';
import { hourRange } from './hourRange';

const ev = (id: string, a: number, b: number) => ({ id, start: Math.round(a * 60), end: Math.round(b * 60) });
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

describe('layoutDayLanes', () => {
  const day = [
    ev('Стоматолог', 9.5, 10.5),
    ev('Созвон с Олегом', 13, 13.5),
    ev('Забрать посылку', 13, 14),
    ev('Йога', 19, 20),
    ev('Разделение', 21, 22),
  ];
  const { h0, hEnd } = hourRange(day, 17 * 60 + 52);
  const H = 554 / (hEnd - h0);
  const OPTS: LaneOptions = { width: 320, hourPx: H, h0, hEnd, minHeight: 34 };

  test('макет C-Day: одна дорожка, «Созвон» и «Посылка» — две рядом', () => {
    const out = layoutDayLanes(day, OPTS);
    assert.deepEqual(
      out.map((b) => [b.id, b.lane, b.lanes]),
      [['Стоматолог', 0, 1], ['Созвон с Олегом', 0, 2], ['Забрать посылку', 1, 2], ['Йога', 0, 1], ['Разделение', 0, 1]],
    );
    // Координаты как в макете: x = 1 + l·GW/n, w = GW/n − 2, y = (a − H0)·H + 1, h = max((b − a)·H − 2, 34)
    const [dent, call, parcel] = out;
    assert.ok(near(dent.x, 1) && near(dent.w, 318) && near(dent.y, 1.5 * H + 1) && near(dent.h, H - 2));
    assert.ok(near(call.x, 1) && near(call.w, 158) && near(call.h, 34));
    assert.ok(near(parcel.x, 161) && near(parcel.w, 158) && near(parcel.y, 5 * H + 1));
  });

  test('цепочка: дорожки переиспользуются, группа считает максимум', () => {
    const o: LaneOptions = { width: 300, hourPx: 60, h0: 0, hEnd: 24 };
    const out = layoutDayLanes([ev('a', 9, 11), ev('b', 10, 12), ev('c', 11, 13), ev('d', 14, 15)], o);
    assert.deepEqual(out.map((b) => [b.id, b.lane, b.lanes]), [['a', 0, 2], ['b', 1, 2], ['c', 0, 2], ['d', 0, 1]]);
    assert.ok(near(out[1].x, 151) && near(out[1].w, 148));
  });

  test('minHeight раздувает короткое дело — следующее уходит в соседнюю дорожку', () => {
    const o: LaneOptions = { width: 200, hourPx: 40, h0: 0, hEnd: 24, minHeight: 34 };
    const out = layoutDayLanes([ev('коротко', 9, 9.25), ev('следом', 9.5, 10)], o);
    assert.deepEqual(out.map((b) => [b.lane, b.lanes]), [[0, 2], [1, 2]]);
    const flat = layoutDayLanes([ev('коротко', 9, 9.25), ev('следом', 9.5, 10)], { ...o, minHeight: 0 });
    assert.deepEqual(flat.map((b) => [b.lane, b.lanes]), [[0, 1], [0, 1]]);
  });

  test('обрезка по видимым часам и дела вне сетки', () => {
    const o: LaneOptions = { width: 100, hourPx: 60, h0: 8, hEnd: 12 };
    const out = layoutDayLanes([ev('утро', 6, 9), ev('ночь', 22, 23), ev('без конца', 10, 10)], o);
    assert.deepEqual(out.map((b) => [b.id, b.y, b.h]), [['утро', 1, 58], ['без конца', 121, 28]]);
  });
});
