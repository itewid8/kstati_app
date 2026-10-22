/**
 * Занятость людей для экранов: дела → BusyEvent (правило — src/lib/calendarLayout/index.ts),
 * конфликты черновика с чужими делами («КАРИНА ЗАНЯТА · Йога · 19:00–20:00») и настройки «Свободно».
 */
import {
  MIN_DURATION,
  absMinute,
  conflicts,
  dayNo,
  isoOf,
  type BusyEvent,
  type FreeWindowOptions,
  type IsoDate,
} from '@/lib/calendarLayout';
import { taskKey } from '@/lib/recur';
import { isLong, lastDay, peopleOf } from '@/lib/span';
import type { ID, Task } from '@/lib/types';
import { hhmm } from '@/screens/calendar/format';
import type { Snapshot } from '../snapshot';
import { instancesIn, planIds } from './tasks';

/** «Свободно» в ответе ассистента: 09:00–22:00, окна от 1 ч (docs/redesign/DECISIONS.md). FREE_DEFAULTS не трогаем */
export const FREE_OPTS: Required<FreeWindowOptions> = { dayStart: 9 * 60, dayEnd: 22 * 60, minGap: 60 };

type Timing = Pick<Task, 'date' | 'time' | 'endDate' | 'endTime'>;

/** Занятость одного дела со временем; на весь день, длиннее суток и без даты — null */
function busyOf(id: string, t: Timing, people: readonly ID[]): BusyEvent | null {
  if (!t.date || !t.time || isLong(t)) return null;
  const start = absMinute(t.date, t.time);
  // Нет конца (или он не позже начала) — end = start, функции занятости сами возьмут 30 минут
  const end = t.endTime ? absMinute(t.endDate ?? t.date, t.endTime) : start;
  return { id, start, end: end > start ? end : start, people };
}

/**
 * Занятость по разам дел (instancesIn): только дела со временем, не длиннее суток и не планы с подзадачами.
 * id — taskKey, people — peopleOf. tasks — все дела (по ним видно, у какого дела есть подзадачи)
 */
export function busyEvents(instances: readonly Task[], tasks: readonly Task[] = instances): BusyEvent[] {
  const plans = planIds(tasks);
  return instances.flatMap((t) => {
    if (plans.has(t.id)) return [];
    const e = busyOf(taskKey(t), t, peopleOf(t));
    return e ? [e] : [];
  });
}

export type BusyConflict = {
  /** Кто занят */
  personId: ID;
  /** Чем: название дела */
  title: string;
  /** «19:00–20:00» */
  range: string;
  /** taskKey дела, с которым пересекается */
  key: string;
  /** Дата начала того дела */
  date: IsoDate;
};

const endOf = (e: BusyEvent) => (e.end > e.start ? e.end : e.start + MIN_DURATION);
const DRAFT = '\u0000draft';

/**
 * С кем из personIds черновик пересекается по времени: дела всех моих групп, кроме exceptId (само редактируемое дело
 * со всеми его повторами). Черновик без времени (или длиннее суток) ни с кем не пересекается.
 * Порядок — по началу того дела, затем по порядку personIds
 */
export function busyFor(s: Pick<Snapshot, 'tasks' | 'groups'>, draft: Timing, personIds: readonly ID[], exceptId?: ID | null): BusyConflict[] {
  const mine = busyOf(DRAFT, draft, personIds);
  if (!mine || !draft.date || !personIds.length) return [];
  // Дела, которые могут задеть черновик: с запасом в сутки до начала (через полночь)
  const from = isoOf(dayNo(draft.date) - 1);
  const to = lastDay(draft) ?? draft.date;
  const instances = instancesIn(
    s.tasks.filter((t) => t.id !== exceptId),
    s.groups.map((g) => g.id),
    from,
    to,
  );
  const events = busyEvents(instances, s.tasks);
  const byKey = new Map(instances.map((t) => [taskKey(t), t]));
  const startOf = new Map(events.map((e) => [e.id, e]));
  const out: (BusyConflict & { start: number })[] = [];
  for (const c of conflicts([mine, ...events])) {
    const other = c.a === DRAFT ? c.b : c.b === DRAFT ? c.a : null;
    const t = other ? byKey.get(other) : undefined;
    const e = other ? startOf.get(other) : undefined;
    if (!other || !t || !e || !t.date) continue;
    const range = `${hhmm(e.start % 1440)}–${hhmm(endOf(e) % 1440)}`;
    for (const personId of personIds) {
      if (c.people.includes(personId)) out.push({ personId, title: t.title, range, key: other, date: t.date, start: e.start });
    }
  }
  return out
    .sort((x, y) => x.start - y.start || personIds.indexOf(x.personId) - personIds.indexOf(y.personId))
    .map(({ start: _start, ...rest }) => rest);
}
