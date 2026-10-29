/**
 * Переходник Task → календарь (C-Day, C-Week, C-Month, C-Year) — ровно по комментарию src/lib/calendarLayout/index.ts:
 * id = taskKey («id@occ» у повторов), people = peopleOf; полоса — без времени, длиннее суток или план с подзадачами
 * (сам план в сетке не рисуется); сетка — minutesOn(task, day); parentTitle — название плана у подзадачи.
 * Скрытые люди (calendarHidden): дело скрывается, если скрыты все его люди.
 */
import { scopeTasks } from '@/lib/visibility';
import { dayNo, isoOf, type DayMinute, type IsoDate } from '@/lib/calendarLayout';
import { taskKey } from '@/lib/recur';
import { isLong, isMulti, lastDay, minutesOn, peopleOf } from '@/lib/span';
import type { ID, Task } from '@/lib/types';
import { pad2, parts, weekday } from '@/screens/calendar/format';
import type { CalendarBar, TimedEvent } from '@/screens/calendar/types';
import { ALL_TASKS, instancesIn, planIds } from '../common/tasks';
import type { DataOf, Snapshot } from '../snapshot';

/** Срез хранилища для календаря: без хотелок, идей и ленты — экран не перерисовывается из-за них */
export type CalendarSnapshot = Pick<Snapshot, 'me' | 'users' | 'groups' | 'currentGroupId' | 'tasks'>;

/** Верхнюю панель (группа, кнопка профиля, точка ленты) даёт useChrome в контейнере */
type ChromeKeys = 'groupLabel' | 'me' | 'hasNews';
/** Данные экрана календаря без верхней панели, колбэков и safe area */
export type CalendarData<P> = Omit<DataOf<P>, ChromeKeys>;

const DAY_END: DayMinute = 24 * 60;
const NO_IDS: readonly ID[] = [];

/** Понедельник недели, в которой лежит дата */
export const mondayOf = (iso: IsoDate): IsoDate => isoOf(dayNo(iso) - weekday(iso));

/** Сдвиг даты на n дней */
export const shiftDay = (iso: IsoDate, n: number): IsoDate => isoOf(dayNo(iso) + n);

/** Дни периода [from, to] включительно */
export function daysBetween(from: IsoDate, to: IsoDate): IsoDate[] {
  const a = dayNo(from);
  return Array.from({ length: Math.max(0, dayNo(to) - a + 1) }, (_, i) => isoOf(a + i));
}

/** Сделано: у обычного дела doneAt, у раза серии — doneDates ∋ occ (instance уже перенёс это в doneAt) */
export const isDone = (t: Pick<Task, 'doneAt' | 'occ' | 'doneDates'>) => !!t.doneAt || (!!t.occ && !!t.doneDates?.includes(t.occ));

/** Дело видно: никто не скрыт, или хотя бы один его человек не скрыт */
export function visibleFor(hidden: readonly ID[]): (t: Pick<Task, 'people' | 'createdBy'>) => boolean {
  if (!hidden.length) return () => true;
  const off = new Set(hidden);
  return (t) => peopleOf(t).some((id) => !off.has(id));
}

/** Разы дел текущей группы в периоде (по началу); hidden — скрытые люди */
export function groupInstances(s: Pick<CalendarSnapshot, 'tasks' | 'currentGroupId' | 'groups' | 'me'>, from: IsoDate, to: IsoDate, hidden: readonly ID[] = NO_IDS): Task[] {
  if (!s.currentGroupId) return [];
  return instancesIn(scopeTasks(s.tasks, { viewId: s.currentGroupId, groups: s.groups, meId: s.me.id }), ALL_TASKS, from, to).filter(visibleFor(hidden));
}

/** Что нужно знать о планах, чтобы разложить дела: id планов и их названия (для подписи подзадач) */
export type PlanIndex = { ids: ReadonlySet<ID>; titles: ReadonlyMap<ID, string> };

export function planIndex(tasks: readonly Task[]): PlanIndex {
  const ids = planIds(tasks);
  const titles = new Map<ID, string>();
  for (const t of tasks) if (ids.has(t.id)) titles.set(t.id, t.title);
  return { ids, titles };
}

/** Полоса над сеткой: дело без времени, длиннее суток или план с подзадачами */
export const isBar = (t: Task, plans: PlanIndex) => !t.time || isLong(t) || plans.ids.has(t.id);

/** Месяц в подписях полос: «8–10 окт», «7 окт 07:00» (родительный падеж, строчными) */
const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'] as const;
const dm = (iso: IsoDate) => {
  const { m, d } = parts(iso);
  return `${d} ${MON[m - 1] ?? ''}`;
};
/** «09:00» → «09», «09:30» → «09:30» */
const hourShort = (t: string) => (t.endsWith(':00') ? t.slice(0, 2) : t);

/**
 * Приглушённая подпись полосы недели — как в макете C-Week: « · 7 окт 07:00 → 9 окт 15:00» (многодневное со временем),
 * « · 8–10 окт» (многодневное без времени), « 09–20» (план в один день со временем). Весь день — без подписи
 */
export function barMeta(t: Pick<Task, 'date' | 'time' | 'endDate' | 'endTime'>): string | undefined {
  if (!t.date) return undefined;
  const end = lastDay(t) ?? t.date;
  if (isMulti(t)) {
    if (t.time || t.endTime) {
      const edge = (date: IsoDate, time: string | null | undefined) => (time ? `${dm(date)} ${time}` : dm(date));
      return ` · ${edge(t.date, t.time)} → ${edge(t.endDate ?? end, t.endTime)}`;
    }
    const a = parts(t.date);
    const b = parts(end);
    return a.m === b.m && a.y === b.y ? ` · ${a.d}–${b.d} ${MON[b.m - 1] ?? ''}` : ` · ${dm(t.date)} – ${dm(end)}`;
  }
  if (!t.time) return undefined;
  return t.endTime && t.endTime > t.time ? ` ${hourShort(t.time)}–${hourShort(t.endTime)}` : ` ${hourShort(t.time)}`;
}

export function toBar(t: Task): CalendarBar | null {
  if (!t.date) return null;
  const meta = barMeta(t);
  return {
    id: taskKey(t),
    title: t.title,
    ...(meta ? { meta } : {}),
    startDate: t.date,
    endDate: lastDay(t) ?? t.date,
    people: peopleOf(t),
    ...(t.hidden && { hidden: true }),
    ...(t.kind && t.kind !== 'task' && { kind: t.kind }),
  };
}

/** Дело в сетке дня day: null — в этот день его в сетке нет (без времени, другой день) */
export function toTimed(t: Task, day: IsoDate, plans: PlanIndex): TimedEvent | null {
  const span = minutesOn(t, day);
  if (!span || !t.date) return null;
  const [start, end] = span;
  const parentTitle = t.parentId ? plans.titles.get(t.parentId) : undefined;
  const fromPrevDay = start === 0 && day > t.date;
  const toNextDay = end === DAY_END && day < (lastDay(t) ?? t.date);
  return {
    id: taskKey(t),
    title: t.title,
    ...(t.note?.trim() ? { note: t.note.trim() } : {}),
    start,
    end,
    people: peopleOf(t),
    ...(isDone(t) ? { done: true } : {}),
    ...(parentTitle ? { parentTitle } : {}),
    ...(fromPrevDay ? { fromPrevDay } : {}),
    ...(toNextDay ? { toNextDay } : {}),
    ...(t.hidden && { hidden: true }),
    ...(t.kind && t.kind !== 'task' && { kind: t.kind }),
  };
}

/** Полосы среди разов: план с подзадачами, без времени, длиннее суток */
export function barsOf(instances: readonly Task[], plans: PlanIndex): CalendarBar[] {
  return instances.flatMap((t) => {
    const bar = isBar(t, plans) ? toBar(t) : null;
    return bar ? [bar] : [];
  });
}

/** Дела в сетке дня, по началу (при равном начале — в порядке разов: раньше идущее левее) */
export function timedOn(instances: readonly Task[], day: IsoDate, plans: PlanIndex): TimedEvent[] {
  const out: TimedEvent[] = [];
  for (const t of instances) {
    if (isBar(t, plans)) continue;
    const e = toTimed(t, day, plans);
    if (e) out.push(e);
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Выбранный день при переходе к месяцу m (1…12): сегодня, если оно в этом месяце, иначе первое число */
export function monthAnchor(y: number, m: number, today: IsoDate): IsoDate {
  const t = parts(today);
  return t.y === y && t.m === m ? today : `${y}-${pad2(m)}-01`;
}

/** Месяц со сдвигом на n (−1 — предыдущий) */
export function shiftMonth(y: number, m: number, n: number): { y: number; m: number } {
  const i = y * 12 + (m - 1) + n;
  return { y: Math.floor(i / 12), m: (i % 12) + 1 };
}
