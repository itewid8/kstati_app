/**
 * Период плана: начало сдвинули — конец едет на столько же (длительность сохраняется; C-TimeStory 06).
 * Подзадачи при этом не двигаются (docs/redesign/DECISIONS.md) — вышедшие за период подсвечивает экран.
 * Даты YYYY-MM-DD, время HH:MM или null (без времени). Считаем в минутах от 1970-01-01 UTC — без поясов.
 */
import { dayNo, isoOf } from '@/lib/recur';

export type PeriodPoint = { date: string; time: string | null };
export type Period = { start: PeriodPoint; end: PeriodPoint };

const DAY_MIN = 24 * 60;

const toMin = (p: PeriodPoint) => {
  const [h, m] = (p.time ?? '00:00').split(':').map(Number);
  return dayNo(p.date) * DAY_MIN + h * 60 + m;
};

const pad2 = (n: number) => String(n).padStart(2, '0');

const fromMin = (min: number, withTime: boolean): PeriodPoint => {
  const day = Math.floor(min / DAY_MIN);
  const rest = min - day * DAY_MIN;
  return { date: isoOf(day), time: withTime ? `${pad2(Math.floor(rest / 60))}:${pad2(rest % 60)}` : null };
};

/** Новое начало; конец сдвигается на ту же величину. Без времени у конца — сдвигается только дата. */
export function moveStart(period: Period, start: PeriodPoint): Period {
  const delta = toMin(start) - toMin(period.start);
  if (!delta) return { start, end: period.end };
  if (period.end.time === null) {
    const days = dayNo(start.date) - dayNo(period.start.date);
    return { start, end: { date: isoOf(dayNo(period.end.date) + days), time: null } };
  }
  return { start, end: fromMin(toMin(period.end) + delta, true) };
}

/** Новый конец; раньше начала не уходит (тогда конец = начало). */
export function moveEnd(period: Period, end: PeriodPoint): Period {
  return toMin(end) < toMin(period.start) ? { start: period.start, end: { ...period.start } } : { start: period.start, end };
}
