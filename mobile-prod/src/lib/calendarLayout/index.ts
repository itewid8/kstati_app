/**
 * Раскладка нового календаря — чистая логика без UI (порт макетов design/mockups/C-Week, C-Day, C-Month).
 *
 * Переходник из lib/types.ts (Task) — делается в UI-слое, здесь нет зависимостей от приложения:
 *  - id: у развёрнутого повтора — `${task.id}@${task.occ}`, чтобы разы одной серии были разными делами.
 *  - Кто: people = peopleOf(task) из lib/span.ts (отмеченные участники, иначе автор).
 *  - Полоса над сеткой (DayBar, packAllDayBars): дело без времени (task.time == null), дело длиннее суток
 *    (isLong из lib/span.ts) и общее дело, у которого есть подзадачи (на него ссылается чей-то parentId).
 *    startDate = task.date, endDate = lastDay(task) из lib/span.ts.
 *  - Сетка (ColumnEvent, layoutDayColumn): остальные дела со временем; для дня day — [start, end] = minutesOn(task, day)
 *    из lib/span.ts (null — в этот день в сетке нет). Подзадача — обычное дело; к подписи «кто» UI добавляет
 *    « · <название общего дела>».
 *  - Занятость (BusyEvent, conflicts, freeWindows): те же дела, что в сетке, но целиком:
 *    start = absMinute(task.date, task.time), end = absMinute(task.endDate ?? task.date, task.endTime);
 *    нет endTime (или конец не позже начала) — end = start, функции сами возьмут MIN_DURATION (30 мин, как в span.ts).
 *  - hourRange: все ColumnEvent видимых дней; now — минуты от полуночи, только если сегодня на экране.
 *  - День (C-Day, layoutDayLanes): те же ColumnEvent, что в сетке недели, но пересекающиеся дела стоят рядом
 *    в равных дорожках; порядок входа — по началу (при равном начале решает вызывающий).
 */
export { COLUMN, layoutDayColumn, minuteToY, type Band, type ColumnBlock, type ColumnOptions } from './dayColumn';
export { layoutDayLanes, type LaneBlock, type LaneOptions } from './dayLanes';
export { EMPTY_RANGE, hourRange, type HourRange } from './hourRange';
export { packAllDayBars, type BarRows, type PlacedBar } from './allDayBars';
export {
  FREE_DEFAULTS,
  absMinute,
  conflicts,
  freeWindows,
  isoOfMinute,
  type Conflict,
  type FreeWindow,
  type FreeWindowOptions,
} from './busy';
export { monthCellItems, type MonthCell } from './monthCell';
export { fitRows, fitTextLines, linesOf, textRoom, type TextFit, type TextSegment } from './textFit';
export { monoWidth, syllables, timeLines, timeOptions, titlePlan, type TimeRow, type TitlePlan } from './weekText';
export {
  GRID,
  MONTH_GRID,
  YEAR_GRID,
  monthCellAt,
  monthLayout,
  weekColumnAt,
  yearLayout,
  yearMonthAt,
  type MonthLayout,
  type ViewFrame,
  type YearLayout,
} from './viewGeometry';
export {
  ZOOM,
  ZOOM_VIEWS,
  zoomCommits,
  zoomDir,
  zoomEnterScale,
  zoomExitScale,
  zoomFollow,
  zoomNext,
  zoomProgress,
  zoomShift,
  type ZoomDir,
  type ZoomView,
} from './zoom';
export { dayNo, isoOf } from './days';
export { MIN_DURATION, type AbsMinute, type BusyEvent, type ColumnEvent, type DayBar, type DayMinute, type IsoDate } from './types';
