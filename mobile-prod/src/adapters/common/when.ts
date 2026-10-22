/** Подписи дат и времени дел заглавными: «ПН 05», «СБ 10 ОКТ · 19:00», «7—9», «СР 7 ОКТ 07:00 → ПТ 9 ОКТ 15:00» */
import type { IsoDate } from '@/lib/calendarLayout';
import { isMulti } from '@/lib/span';
import type { Task } from '@/lib/types';
import { MONTHS_SHORT, WEEKDAYS, pad2, parts, weekday } from '@/screens/calendar/format';

const wd = (iso: IsoDate) => WEEKDAYS[weekday(iso)] ?? '';
const mon = (m: number) => MONTHS_SHORT[m - 1] ?? '';

/** Момент времени (ISO с часовым поясом) → местная дата «YYYY-MM-DD» */
export function dateOfStamp(stamp: string): IsoDate {
  const d = new Date(stamp);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Момент времени → местное «ЧЧ:ММ» */
export function timeOfStamp(stamp: string): string {
  const d = new Date(stamp);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** «ПН 05» */
export const dayShort = (iso: IsoDate) => `${wd(iso)} ${pad2(parts(iso).d)}`;

/** «СБ 10 ОКТ», «СР 7 ОКТ» */
export function dayMonth(iso: IsoDate): string {
  const { m, d } = parts(iso);
  return `${wd(iso)} ${d} ${mon(m)}`;
}

/** «28 СЕН», «5 ОКТ» */
export function dayMonthShort(iso: IsoDate): string {
  const { m, d } = parts(iso);
  return `${d} ${mon(m)}`;
}

/** «СБ 10 ОКТ · 19:00», «СБ 10 ОКТ», без даты — «БЕЗ ДАТЫ» */
export function whenLabel(date: IsoDate | null, time: string | null): string {
  if (!date) return 'БЕЗ ДАТЫ';
  return time ? `${dayMonth(date)} · ${time}` : dayMonth(date);
}

export type RangeOptions = {
  /** Числа двумя цифрами: «07—11» (список дел), а не «7—9» (план) */
  pad?: boolean;
  /** Месяц в конце: «05—11 ОКТ» (ответ ассистента) */
  month?: boolean;
};

/**
 * Дни периода через длинное тире: «7—9», «07—11», «05—11 ОКТ»; один день — «7».
 * Разные месяцы — месяц у каждого края: «28 СЕН—4 ОКТ»
 */
export function rangeDays(a: IsoDate, b: IsoDate, opts: RangeOptions = {}): string {
  const x = parts(a);
  const y = parts(b);
  const n = (d: number) => (opts.pad ? pad2(d) : String(d));
  if (x.y !== y.y || x.m !== y.m) return `${n(x.d)} ${mon(x.m)}—${n(y.d)} ${mon(y.m)}`;
  const days = a === b ? n(x.d) : `${n(x.d)}—${n(y.d)}`;
  return opts.month ? `${days} ${mon(y.m)}` : days;
}

/** «10:00–11:30» или «10:00»; без времени — '' */
export function timeSpan(time: string | null | undefined, endTime: string | null | undefined): string {
  if (!time) return '';
  return endTime && endTime > time ? `${time}–${endTime}` : time;
}

/**
 * Период дела: многодневное — «СР 7 ОКТ 07:00 → ПТ 9 ОКТ 15:00» (без времени — «СР 7 ОКТ → ПТ 9 ОКТ»);
 * в один день — «СБ 10 ОКТ · 10:00–11:30»; без даты — «БЕЗ ДАТЫ»
 */
export function periodLabel(t: Pick<Task, 'date' | 'time' | 'endDate' | 'endTime'>): string {
  if (!t.date) return 'БЕЗ ДАТЫ';
  if (!isMulti(t) || !t.endDate) {
    const time = timeSpan(t.time, t.endTime);
    return time ? `${dayMonth(t.date)} · ${time}` : dayMonth(t.date);
  }
  const edge = (date: IsoDate, time: string | null | undefined) => (time ? `${dayMonth(date)} ${time}` : dayMonth(date));
  return `${edge(t.date, t.time)} → ${edge(t.endDate, t.endTime)}`;
}
