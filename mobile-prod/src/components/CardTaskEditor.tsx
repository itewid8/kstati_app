/**
 * Дело из голосового ответа с несколькими записями — в полном окне дела (C-EditDate / -Repeat / -Remind / -Who) поверх
 * окна записей. Правки остаются в ответе: «СОХРАНИТЬ» возвращает черновик в окно записей (в хранилище — по его
 * «СОХРАНИТЬ»), «назад» ничего не меняет, «УДАЛИТЬ» убирает дело из ответа.
 * Кладётся внутрь окна записей (вложенный Modal показывается поверх него и на iPhone).
 */
import { BugButton } from './BugButton';
import { ModalShot } from './ModalShot';
import { useCallback, useMemo, useRef, useState, type RefObject } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { draftFromSeed, draftToItem, initialUi, type EditorState } from '@/adapters/editors/draft';
import { endLabel } from '@/adapters/editors/labels';
import { taskEditorProps } from '@/adapters/editors/taskEditor';
import { colorOf } from '@/adapters/common/people';
import { CustomRemindSheet, EndSheet, UntilSheet } from '@/containers/editors/EditorSheets';
import { useEditorState, usePanelHandlers, type EditorContext } from '@/containers/editors/useEditorState';
import { useClock } from '@/containers/common/useClock';
import { useInsets } from '@/containers/common/useInsets';
import { usePersonColors } from '@/containers/common/usePersonColors';
import { useSnapshot } from '@/containers/common/useSnapshot';
import type { DraftItem, TaskDraft } from '@/lib/types';
import type { CustomReminder } from '@/screens/editors/panels/RemindPanel';
import { TaskEditorScreen, type TaskEditorScreenProps, type TaskField } from '@/screens/editors/TaskEditorScreen';
import { ActionSheet } from '@/screens/sheets';
import { BottomSheet, InputSheet } from '@/ui';

type TaskItem = Extract<DraftItem, { type: 'task' }>;

type Props = {
  item: TaskItem | null;
  onSave: (data: TaskDraft) => void;
  onRemove: () => void;
  onClose: () => void;
};

export const CardTaskEditor = ({ item, onSave, onRemove, onClose }: Props) => {
  // «Назад» Android приходит в Modal: сначала закрывает окно поверх редактора, потом сам редактор
  const back = useRef<() => void>(onClose);
  const onBack = useCallback(() => back.current(), []);
  return (
    <Modal visible={!!item} animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onBack}>
      <GestureHandlerRootView style={styles.fill}>
        <ModalShot opaque>
        {item ? <Editor key={item.key} item={item} back={back} onSave={onSave} onRemove={onRemove} onClose={onClose} /> : null}
        <BugButton />
        </ModalShot>
      </GestureHandlerRootView>
    </Modal>
  );
};

type Sheet = 'title' | 'note' | 'end' | 'until' | 'more';

const TITLE_MAX = 200;
const NOTE_MAX = 2000;

const Editor = ({ item, back, onSave, onRemove, onClose }: Props & { item: TaskItem; back: RefObject<() => void> }) => {
  const s = useSnapshot();
  const clock = useClock();
  const insets = useInsets();
  const colors = usePersonColors(s);
  const { state, dispatch, latest } = useEditorState((): EditorState => {
    const draft = draftFromSeed({ ...item.data, ...(item.id ? { id: item.id } : null) }, s);
    return { draft, ui: initialUi(draft, clock.today, null) };
  });
  const { draft } = state;
  const [sheet, setSheet] = useState<Sheet | null>(() => (item.data.title.trim() ? null : 'title'));
  const [custom, setCustom] = useState<CustomReminder | null>(null);
  const closeSheet = useCallback(() => setSheet(null), []);
  const closeCustom = useCallback(() => setCustom(null), []);

  const ctx = useRef<EditorContext>({ today: clock.today, snapshot: s });
  ctx.current = { today: clock.today, snapshot: s };

  const handlers = usePanelHandlers({
    dispatch,
    latest,
    ctx,
    onPickUntil: useCallback(() => setSheet('until'), []),
    onCustom: setCustom,
  });

  // «Назад» Android: открыто окно поверх — закрыть его, иначе выйти без изменений (окна ввода текста закрываются сами)
  back.current = () => {
    if (custom) setCustom(null);
    else if (sheet) setSheet(null);
    else onClose();
  };

  const onField = useCallback(
    (field: TaskField) => {
      const d = latest.current.draft;
      switch (field) {
        case 'note':
          return setSheet('note');
        case 'end':
          if (!d.date) return dispatch({ type: 'toggle', field: 'when', today: ctx.current.today });
          dispatch({ type: 'initEnd' });
          dispatch({ type: 'collapse' });
          return setSheet('end');
        case 'subtasks':
          // План делается из сохранённого дела — в ответе подзадач нет
          return undefined;
        default:
          return dispatch({ type: 'toggle', field, today: ctx.current.today });
      }
    },
    [dispatch, latest],
  );

  const save = useCallback(() => {
    const d = latest.current.draft;
    if (!d.title.trim()) return setSheet('title');
    onSave(draftToItem(d).data);
  }, [latest, onSave]);

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
  const onUntil = useCallback((until: string) => dispatch({ type: 'repeatEdit', edit: { kind: 'until', until } }), [dispatch]);
  const onMore = useCallback(() => setSheet('more'), []);
  const onEditTitle = useCallback(() => setSheet('title'), []);
  const onClearEnd = useCallback(() => dispatch({ type: 'clearEnd' }), [dispatch]);
  const moreActions = useMemo(() => (draft.date ? [{ label: 'Без даты' }] : [{ label: 'Убрать из ответа', danger: true }]), [draft.date]);
  const onMoreAction = useCallback(() => {
    setSheet(null);
    if (latest.current.draft.date) dispatch({ type: 'clearDate' });
    else onRemove();
  }, [dispatch, latest, onRemove]);

  const data = useMemo(() => taskEditorProps(state.draft, state.ui, s, clock), [state, s, clock]);
  const screen = useMemo<TaskEditorScreenProps>(
    () => ({
      ...data,
      subtasks: undefined,
      whenPanel: data.whenPanel && { ...data.whenPanel, ...handlers.when },
      repeatPanel: data.repeatPanel && { ...data.repeatPanel, ...handlers.repeat },
      remindPanel: data.remindPanel && { ...data.remindPanel, ...handlers.remind },
      whoPanel: data.whoPanel && { ...data.whoPanel, ...handlers.who },
      insets,
      onBack: onClose,
      onMore,
      onEditTitle,
      onField,
      onClearEnd,
      onDelete: onRemove,
      onSave: save,
    }),
    [data, handlers, insets, onClose, onMore, onEditTitle, onField, onClearEnd, onRemove, save],
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
      <BottomSheet visible={sheet === 'more'} onClose={closeSheet} bottomInset={insets.bottom}>
        <ActionSheet title={draft.title.trim() || 'Дело'} actions={moreActions} onAction={onMoreAction} onClose={closeSheet} />
      </BottomSheet>
      <InputSheet visible={sheet === 'title'} value={draft.title} maxLength={TITLE_MAX} bottomInset={insets.bottom} onSubmit={onTitle} onClose={closeSheet} />
      <InputSheet visible={sheet === 'note'} value={draft.note} multiline maxLength={NOTE_MAX} bottomInset={insets.bottom} onSubmit={onNote} onClose={closeSheet} />
    </View>
  );
};

const styles = StyleSheet.create({ fill: { flex: 1 } });
