/**
 * Ячейка месяца (C-Month): входит до max дел; если больше — max−1 и «+N».
 * Порядок не меняется: сортирует вызывающий (сначала на весь день, потом по времени).
 */
export interface MonthCell<T> {
  readonly shown: readonly T[];
  /** Сколько не влезло: 0 — подпись «+N» не нужна */
  readonly more: number;
}

export function monthCellItems<T>(list: readonly T[], max = 5): MonthCell<T> {
  if (list.length <= max) return { shown: list.slice(), more: 0 };
  const n = Math.max(0, max - 1);
  return { shown: list.slice(0, n), more: list.length - n };
}
