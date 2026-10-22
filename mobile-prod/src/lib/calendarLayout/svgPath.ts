/**
 * Контур блока в SVG-путь: ступенчатые профили → точки → путь со скруглёнными внутренними углами.
 */

export type Point = readonly [number, number];

/** Горизонтальная полоса блока (локальные координаты): на высоте y0…y1 блок занимает left…right */
export interface Band {
  readonly y0: number;
  readonly y1: number;
  readonly left: number;
  readonly right: number;
}

const collinear = (a: Point, b: Point, c: Point) =>
  Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) <= 0.01;
const same = (a: Point, b: Point) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;

/** Убирает повторы и точки посередине прямых отрезков (концы ломаной сохраняются) */
export function simplify(pts: readonly Point[]): Point[] {
  const out: Point[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (last && same(last, p)) continue;
    const prev = out[out.length - 2];
    if (prev && last && collinear(prev, last, p)) out.pop();
    out.push(p);
  }
  return out;
}

/** Край блока сверху вниз: скачок между полосами — горизонтальная ступенька */
export function contour(bands: readonly Band[], side: 'left' | 'right'): Point[] {
  return simplify(bands.flatMap((b): Point[] => [[b[side], b.y0], [b[side], b.y1]]));
}

const r1 = (n: number) => {
  const v = Math.round(n * 10) / 10;
  return String(Object.is(v, -0) ? 0 : v);
};
const xy = (p: Point) => `${r1(p[0])} ${r1(p[1])}`;

/**
 * Ломаная в путь. Внутренние углы (не на верхнем y=0 и нижнем y=h крае блока) скругляются радиусом radius,
 * но не больше половины прилегающих отрезков. closed — замкнуть (контур блока), иначе открытая линия (край).
 */
export function roundedPath(pts: readonly Point[], closed: boolean, h: number, radius: number): string {
  const n = pts.length;
  const parts = pts.map((P, j) => {
    const cmd = j ? ' L ' : 'M ';
    const end = !closed && (j === 0 || j === n - 1);
    if (end || P[1] < 0.01 || P[1] > h - 0.01) return cmd + xy(P);
    const A = pts[(j - 1 + n) % n];
    const B = pts[(j + 1) % n];
    const la = Math.hypot(A[0] - P[0], A[1] - P[1]);
    const lb = Math.hypot(B[0] - P[0], B[1] - P[1]);
    if (la < 1e-6 || lb < 1e-6) return cmd + xy(P);
    const rr = Math.min(radius, la / 2, lb / 2);
    const p1: Point = [P[0] + ((A[0] - P[0]) / la) * rr, P[1] + ((A[1] - P[1]) / la) * rr];
    const p2: Point = [P[0] + ((B[0] - P[0]) / lb) * rr, P[1] + ((B[1] - P[1]) / lb) * rr];
    return `${cmd}${xy(p1)} Q ${xy(P)} ${xy(p2)}`;
  });
  return parts.join('') + (closed ? ' Z' : '');
}
