import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { mondayOf, shiftDay } from '@/adapters/calendar/events';
import { phoneBarsIn, phoneSlotsOn } from '@/adapters/calendar/phone';
import { weekProps } from '@/adapters/calendar/week';
import type { IsoDate } from '@/lib/calendarLayout';
import { toISODate } from '@/lib/dates';
import { useStore } from '@/lib/store';
import { WeekScreen } from '@/screens/calendar/WeekScreen';
import { holdTask } from '../quick/quickStore';
import { useClock, usePersonColors, type StoreState } from '../common';
import { openTaskKey, togglePerson, useCalendarChrome, useCalendarSnapshot } from './useCalendar';
import { openPhoneKey, usePhoneEvents } from './usePhone';

const pickWeek = (s: StoreState) => ({ date: s.calendarDate, hidden: s.calendarHidden });

const shift = (n: number) => () => {
  const s = useStore.getState();
  s.setCalendarDate(shiftDay(s.calendarDate, n));
};
export const prevWeek = shift(-7);
export const nextWeek = shift(7);
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
  const from = mondayOf(date);
  const to = shiftDay(from, 6);
  const { events: phoneList } = usePhoneEvents(from, to, chrome.phoneOn);
  const layer = useMemo(() => {
    if (!phoneList.length) return null;
    const phone: Record<IsoDate, ReturnType<typeof phoneSlotsOn>> = {};
    for (let i = 0; i < 7; i++) {
      const d = shiftDay(from, i);
      const slots = phoneSlotsOn(phoneList, d);
      if (slots.length) phone[d] = slots;
    }
    return { phone, bars: [...data.bars, ...phoneBarsIn(phoneList, from, to)] };
  }, [phoneList, from, to, data.bars]);
  return (
    <WeekScreen
      {...chrome}
      {...data}
      {...layer}
      onOpenPhone={openPhoneKey}
      onPrev={prevWeek}
      onNext={nextWeek}
      onToday={goToday}
      onOpenDay={openDay}
      onOpenEvent={openTaskKey}
      onOpenBar={openTaskKey}
      onLongPressEvent={holdTask}
      onLongPressBar={holdTask}
      onTogglePerson={togglePerson}
    />
  );
};
