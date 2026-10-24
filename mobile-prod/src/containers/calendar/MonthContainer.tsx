import { useMemo } from 'react';
import { monthAnchor, shiftMonth } from '@/adapters/calendar/events';
import { monthProps } from '@/adapters/calendar/month';
import { toISODate } from '@/lib/dates';
import { useStore } from '@/lib/store';
import { MonthScreen } from '@/screens/calendar/MonthScreen';
import { parts } from '@/screens/calendar/format';
import { holdTask } from '../quick/quickStore';
import { useClock, usePersonColors } from '../common';
import { openTaskKey, useCalendarChrome, useCalendarSnapshot } from './useCalendar';

/** Соседний месяц: выбран сегодняшний день, если он там, иначе первое число */
const shift = (n: number) => () => {
  const s = useStore.getState();
  const { y, m } = parts(s.calendarDate);
  const next = shiftMonth(y, m, n);
  s.setCalendarDate(monthAnchor(next.y, next.m, toISODate(new Date())));
};
export const prevMonth = shift(-1);
export const nextMonth = shift(1);
const selectDate = (date: string) => useStore.getState().setCalendarDate(date);
const openYear = () => useStore.getState().setTasksView('year');

/** C-Month: месяц s.calendarDate, панель выбранного дня (INTEGRATION.md 1.1) */
export const MonthContainer = () => {
  const chrome = useCalendarChrome();
  const snap = useCalendarSnapshot();
  const colors = usePersonColors(snap);
  // Месяцу «сейчас» не нужно: пересчёт только при смене дня
  const { today } = useClock();
  const date = useStore((s) => s.calendarDate);
  const data = useMemo(() => monthProps(snap, { today }, colors, { date }), [snap, today, colors, date]);
  return (
    <MonthScreen
      {...chrome}
      {...data}
      onPrev={prevMonth}
      onNext={nextMonth}
      onSelectDate={selectDate}
      onOpenEvent={openTaskKey}
      onLongPressEvent={holdTask}
      onOpenYear={openYear}
    />
  );
};
