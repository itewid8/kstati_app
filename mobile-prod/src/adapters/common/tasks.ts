/** Дела для экранов: разы повторов в периоде, ключ «id@дата», подзадачи плана */
import { dayNo, isoOf, type IsoDate } from '@/lib/calendarLayout';
import { sortKey } from '@/lib/dates';
import { instance, occurrences } from '@/lib/recur';
import { lastDay } from '@/lib/span';
import type { ID, Task } from '@/lib/types';

/** Дело задевает период [from, to] хотя бы одним днём (многодневное, начатое раньше, — тоже) */
export const touches = (t: Pick<Task, 'date' | 'time' | 'endDate' | 'endTime'>, from: IsoDate, to: IsoDate) =>
  !!t.date && t.date <= to && (lastDay(t) ?? t.date) >= from;

/**
 * Дела групп groupIds, которые задевают период [from, to]: разы повторов — отдельными делами (taskKey — «id@дата»),
 * обычные — как есть. Дела без даты не попадают. Порядок — по началу (дата, время).
 */
export function instancesIn(tasks: readonly Task[], groupIds: readonly ID[], from: IsoDate, to: IsoDate): Task[] {
  const groups = new Set(groupIds);
  const out: Task[] = [];
  for (const t of tasks) {
    if (!groups.has(t.groupId) || !t.date) continue;
    if (!t.repeat) {
      if (touches(t, from, to)) out.push(t);
      continue;
    }
    // Раз многодневной серии мог начаться до периода и задеть его
    const span = dayNo(lastDay(t) ?? t.date) - dayNo(t.date);
    for (const occ of occurrences(t, isoOf(dayNo(from) - span), to)) {
      const one = instance(t, occ);
      if (touches(one, from, to)) out.push(one);
    }
  }
  return out.sort((a, b) => sortKey(a.date, a.time).localeCompare(sortKey(b.date, b.time)));
}

const OCC = /^\d{4}-\d{2}-\d{2}$/;

/** «id@2026-10-10» → { id, occ } (обратная к taskKey); без «@дата» — только id */
export function parseKey(key: string): { id: ID; occ?: IsoDate } {
  const at = key.lastIndexOf('@');
  const occ = at > 0 ? key.slice(at + 1) : '';
  return OCC.test(occ) ? { id: key.slice(0, at), occ } : { id: key };
}

/** Подзадачи плана по началу (без даты — в конце) */
export function kidsOf(tasks: readonly Task[], planId: ID): Task[] {
  return tasks.filter((t) => t.parentId === planId).sort((a, b) => sortKey(a.date, a.time).localeCompare(sortKey(b.date, b.time)));
}

/** План — дело без родителя, у которого есть подзадачи */
export const isPlan = (t: Pick<Task, 'id' | 'parentId'>, tasks: readonly Pick<Task, 'parentId'>[]) =>
  !t.parentId && tasks.some((x) => x.parentId === t.id);

/** id всех планов (для проверки многих дел разом) */
export const planIds = (tasks: readonly Pick<Task, 'parentId'>[]): Set<ID> =>
  new Set(tasks.flatMap((t) => (t.parentId ? [t.parentId] : [])));
