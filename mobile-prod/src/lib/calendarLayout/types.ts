/**
 * Типы раскладки календаря. Сознательно не зависят от lib/types.ts — переходник описан в index.ts.
 */

/** Дата «YYYY-MM-DD» (как Task.date) */
export type IsoDate = string;

/** Минуты от полуночи дня колонки: 0…1440 */
export type DayMinute = number;

/**
 * Минуты «по настенным часам» от 1970-01-01 00:00: dayNo(date)·1440 + чч·60 + мм
 * (то же начало отсчёта, что bounds() в lib/span.ts). Сутки — ровно 1440, переходы на летнее время не учитываются.
 */
export type AbsMinute = number;

/** Дело с концом не позже начала длится 30 минут (как DEFAULT_MIN в lib/span.ts) — и в сетке, и в занятости */
export const MIN_DURATION = 30;

/** Дело в колонке дня (сетка часов): только дела со временем; конец позже начала */
export interface ColumnEvent {
  readonly id: string;
  readonly start: DayMinute;
  readonly end: DayMinute;
}

/** Занятость человека: дело со временем, абсолютные минуты; people — кто занят */
export interface BusyEvent {
  readonly id: string;
  readonly start: AbsMinute;
  readonly end: AbsMinute;
  readonly people: readonly string[];
}

/** Полоса над сеткой (на весь день, многодневное, общее дело с подзадачами): дни включительно */
export interface DayBar {
  readonly id: string;
  readonly startDate: IsoDate;
  readonly endDate: IsoDate;
}
