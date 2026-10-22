/**
 * Окно плана (C-EditPlan, C-EditPeriod, C-EditYear): черновик плана + что раскрыто → данные PlanEditorScreen.
 * Период правится в черновике, подзадачи не двигаются (DECISIONS.md): вышедшие за новый период — «вне периода».
 * В макетах при раскрытой строке описание и список подзадач свёрнуты в сводку (а в виде года — и сводка),
 * чтобы всё помещалось над кнопками.
 */
import { shortDate } from '@/lib/dates';
import { lastDay } from '@/lib/span';
import type { Task } from '@/lib/types';
import type { EditorNotice } from '@/screens/editors/components/EditorScaffold';
import type { SubtaskItem } from '@/screens/editors/components/SubtaskBox';
import type { PlanEditorScreenProps, PlanField } from '@/screens/editors/PlanEditorScreen';
import type { Clock, DataOf, Snapshot } from '../snapshot';
import { colorMap, colorOf } from '../common/people';
import { kidsOf } from '../common/tasks';
import { periodLabel } from '../common/when';
import type { EditorDraft, EditorField, EditorUi } from './draft';
import { remindSummary, subtaskMeta, subtaskSummary } from './labels';
import { mySpecs, periodPanel, remindPanel, whoPanel } from './panels';
import { draftPeopleRefs, editorCaption } from './taskEditor';

export type PlanEditorData = DataOf<PlanEditorScreenProps>;

/** У плана повтора нет — строка «ПОВТОР» не раскрывается */
const PLAN_FIELDS: ReadonlySet<EditorField> = new Set<PlanField>(['period', 'who', 'remind', 'note', 'subtasks']);
const isPlanField = (f: EditorField | null): f is PlanField => f !== null && PLAN_FIELDS.has(f);

/** Подзадача вне [начало, последний день] периода черновика */
export function outsidePeriod(t: Pick<Task, 'date'>, d: Pick<EditorDraft, 'date' | 'time' | 'endDate' | 'endTime'>): boolean {
  if (!t.date || !d.date) return false;
  return t.date < d.date || t.date > (lastDay(d) ?? d.date);
}

export function planSubtasks(d: EditorDraft, s: Pick<Snapshot, 'tasks'>): { items: SubtaskItem[]; kids: Task[] } {
  const kids = d.id ? kidsOf(s.tasks, d.id) : [];
  const items = kids.map((t): SubtaskItem => {
    const outside = outsidePeriod(t, d);
    const item = { id: t.id, title: t.title, meta: subtaskMeta(t, outside), done: !!t.doneAt };
    return outside ? { ...item, outside: true } : item;
  });
  return { items, kids };
}

/** Первая подзадача вне периода: «ВНЕ ПЕРИОДА · «Сувениры маме» · сб 10 окт» */
export function outsideNotice(d: EditorDraft, kids: readonly Task[]): EditorNotice | null {
  const out = kids.find((t) => outsidePeriod(t, d));
  return out?.date ? { label: 'ВНЕ ПЕРИОДА', text: `«${out.title}» · ${shortDate(out.date)}`, tone: 'warn' } : null;
}

export function planEditorProps(d: EditorDraft, ui: EditorUi, s: Snapshot, clock: Pick<Clock, 'today'>): PlanEditorData {
  const colors = colorMap(s);
  const refs = draftPeopleRefs(d, s, colors);
  const color = refs.colors[0] ?? colorOf(colors, s.me.id);
  const expanded = isPlanField(ui.expanded) ? ui.expanded : null;
  const { items, kids } = planSubtasks(d, s);
  const yearView = expanded === 'period' && ui.dateView === 'year';
  const notice = outsideNotice(d, kids);
  return {
    caption: editorCaption('ПЛАН', s, d.groupId),
    title: d.title,
    colors: refs.colors,
    color,
    period: periodLabel(d),
    repeat: null,
    people: refs.people,
    remind: remindSummary(mySpecs(d, s.reminders), d.time),
    expanded,
    // Ничего не раскрыто — описание и список подзадач; раскрыто — сводка и плашка «вне периода»; вид года — ничего
    ...(expanded === null && { note: d.note.trim() || null, subtasks: items }),
    ...(expanded !== null && !yearView && { subtaskSummary: subtaskSummary(items.length, items.filter((i) => i.done).length) }),
    ...(expanded !== null && !yearView && notice && { notice }),
    ...(expanded === 'period' && { periodPanel: periodPanel(d, ui, clock, color) }),
    ...(expanded === 'remind' && { remindPanel: remindPanel(d, ui, s.reminders) }),
    ...(expanded === 'who' && { whoPanel: whoPanel(d, ui, s, colors) }),
  };
}
