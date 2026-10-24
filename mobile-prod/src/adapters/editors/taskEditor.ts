/**
 * Окно дела (C-EditDate, C-EditRepeat, C-EditRemind, C-EditWho): черновик + что раскрыто → данные TaskEditorScreen.
 */
import { visibleField, visibleGroups } from './visible';
import { PERSONAL } from '@/lib/visibility';
import type { ID, PersonColor } from '@/lib/types';
import type { EditorNotice } from '@/screens/editors/components/EditorScaffold';
import type { EditorPersonRef, TaskEditorScreenProps, TaskField } from '@/screens/editors/TaskEditorScreen';
import type { Clock, DataOf, Snapshot } from '../snapshot';
import { busyFor } from '../common/busy';
import { colorMap, colorOf, editorPerson, userOf, type ColorMap } from '../common/people';
import { busyLabel, upper } from '../common/ru';
import { kidsOf } from '../common/tasks';
import { whenLabel } from '../common/when';
import { canSaveDraft, draftPeople, noteValue, type EditorDraft, type EditorField, type EditorUi } from './draft';
import { endLabel, remindSummary, repeatText, subtaskSummary } from './labels';
import { mySpecs, remindPanel, repeatPanel, whenPanel, whoPanel } from './panels';

export type TaskEditorData = DataOf<TaskEditorScreenProps>;

const TASK_FIELDS: ReadonlySet<EditorField> = new Set<TaskField>(['when', 'end', 'repeat', 'who', 'visible', 'remind', 'note', 'subtasks']);
const isTaskField = (f: EditorField | null): f is TaskField => f !== null && TASK_FIELDS.has(f);

/** «ДЕЛО · МЫ С КАРИНОЙ», «ПЛАН · …» */
export function editorCaption(kind: 'ДЕЛО' | 'ПЛАН', s: Pick<Snapshot, 'groups' | 'users' | 'me'>, groupId: ID | null, ownerId?: ID): string {
  // Личное — имя владельца (макет C-EditVisible: «ДЕЛО · САНЯ»)
  const name =
    groupId === PERSONAL ? (ownerId && ownerId !== s.me.id ? s.users.find((u) => u.id === ownerId)?.name : s.me.name) : groupId ? s.groups.find((g) => g.id === groupId)?.name : undefined;
  return name ? `${kind} · ${upper(name)}` : kind;
}

/** Люди черновика: выбранные (метки «КТО») и их цвета (полоса у заголовка) */
export function draftPeopleRefs(d: EditorDraft, s: Snapshot, colors: ColorMap): { people: EditorPersonRef[]; colors: PersonColor[] } {
  const ids = draftPeople(d);
  return {
    people: ids.flatMap((id) => {
      const p = editorPerson(s, colors, id);
      return p ? [p] : [];
    }),
    colors: ids.map((id) => colorOf(colors, id)),
  };
}

/** Первое пересечение с делами участников: «КАРИНА ЗАНЯТА · Йога · 19:00–20:00» красным */
export function busyNotice(d: EditorDraft, s: Snapshot): EditorNotice | null {
  const [first] = busyFor(s, d, draftPeople(d), d.id);
  const user = first ? userOf(s, first.personId) : undefined;
  return first && user ? { label: busyLabel(user), text: `${first.title} · ${first.range}`, tone: 'red' } : null;
}

/**
 * Строка «ПОДЗАДАЧИ»: у плана — «05 · 1 СДЕЛАНО», у обычного дела — null («+ ПЛАН»);
 * у серии и у подзадачи строки нет (undefined)
 */
export function subtasksField(d: EditorDraft, s: Pick<Snapshot, 'tasks'>): string | null | undefined {
  if (d.repeat || d.parentId) return undefined;
  const kids = d.id ? kidsOf(s.tasks, d.id) : [];
  return kids.length ? subtaskSummary(kids.length, kids.filter((t) => t.doneAt).length) : null;
}

export function taskEditorProps(d: EditorDraft, ui: EditorUi, s: Snapshot, clock: Pick<Clock, 'today'>): TaskEditorData {
  const colors = colorMap(s);
  const refs = draftPeopleRefs(d, s, colors);
  const expanded = isTaskField(ui.expanded) ? ui.expanded : null;
  const visible = visibleField(d, s);
  return {
    caption: editorCaption('ДЕЛО', s, d.groupId, d.createdBy),
    title: d.title,
    colors: refs.colors,
    when: whenLabel(d.date, d.time),
    end: endLabel(d),
    repeat: d.repeat && d.date ? repeatText(d.repeat, d.date) : null,
    people: refs.people,
    ...(visible !== undefined && { visible }),
    remind: remindSummary(mySpecs(d, s.reminders), d.time),
    note: noteValue(d),
    subtasks: subtasksField(d, s),
    notice: busyNotice(d, s),
    saveDisabled: !canSaveDraft(d),
    expanded,
    ...(expanded === 'when' && { whenPanel: whenPanel(d, ui, clock) }),
    ...(expanded === 'repeat' && { repeatPanel: repeatPanel(d, ui, clock) }),
    ...(expanded === 'remind' && { remindPanel: remindPanel(d, ui, s.reminders) }),
    ...(expanded === 'who' && { whoPanel: whoPanel(d, ui, s, colors) }),
    ...(expanded === 'visible' && visible !== undefined && { visiblePanel: { onlyMe: d.only, groups: visibleGroups(d, s) } }),
  };
}
