/**
 * «Свободно» в ответе «что я делаю на выходных» (C-AskWeekend): окна человека от 1 ч в пределах 09:00–22:00
 * (docs/redesign/DECISIONS.md) — только через freeWindows с FREE_OPTS. Занятость — дела со временем всех моих групп
 * (busyEvents: дела на весь день, многодневные и планы с подзадачами не занимают). Прошедшее сегодня не показывается.
 */
import { absMinute, dayNo, freeWindows, isoOf, type FreeWindow, type IsoDate } from '@/lib/calendarLayout';
import type { ID } from '@/lib/types';
import { WEEKDAYS, hhmm, weekday } from '@/screens/calendar/format';
import type { Clock, Snapshot } from '../snapshot';
import { FREE_OPTS, busyEvents } from '../common/busy';
import { ALL_TASKS, instancesIn } from '../common/tasks';

const DAY = 1440;

/** «СБ 18:30 →» (до конца дня), «ВС ДО 11:00» (с начала дня), «СБ 12:00–15:00», «ВС ВЕСЬ ДЕНЬ» */
export function freeLabel(w: FreeWindow): string {
  const wd = WEEKDAYS[weekday(w.date)] ?? '';
  const a = hhmm(w.start % DAY);
  const b = hhmm(w.end % DAY);
  if (w.atDayStart && w.atDayEnd) return `${wd} ВЕСЬ ДЕНЬ`;
  if (w.atDayEnd) return `${wd} ${a} →`;
  if (w.atDayStart) return `${wd} ДО ${b}`;
  return `${wd} ${a}–${b}`;
}

/** Свободные окна человека в днях [from, to] (включительно), начиная не раньше «сейчас» */
export function freeWindowsOf(s: Pick<Snapshot, 'tasks' | 'groups'>, personId: ID, from: IsoDate, to: IsoDate, clock: Clock): FreeWindow[] {
  // Дело, начатое вчера вечером, может занимать утро первого дня
  const instances = instancesIn(
    s.tasks,
    ALL_TASKS,
    isoOf(dayNo(from) - 1),
    to,
  );
  const events = busyEvents(instances, s.tasks);
  const start = Math.max(absMinute(from), absMinute(clock.today) + clock.now);
  const end = absMinute(to) + DAY;
  return start < end ? freeWindows(events, personId, start, end, FREE_OPTS) : [];
}

/** Строка рамки «Свободно»; окон нет — undefined (рамка не показывается) */
export function freeText(s: Pick<Snapshot, 'tasks' | 'groups'>, personId: ID, from: IsoDate, to: IsoDate, clock: Clock): string | undefined {
  const windows = freeWindowsOf(s, personId, from, to, clock);
  return windows.length ? windows.map(freeLabel).join(' · ') : undefined;
}
