/**
 * Окно дела (C-EditDate / -Repeat / -Remind / -Who). Правки — в черновике (useEditorState), в хранилище — по «СОХРАНИТЬ»;
 * «назад» ничего не меняет. Новое дело: из «+», из календаря (date, time), подзадача плана (parentId),
 * из голоса (s.editorSeed — забираем при открытии). Открытый раз серии (occ) правит всю серию.
 * Новое дело открывается чистым шаблоном, без окон поверх: название и описание правятся прямо в окне,
 * «СОХРАНИТЬ» недоступна, пока нет названия.
 */
import { router, useNavigation } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, StyleSheet, View, type TextInput } from 'react-native';
import { canSaveDraft, draftFromSeed, draftFromTask, emptyDraft, initialUi, type EditorState } from '@/adapters/editors/draft';
import { endLabel } from '@/adapters/editors/labels';
import { taskEditorProps } from '@/adapters/editors/taskEditor';
import { colorOf } from '@/adapters/common/people';
import { kidsOf } from '@/adapters/common/tasks';
import type { IsoDate } from '@/lib/calendarLayout';
import { shortDate } from '@/lib/dates';
import { nextOpen } from '@/lib/recur';
import { useStore, type MenuAction } from '@/lib/store';
import type { ID, Task } from '@/lib/types';
import { canEditTask } from '@/lib/visibility';
import type { CustomReminder } from '@/screens/editors/panels/RemindPanel';
import { TaskEditorScreen, type TaskEditorScreenProps, type TaskField } from '@/screens/editors/TaskEditorScreen';
import { openPlanEditor } from '../common/go';
import { nav, type TaskEditorField } from '../common/nav';
import { signedInOnly } from '../common/signedIn';
import { useClock } from '../common/useClock';
import { useInsets } from '../common/useInsets';
import { usePersonColors } from '../common/usePersonColors';
import { pickSnapshot, useSnapshot } from '../common/useSnapshot';
import { CustomRemindSheet, EndSheet, UntilSheet } from './EditorSheets';
import {
  endSeriesBefore,
  leaveEditor,
  notSaved,
  removeTask,
  saveDraft,
  useEditorState,
  usePanelHandlers,
  type EditorContext,
} from './useEditorState';

/** field — строка, раскрытая при открытии (ДАТА… из быстрых действий) */
export type TaskEditorContainerProps = { id: ID | null; occ?: string; date?: string; time?: string; parentId?: ID; field?: TaskEditorField };

/** Нижние окна, для которых нет места в строках: конец дела, дата окончания повтора */
type Sheet = 'end' | 'until';

/** Черновик при открытии: голос (seed) → существующее дело → новое. null — дела уже нет */
function initial(props: TaskEditorContainerProps, today: string): EditorState | null {
  const st = useStore.getState();
  const s = pickSnapshot(st);
  const seed = st.editorSeed;
  const task = props.id ? s.tasks.find((t) => t.id === props.id) : undefined;
  const draft =
    seed && (!props.id || seed.id === props.id)
      ? draftFromSeed(seed, s)
      : task
        ? draftFromTask(task, s, props.occ)
        : props.id
          ? null
          : emptyDraft(s, { date: props.date, time: props.time, parentId: props.parentId });
  return draft ? { draft, ui: initialUi(draft, today, props.field ?? null) } : null;
}

/** Раз серии для «только этот раз» и «этот и все следующие»: открытый в окне, иначе ближайший несделанный */
type SeriesRef = { occ: IsoDate; opened: boolean };

function seriesRef(task: Task, occ: IsoDate | null, today: IsoDate): SeriesRef | null {
  if (occ) return { occ, opened: true };
  const next = nextOpen(task, today);
  return next ? { occ: next, opened: false } : null;
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Удаление серии — всегда с вопросом, даже если окно открыто без раза (лента, план, «Изменить»; QA-1 М2, М3):
 * только этот (ближайший) раз / этот и все следующие (как в старом приложении) / все повторы.
 * verb — подписи пунктов меню «⋯» («Удалить …»); без него — пункты окна «Удалить «…»?»
 */
function seriesDeleteActions(task: Task, ref: SeriesRef | null, verb: boolean): MenuAction[] {
  const prefix = verb ? 'удалить ' : '';
  const all: MenuAction = { label: capital(`${prefix}все повторы`), danger: true, onPress: () => removeTask(task.id) };
  if (!ref) return [all];
  const one = ref.opened ? 'этот раз' : `ближайший · ${shortDate(ref.occ)}`;
  const rest = ref.opened ? 'этот и все следующие' : 'ближайший и все следующие';
  return [
    { label: capital(`${prefix}только ${one}`), danger: true, onPress: () => removeTask(task.id, ref.occ) },
    { label: capital(`${prefix}${rest}`), danger: true, onPress: () => endSeriesBefore(task.id, ref.occ) },
    all,
  ];
}

export const TaskEditorContainer = signedInOnly(function TaskEditorRoot(props: TaskEditorContainerProps) {
  const clock = useClock();
  const [start] = useState(() => initial(props, clock.today));
  // Дело удалили (или его ещё нет на телефоне) — окно сразу закрывается
  useEffect(() => {
    if (!start) leaveEditor();
  }, [start]);
  return start ? <TaskEditor start={start} /> : null;
});

function TaskEditor({ start }: { start: EditorState }) {
  const s = useSnapshot();
  const clock = useClock();
  const insets = useInsets();
  const navigation = useNavigation();
  const colors = usePersonColors(s);
  const { state, dispatch, latest } = useEditorState(() => start);
  const { draft } = state;
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const titleRef = useRef<TextInput>(null);
  const noteRef = useRef<TextInput>(null);
  const [custom, setCustom] = useState<CustomReminder | null>(null);
  const closeSheet = useCallback(() => setSheet(null), []);
  const closeCustom = useCallback(() => setCustom(null), []);

  // Черновик из голоса забран — в хранилище он больше не нужен
  useEffect(() => {
    if (useStore.getState().editorSeed) useStore.getState().setEditorSeed(null);
  }, []);

  const ctx = useRef<EditorContext>({ today: clock.today, snapshot: s });
  ctx.current = { today: clock.today, snapshot: s };

  const handlers = usePanelHandlers({
    dispatch,
    latest,
    ctx,
    onPickUntil: useCallback(() => setSheet('until'), []),
    onCustom: setCustom,
  });

  /** Сохранить и сделать планом: окно плана, поверх — новая подзадача. Не сохранилось (нет группы) — окно остаётся */
  const makePlan = useCallback(() => {
    const d = latest.current.draft;
    // Без названия — сначала назвать: курсор в заголовок
    if (!canSaveDraft(d)) return titleRef.current?.focus();
    Keyboard.dismiss();
    const id = saveDraft(d);
    if (!id) return notSaved(d);
    router.replace(nav.planEditor(id));
    router.push(nav.taskEditor({ parentId: id, date: d.date }));
  }, [latest]);

  /** Окно плана: уже открытое ниже (подзадачу открыли из него) — назад к нему, иначе новое */
  const openPlan = useCallback(
    (planId: ID) => {
      Keyboard.dismiss();
      openPlanEditor(navigation.getState(), planId);
    },
    [navigation],
  );

  const onField = useCallback(
    (field: TaskField) => {
      const d = latest.current.draft;
      switch (field) {
        case 'note':
          return noteRef.current?.focus();
        case 'end':
          // Без даты конца нет — сначала «КОГДА»
          if (!d.date) return dispatch({ type: 'toggle', field: 'when', today: ctx.current.today });
          dispatch({ type: 'initEnd' });
          dispatch({ type: 'collapse' });
          return setSheet('end');
        case 'subtasks':
          if (d.id && kidsOf(useStore.getState().tasks, d.id).length) return openPlan(d.id);
          return makePlan();
        default:
          return dispatch({ type: 'toggle', field, today: ctx.current.today });
      }
    },
    [dispatch, latest, makePlan, openPlan],
  );

  const onSave = useCallback(() => {
    const d = latest.current.draft;
    // Кнопка без названия недоступна; на всякий случай — курсор в заголовок
    if (!canSaveDraft(d)) return titleRef.current?.focus();
    // Новое дело без группы не сохраняется — не закрываем окно молча
    if (!saveDraft(d)) return notSaved(d);
    leaveEditor();
  }, [latest]);

  const onDelete = useCallback(() => {
    const d = latest.current.draft;
    const st = useStore.getState();
    const task = d.id ? st.tasks.find((t) => t.id === d.id) : undefined;
    if (!task) return leaveEditor();
    if (!task.repeat || !task.date) return removeTask(task.id);
    st.setMenu({ title: `Удалить «${task.title}»?`, actions: seriesDeleteActions(task, seriesRef(task, d.occ, ctx.current.today), false) });
  }, [latest]);

  const onMore = useCallback(() => {
    const d = latest.current.draft;
    const st = useStore.getState();
    const task = d.id ? st.tasks.find((t) => t.id === d.id) : undefined;
    const kids = d.id ? kidsOf(st.tasks, d.id).length : 0;
    const actions: MenuAction[] = [];
    const planId = d.parentId ?? (task && kids ? task.id : null);
    if (planId) actions.push({ label: 'Открыть план', onPress: () => openPlan(planId) });
    else if (!d.repeat) actions.push({ label: 'Сделать планом', onPress: makePlan });
    if (d.date) actions.push({ label: 'Без даты', onPress: () => dispatch({ type: 'clearDate' }) });
    if (task?.repeat && task.date) actions.push(...seriesDeleteActions(task, seriesRef(task, d.occ, ctx.current.today), true));
    else if (task) actions.push({ label: 'Удалить', danger: true, onPress: () => removeTask(task.id) });
    if (actions.length) st.setMenu({ title: d.title.trim() || 'Дело', actions });
  }, [dispatch, latest, makePlan, openPlan]);

  const onClearEnd = useCallback(() => dispatch({ type: 'clearEnd' }), [dispatch]);
  const onChangeTitle = useCallback((title: string) => dispatch({ type: 'title', title }), [dispatch]);
  const onChangeNote = useCallback((note: string) => dispatch({ type: 'note', note }), [dispatch]);
  const onUntil = useCallback((until: string) => dispatch({ type: 'repeatEdit', edit: { kind: 'until', until } }), [dispatch]);

  const data = useMemo(() => taskEditorProps(state.draft, state.ui, s, clock), [state, s, clock]);
  // Чужое дело без прав админа: править можно только свои напоминания (сервер всё равно примет лишь «сделано»)
  const editable = useMemo(() => {
    const task = state.draft.id ? s.tasks.find((t) => t.id === state.draft.id) : undefined;
    return !task || canEditTask(task, s.groups, s.me.id);
  }, [state.draft.id, s]);
  const remindOnly = useCallback((field: TaskField) => (field === 'remind' ? onField(field) : undefined), [onField]);
  const screen = useMemo<TaskEditorScreenProps>(
    () => ({
      ...data,

      whenPanel: data.whenPanel && { ...data.whenPanel, ...handlers.when },
      repeatPanel: data.repeatPanel && { ...data.repeatPanel, ...handlers.repeat },
      remindPanel: data.remindPanel && { ...data.remindPanel, ...handlers.remind },
      whoPanel: data.whoPanel && { ...data.whoPanel, ...handlers.who },
      visiblePanel: data.visiblePanel && { ...data.visiblePanel, ...handlers.visible },
      insets,
      titleRef,
      noteRef,
      onBack: leaveEditor,
      onMore,
      onChangeTitle,
      onChangeNote,
      onField,
      onClearEnd,
      onDelete,
      onSave,
      ...(!editable && {
        onChangeTitle: undefined,
        onChangeNote: undefined,
        onField: remindOnly,
        onMore: undefined,
        onDelete: undefined,
        onClearEnd: undefined,
      }),
    }),
    [data, handlers, insets, onMore, onChangeTitle, onChangeNote, onField, onClearEnd, onDelete, onSave, editable, remindOnly],
  );

  const color = colorOf(colors, draft.people[0] ?? draft.createdBy);

  return (
    <View style={styles.fill}>
      <TaskEditorScreen {...screen} />
      <EndSheet
        visible={sheet === 'end'}
        draft={draft}
        label={endLabel(draft) ?? data.when}
        color={color}
        today={clock.today}
        bottomInset={insets.bottom}
        dispatch={dispatch}
        onClose={closeSheet}
      />
      <UntilSheet
        visible={sheet === 'until'}
        until={draft.repeat?.until ?? null}
        from={draft.date ?? clock.today}
        today={clock.today}
        bottomInset={insets.bottom}
        onPick={onUntil}
        onClose={closeSheet}
      />
      <CustomRemindSheet kind={custom} bottomInset={insets.bottom} onAdd={handlers.addReminder} onClose={closeCustom} />
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
