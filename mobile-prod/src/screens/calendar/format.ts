/** Подписи календаря: даты, время, склонения. Без часовых поясов — даты «YYYY-MM-DD» как в calendarLayout */
import { dayNo, isoOf, type DayMinute, type IsoDate } from '@/lib/calendarLayout';
import type { ID } from '@/lib/types';
import type { CalendarPerson, TimedEvent } from './types';

export const WEEKDAYS = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'] as const;
export const MONTHS_SHORT = ['ЯНВ', 'ФЕВ', 'МАР', 'АПР', 'МАЙ', 'ИЮН', 'ИЮЛ', 'АВГ', 'СЕН', 'ОКТ', 'НОЯ', 'ДЕК'] as const;
export const MONTHS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
] as const;

/** «5 октября» — подписи для экранного диктора */
export const MONTHS_GEN = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
] as const;

export const pad2 = (n: number) => String(n).padStart(2, '0');

/** Части даты: год, месяц 1…12, число */
export function parts(iso: IsoDate): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

/** День недели 0 = ПН … 6 = ВС (1970-01-01 — четверг) */
export const weekday = (iso: IsoDate) => (dayNo(iso) + 3) % 7;

export const addDays = (iso: IsoDate, n: number) => isoOf(dayNo(iso) + n);

export const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export const isoDate = (y: number, m: number, d: number): IsoDate => `${y}-${pad2(m)}-${pad2(d)}`;

/** 570 → «09:30» */
export const hhmm = (m: DayMinute) => `${pad2(Math.floor(m / 60) % 24)}:${pad2(m % 60)}`;

/** Время дела в сетке: «09:30–10:30», «→ 15:00», «07:00 →», «весь день» */
export function timeRange(e: Pick<TimedEvent, 'start' | 'end' | 'fromPrevDay' | 'toNextDay'>): string {
  if (e.fromPrevDay && e.toNextDay) return 'весь день';
  if (e.fromPrevDay) return `→ ${hhmm(e.end)}`;
  if (e.toNextDay) return `${hhmm(e.start)} →`;
  return `${hhmm(e.start)}–${hhmm(e.end)}`;
}

/** 1 дело, 2 дела, 5 дел */
export function plural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}

export const tasksWord = (n: number) => plural(n, 'ДЕЛО', 'ДЕЛА', 'ДЕЛ');

/** Люди по id в порядке дела; неизвестные пропускаются */
export function peopleOf(ids: readonly ID[], byId: ReadonlyMap<ID, CalendarPerson>): CalendarPerson[] {
  return ids.flatMap((id) => {
    const p = byId.get(id);
    return p ? [p] : [];
  });
}

/** «Саня, Карина» */
export const namesOf = (people: readonly CalendarPerson[]) => people.map((p) => p.name).join(', ');
