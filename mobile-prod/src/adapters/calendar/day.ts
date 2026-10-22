/** C-Day: дела одного дня — полосы (весь день, многодневные, планы) и сетка по началу */
import type { IsoDate } from '@/lib/calendarLayout';
import type { ID } from '@/lib/types';
import type { DayScreenProps } from '@/screens/calendar/DayScreen';
import { groupPeople, type ColorMap } from '../common/people';
import type { Clock } from '../snapshot';
import { barsOf, groupInstances, planIndex, timedOn, type CalendarData, type CalendarSnapshot } from './events';

export type DayOptions = {
  /** Показываемый день (s.calendarDate) */
  date: IsoDate;
  /** Скрытые люди (s.calendarHidden) */
  hidden: readonly ID[];
};

export function dayProps(s: CalendarSnapshot, clock: Clock, colors: ColorMap, { date, hidden }: DayOptions): CalendarData<DayScreenProps> {
  const instances = groupInstances(s, date, date, hidden);
  const plans = planIndex(s.tasks);
  return {
    people: groupPeople(s, colors, s.currentGroupId),
    hiddenPeople: hidden,
    date,
    today: clock.today,
    ...(date === clock.today ? { now: clock.now } : {}),
    bars: barsOf(instances, plans),
    events: timedOn(instances, date, plans),
  };
}
