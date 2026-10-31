import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { PHONE, layoutPhoneColumn } from './phoneLayer';

const O = { colWidth: 46, hourPx: 60, h0: 6, hEnd: 23 };
const s = (id: string, a: number, b: number) => ({ id, start: a * 60, end: b * 60 });

describe('phoneLayer', () => {
  test('свободное время — блок во всю колонку', () => {
    const [b] = layoutPhoneColumn([s('p', 10, 11)], [s('t', 12, 13)], O);
    assert.deepEqual(b, { id: 'p', x: 1, y: 240, w: 44, h: 59, strip: false });
  });

  test('рядом дело — узкая полоса у правого края', () => {
    const [b] = layoutPhoneColumn([s('p', 19.5, 20.5)], [s('t', 19, 21)], O);
    assert.equal(b.strip, true);
    assert.equal(b.w, PHONE.STRIP);
    assert.equal(b.x, 46 - 1 - PHONE.STRIP);
  });

  test('две полосы друг на друге — вторая левее', () => {
    const r = layoutPhoneColumn([s('a', 19, 20), s('b', 19.5, 21)], [s('t', 18, 22)], O);
    assert.deepEqual(
      r.map((b) => [b.id, b.x]),
      [
        ['a', 39],
        ['b', 32],
      ],
    );
  });

  test('два события телефона друг на друге без дел — делят ширину', () => {
    const r = layoutPhoneColumn([s('a', 10, 12), s('b', 11, 13)], [], O);
    assert.equal(r[0].w, 21);
    assert.equal(r[1].x, 23);
  });

  test('вне видимых часов — нет; край обрезается', () => {
    assert.equal(layoutPhoneColumn([s('a', 2, 3)], [], O).length, 0);
    const [b] = layoutPhoneColumn([s('a', 5, 7)], [], O);
    assert.equal(b.y, 0);
    assert.equal(b.h, 59);
  });
});
