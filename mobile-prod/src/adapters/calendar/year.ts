/**
 * C-Year: занятость дней за год. Считаются дела (разы повторов и подзадачи — да, план с подзадачами — нет):
 * у месяца и за год — по дню начала; у дня — все дела, которые его задевают.
 * Кто занят — объединение peopleOf по порядку группы (не больше двух цветов), насыщенность 0.35 + 0.5·min(1, n/4)
 */
import { dayNo, isoOf, type IsoDate } from '@/lib/calendarLayout';
import { occurrences } from '@/lib/recur';
import { lastDay, peopleOf } from '@/lib/span';
import type { ID } from '@/lib/types';
import type { YearDay, YearScreenProps } from '@/screens/calendar/YearScreen';
import { groupPeople, type ColorMap } from '../common/people';
import { planIds, touches } from '../common/tasks';
import type { Clock } from '../snapshot';
import type { CalendarData, CalendarSnapshot } from './events';

export type YearOptions = { year: number };

/** Насыщенность дня по числу дел (AUDIT-2 §4.5) */
export const yearLevel = (n: number) => 0.35 + 0.5 * Math.min(1, n / 4);

/** «Вместе» — диагональ двух цветов: при трёх и больше людях берутся первые двое по порядку группы */
const MAX_COLORS = 2;
/** Многодневное дело отмечается не больше чем на 61 день (как daysOf в lib/span.ts) */
const MAX_SPAN = 60;

export function yearProps(s: CalendarSnapshot, clock: Pick<Clock, 'today'>, colors: ColorMap, { year }: YearOptions): CalendarData<YearScreenProps> {
  const from: IsoDate = `${year}-01-01`;
  const to: IsoDate = `${year}-12-31`;
  const fromNo = dayNo(from);
  const toNo = dayNo(to);
  const people = groupPeople(s, colors, s.currentGroupId);
  const rank = new Map(people.map((p, i) => [p.id, i]));
  const rankOf = (id: ID) => rank.get(id) ?? people.length;
  const plans = planIds(s.tasks);

  // Разы дел за год без промежуточных объектов (instancesIn с сортировкой здесь не нужен): день — номер от 1970 года
  const count = new Map<number, number>();
  const who = new Map<number, ID[]>();
  const monthCounts = Array.from({ length: 12 }, () => 0);
  let total = 0;
  for (const t of s.tasks) {
    if (t.groupId !== s.currentGroupId || !t.date || plans.has(t.id)) continue;
    const span = Math.min(MAX_SPAN, dayNo(lastDay(t) ?? t.date) - dayNo(t.date));
    const ids = peopleOf(t);
    const starts = t.repeat ? occurrences(t, isoOf(fromNo - span), to) : touches(t, from, to) ? [t.date] : [];
    for (const occ of starts) {
      const a = dayNo(occ);
      if (a >= fromNo) {
        const m = Number(occ.slice(5, 7)) - 1;
        monthCounts[m] = (monthCounts[m] ?? 0) + 1;
        total++;
      }
      for (let d = Math.max(a, fromNo), end = Math.min(a + span, toNo); d <= end; d++) {
        count.set(d, (count.get(d) ?? 0) + 1);
        const list = who.get(d);
        if (!list) who.set(d, [...ids]);
        else for (const id of ids) if (!list.includes(id)) list.push(id);
      }
    }
  }

  const days: Record<IsoDate, YearDay> = {};
  for (const [d, n] of count) {
    const ids = [...(who.get(d) ?? [])].sort((a, b) => rankOf(a) - rankOf(b)).slice(0, MAX_COLORS);
    days[isoOf(d)] = { people: ids, level: yearLevel(n) };
  }

  return { people, year, today: clock.today, total, days, monthCounts };
}
