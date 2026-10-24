import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import { planGridProps } from '@/adapters/calendar/plan';
import { useStore } from '@/lib/store';
import type { ID } from '@/lib/types';
import { PlanScreen, type PlanMode } from '@/screens/calendar/PlanScreen';
import { nav, openTaskEditor, signedInOnly, useChrome, useClock, useInsets, usePersonColors } from '../common';
import { holdTask } from '../quick/quickStore';
import { useCalendarSnapshot } from './useCalendar';

export type PlanContainerProps = { id: ID };

const goBack = () => (router.canGoBack() ? router.back() : router.dismissTo(nav.tab('tasks')));
const openStep = (id: ID) => openTaskEditor(id);

/** C-Plan: сетка плана по дням; пока экран в фокусе, голос добавляет подзадачи в этот план (setVoiceParent) (INTEGRATION.md 1.1) */
export const PlanContainer = signedInOnly(function Plan({ id }: PlanContainerProps) {
  const { onNavigate, onRec } = useChrome('tasks');
  const insets = useInsets();
  const snap = useCalendarSnapshot();
  const colors = usePersonColors(snap);
  const { today } = useClock();
  const data = useMemo(() => planGridProps(snap, { today }, colors, id), [snap, today, colors, id]);
  const missing = data === null;

  useFocusEffect(
    useCallback(() => {
      useStore.getState().setVoiceParent(id);
      return () => useStore.getState().setVoiceParent(null);
    }, [id]),
  );

  // План удалили (или его нет) — назад
  useEffect(() => {
    if (missing) goBack();
  }, [missing]);

  const startDate = data?.startDate;
  const onAddStep = useCallback(() => router.push(nav.taskEditor({ parentId: id, date: startDate })), [id, startDate]);
  const onMore = useCallback(() => router.push(nav.planEditor(id)), [id]);
  // СПИСОК подзадач — это окно плана (C-EditPlan) поверх сетки: «назад» из него — снова сетка.
  // replace из стека вкладки заменил бы в корне все вкладки (QA-1 М1)
  const onChangeMode = useCallback(
    (mode: PlanMode) => {
      if (mode === 'list') router.push(nav.planEditor(id));
    },
    [id],
  );

  if (!data) return null;
  return (
    <PlanScreen
      {...data}
      insets={insets}
      onBack={goBack}
      onAddStep={onAddStep}
      onMore={onMore}
      onChangeMode={onChangeMode}
      onOpenStep={openStep}
      onLongPressStep={holdTask}
      onNavigate={onNavigate}
      onRec={onRec}
    />
  );
});
