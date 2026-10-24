/**
 * Окно плана (C-EditPlan / -Period / -Year). Период, люди, напоминания, описание и название — в черновике, в хранилище —
 * по «СОХРАНИТЬ»; подзадачи при переносе периода не двигаются (вышедшие — «вне периода»). Отметка подзадачи — сразу
 * (это отдельные дела). field — что открыть при входе: период, описание (курсор в строке) или список подзадач.
 * Название и описание правятся прямо в окне; без названия «СОХРАНИТЬ» недоступна.
 */
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, StyleSheet, View, type TextInput } from 'react-native';
import { canSaveDraft, draftFromTask, initialUi, type EditorState } from '@/adapters/editors/draft';
import { planEditorProps } from '@/adapters/editors/planEditor';
import { useStore } from '@/lib/store';
import type { ID } from '@/lib/types';
import { PlanEditorScreen, type PlanEditorScreenProps, type PlanField } from '@/screens/editors/PlanEditorScreen';
import type { CustomReminder } from '@/screens/editors/panels/RemindPanel';
import { toPlanGrid } from '../common/go';
import { nav, type PlanEditorField } from '../common/nav';
import { signedInOnly } from '../common/signedIn';
import { useClock } from '../common/useClock';
import { useInsets } from '../common/useInsets';
import { pickSnapshot, useSnapshot } from '../common/useSnapshot';
import { CustomRemindSheet } from './EditorSheets';
import { leaveEditor, notSaved, removeTask, saveDraft, useEditorState, usePanelHandlers, type EditorContext } from './useEditorState';

export type PlanEditorContainerProps = { id: ID; field?: PlanEditorField };

const noop = () => undefined;

function initial(id: ID, field: PlanEditorField | undefined, today: string): EditorState | null {
  const s = pickSnapshot(useStore.getState());
  const plan = s.tasks.find((t) => t.id === id);
  if (!plan) return null;
  const draft = draftFromTask(plan, s);
  return { draft, ui: initialUi(draft, today, field === 'period' ? 'period' : null) };
}

export const PlanEditorContainer = signedInOnly(function PlanEditorRoot({ id, field }: PlanEditorContainerProps) {
  const clock = useClock();
  const [start] = useState(() => initial(id, field, clock.today));
  useEffect(() => {
    if (!start) leaveEditor();
  }, [start]);
  return start ? <PlanEditor start={start} openNote={field === 'note'} /> : null;
});

function PlanEditor({ start, openNote }: { start: EditorState; openNote: boolean }) {
  const s = useSnapshot();
  const clock = useClock();
  const insets = useInsets();
  const { state, dispatch, latest } = useEditorState(() => start);
  const [custom, setCustom] = useState<CustomReminder | null>(null);
  const closeCustom = useCallback(() => setCustom(null), []);
  const titleRef = useRef<TextInput>(null);
  const noteRef = useRef<TextInput>(null);

  // Открыли «на описании» — курсор сразу в строке «ОПИСАНИЕ»
  useEffect(() => {
    if (openNote) noteRef.current?.focus();
  }, [openNote]);

  const ctx = useRef<EditorContext>({ today: clock.today, snapshot: s });
  ctx.current = { today: clock.today, snapshot: s };

  // У плана повтора нет — «ДО ДАТЫ» не выбирается
  const handlers = usePanelHandlers({ dispatch, latest, ctx, onPickUntil: noop, onCustom: setCustom });

  const planId = start.draft.id ?? '';

  const onField = useCallback(
    (f: PlanField) => {
      switch (f) {
        case 'note':
          return noteRef.current?.focus();
        // Сводка подзадач — свернуть раскрытую строку, под полями снова список
        case 'subtasks':
          return dispatch({ type: 'collapse' });
        // У плана повтора нет
        case 'repeat':
          return;
        default:
          return dispatch({ type: 'toggle', field: f, today: ctx.current.today });
      }
    },
    [dispatch],
  );

  const onToggleSubtask = useCallback((id: ID, done: boolean) => {
    const st = useStore.getState();
    const t = st.tasks.find((x) => x.id === id);
    if (t && !!t.doneAt !== done) st.toggleTask(id);
  }, []);
  const onOpenSubtask = useCallback((id: ID) => {
    Keyboard.dismiss();
    router.push(nav.taskEditor({ id }));
  }, []);
  const onAddSubtask = useCallback(() => {
    Keyboard.dismiss();
    router.push(nav.taskEditor({ parentId: planId, date: latest.current.draft.date }));
  }, [planId, latest]);
  // Сетка — во вкладке «Дела»: окно закрывается, под ним уже открытые вкладки (не второй (tabs); QA-1 С3)
  const onOpenGrid = useCallback(() => {
    Keyboard.dismiss();
    toPlanGrid(planId);
  }, [planId]);
  const onDelete = useCallback(() => removeTask(planId), [planId]);
  const onSave = useCallback(() => {
    const d = latest.current.draft;
    // Кнопка без названия недоступна; на всякий случай — курсор в заголовок
    if (!canSaveDraft(d)) return titleRef.current?.focus();
    if (!saveDraft(d)) return notSaved(d);
    leaveEditor();
  }, [latest]);
  const onMore = useCallback(() => {
    const d = latest.current.draft;
    useStore.getState().setMenu({
      title: d.title.trim() || 'План',
      actions: [
        { label: 'План сеткой', onPress: onOpenGrid },
        { label: 'Удалить план', danger: true, onPress: onDelete },
      ],
    });
  }, [latest, onOpenGrid, onDelete]);
  const onChangeTitle = useCallback((title: string) => dispatch({ type: 'title', title }), [dispatch]);
  const onChangeNote = useCallback((note: string) => dispatch({ type: 'note', note }), [dispatch]);

  const data = useMemo(() => planEditorProps(state.draft, state.ui, s, clock), [state, s, clock]);
  const screen = useMemo<PlanEditorScreenProps>(
    () => ({
      ...data,
      periodPanel: data.periodPanel && { ...data.periodPanel, ...handlers.period },
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
      onToggleSubtask,
      onOpenSubtask,
      onAddSubtask,
      onOpenGrid,
      onDelete,
      onSave,
    }),
    [data, handlers, insets, onMore, onChangeTitle, onChangeNote, onField, onToggleSubtask, onOpenSubtask, onAddSubtask, onOpenGrid, onDelete, onSave],
  );

  return (
    <View style={styles.fill}>
      <PlanEditorScreen {...screen} />
      <CustomRemindSheet kind={custom} bottomInset={insets.bottom} onAdd={handlers.addReminder} onClose={closeCustom} />
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
