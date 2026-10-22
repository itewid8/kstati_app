/**
 * Сетка месяца для календарей окон редактирования. Без часовых поясов: дни по UTC (как lib/calendarLayout/days).
 */
import { dayNo, isoOf, type IsoDate } from '@/lib/calendarLayout';

export const MONTHS = ['ЯНВАРЬ', 'ФЕВРАЛЬ', 'МАРТ', 'АПРЕЛЬ', 'МАЙ', 'ИЮНЬ', 'ИЮЛЬ', 'АВГУСТ', 'СЕНТЯБРЬ', 'ОКТЯБРЬ', 'НОЯБРЬ', 'ДЕКАБРЬ'];
export const MONTHS_SHORT = ['ЯНВ', 'ФЕВ', 'МАР', 'АПР', 'МАЙ', 'ИЮН', 'ИЮЛ', 'АВГ', 'СЕН', 'ОКТ', 'НОЯ', 'ДЕК'];
export const MONTHS_A11Y = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
export const WEEKDAYS = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];

export type MonthCell = {
  iso: IsoDate;
  day: number;
  inMonth: boolean;
};

/** Понедельник = 0 */
export const firstWeekday = (year: number, month: number) => (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
export const monthLength = (year: number, month: number) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

/**
 * Дни месяца с хвостами соседних до целых недель (пн–вс).
 * minWeeks — дополнить до стольких недель (мини-месяцы года всегда 6 строк).
 */
export function monthCells(year: number, month: number, minWeeks = 0): MonthCell[] {
  const offset = firstWeekday(year, month);
  const len = monthLength(year, month);
  const weeks = Math.max(minWeeks, Math.ceil((offset + len) / 7));
  const first = Math.round(Date.UTC(year, month, 1) / 86_400_000);
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const iso = isoOf(first - offset + i);
    const d = i - offset + 1;
    return { iso, day: Number(iso.slice(8)), inMonth: d >= 1 && d <= len };
  });
}

/** День внутри [start, end] включительно (ISO-строки сравниваются как даты) */
export const within = (iso: IsoDate, start: IsoDate, end: IsoDate) => iso >= start && iso <= end;

export const daysBetween = (a: IsoDate, b: IsoDate) => dayNo(b) - dayNo(a);
