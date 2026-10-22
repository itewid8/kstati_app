/**
 * C-Plan: план по дням. Период — у самого плана (AUDIT-2 §6.2), не по подзадачам: перенос плана подзадачи не двигает.
 * В сетку попадают подзадачи со временем внутри периода; без времени и вне периода видны в окне плана (C-EditPlan)
 */
import type { IsoDate } from '@/lib/calendarLayout';
import { lastDay, minutesOn, peopleOf } from '@/lib/span';
import type { ID, Task } from '@/lib/types';
import type { PlanScreenProps, PlanStepEvent } from '@/screens/calendar/PlanScreen';
import { colorOf, userOf, type ColorMap } from '../common/people';
import { upper } from '../common/ru';
import { kidsOf } from '../common/tasks';
import { periodLabel } from '../common/when';
import type { Clock, DataOf } from '../snapshot';
import { isDone, type CalendarSnapshot } from './events';

/** Подзадача в сетке плана: со временем, начинается внутри периода [start, end] */
function stepOf(k: Task, start: IsoDate, end: IsoDate): PlanStepEvent | null {
  if (!k.date || !k.time || k.date < start || k.date > end) return null;
  const span = minutesOn(k, k.date);
  if (!span) return null;
  return {
    id: k.id,
    title: k.title,
    ...(k.note?.trim() ? { note: k.note.trim() } : {}),
    date: k.date,
    start: span[0],
    end: span[1],
    ...(isDone(k) ? { done: true } : {}),
  };
}

/** Период плана без даты: по подзадачам, а если и у них нет дат — сегодня */
function fallbackPeriod(kids: readonly Task[], today: IsoDate): [IsoDate, IsoDate] {
  const dates = kids.flatMap((k) => (k.date ? [k.date, lastDay(k) ?? k.date] : [])).sort();
  return [dates[0] ?? today, dates[dates.length - 1] ?? today];
}

/** Данные C-Plan; плана нет (удалён, ещё не пришёл) — null */
export function planGridProps(s: CalendarSnapshot, clock: Pick<Clock, 'today'>, colors: ColorMap, planId: ID): DataOf<PlanScreenProps> | null {
  const plan = s.tasks.find((t) => t.id === planId);
  if (!plan) return null;
  const kids = kidsOf(s.tasks, planId);
  const [startDate, endDate] = plan.date ? [plan.date, lastDay(plan) ?? plan.date] : fallbackPeriod(kids, clock.today);
  const group = s.groups.find((g) => g.id === plan.groupId);
  const who = peopleOf(plan);
  const names = who.flatMap((id) => {
    const u = userOf(s, id);
    return u ? [upper(u.name)] : [];
  });
  return {
    caption: group ? `ПЛАН · ${upper(group.name)}` : 'ПЛАН',
    title: plan.title,
    color: colorOf(colors, who[0] ?? plan.createdBy),
    rangeLabel: periodLabel(plan),
    ownerLabel: names.join(', '),
    startDate,
    endDate,
    steps: kids.flatMap((k) => {
      const step = stepOf(k, startDate, endDate);
      return step ? [step] : [];
    }),
  };
}
