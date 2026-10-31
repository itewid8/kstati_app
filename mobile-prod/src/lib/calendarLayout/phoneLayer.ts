/**
 * Слой календаря телефона в колонке дня (неделя, день). События телефона вторичны: свободное время — целым блоком
 * (несколько событий телефона подряд друг на друге — делят ширину поровну), а там, где уже стоит дело «Кстати», —
 * узкой полосой у правого края колонки: видно, что время занято, а дело остаётся во всю ширину.
 */
import { MIN_DURATION, type DayMinute } from './types';

export type PhoneSpan = { readonly id: string; readonly start: DayMinute; readonly end: DayMinute };

export type PhoneBlock = {
  readonly id: string;
  /** Относительно колонки */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** Узкая полоса: рядом стоит дело */
  readonly strip: boolean;
};

export type PhoneLayerOptions = { readonly colWidth: number; readonly hourPx: number; readonly h0: number; readonly hEnd: number };

export const PHONE = {
  /** Ширина полосы и зазор между полосами */
  STRIP: 6,
  STRIP_GAP: 1,
  /** Отступ от краёв колонки */
  INSET: 1,
} as const;

const endOf = (s: { start: DayMinute; end: DayMinute }) => (s.end > s.start ? s.end : s.start + MIN_DURATION);
const overlaps = (a: { start: DayMinute; end: DayMinute }, b: { start: DayMinute; end: DayMinute }) => a.start < endOf(b) && b.start < endOf(a);

/** Жадные дорожки: номер первой свободной для каждого (по порядку начала) */
function lanes<T extends { start: DayMinute; end: DayMinute }>(list: readonly T[]): number[] {
  const ends: number[] = [];
  return list.map((s) => {
    let i = ends.findIndex((e) => e <= s.start);
    if (i < 0) i = ends.length;
    ends[i] = endOf(s);
    return i;
  });
}

export function layoutPhoneColumn(phone: readonly PhoneSpan[], taken: readonly { start: DayMinute; end: DayMinute }[], o: PhoneLayerOptions): PhoneBlock[] {
  const v0 = o.h0 * 60;
  const v1 = o.hEnd * 60;
  const y = (m: DayMinute) => ((Math.min(Math.max(m, v0), v1) - v0) * o.hourPx) / 60;
  const sorted = [...phone].filter((p) => endOf(p) > v0 && p.start < v1).sort((a, b) => a.start - b.start || endOf(b) - endOf(a));
  const busy = sorted.map((p) => taken.some((t) => overlaps(p, t)));
  const strips = sorted.filter((_, i) => busy[i]);
  const free = sorted.filter((_, i) => !busy[i]);
  const stripLane = lanes(strips);
  const freeLane = lanes(free);
  // Сколько дорожек в группе пересекающихся свободных событий — ширина делится на них
  const width = free.map((p) => {
    let n = 1;
    free.forEach((q, j) => {
      if (overlaps(p, q)) n = Math.max(n, freeLane[j]! + 1);
    });
    return n;
  });
  const out: PhoneBlock[] = [];
  const full = o.colWidth - 2 * PHONE.INSET;
  free.forEach((p, i) => {
    const n = width[i]!;
    const w = full / n;
    const y0 = y(p.start);
    out.push({ id: p.id, x: PHONE.INSET + freeLane[i]! * w, y: y0, w: w - (n > 1 ? PHONE.STRIP_GAP : 0), h: Math.max(2, y(endOf(p)) - y0 - 1), strip: false });
  });
  strips.forEach((p, i) => {
    const y0 = y(p.start);
    const x = o.colWidth - PHONE.INSET - PHONE.STRIP - stripLane[i]! * (PHONE.STRIP + PHONE.STRIP_GAP);
    out.push({ id: p.id, x: Math.max(0, x), y: y0, w: PHONE.STRIP, h: Math.max(2, y(endOf(p)) - y0 - 1), strip: true });
  });
  return out;
}
