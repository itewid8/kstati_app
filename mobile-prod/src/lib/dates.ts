const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toHHMM(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() + n);
  return r;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** «сб 3 окт» */
export function shortDate(iso: string): string {
  const d = fromISODate(iso);
  return `${WD[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`;
}

/** «сб 3 окт · 19:00» */
export function taskWhen(date: string | null, time: string | null): string {
  if (!date) return time ?? '';
  return time ? `${shortDate(date)} · ${time}` : shortDate(date);
}

export type Section = 'past' | 'today' | 'tomorrow' | 'week' | 'later' | 'none';

export const SECTION_TITLE: Record<Section, string> = {
  past: 'Прошло',
  today: 'Сегодня',
  tomorrow: 'Завтра',
  week: 'На этой неделе',
  later: 'Позже',
  none: 'Без даты',
};

export const SECTION_ORDER: Section[] = ['past', 'today', 'none', 'tomorrow', 'week', 'later'];

export function sectionFor(date: string | null, time: string | null, now = new Date()): Section {
  if (!date) return 'none';
  const today = startOfDay(now);
  const d = fromISODate(date);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return 'past';
  if (diff === 0) {
    if (time && time < toHHMM(now)) return 'past';
    return 'today';
  }
  if (diff === 1) return 'tomorrow';
  // До конца текущей недели (неделя с понедельника)
  const dow = (today.getDay() + 6) % 7; // 0 = пн
  const daysToSunday = 6 - dow;
  if (diff <= daysToSunday) return 'week';
  return 'later';
}

/** Сортировочный ключ: дата+время, без времени — в начале дня */
export function sortKey(date: string | null, time: string | null): string {
  return `${date ?? '9999-99-99'} ${time ?? '00:00'}`;
}

const MONTH_FULL = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
export const WEEKDAYS_SHORT = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

/** Понедельник недели, в которую входит дата */
export function startOfWeek(d: Date): Date {
  const r = startOfDay(d);
  r.setDate(r.getDate() - ((r.getDay() + 6) % 7));
  return r;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

/** «Октябрь 2026» */
export function monthTitle(d: Date): string {
  return `${MONTH_FULL[d.getMonth()]} ${d.getFullYear()}`;
}

/** «28 сен – 4 окт» */
export function weekTitle(start: Date): string {
  const end = addDays(start, 6);
  const a = `${start.getDate()} ${MON[start.getMonth()]}`;
  const b = `${end.getDate()} ${MON[end.getMonth()]}`;
  return `${a} – ${b}`;
}

/** Сетка месяца: 6 недель по 7 дней, начиная с понедельника */
export function monthGrid(month: Date): Date[] {
  const first = startOfWeek(startOfMonth(month));
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

export function weekDayShort(d: Date): string {
  return WD[d.getDay()];
}
