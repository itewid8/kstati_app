/**
 * Полосы над сеткой: дела на весь день, многодневные, общие дела с подзадачами. Раскладка по строкам жадная
 * (как в C-Week): полосы по первому видимому дню, при равенстве длинные первыми, дальше — порядок входа;
 * каждая встаёт в первую строку, где она ни с кем не пересекается по дням.
 */
import { dayNo } from './days';
import type { DayBar, IsoDate } from './types';

export interface PlacedBar {
  readonly id: string;
  readonly row: number;
  /** Первый и последний видимый день: 0…days−1 от начала периода */
  readonly d0: number;
  readonly d1: number;
  /** Полоса продолжается левее / правее видимого периода */
  readonly cutStart: boolean;
  readonly cutEnd: boolean;
}

export interface BarRows {
  readonly rowCount: number;
  readonly bars: readonly PlacedBar[];
}

/** weekStart — первый видимый день; days — сколько дней видно (неделя — 7, день — 1) */
export function packAllDayBars(items: readonly DayBar[], weekStart: IsoDate, days = 7): BarRows {
  const s = dayNo(weekStart);
  const visible = items
    .map((b, idx) => {
      const a = dayNo(b.startDate) - s;
      const z = Math.max(a, dayNo(b.endDate) - s);
      return { id: b.id, idx, d0: Math.max(0, a), d1: Math.min(days - 1, z), cutStart: a < 0, cutEnd: z > days - 1 };
    })
    .filter((b) => b.d0 <= b.d1)
    .sort((x, y) => x.d0 - y.d0 || y.d1 - x.d1 || x.idx - y.idx);

  const rowEnds: number[] = [];
  const bars = visible.map(({ idx: _idx, ...b }): PlacedBar => {
    let row = rowEnds.findIndex((end) => end < b.d0);
    if (row < 0) row = rowEnds.push(-1) - 1;
    rowEnds[row] = b.d1;
    return { ...b, row };
  });
  return { rowCount: rowEnds.length, bars };
}
