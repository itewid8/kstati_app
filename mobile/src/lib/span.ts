/**
 * Длительность дела: конец, дни, которые дело занимает, подписи «18:00–20:00» и «7–9 окт»,
 * блоки в сетке недели и пересечения занятости.
 * Конец — endTime (тот же день) и endDate (многодневное). Нет конца — в сетке блок на 30 минут.
 */
import { shortDate } from './dates';
import { dayNo, isoOf } from './recur';
import type { ID, Task } from './types';

/** Дело без конца занимает в сетке и в занятости 30 минут (как в Outlook) */
export const DEFAULT_MIN = 30;

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const pad = (n: number) => String(n).padStart(2, '0');
export const fromMin = (m: number) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;

/** Кто занят делом: отмеченные участники, иначе автор */
export const peopleOf = (t: Pick<Task, 'people' | 'createdBy'>): ID[] => (t.people?.length ? t.people : [t.createdBy]);

export const isMulti = (t: Pick<Task, 'date' | 'endDate'>) => !!t.endDate && !!t.date && t.endDate > t.date;

/** Начало и конец дела в минутах от 1970 года; без времени — весь день, без конца — 30 минут */
function bounds(t: Pick<Task, 'date' | 'time' | 'endDate' | 'endTime'>): [number, number] | null {
  if (!t.date) return null;
  const d0 = dayNo(t.date) * 1440;
  const s = d0 + (t.time ? toMin(t.time) : 0);
  if (isMulti(t)) return [s, dayNo(t.endDate!) * 1440 + (t.endTime ? toMin(t.endTime) : 1440)];
  if (t.time) return [s, t.endTime && toMin(t.endTime) > toMin(t.time) ? d0 + toMin(t.endTime) : s + DEFAULT_MIN];
  return [d0, d0 + 1440];
}

/** Длительность в минутах (без времени — сутки на каждый день, без конца — 30 минут) */
export const durationMin = (t: Pick<Task, 'date' | 'time' | 'endDate' | 'endTime'>) => {
  const b = bounds(t);
  return b ? b[1] - b[0] : 0;
};

/** Дело длиннее суток: в сетке недели — полосой сверху, а не в днях */
export const isLong = (t: Pick<Task, 'date' | 'time' | 'endDate' | 'endTime'>) => durationMin(t) > 1440;

/**
 * Последний день дела. Многодневное, которое кончается ровно в 00:00 («в 20:00 на 4 часа»),
 * следующий день не занимает.
 */
export const lastDay = (t: Pick<Task, 'date' | 'time' | 'endDate' | 'endTime'>) =>
  isMulti(t) ? isoOf(Math.floor((bounds(t)![1] - 1) / 1440)) : t.date;

/** Все дни, которые занимает дело */
export function daysOf(t: Pick<Task, 'date' | 'time' | 'endDate' | 'endTime'>): string[] {
  if (!t.date) return [];
  const a = dayNo(t.date);
  const b = Math.max(a, dayNo(lastDay(t)!));
  return Array.from({ length: Math.min(b - a, 60) + 1 }, (_, i) => isoOf(a + i));
}

/**
 * Промежуток дела в минутах внутри дня day: [начало, конец].
 * null — дело на весь день (без времени) или не в этот день.
 */
export function minutesOn(t: Pick<Task, 'date' | 'time' | 'endDate' | 'endTime'>, day: string): [number, number] | null {
  if (!t.date || day < t.date || day > lastDay(t)!) return null;
  if (!isMulti(t)) {
    if (!t.time) return null;
    const s = toMin(t.time);
    const e = t.endTime && toMin(t.endTime) > s ? toMin(t.endTime) : s + DEFAULT_MIN;
    return [s, Math.min(e, 24 * 60)];
  }
  // Многодневное без времени — полоса на весь день
  if (!t.time && !t.endTime) return null;
  const [a, b] = bounds(t)!;
  const d0 = dayNo(day) * 1440;
  const s = Math.max(a, d0) - d0;
  const e = Math.min(b, d0 + 1440) - d0;
  return e > s ? [s, e] : null;
}

/** Время дела в дне календаря: «18:00–20:00», «с 10:00», «до 18:00», «весь день», «18:00» */
export function timeOn(t: Task, day: string): string {
  if (!isMulti(t)) {
    if (!t.time) return '';
    return t.endTime && t.endTime > t.time ? `${t.time}–${t.endTime}` : t.time;
  }
  const m = minutesOn(t, day);
  if (!m) return 'весь день';
  if (m[0] > 0 && m[1] < 1440) return `${fromMin(m[0])}–${fromMin(m[1])}`;
  if (m[0] > 0) return `с ${fromMin(m[0])}`;
  if (m[1] < 1440) return `до ${fromMin(m[1])}`;
  return 'весь день';
}

const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const dm = (iso: string) => {
  const [, m, d] = iso.split('-').map(Number);
  return { d, m: MON[m - 1] };
};

/** Полная подпись: «сб 3 окт · 18:00–20:00», «7–9 окт», «30 сен 10:00 – 2 окт 18:00» */
export function spanLabel(t: Pick<Task, 'date' | 'time' | 'endDate' | 'endTime'>): string {
  if (!t.date) return t.time ? (t.endTime ? `${t.time}–${t.endTime}` : t.time) : '';
  const multi = !!t.endDate && t.endDate > t.date;
  if (!multi) {
    const time = t.time ? (t.endTime && t.endTime > t.time ? `${t.time}–${t.endTime}` : t.time) : '';
    return time ? `${shortDate(t.date)} · ${time}` : shortDate(t.date);
  }
  const a = dm(t.date);
  const b = dm(t.endDate!);
  if (!t.time && !t.endTime) return a.m === b.m ? `${a.d}–${b.d} ${b.m}` : `${a.d} ${a.m} – ${b.d} ${b.m}`;
  return `${a.d} ${a.m}${t.time ? ` ${t.time}` : ''} – ${b.d} ${b.m}${t.endTime ? ` ${t.endTime}` : ''}`;
}

/** Та же подпись двумя строками для узких блоков сетки: «ср 7 окт» + «18:00–20:00», «7 окт 06:00» + «– 10 окт 12:00» */
export function spanParts(t: Pick<Task, 'date' | 'time' | 'endDate' | 'endTime'>): string[] {
  if (!isMulti(t)) return spanLabel(t).split(' · ').filter(Boolean);
  const a = dm(t.date!);
  const b = dm(t.endDate!);
  return [`${a.d} ${a.m}${t.time ? ` ${t.time}` : ''}`, `– ${b.d} ${b.m}${t.endTime ? ` ${t.endTime}` : ''}`];
}

/** Пересекаются ли дела по времени. Дела без времени на весь день не считаем занятостью */
export function overlaps(a: Pick<Task, 'date' | 'time' | 'endDate' | 'endTime'>, b: Pick<Task, 'date' | 'time' | 'endDate' | 'endTime'>): boolean {
  const timed = (x: typeof a) => !!x.time || (!!x.endDate && !!x.date && x.endDate > x.date);
  if (!timed(a) || !timed(b)) return false;
  const x = bounds(a);
  const y = bounds(b);
  return !!x && !!y && x[0] < y[1] && y[0] < x[1];
}

/** Сдвиг даты на n дней (для переноса плана вместе с подзадачами) */
export const shiftIso = (iso: string | null | undefined, n: number) => (iso ? isoOf(dayNo(iso) + n) : (iso ?? null));
export const daysBetween = (a: string, b: string) => dayNo(b) - dayNo(a);
