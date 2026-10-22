/**
 * Раскладка дел со временем в колонке дня (неделя, день). Порт renderVals() из design/mockups/C-Week.dc.html,
 * но профили считаются точно (ступенчатые функции), а не выборкой по пикселям.
 *
 * Правило пересечений. Из двух пересекающихся дел «основа» (host) — то, что началось раньше; при одновременном
 * начале — более длинное; при полном совпадении — стоящее раньше во входном списке. Второе — «гость».
 *  - Основа сужается до своей полосы (STRIP) прямой ступенькой за GAP до начала гостя (верх гостя прямой)
 *    и расширяется обратно через GAP после его конца.
 *  - Гость занимает всё справа от основы с зазором GAP по горизонтали и вертикали: его левый край —
 *    правый край основы, раздутый на GAP по вертикали, плюс GAP. Если основа кончается во время гостя,
 *    гость ступенькой (через GAP после её конца) возвращает себе всю ширину.
 *  - Цепочки: каждое следующее дело огибает полосы всех предыдущих (левый край — максимум по всем основам).
 *  - Сужения ближе MIN_SEGMENT друг к другу или к краю блока сливаются: без щелей и «козырьков» в пару пикселей.
 */
import { contour, roundedPath, type Band } from './svgPath';
import { MIN_DURATION, type ColumnEvent, type DayMinute } from './types';

export type { Band } from './svgPath';

export const COLUMN = {
  /** Отступ блока от краёв колонки и от линий своего времени, px (между делами подряд — 2·INSET) */
  INSET: 1,
  /** Ширина полосы, до которой сужается основа (WN в макете) */
  STRIP: 2,
  /** Зазор между основой и гостем по горизонтали и вертикали (G) */
  GAP: 2,
  /** Радиус скругления ступенек (RAD) */
  RADIUS: 4,
  /** Отступ текста от верха полосы и от её левого края (pt, pl в макете) */
  TEXT_TOP: 3,
  TEXT_LEFT: 6,
  /** Полоса ниже этого не годится под текст, если ниже есть полоса просторнее */
  TEXT_MIN_H: 12,
  /** Сужения и расширения короче этого не делаем (2·RADIUS) */
  MIN_SEGMENT: 8,
} as const;

export interface ColumnOptions {
  /** Ширина колонки дня, px */
  readonly colWidth: number;
  /** Высота часа, px */
  readonly hourPx: number;
  /** Видимые часы: h0…hEnd (см. hourRange) */
  readonly h0: number;
  readonly hEnd: number;
}

export interface ColumnBlock {
  readonly id: string;
  /** Прямоугольник блока относительно колонки; path, edgePath, bands, text* — относительно блока */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** Форма блока сверху вниз */
  readonly bands: readonly Band[];
  /** Замкнутый контур (заливка, clip) со скруглёнными ступеньками */
  readonly path: string;
  /** Левый край сверху вниз (открытая линия) — для цветной полосы, повторяет ступеньки */
  readonly edgePath: string;
  readonly textInsetTop: number;
  readonly textInsetLeft: number;
  /** Ширина под текст от textInsetLeft до правого края выбранной полосы */
  readonly textWidth: number;
}

/** y в колонке для минуты дня (линия «сейчас», подписи часов) */
export const minuteToY = (m: DayMinute, o: Pick<ColumnOptions, 'hourPx' | 'h0'>) => ((m - o.h0 * 60) * o.hourPx) / 60;

const EPS = 1e-6;
/** Убирает шум плавающей точки в результатах: 0.001 px */
const snap = (v: number) => Math.round(v * 1000) / 1000;

/** Ступенчатая функция по y: значение v на [y0, y1) */
interface Seg {
  y0: number;
  y1: number;
  v: number;
}

interface Item {
  readonly id: string;
  readonly idx: number;
  /** Настоящие начало и конец — для выбора основы */
  readonly start: number;
  readonly end: number;
  /** Видимая часть в минутах и в px колонки */
  readonly vs: number;
  readonly ve: number;
  readonly Y0: number;
  readonly Y1: number;
}

/** Точки разбиения d0…d1: концы и все внутренние cuts без повторов */
function breakpoints(d0: number, d1: number, cuts: readonly number[]): number[] {
  const pts = [d0];
  for (const c of [...cuts].sort((a, b) => a - b)) {
    if (c > pts[pts.length - 1] + EPS && c < d1 - EPS) pts.push(c);
  }
  pts.push(d1);
  return pts;
}

/** Строит ступенчатую функцию на d0…d1, вычисляя f в середине каждого куска; соседние равные куски сливаются */
function sample(d0: number, d1: number, cuts: readonly number[], f: (y: number) => number): Seg[] {
  const pts = breakpoints(d0, d1, cuts);
  const out: Seg[] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const v = f((pts[i] + pts[i + 1]) / 2);
    const last = out[out.length - 1];
    if (last && Math.abs(last.v - v) < EPS) last.y1 = pts[i + 1];
    else out.push({ y0: pts[i], y1: pts[i + 1], v });
  }
  return out;
}

const valueAt = (segs: readonly Seg[], y: number) => (segs.find((s) => y >= s.y0 && y < s.y1) ?? segs[segs.length - 1]).v;

/** Основа идёт раньше гостя: раньше началась → длиннее → раньше во входном списке */
const hostFirst = (a: Item, b: Item) => a.start - b.start || b.end - b.start - (a.end - a.start) || a.idx - b.idx;

const overlap = (a: Item, b: Item) => a.vs < b.ve && b.vs < a.ve;

/** Где основа узкая: объединение [гость − GAP, гость + GAP], короткие промежутки и хвосты у краёв сливаются */
function narrowSpans(e: Item, guests: readonly Item[]): [number, number][] {
  const { GAP, MIN_SEGMENT } = COLUMN;
  const spans = guests.map((g): [number, number] => [g.Y0 - GAP, g.Y1 + GAP]).sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s[0] - last[1] < MIN_SEGMENT) last[1] = Math.max(last[1], s[1]);
    else merged.push([s[0], s[1]]);
  }
  return merged
    .map(([a, b]): [number, number] => [a - e.Y0 < MIN_SEGMENT ? e.Y0 : a, e.Y1 - b < MIN_SEGMENT ? e.Y1 : b])
    .filter(([a, b]) => b > a + EPS);
}

/** Полосы блока в локальных координатах (y от верха блока) */
function bandsOf(left: readonly Seg[], right: readonly Seg[], top: number, h: number): Band[] {
  const cuts = [...left, ...right].flatMap((s) => [s.y0 - top, s.y1 - top]);
  const pts = breakpoints(0, h, cuts);
  const out: Band[] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const mid = (pts[i] + pts[i + 1]) / 2 + top;
    const l = valueAt(left, mid);
    const r = valueAt(right, mid);
    const last = out[out.length - 1];
    if (last && Math.abs(last.left - l) < EPS && Math.abs(last.right - r) < EPS) out[out.length - 1] = { ...last, y1: pts[i + 1] };
    else out.push({ y0: pts[i], y1: pts[i + 1], left: l, right: r });
  }
  return out.map((b) => ({ y0: snap(b.y0), y1: snap(b.y1), left: snap(b.left), right: snap(b.right) }));
}

/**
 * Куда ставить текст: первая полоса шире STRIP (не узкая основа), высотой не меньше TEXT_MIN_H;
 * нет такой — первая полоса шире STRIP; нет и её — самая верхняя.
 */
function textBand(bands: readonly Band[]): Band {
  const wide = bands.filter((b) => b.right - b.left > COLUMN.STRIP + EPS);
  return wide.find((b) => b.y1 - b.y0 >= COLUMN.TEXT_MIN_H) ?? wide[0] ?? bands[0];
}

export function layoutDayColumn(events: readonly ColumnEvent[], opts: ColumnOptions): ColumnBlock[] {
  const { INSET, STRIP, GAP, RADIUS, TEXT_TOP, TEXT_LEFT } = COLUMN;
  const wr = opts.colWidth - 2 * INSET;
  const v0 = opts.h0 * 60;
  const v1 = opts.hEnd * 60;
  const Y = (m: number) => minuteToY(m, opts);

  const items: Item[] = events
    .map((ev, idx) => {
      const end = ev.end > ev.start ? ev.end : ev.start + MIN_DURATION;
      const vs = Math.max(ev.start, v0);
      const ve = Math.min(end, v1);
      return { id: ev.id, idx, start: ev.start, end, vs, ve, Y0: Y(vs), Y1: Y(ve) };
    })
    .filter((it) => it.ve > it.vs)
    .sort(hostFirst);

  /** Правые края уже разложенных дел (основы раскладываются раньше гостей) */
  const rights = new Map<Item, Seg[]>();
  const blocks = items.map((e, i) => {
    const hosts = items.slice(0, i).filter((o) => overlap(o, e));
    const guests = items.slice(i + 1).filter((o) => overlap(o, e));

    // Левый край: правый край каждой основы, раздутый на GAP по вертикали, плюс GAP
    const contribs = hosts.flatMap((h) => (rights.get(h) ?? []).map((s) => ({ a: s.y0 - GAP, b: s.y1 + GAP, v: s.v + GAP })));
    const left = sample(
      e.Y0,
      e.Y1,
      contribs.flatMap((c) => [c.a, c.b]),
      (y) => Math.min(wr - STRIP, contribs.reduce((m, c) => (c.a < y && y < c.b ? Math.max(m, c.v) : m), 0)),
    );

    // Правый край: где есть гость — полоса STRIP от левого края, иначе вся ширина
    const narrow = narrowSpans(e, guests);
    const right = sample(
      e.Y0,
      e.Y1,
      [...left.flatMap((s) => [s.y0, s.y1]), ...narrow.flat()],
      (y) => (narrow.some(([a, b]) => a < y && y < b) ? valueAt(left, y) + STRIP : wr),
    );
    rights.set(e, right);

    const top = e.Y0 + INSET;
    const h = Math.max(1, e.Y1 - e.Y0 - 2 * INSET);
    const bands = bandsOf(left, right, top, h);
    const L = contour(bands, 'left');
    const R = contour(bands, 'right');
    const tb = textBand(bands);
    const block: ColumnBlock = {
      id: e.id,
      x: INSET,
      y: top,
      w: wr,
      h,
      bands,
      path: roundedPath([...L, ...R.reverse()], true, h, RADIUS),
      edgePath: roundedPath(L, false, h, RADIUS),
      textInsetTop: tb.y0 + TEXT_TOP,
      textInsetLeft: tb.left + TEXT_LEFT,
      textWidth: Math.max(0, tb.right - tb.left - TEXT_LEFT),
    };
    return { idx: e.idx, block };
  });

  // Порядок результата — порядок входа
  return blocks.sort((a, b) => a.idx - b.idx).map((b) => b.block);
}
