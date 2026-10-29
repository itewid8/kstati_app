/**
 * C-List: дела текущей группы списком по разделам ПРОШЛО / СЕГОДНЯ / БЕЗ ДАТЫ / ЗАВТРА / НЕДЕЛЯ / ПОЗЖЕ.
 * Все дела вида, сделанные — зачёркнутыми. У серии — все отмеченные разы и ближайший неотмеченный, план — строкой с подзадачами.
 */
import { PERSONAL, PERSONAL_NAME, scopeTasks } from '@/lib/visibility';
import { dayNo, isoOf, type IsoDate } from '@/lib/calendarLayout';
import { sortKey } from '@/lib/dates';
import { listInstances, taskKey } from '@/lib/recur';
import { lastDay, peopleOf } from '@/lib/span';
import type { PersonColor, Task } from '@/lib/types';
import { pad2, weekday } from '@/screens/calendar/format';
import type { Owners, PlanItem, PlanStep, TaskItem, TaskListEntry, TaskSection, TasksListScreenProps } from '@/screens/lists/TasksListScreen';
import { colorOf, meBadge, type ColorMap } from '../common/people';
import { upper } from '../common/ru';
import { kidsOf, planIds } from '../common/tasks';
import { dayMonthShort, dayShort, rangeDays } from '../common/when';
import type { Clock, DataOf, Snapshot } from '../snapshot';

export type ListSection = 'past' | 'today' | 'none' | 'tomorrow' | 'week' | 'later' | 'done';

export const LIST_SECTIONS: readonly ListSection[] = ['past', 'today', 'none', 'tomorrow', 'week', 'later', 'done'];

/** Свёрнуты, пока их не раскрыли (хранилище: collapsedSections) */
export const COLLAPSED_BY_DEFAULT: readonly ListSection[] = ['past', 'done'];

const LABEL: Record<ListSection, string> = {
  past: 'ПРОШЛО',
  today: 'СЕГОДНЯ',
  none: 'БЕЗ ДАТЫ',
  tomorrow: 'ЗАВТРА',
  week: 'НЕДЕЛЯ',
  later: 'ПОЗЖЕ',
  done: 'СДЕЛАНО',
};

type Span = Pick<Task, 'date' | 'time' | 'endDate' | 'endTime'>;

/**
 * Раздел дела относительно сегодня. Сегодняшние дела остаются в СЕГОДНЯ и после своего времени (как в макете C-List),
 * многодневное, которое идёт сегодня, — тоже. НЕДЕЛЯ — до воскресенья этой недели
 */
export function sectionOf(t: Span, today: IsoDate): ListSection {
  if (!t.date) return 'none';
  const diff = dayNo(t.date) - dayNo(today);
  if (diff < 0) return (lastDay(t) ?? t.date) >= today ? 'today' : 'past';
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  return diff <= 6 - weekday(today) ? 'week' : 'later';
}

/** Подпись справа в шапке раздела: «ПН 05», «ВТ 06», «07—11»; у разделов без своих дат — число дел */
function sectionDate(section: ListSection, today: IsoDate, count: number): string {
  const t = dayNo(today);
  switch (section) {
    case 'today':
      return dayShort(today);
    case 'tomorrow':
      return dayShort(isoOf(t + 1));
    case 'week':
      return rangeDays(isoOf(t + 2), isoOf(t + 6 - weekday(today)), { pad: true });
    default:
      return pad2(count);
  }
}

/** Время в строке: в СЕГОДНЯ и ЗАВТРА — «09:30» / «—», в НЕДЕЛЕ — день «СБ 10», дальше и раньше — «17 ОКТ» */
function timeCell(t: Task, section: ListSection): string {
  if (!t.date) return '—';
  if (section === 'today' || section === 'tomorrow') return t.time ?? '—';
  return section === 'week' ? dayShort(t.date) : dayMonthShort(t.date);
}

const ownersOf = (t: Task, colors: ColorMap): Owners => {
  const [a = t.createdBy, b] = peopleOf(t);
  const first: PersonColor = colorOf(colors, a);
  return b ? [first, colorOf(colors, b)] : [first];
};


function planItem(plan: Task, kids: Task[], colors: ColorMap): PlanItem {
  const steps: PlanStep[] = kids.map((k) => ({ id: k.id, title: k.title, when: k.date ? dayShort(k.date) : '—', done: !!k.doneAt }));
  const done = steps.filter((st) => st.done).length;
  const [owner = plan.createdBy] = peopleOf(plan);
  return {
    kind: 'plan',
    id: plan.id,
    title: plan.title,
    progress: steps.length ? `${done}/${steps.length}` : undefined,
    range: plan.date ? rangeDays(plan.date, lastDay(plan) ?? plan.date) : '—',
    color: colorOf(colors, owner),
    steps,
  };
}

const taskItem = (t: Task, section: ListSection, colors: ColorMap): TaskItem => ({
  kind: 'task',
  id: taskKey(t),
  title: t.title,
  time: timeCell(t, section),
  owners: ownersOf(t, colors),
  done: !!t.doneAt,
  ...(t.hidden && { hidden: true }),
  ...(t.kind && t.kind !== 'task' && { taskType: t.kind }),
});

/** Разделы списка: пустые не показываются. id строки дела — taskKey («id@дата» у раза серии), шага плана — id подзадачи */
export function tasksListSections(
  s: Pick<Snapshot, 'tasks' | 'currentGroupId' | 'groups' | 'me'>,
  colors: ColorMap,
  clock: Pick<Clock, 'today'>,
  collapsed: readonly string[] = [],
): TaskSection[] {
  const { today } = clock;
  const tasks = scopeTasks(s.tasks, { viewId: s.currentGroupId, groups: s.groups, meId: s.me.id });
  const plans = planIds(tasks);
  const own = new Set(tasks.map((t) => t.id));
  const by = new Map<ListSection, Task[]>();
  // Все дела вида, сделанные — зачёркнутыми; у серии — все отмеченные разы и ближайший неотмеченный
  for (const t of listInstances(tasks, today, '')) {
    // Подзадачи — под своим планом
    if (t.parentId && own.has(t.parentId)) continue;
    // Сделанное из прошлого и без даты — в СДЕЛАНО (свёрнуто); сегодняшнее и будущее — на месте зачёркнутым
    const at = sectionOf(t, today);
    const section: ListSection = t.doneAt && (at === 'past' || at === 'none') ? 'done' : at;
    by.set(section, [...(by.get(section) ?? []), t]);
  }
  return LIST_SECTIONS.flatMap((section) => {
    const list = by.get(section);
    if (!list?.length) return [];
    const sorted =
      section === 'none'
        ? [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        : section === 'done'
          ? // Свежие сверху, без даты — по времени отметки
            [...list].sort((a, b) => (b.date ?? b.doneAt ?? '').localeCompare(a.date ?? a.doneAt ?? ''))
          : [...list].sort((a, b) => sortKey(a.date, a.time).localeCompare(sortKey(b.date, b.time)));
    const items: TaskListEntry[] = sorted.map((t) =>
      plans.has(t.id) ? planItem(t, kidsOf(tasks, t.id), colors) : taskItem(t, section, colors),
    );
    return [{ id: section, label: LABEL[section], date: sectionDate(section, today, items.length), items, collapsed: collapsed.includes(section) }];
  });
}

/** Срез хранилища списка дел: правки хотелок, идей и «Смотреть» список не пересчитывают */
export type TasksListSnapshot = Pick<Snapshot, 'me' | 'groups' | 'currentGroupId' | 'tasks' | 'activity' | 'activitySeen'> & { collapsedSections: readonly string[] };

export function tasksListProps(s: TasksListSnapshot, colors: ColorMap, clock: Pick<Clock, 'today'>): DataOf<TasksListScreenProps> {
  const group = s.groups.find((g) => g.id === s.currentGroupId);
  return {
    groupLabel: upper(s.currentGroupId === PERSONAL ? PERSONAL_NAME : (group?.name ?? '')),
    me: meBadge(s, colors),
    hasNews: (s.activity[0]?.id ?? '') > s.activitySeen,
    sections: tasksListSections(s, colors, clock, s.collapsedSections),
  };
}
