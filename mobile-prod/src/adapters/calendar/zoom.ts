/**
 * Щипок между видами: какой период откроется. Период следует за точкой щипка:
 *  - неделя → месяц: месяц дня под пальцами (он же выбранный день месяца);
 *  - месяц → неделя: неделя ячейки под пальцами (вне сетки — неделя выбранного дня);
 *  - год → месяц: месяц карточки под пальцами (сегодняшний день, если он в нём, иначе первое число);
 *  - неделя → день: день колонки под пальцами;
 *  - день → неделя, месяц → год: тот же день.
 */
import {
  dayNo,
  isoOf,
  monthCellAt,
  weekColumnAt,
  yearMonthAt,
  zoomNext,
  type IsoDate,
  type ViewFrame,
  type ZoomDir,
} from '@/lib/calendarLayout';
import { daysInMonth, isoDate, parts, weekday } from '@/screens/calendar/format';
import type { CalendarView } from '@/screens/calendar/types';
import { monthAnchor, mondayOf } from './events';

export type ZoomTarget = { view: CalendarView; date: IsoDate };

export type ZoomInput = {
  view: CalendarView;
  /** s.calendarDate */
  date: IsoDate;
  dir: ZoomDir;
  /** Точка щипка, px экрана */
  x: number;
  y: number;
  frame: ViewFrame;
  today: IsoDate;
  /** Прокрутка сетки года */
  yearScroll?: number;
};

/** Сколько недель (строк) в сетке месяца даты */
export const monthWeeks = (date: IsoDate): number => {
  const { y, m } = parts(date);
  return Math.ceil((weekday(isoDate(y, m, 1)) + daysInMonth(y, m)) / 7);
};

/** Куда ведёт щипок; null — дальше переключать некуда */
export const zoomTarget = ({ view, date, dir, x, y, frame, today, yearScroll = 0 }: ZoomInput): ZoomTarget | null => {
  const next = zoomNext(view, dir);
  if (!next) return null;
  switch (view) {
    case 'week':
      // В месяц и в день — день под пальцами
      return { view: next, date: isoOf(dayNo(mondayOf(date)) + weekColumnAt(x, frame.width)) };
    case 'month': {
      if (next === 'year') return { view: next, date };
      const { y: yy, m } = parts(date);
      const first = isoDate(yy, m, 1);
      const cell = monthCellAt(x, y, monthWeeks(date), frame);
      return { view: next, date: cell ? isoOf(dayNo(first) - weekday(first) + cell.row * 7 + cell.col) : date };
    }
    case 'year':
      return { view: next, date: monthAnchor(parts(date).y, yearMonthAt(x, y, frame, yearScroll), today) };
    default:
      return { view: next, date };
  }
};
