/** C-Week: неделя с понедельника — полосы за неделю и дела со временем по дням */
import type { IsoDate } from '@/lib/calendarLayout';
import type { ID } from '@/lib/types';
import type { TimedEvent } from '@/screens/calendar/types';
import type { WeekScreenProps } from '@/screens/calendar/WeekScreen';
import { groupPeople, type ColorMap } from '../common/people';
import type { Clock } from '../snapshot';
import { barsOf, daysBetween, groupInstances, mondayOf, planIndex, shiftDay, timedOn, type CalendarData, type CalendarSnapshot } from './events';

export type WeekOptions = {
  /** Любой день недели (s.calendarDate) */
  date: IsoDate;
  hidden: readonly ID[];
};

export function weekProps(s: CalendarSnapshot, clock: Clock, colors: ColorMap, { date, hidden }: WeekOptions): CalendarData<WeekScreenProps> {
  const weekStart = mondayOf(date);
  const weekEnd = shiftDay(weekStart, 6);
  const instances = groupInstances(s, weekStart, weekEnd, hidden);
  const plans = planIndex(s.tasks);
  const events: Record<IsoDate, TimedEvent[]> = {};
  for (const day of daysBetween(weekStart, weekEnd)) {
    const list = timedOn(instances, day, plans);
    if (list.length) events[day] = list;
  }
  return {
    people: groupPeople(s, colors, s.currentGroupId),
    hiddenPeople: hidden,
    weekStart,
    today: clock.today,
    now: clock.now,
    bars: barsOf(instances, plans),
    events,
  };
}
