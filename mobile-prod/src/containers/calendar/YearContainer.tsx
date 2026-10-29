import { useMemo } from 'react';
import { monthAnchor } from '@/adapters/calendar/events';
import { yearProps } from '@/adapters/calendar/year';
import { toISODate } from '@/lib/dates';
import { useStore } from '@/lib/store';
import { parts } from '@/screens/calendar/format';
import { YearScreen } from '@/screens/calendar/YearScreen';
import { useClock, usePersonColors } from '../common';
import { useCalendarChrome, useCalendarSnapshot } from './useCalendar';

/** Соседний год: тот же месяц (сегодняшний день, если он в нём, иначе первое число) */
const shift = (n: number) => () => {
  const s = useStore.getState();
  const { y, m } = parts(s.calendarDate);
  s.setCalendarDate(monthAnchor(y + n, m, toISODate(new Date())));
};
export const prevYear = shift(-1);
export const nextYear = shift(1);
const goToday = () => useStore.getState().setCalendarDate(toISODate(new Date()));
const openMonth = (month: number) => {
  const s = useStore.getState();
  s.setCalendarDate(monthAnchor(parts(s.calendarDate).y, month, toISODate(new Date())));
  s.setTasksView('month');
};

/** C-Year: год s.calendarDate. Разы дел за год считаются заново только при смене дел, группы, людей, года или дня */
export const YearContainer = () => {
  const chrome = useCalendarChrome();
  const snap = useCalendarSnapshot();
  const colors = usePersonColors(snap);
  const { today } = useClock();
  const year = useStore((s) => parts(s.calendarDate).y);
  const data = useMemo(() => yearProps(snap, { today }, colors, { year }), [snap, today, colors, year]);
  return <YearScreen {...chrome} {...data} onPrev={prevYear} onNext={nextYear} onToday={goToday} onOpenMonth={openMonth} />;
};
