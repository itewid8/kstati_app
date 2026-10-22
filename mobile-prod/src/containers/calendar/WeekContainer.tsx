import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { shiftDay } from '@/adapters/calendar/events';
import { weekProps } from '@/adapters/calendar/week';
import type { IsoDate } from '@/lib/calendarLayout';
import { toISODate } from '@/lib/dates';
import { useStore } from '@/lib/store';
import { WeekScreen } from '@/screens/calendar/WeekScreen';
import { useClock, usePersonColors, type StoreState } from '../common';
import { openTaskKey, togglePerson, useCalendarChrome, useCalendarSnapshot } from './useCalendar';

const pickWeek = (s: StoreState) => ({ date: s.calendarDate, hidden: s.calendarHidden });

const shift = (n: number) => () => {
  const s = useStore.getState();
  s.setCalendarDate(shiftDay(s.calendarDate, n));
};
const prevWeek = shift(-7);
const nextWeek = shift(7);
const goToday = () => useStore.getState().setCalendarDate(toISODate(new Date()));
const openDay = (date: IsoDate) => {
  const s = useStore.getState();
  s.setCalendarDate(date);
  s.setTasksView('day');
};

/** C-Week: неделя с понедельника s.calendarDate (INTEGRATION.md 1.1) */
export const WeekContainer = () => {
  const chrome = useCalendarChrome();
  const snap = useCalendarSnapshot();
  const colors = usePersonColors(snap);
  const clock = useClock();
  const { date, hidden } = useStore(useShallow(pickWeek));
  const data = useMemo(() => weekProps(snap, clock, colors, { date, hidden }), [snap, clock, colors, date, hidden]);
  return (
    <WeekScreen
      {...chrome}
      {...data}
      onPrev={prevWeek}
      onNext={nextWeek}
      onToday={goToday}
      onOpenDay={openDay}
      onOpenEvent={openTaskKey}
      onOpenBar={openTaskKey}
      onTogglePerson={togglePerson}
    />
  );
};
