/**
 * Геометрия видов календаря, которая нужна и экрану, и щипку (что под пальцами): колонки недели,
 * сетка месяца с панелью дня, карточки года. Все y — px экрана с учётом safe area.
 *
 * Кадр (ViewFrame): размер экрана, отступ сверху (safe area) и снизу — то, что закрывает нижняя навигация
 * вместе с safe area (insets.bottom + size.contentBottom). Содержимое не заходит под навигацию.
 */

export type ViewFrame = {
  readonly width: number;
  readonly height: number;
  /** safe area сверху */
  readonly top: number;
  /** Снизу занято навигацией и safe area: insets.bottom + size.contentBottom */
  readonly bottom: number;
};

/** Поля экрана слева и справа (space.side) */
const SIDE = 16;

const clampInt = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.floor(v)));

/** Сетка часов (неделя, день): подписи часов слева, поле вкладок людей справа */
export const GRID = { left: 44, right: 26 } as const;

/** Колонка недели под точкой x: 0…6, за краями сетки — крайняя */
export const weekColumnAt = (x: number, width: number): number => {
  const col = (width - GRID.left - GRID.right) / 7;
  return col > 0 ? clampInt((x - GRID.left) / col, 0, 6) : 0;
};

/** Вертикаль месяца (C-Month, px от верха экрана без safe area) */
export const MONTH_GRID = {
  weekdaysTop: 140,
  gridTop: 156,
  /** Панель выбранного дня по макету; на низком экране поднимается, чтобы её не закрыла навигация */
  panelTop: 552,
  /** Зазор между сеткой и панелью дня */
  gap: 8,
  rule: 1.5,
  /** Строка 77px при 5 неделях */
  maxRow: 77,
  /** Панели дня нужно место хотя бы на шапку и две строки: рамки 3 + шапка 22 + 2 × 31 */
  minPanel: 87,
} as const;

export type MonthLayout = {
  /** Верх сетки (черта 1.5px) */
  readonly gridTop: number;
  readonly rowH: number;
  readonly panelTop: number;
  /** Высота панели дня до навигации */
  readonly panelMax: number;
};

export const monthLayout = (weeks: number, f: ViewFrame): MonthLayout => {
  const M = MONTH_GRID;
  const gridTop = f.top + M.gridTop;
  const floor = f.height - f.bottom;
  const panelTop = Math.min(f.top + M.panelTop, floor - M.minPanel);
  const rowH = Math.max(0, Math.min(M.maxRow, Math.floor((panelTop - M.gap - gridTop - M.rule) / Math.max(1, weeks))));
  return { gridTop, rowH, panelTop, panelMax: Math.max(0, floor - panelTop) };
};

/** Ячейка месяца под точкой: неделя и день недели; вне сетки по высоте — null (по ширине — крайний день) */
export const monthCellAt = (x: number, y: number, weeks: number, f: ViewFrame): { row: number; col: number } | null => {
  const { gridTop, rowH } = monthLayout(weeks, f);
  const y0 = gridTop + MONTH_GRID.rule;
  if (rowH <= 0 || y < y0 || y >= y0 + weeks * rowH) return null;
  const cellW = (f.width - 2 * SIDE) / 7;
  return { row: clampInt((y - y0) / rowH, 0, weeks - 1), col: cellW > 0 ? clampInt((x - SIDE) / cellW, 0, 6) : 0 };
};

/** Вертикаль года (C-Year, px от верха экрана без safe area) */
export const YEAR_GRID = {
  legendTop: 140,
  gridTop: 162,
  /** Строка карточек по макету; на низком экране ниже, чтобы декабрь не ушёл под навигацию */
  row: 138,
  gap: 6,
  cols: 3,
  rows: 4,
  pad: 8,
  /** Шапка карточки (название месяца) и зазор под ней */
  head: 13,
  headGap: 6,
  dayH: 12,
  dayGap: 2,
  /** Меньше квадраты дней не становятся — дальше сетка года прокручивается */
  minDayH: 6,
} as const;

export type YearLayout = {
  readonly gridTop: number;
  readonly rowH: number;
  /** Высота квадрата дня */
  readonly dayH: number;
  /** Высота всей сетки карточек */
  readonly gridH: number;
};

/** Карточка вмещает 6 недель квадратами dayH */
const cardHeight = (dayH: number) => {
  const Y = YEAR_GRID;
  return 2 * Y.pad + Y.head + Y.headGap + 6 * dayH + 5 * Y.dayGap;
};

export const yearLayout = (f: ViewFrame): YearLayout => {
  const Y = YEAR_GRID;
  const gridTop = f.top + Y.gridTop;
  const avail = f.height - f.bottom - gridTop;
  const fitRow = Math.floor((avail - (Y.rows - 1) * Y.gap) / Y.rows);
  const minRow = cardHeight(Y.minDayH);
  const rowH = Math.max(minRow, Math.min(Y.row, fitRow));
  const room = Math.floor((rowH - cardHeight(0)) / 6);
  const dayH = Math.max(Y.minDayH, Math.min(Y.dayH, room));
  return { gridTop, rowH, dayH, gridH: Y.rows * rowH + (Y.rows - 1) * Y.gap };
};

/** Месяц (1…12) под точкой; scrollY — прокрутка сетки года. За краями — ближайшая карточка */
export const yearMonthAt = (x: number, y: number, f: ViewFrame, scrollY = 0): number => {
  const Y = YEAR_GRID;
  const { gridTop, rowH } = yearLayout(f);
  const cardW = (f.width - 2 * SIDE - (Y.cols - 1) * Y.gap) / Y.cols;
  const col = cardW > 0 ? clampInt((x - SIDE + Y.gap / 2) / (cardW + Y.gap), 0, Y.cols - 1) : 0;
  const row = clampInt((y + scrollY - gridTop + Y.gap / 2) / (rowH + Y.gap), 0, Y.rows - 1);
  return row * Y.cols + col + 1;
};
