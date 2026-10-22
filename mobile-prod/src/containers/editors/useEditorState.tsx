/**
 * Состояние окна редактирования: черновик и что раскрыто (reduceEditor из adapters/editors/draft),
 * колбэки раскрытых строк и сохранение / выход. Общее для окна дела и окна плана.
 */
import { router } from 'expo-router';
import { useMemo, useReducer, useRef, type Dispatch, type RefObject } from 'react';
import { shiftDay } from '@/adapters/calendar/events';
import type { Snapshot } from '@/adapters/snapshot';
import { draftToItem, reduceEditor, type EditorAction, type EditorDraft, type EditorState } from '@/adapters/editors/draft';
import { memberIds, remindList, timeText, withSpec, withoutSpec } from '@/adapters/editors/panels';
import type { IsoDate } from '@/lib/calendarLayout';
import { useStore } from '@/lib/store';
import type { ID, ReminderSpec } from '@/lib/types';
import type { TimeValue } from '@/screens/editors/components/TimeWheel';
import type { DatePickerProps } from '@/screens/editors/panels/DatePanel';
import type { PeriodEdge, PeriodPanelProps } from '@/screens/editors/panels/PeriodPanel';
import type { CustomReminder, RemindPanelProps, RemindScope } from '@/screens/editors/panels/RemindPanel';
import type { RepeatEnd, RepeatPanelProps, RepeatPreset, RepeatUnit } from '@/screens/editors/panels/RepeatPanel';
import type { WhoMode, WhoPanelProps } from '@/screens/editors/panels/WhoPanel';
import { nav } from '../common/nav';

export type EditorDispatch = Dispatch<EditorAction>;

/** Что нужно колбэкам в момент нажатия: сегодня и срез хранилища (через ref — колбэки не пересоздаются) */
export type EditorContext = { today: IsoDate; snapshot: Snapshot };

export function useEditorState(init: () => EditorState) {
  const [state, dispatch] = useReducer(reduceEditor, undefined, init);
  const latest = useRef(state);
  latest.current = state;
  return { state, dispatch, latest };
}

/** Закрыть окно: назад, а если окно открыли ссылкой — на вкладку «Дела» */
export function leaveEditor() {
  if (router.canGoBack()) router.back();
  else router.replace(nav.tab('tasks'));
}

/**
 * Сохранить черновик (saveItems вернёт id сохранённой записи). null — не сохранилось: новое дело без группы и без плана
 * или дела, которое правили, уже нет (удалили на другом телефоне) — см. notSaved
 */
export function saveDraft(d: EditorDraft): ID | null {
  const saved = useStore.getState().saveItems([draftToItem(d)]);
  return saved[0] ?? null;
}

/**
 * Не сохранилось — не закрываем молча. Новое дело: групп нет — сообщение, окно остаётся (черновик не пропадает).
 * Правка: дела уже нет — сообщение и выход
 */
export function notSaved(d: EditorDraft) {
  if (!d.id) return useStore.getState().notice('Нет группы');
  useStore.getState().notice('Дела уже нет');
  leaveEditor();
}

/** Удалить дело (occ — только этот раз серии; план — вместе с подзадачами) и закрыть окно; отмена — в нижнем сообщении */
export function removeTask(id: ID, occ?: string) {
  useStore.getState().deleteTask(id, occ);
  leaveEditor();
}

/** «Этот и все следующие»: серия заканчивается накануне occ (с первого раза — удаляется целиком) и окно закрывается */
export function endSeriesBefore(id: ID, occ: IsoDate) {
  useStore.getState().endSeries(id, shiftDay(occ, -1));
  leaveEditor();
}

type Picker = Pick<DatePickerProps, 'onSelectDay' | 'onShift' | 'onToggleView' | 'onSelectMonth' | 'onChangeTime' | 'onToggleNoTime'>;

export type PanelHandlers = {
  when: Picker;
  period: Picker & Pick<PeriodPanelProps, 'onEdge'>;
  repeat: Pick<RepeatPanelProps, 'onPreset' | 'onEvery' | 'onUnit' | 'onToggleWeekday' | 'onEnd' | 'onPickUntil' | 'onCount'>;
  remind: Pick<RemindPanelProps, 'onScope' | 'onRemove' | 'onAdd' | 'onCustom'>;
  who: Pick<WhoPanelProps, 'onMode' | 'onToggleMember'>;
  /** Своё напоминание из окна CustomRemindSheet */
  addReminder: (spec: ReminderSpec) => void;
};

type HandlerDeps = {
  dispatch: EditorDispatch;
  latest: RefObject<EditorState>;
  ctx: RefObject<EditorContext>;
  /** «ДО ДАТЫ» → окно даты окончания */
  onPickUntil: () => void;
  /** «СВОЁ: …» → окно своего напоминания */
  onCustom: (kind: CustomReminder) => void;
};

/** Колбэки раскрытых строк: создаются один раз, текущее состояние читают через ref */
export function usePanelHandlers({ dispatch, latest, ctx, onPickUntil, onCustom }: HandlerDeps): PanelHandlers {
  const deps = useRef({ onPickUntil, onCustom });
  deps.current = { onPickUntil, onCustom };

  return useMemo(() => {
    const today = () => ctx.current.today;
    const edge = (): PeriodEdge => latest.current.ui.edge;
    const setReminders = (change: (list: readonly ReminderSpec[]) => ReminderSpec[]) => {
      const { draft, ui } = latest.current;
      const scope: RemindScope = ui.remindScope;
      const list = remindList(draft, scope, ctx.current.snapshot.reminders);
      dispatch({ type: 'reminders', scope, specs: change(list) });
    };
    const addReminder = (spec: ReminderSpec) => setReminders((list) => withSpec(list, spec));
    const view = {
      onShift: (dir: -1 | 1) => dispatch({ type: 'shift', dir }),
      onToggleView: () => dispatch({ type: 'dateView' }),
      onSelectMonth: (month: number) => dispatch({ type: 'pickMonth', month }),
    };
    return {
      when: {
        ...view,
        // Тот же день ещё раз — свернуть (как в старом окне); «без даты» — в меню «⋯»
        onSelectDay: (date: IsoDate) =>
          dispatch(date === latest.current.draft.date ? { type: 'collapse' } : { type: 'day', date }),
        onChangeTime: (t: TimeValue) => dispatch({ type: 'time', time: timeText(t) }),
        onToggleNoTime: () => dispatch({ type: 'noTime' }),
      },
      period: {
        ...view,
        onEdge: (e: PeriodEdge) => dispatch({ type: 'edge', edge: e, today: today() }),
        onSelectDay: (date: IsoDate) => dispatch({ type: 'periodDay', edge: edge(), date }),
        onChangeTime: (t: TimeValue) => dispatch({ type: 'periodTime', edge: edge(), time: timeText(t) }),
        onToggleNoTime: () => dispatch({ type: 'periodNoTime', edge: edge() }),
      },
      repeat: {
        onPreset: (preset: RepeatPreset) => dispatch({ type: 'repeatPreset', preset, today: today() }),
        onEvery: (every: number) => dispatch({ type: 'repeatEdit', edit: { kind: 'every', every } }),
        onUnit: (unit: RepeatUnit) => dispatch({ type: 'repeatEdit', edit: { kind: 'unit', unit } }),
        onToggleWeekday: (weekday: number) => dispatch({ type: 'repeatEdit', edit: { kind: 'weekday', weekday } }),
        onEnd: (end: RepeatEnd) => dispatch({ type: 'repeatEdit', edit: { kind: 'end', end } }),
        onPickUntil: () => deps.current.onPickUntil(),
        onCount: (count: number) => dispatch({ type: 'repeatEdit', edit: { kind: 'count', count } }),
      },
      remind: {
        onScope: (scope: RemindScope) => dispatch({ type: 'remindScope', scope }),
        onRemove: (spec: ID) => setReminders((list) => withoutSpec(list, spec)),
        onAdd: addReminder,
        onCustom: (kind: CustomReminder) => deps.current.onCustom(kind),
      },
      who: {
        onMode: (mode: WhoMode) =>
          dispatch({ type: 'whoMode', mode, members: memberIds(ctx.current.snapshot, latest.current.draft.groupId) }),
        onToggleMember: (id: ID) => {
          dispatch({ type: 'togglePerson', id });
          // Сняли или добавили человека вручную — это уже «ВЫБРАТЬ»
          if (latest.current.ui.whoMode === 'all') dispatch({ type: 'whoMode', mode: 'pick', members: [] });
        },
      },
      addReminder,
    };
  }, [dispatch, latest, ctx]);
}
