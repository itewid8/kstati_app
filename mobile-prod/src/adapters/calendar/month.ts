/**
 * C-Month: дела по дням месяца (сначала без времени, потом по времени; подзадачи — строками, план — только подсветкой),
 * планы месяца и панель выбранного дня («09:30» / «—»)
 */
import type { IsoDate } from '@/lib/calendarLayout';
import { taskKey } from '@/lib/recur';
import { daysOf, lastDay, minutesOn, peopleOf } from '@/lib/span';
import type { Task } from '@/lib/types';
import { daysInMonth, isoDate, parts } from '@/screens/calendar/format';
import type { AgendaRow, MonthItem, MonthPlan, MonthScreenProps } from '@/screens/calendar/MonthScreen';
import { colorOf, groupPeople, type ColorMap } from '../common/people';
import type { Clock } from '../snapshot';
import { groupInstances, planIndex, type CalendarData, type CalendarSnapshot } from './events';

export type MonthOptions = {
  /** Выбранный день (s.calendarDate): по нему же месяц */
  date: IsoDate;
};

/** Без времени в этот день (весь день, продолжение многодневного) — раньше всех, дальше по началу */
const orderOn = (t: Task, day: IsoDate) => minutesOn(t, day)?.[0] ?? -1;

const byOrder = (day: IsoDate) => (a: Task, b: Task) => orderOn(a, day) - orderOn(b, day);

const itemOf = (t: Task): MonthItem => ({ id: taskKey(t), title: t.title, people: peopleOf(t) });

export function monthProps(s: CalendarSnapshot, clock: Pick<Clock, 'today'>, colors: ColorMap, { date }: MonthOptions): CalendarData<MonthScreenProps> {
  const { y, m } = parts(date);
  const from = isoDate(y, m, 1);
  const to = isoDate(y, m, daysInMonth(y, m));
  const instances = groupInstances(s, from, to);
  const plans = planIndex(s.tasks);

  const byDay = new Map<IsoDate, Task[]>();
  const monthPlans: MonthPlan[] = [];
  for (const t of instances) {
    if (plans.ids.has(t.id)) {
      if (t.date) monthPlans.push({ id: taskKey(t), startDate: t.date, endDate: lastDay(t) ?? t.date, color: colorOf(colors, peopleOf(t)[0] ?? t.createdBy) });
      continue;
    }
    for (const day of daysOf(t)) {
      if (day < from || day > to) continue;
      const list = byDay.get(day);
      if (list) list.push(t);
      else byDay.set(day, [t]);
    }
  }

  const items: Record<IsoDate, MonthItem[]> = {};
  for (const [day, list] of byDay) items[day] = [...list].sort(byOrder(day)).map(itemOf);

  // Панель дня: сначала планы, которые его покрывают, потом дела дня в том же порядке, что в ячейке
  const dayPlans = instances.filter((t) => plans.ids.has(t.id) && !!t.date && t.date <= date && (lastDay(t) ?? t.date) >= date);
  const dayTasks = [...(byDay.get(date) ?? [])].sort(byOrder(date));
  const agenda: AgendaRow[] = [...dayPlans, ...dayTasks].map((t) => ({
    id: taskKey(t),
    time: t.date === date && t.time ? t.time : '—',
    title: t.title,
    people: peopleOf(t),
  }));

  return {
    people: groupPeople(s, colors, s.currentGroupId),
    year: y,
    month: m,
    today: clock.today,
    selectedDate: date,
    items,
    plans: monthPlans,
    agenda,
  };
}
