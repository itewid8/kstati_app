/**
 * Видимые часы сетки (C-Week, C-Day): на час раньше самого раннего начала и на час позже самого позднего конца,
 * с учётом текущего времени, в пределах 0…24.
 *   h0   = max(0,  min(⌊начало⌋, ⌊сейчас⌋) − 1)
 *   hEnd = min(24, max(⌈конец⌉, ⌈сейчас⌉) + 1)
 * Нет ни дел, ни «сейчас» — EMPTY_RANGE. Нет дел, но есть «сейчас» — EMPTY_RANGE, расширенный до сейчас ± 1 ч.
 */
import type { DayMinute } from './types';

export interface HourRange {
  readonly h0: number;
  readonly hEnd: number;
}

export const EMPTY_RANGE: HourRange = { h0: 8, hEnd: 22 };

/**
 * events — дела в сетке (минуты от полуночи; для недели — все дни сразу).
 * now — минуты от полуночи, только если сегодняшний день виден.
 */
export function hourRange(events: readonly { readonly start: DayMinute; readonly end: DayMinute }[], now?: DayMinute): HourRange {
  const starts = events.map((e) => Math.floor(e.start / 60));
  const ends = events.map((e) => Math.ceil(Math.max(e.end, e.start) / 60));
  if (!events.length) {
    starts.push(EMPTY_RANGE.h0 + 1);
    ends.push(EMPTY_RANGE.hEnd - 1);
  }
  if (now !== undefined) {
    starts.push(Math.floor(now / 60));
    ends.push(Math.ceil(now / 60));
  }
  return {
    h0: Math.max(0, Math.min(...starts) - 1),
    hEnd: Math.min(24, Math.max(...ends) + 1),
  };
}
