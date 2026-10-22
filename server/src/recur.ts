/**
 * Даты повторяющегося дела — перенос occurrences() из mobile/src/lib/recur.ts (правите там — поправьте и здесь).
 * Нужно серверу, чтобы в голосовой правке назвать конкретный раз серии (S3: «удали йогу в субботу»).
 */
import type { Repeat } from './repeat.js';

const DAY = 86400000;
const pad = (n: number) => String(n).padStart(2, '0');

export const dayNo = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY);
};
export const isoOf = (n: number) => {
  const d = new Date(n * DAY);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
const parts = (iso: string) => iso.split('-').map(Number) as [number, number, number];
/** 1 = пн … 7 = вс */
export const weekdayOf = (iso: string) => ((new Date(dayNo(iso) * DAY).getUTCDay() + 6) % 7) + 1;
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const dayFits = (days: number[], y: number, m: number, d: number) => days.some((x) => x === d || (x === -1 && d === daysInMonth(y, m)));

/** Подходит ли день под правило (без учёта конца серии и счётчика) */
function fits(r: Repeat, start: string, iso: string): boolean {
  const n = dayNo(iso);
  const s = dayNo(start);
  if (n < s) return false;
  const every = Math.max(1, r.every || 1);
  const [y, m, d] = parts(iso);
  const [sy, sm, sd] = parts(start);
  switch (r.freq) {
    case 'day':
      return (n - s) % every === 0;
    case 'week': {
      const days = r.weekdays?.length ? r.weekdays : [weekdayOf(start)];
      const monday = s - (weekdayOf(start) - 1);
      return Math.floor((n - monday) / 7) % every === 0 && days.includes(weekdayOf(iso));
    }
    case 'month':
      return ((y - sy) * 12 + (m - sm)) % every === 0 && dayFits(r.monthDays?.length ? r.monthDays : [sd], y, m, d);
    case 'year':
      return (y - sy) % every === 0 && (r.months?.length ? r.months : [sm]).includes(m) && dayFits(r.monthDays?.length ? r.monthDays : [sd], y, m, d);
  }
}

type Series = { date: string | null; repeat?: Repeat | null; skipDates?: string[] };

/**
 * Предел перебора — 50 лет от первого проверяемого дня. Без него серия со счётчиком и давней датой
 * (date «0100-01-01», count, редкий повтор) или далёкий to перебирают миллионы дней и на секунды занимают
 * процесс сервера целиком (docs/security/REVIEW-v2.md, V2-1)
 */
const MAX_SPAN_DAYS = 366 * 50;

/** Все даты серии в промежутке [from, to] (включительно), кроме удалённых по одному */
export function occurrences(task: Series, from: string, to: string, limit = 2000): string[] {
  if (!task.date) return [];
  const r = task.repeat;
  if (!r) return task.date >= from && task.date <= to ? [task.date] : [];
  const out: string[] = [];
  const skip = new Set(task.skipDates ?? []);
  const start = dayNo(task.date);
  let end = dayNo(to);
  if (r.until) end = Math.min(end, dayNo(r.until));
  // Со счётчиком повторов считаем с самого начала серии, иначе — с начала промежутка
  let n = r.count ? start : Math.max(start, dayNo(from));
  end = Math.min(end, n + MAX_SPAN_DAYS);
  let seen = 0;
  const fromNo = dayNo(from);
  for (; n <= end && out.length < limit; n++) {
    const iso = isoOf(n);
    // Дата дела — всегда первый раз серии, даже если не подходит под правило
    if (n !== start && !fits(r, task.date, iso)) continue;
    seen++;
    if (r.count && seen > r.count) break;
    if (n >= fromNo && !skip.has(iso)) out.push(iso);
  }
  return out;
}

const WD_SHORT = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

/** Короткая подпись повтора для промпта: «каждую сб», «раз в 2 нед. ср», «каждый день», «каждое 20 число», «каждый год» */
export function repeatShort(r: Repeat): string {
  const n = Math.max(1, r.every || 1);
  switch (r.freq) {
    case 'day':
      return n === 1 ? 'каждый день' : `раз в ${n} дн.`;
    case 'week': {
      const days = (r.weekdays ?? []).map((d) => WD_SHORT[d - 1]).join(',');
      return n === 1 ? (days ? `каждую ${days}` : 'каждую неделю') : `раз в ${n} нед.${days ? ` ${days}` : ''}`;
    }
    case 'month': {
      const days = (r.monthDays ?? []).map((d) => (d === -1 ? 'последнее' : String(d))).join(',');
      if (!days) return n === 1 ? 'каждый месяц' : `раз в ${n} мес.`;
      return `${n === 1 ? 'каждое' : `раз в ${n} мес.`} ${days} число`;
    }
    case 'year':
      return n === 1 ? 'каждый год' : `раз в ${n} г.`;
  }
}
