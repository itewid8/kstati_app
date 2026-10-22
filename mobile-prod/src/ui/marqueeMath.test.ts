/** Бегущая строка: порог переполнения, зазор, скорость, длительность круга */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { MARQUEE, marqueeDuration, marqueeGap, marqueeOverflows, marqueeShift, marqueeSpeed } from './marqueeMath';

describe('marqueeOverflows', () => {
  test('шире рамки — едет', () => assert.equal(marqueeOverflows(201, 200), true));
  test('ровно по рамке и в пределах округления — стоит', () => {
    assert.equal(marqueeOverflows(200, 200), false);
    assert.equal(marqueeOverflows(200.4, 200), false);
  });
  test('рамка ещё не измерена — стоит', () => assert.equal(marqueeOverflows(300, 0), false));
});

describe('marqueeGap / marqueeSpeed', () => {
  test('строка списка 13px: зазор 24, скорость 30 px/с', () => {
    assert.equal(marqueeGap(13), 24);
    assert.equal(marqueeSpeed(13), 30);
  });
  test('подпись 9px: зазор 18, скорость 22.5 px/с', () => {
    assert.equal(marqueeGap(9), 18);
    assert.equal(marqueeSpeed(9), 22.5);
  });
  test('ячейка месяца 6.5px: зазор 13, скорость — нижний предел', () => {
    assert.equal(marqueeGap(6.5), 13);
    assert.equal(marqueeSpeed(6.5), MARQUEE.speedMin);
  });
  test('совсем мелкий текст: зазор не меньше нижнего предела', () => assert.equal(marqueeGap(4), MARQUEE.gapMin));
  test('без размера — 14px по умолчанию', () => assert.equal(marqueeGap(), 24));
});

describe('marqueeDuration', () => {
  test('круг = (ширина + зазор) / скорость', () => {
    const shift = marqueeShift(276, 24);
    assert.equal(shift, 300);
    assert.equal(marqueeDuration(shift, 30), 10000);
  });
  test('нулевой сдвиг или скорость — 0', () => {
    assert.equal(marqueeDuration(0, 30), 0);
    assert.equal(marqueeDuration(100, 0), 0);
  });
});
