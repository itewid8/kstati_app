/**
 * Окно плана (C-EditPlan / -Period / -Year). Период, люди, напоминания, описание и название — в черновике, в хранилище —
 * по «СОХРАНИТЬ»; подзадачи при переносе периода не двигаются (вышедшие — «вне периода»). Отметка подзадачи — сразу
 * (это отдельные дела). field — что открыть при входе: период, описание или список подзадач.
 */
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { draftFromTask, initialUi, type EditorState } from '@/adapters/editors/draft';
import { planEditorProps } from '@/adapters/editors/planEditor';
import { useStore } from '@/lib/store';
import type { ID } from '@/lib/types';
import { PlanEditorScreen, type PlanEditorScreenProps, type PlanField } from '@/screens/editors/PlanEditorScreen';
import type { CustomReminder } from '@/screens/editors/panels/RemindPanel';
import { InputSheet } from '@/ui';
import { toPlanGrid } from '../common/go';
import { nav, type PlanEditorField } from '../common/nav';
import { signedInOnly } from '../common/signedIn';
import { useClock } from '../common/useClock';
import { useInsets } from '../common/useInsets';
import { pickSnapshot, useSnapshot } from '../common/useSnapshot';
import { CustomRemindSheet } from './EditorSheets';
import { leaveEditor, notSaved, removeTask, saveDraft, useEditorState, usePanelHandlers, type EditorContext } from './useEditorState';

export type PlanEditorContainerProps = { id: ID; field?: PlanEditorField };

type Sheet = 'title' | 'note';

const TITLE_MAX = 200;
const NOTE_MAX = 2000;

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
  const { draft } = state;
  const [sheet, setSheet] = useState<Sheet | null>(openNote ? 'note' : null);
  const [custom, setCustom] = useState<CustomReminder | null>(null);
  const closeSheet = useCallback(() => setSheet(null), []);
  const closeCustom = useCallback(() => setCustom(null), []);

  const ctx = useRef<EditorContext>({ today: clock.today, snapshot: s });
  ctx.current = { today: clock.today, snapshot: s };

  const handlers = usePanelHandlers({ dispatch, latest, ctx, onPickUntil: closeSheet, onCustom: setCustom });

  const planId = start.draft.id ?? '';

  const onField = useCallback(
    (f: PlanField) => {
      switch (f) {
        case 'note':
          return setSheet('note');
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
  const onOpenSubtask = useCallback((id: ID) => router.push(nav.taskEditor({ id })), []);
  const onAddSubtask = useCallback(
    () => router.push(nav.taskEditor({ parentId: planId, date: latest.current.draft.date })),
    [planId, latest],
  );
  // Сетка — во вкладке «Дела»: окно закрывается, под ним уже открытые вкладки (не второй (tabs); QA-1 С3)
  const onOpenGrid = useCallback(() => toPlanGrid(planId), [planId]);
  const onDelete = useCallback(() => removeTask(planId), [planId]);
  const onSave = useCallback(() => {
    const d = latest.current.draft;
    if (!d.title.trim()) return setSheet('title');
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
  const onEditTitle = useCallback(() => setSheet('title'), []);
  const onTitle = useCallback(
    (title: string) => {
      dispatch({ type: 'title', title });
      setSheet(null);
    },
    [dispatch],
  );
  const onNote = useCallback(
    (note: string) => {
      dispatch({ type: 'note', note });
      setSheet(null);
    },
    [dispatch],
  );

  const data = useMemo(() => planEditorProps(state.draft, state.ui, s, clock), [state, s, clock]);
  const screen = useMemo<PlanEditorScreenProps>(
    () => ({
      ...data,
      periodPanel: data.periodPanel && { ...data.periodPanel, ...handlers.period },
      remindPanel: data.remindPanel && { ...data.remindPanel, ...handlers.remind },
      whoPanel: data.whoPanel && { ...data.whoPanel, ...handlers.who },
      insets,
      onBack: leaveEditor,
      onMore,
      onEditTitle,
      onField,
      onToggleSubtask,
      onOpenSubtask,
      onAddSubtask,
      onOpenGrid,
      onDelete,
      onSave,
    }),
    [data, handlers, insets, onMore, onEditTitle, onField, onToggleSubtask, onOpenSubtask, onAddSubtask, onOpenGrid, onDelete, onSave],
  );

  return (
    <View style={styles.fill}>
      <PlanEditorScreen {...screen} />
      <CustomRemindSheet kind={custom} bottomInset={insets.bottom} onAdd={handlers.addReminder} onClose={closeCustom} />
      <InputSheet
        visible={sheet === 'title'}
        value={draft.title}
        maxLength={TITLE_MAX}
        bottomInset={insets.bottom}
        onSubmit={onTitle}
        onClose={closeSheet}
      />
      <InputSheet
        visible={sheet === 'note'}
        value={draft.note}
        multiline
        maxLength={NOTE_MAX}
        bottomInset={insets.bottom}
        onSubmit={onNote}
        onClose={closeSheet}
      />
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
