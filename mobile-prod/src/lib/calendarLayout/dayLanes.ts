/**
 * Раскладка дел со временем в дне (C-Day): пересекающиеся дела стоят рядом в равных дорожках.
 * Порт renderVals() из design/mockups/C-Day.dc.html, где дорожки заданы руками ([lane, lanes]).
 *
 *  - Блок занимает [начало, конец] по времени, но не ниже minHeight (короткое дело всё равно читается);
 *    пересечение считается по видимой высоте, поэтому «раздутые» короткие дела тоже не налезают друг на друга.
 *  - Связные группы пересекающихся дел (кластеры) делят ширину на столько дорожек, сколько нужно группе;
 *    дело встаёт в первую свободную дорожку. Порядок: по началу, при равном начале — порядок входа
 *    (сортирует вызывающий: так в макете «Созвон» 13:00–13:30 стоит левее «Посылки» 13:00–14:00).
 *  - Отступ блока от краёв дорожки и от линий времени — COLUMN.INSET, как в неделе.
 */
import { COLUMN, minuteToY } from './dayColumn';
import { MIN_DURATION, type ColumnEvent } from './types';

export interface LaneOptions {
  /** Ширина сетки дня, px */
  readonly width: number;
  /** Высота часа, px */
  readonly hourPx: number;
  /** Видимые часы: h0…hEnd (см. hourRange) */
  readonly h0: number;
  readonly hEnd: number;
  /** Наименьшая высота блока, px (в макете 34) */
  readonly minHeight?: number;
}

export interface LaneBlock {
  readonly id: string;
  /** Дорожка 0…lanes−1 и сколько дорожек в группе */
  readonly lane: number;
  readonly lanes: number;
  /** Прямоугольник блока относительно сетки дня */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const EPS = 1e-6;

export function layoutDayLanes(events: readonly ColumnEvent[], opts: LaneOptions): LaneBlock[] {
  const { INSET } = COLUMN;
  const minH = opts.minHeight ?? 0;
  const v0 = opts.h0 * 60;
  const v1 = opts.hEnd * 60;
  const Y = (m: number) => minuteToY(m, opts);

  const items = events
    .map((ev, idx) => {
      const end = ev.end > ev.start ? ev.end : ev.start + MIN_DURATION;
      const vs = Math.max(ev.start, v0);
      const ve = Math.min(end, v1);
      const y0 = Y(vs);
      const h = Math.max(Y(ve) - y0 - 2 * INSET, minH);
      /** Нижний край с учётом minHeight — по нему ищем пересечения */
      const bottom = Math.max(Y(ve), y0 + h + 2 * INSET);
      return { id: ev.id, idx, vs, ve, y0, h, bottom, lane: 0, cluster: 0 };
    })
    .filter((it) => it.ve > it.vs)
    .sort((a, b) => a.y0 - b.y0 || a.idx - b.idx);

  // Кластеры: идём по началу, группа продолжается, пока следующее дело начинается выше нижнего края группы
  const lanesOf: number[] = [];
  let laneEnds: number[] = [];
  let clusterBottom = -Infinity;
  for (const it of items) {
    if (it.y0 >= clusterBottom - EPS) {
      laneEnds = [];
      lanesOf.push(0);
    }
    const cluster = lanesOf.length - 1;
    let lane = laneEnds.findIndex((end) => end <= it.y0 + EPS);
    if (lane < 0) lane = laneEnds.push(0) - 1;
    laneEnds[lane] = it.bottom;
    it.lane = lane;
    it.cluster = cluster;
    lanesOf[cluster] = Math.max(lanesOf[cluster], laneEnds.length);
    clusterBottom = Math.max(clusterBottom, it.bottom);
  }

  return items
    .sort((a, b) => a.idx - b.idx)
    .map((it): LaneBlock => {
      const lanes = lanesOf[it.cluster];
      const laneW = opts.width / lanes;
      return { id: it.id, lane: it.lane, lanes, x: it.lane * laneW + INSET, y: it.y0 + INSET, w: laneW - 2 * INSET, h: it.h };
    });
}
