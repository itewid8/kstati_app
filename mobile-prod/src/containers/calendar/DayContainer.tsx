import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { dayProps } from '@/adapters/calendar/day';
import { shiftDay } from '@/adapters/calendar/events';
import { phoneBarsIn, phoneSlotsOn } from '@/adapters/calendar/phone';
import { toISODate } from '@/lib/dates';
import { useStore } from '@/lib/store';
import { DayScreen } from '@/screens/calendar/DayScreen';
import { holdTask } from '../quick/quickStore';
import { useClock, usePersonColors, type StoreState } from '../common';
import { openTaskKey, togglePerson, useCalendarChrome, useCalendarSnapshot } from './useCalendar';
import { openPhoneKey, usePhoneEvents } from './usePhone';

const pickDay = (s: StoreState) => ({ date: s.calendarDate, hidden: s.calendarHidden });

const shift = (n: number) => () => {
  const s = useStore.getState();
  s.setCalendarDate(shiftDay(s.calendarDate, n));
};
export const prevDay = shift(-1);
export const nextDay = shift(1);
const goToday = () => useStore.getState().setCalendarDate(toISODate(new Date()));

/** C-Day: дела дня s.calendarDate; вкладки людей — s.calendarHidden (INTEGRATION.md 1.1) */
export const DayContainer = () => {
  const chrome = useCalendarChrome();
  const snap = useCalendarSnapshot();
  const colors = usePersonColors(snap);
  const clock = useClock();
  const { date, hidden } = useStore(useShallow(pickDay));
  const data = useMemo(() => dayProps(snap, clock, colors, { date, hidden }), [snap, clock, colors, date, hidden]);
  const { events: phoneList } = usePhoneEvents(date, date, chrome.phoneOn);
  const layer = useMemo(
    () => (phoneList.length ? { phone: phoneSlotsOn(phoneList, date), bars: [...data.bars, ...phoneBarsIn(phoneList, date, date)] } : null),
    [phoneList, date, data.bars],
  );
  return (
    <DayScreen
      {...chrome}
      {...data}
      {...layer}
      onOpenPhone={openPhoneKey}
      onPrev={prevDay}
      onNext={nextDay}
      onToday={goToday}
      onOpenEvent={openTaskKey}
      onOpenBar={openTaskKey}
      onLongPressEvent={holdTask}
      onLongPressBar={holdTask}
      onTogglePerson={togglePerson}
    />
  );
};
