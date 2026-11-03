import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { SpendDay } from '@/lib/api';
import { spendView } from './spend';

const day = (d: string, kop: number, n: number, extra: Partial<SpendDay> = {}): SpendDay => ({ day: d, n, tokens: n * 1500, kop, sttSec: 0, rules: 0, src: {}, ...extra });

describe('spendView (расходы на ИИ)', () => {
  test('итоги, средняя цена команды, столбики от максимума, сегодня', () => {
    const v = spendView(
      [day('2026-11-01', 0, 0), day('2026-11-02', 150, 4, { src: { device: { n: 4, tokens: 6000, kop: 150 } }, rules: 2 }), day('2026-11-03', 75, 3, { sttSec: 12.5, src: { voice: { n: 1, tokens: 1500, kop: 40 }, device: { n: 2, tokens: 3000, kop: 35 } } })],
      '2026-11-03',
    );
    assert.equal(v.total, '2,25 ₽');
    assert.deepEqual(v.totals.map((x) => x.value), ['7', '10 500', '0,32 ₽']);
    assert.deepEqual(v.bars.map((b) => b.share), [0, 1, 0.5]);
    assert.deepEqual([v.bars[2]?.label, v.bars[2]?.today, v.barsMax], ['3 ноя', true, '1,50 ₽']);
    assert.equal(v.todayLine, 'Сегодня: 0,75 ₽ · 3 команды');
    assert.deepEqual(v.sources.map((s) => s.value), ['0,40 ₽', '1,85 ₽', '0,00 ₽', '0,00 ₽', '13 с']);
    assert.match(v.sources[3]?.meta ?? '', /^2 команды/);
    assert.equal(v.empty, false);
  });
  test('пусто', () => {
    const v = spendView([day('2026-11-03', 0, 0)], '2026-11-03');
    assert.deepEqual([v.empty, v.total, v.totals[2]?.value], [true, '0,00 ₽', '—']);
  });
});
