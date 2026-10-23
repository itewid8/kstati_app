/**
 * Быстрые действия по удержанию записи (C-QuickTask / -Wish / -Watch / -Idea) поверх всех экранов: один хост
 * в корневом макете, рядом с VoiceHost. Запись — из useQuick (экраны зовут hold* из onLongPress*), данные окна —
 * адаптер quickView, действия — actions.ts. Запись пропала (удалили, синхронизация) — окно закрывается.
 * Android «назад» закрывает окно. ДАТА… у раза серии — окно даты (переносится только этот раз).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { quickView, type QuickSnapshot } from '@/adapters/quick';
import type { IsoDate } from '@/lib/calendarLayout';
import { DEMO, useStore } from '@/lib/store';
import { QuickActionsSheet, type QuickTileKey } from '@/screens/quick';
import { NO_ME, useClock, useInsets, usePersonColors, useSignedIn, type StoreState } from '../common';
import { UntilSheet } from '../editors/EditorSheets';
import { moveOccurrence, runDelete, runSegment, runTile, type DatePick } from './actions';
import { closeQuickActions, useQuick } from './quickStore';

/** Окно даты раза серии: раньше любой даты не ограничиваем */
const ANY_DAY = '1970-01-01';

/** Подарки чужих хотелок — только с сервером API 2 (старый молча срежет giftedBy) */
const giftsOn = (api: number | null) => DEMO || (api ?? 0) >= 2;

const pickQuick = (s: StoreState): QuickSnapshot => ({
  me: s.me ?? NO_ME,
  users: s.users,
  groups: s.groups,
  tasks: s.tasks,
  wishes: s.wishes,
  watch: s.watch,
  topics: s.topics,
  ideas: s.ideas,
});

export const QuickActionsHost = () => {
  const target = useQuick((q) => q.target);
  const lift = useQuick((q) => q.lift);
  const signedIn = useSignedIn();
  const s = useStore(useShallow(pickQuick));
  const gifts = useStore((st) => giftsOn(st.serverApi));
  const { today } = useClock();
  const insets = useInsets();
  const colors = usePersonColors(s);
  const [pick, setPick] = useState<DatePick | null>(null);

  const view = useMemo(
    () => (target && signedIn ? quickView(s, colors, { today, gifts }, target) : null),
    [target, signedIn, s, colors, today, gifts],
  );
  const latest = useRef(view);
  latest.current = view;

  // Записи больше нет (или вышли из аккаунта) — закрыть
  useEffect(() => {
    if (target && !view) closeQuickActions();
  }, [target, view]);

  const open = !!view;
  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeQuickActions();
      return true;
    });
    return () => sub.remove();
  }, [open]);

  const onTile = useCallback((key: QuickTileKey) => {
    const v = latest.current;
    if (v) runTile(v, key);
  }, []);
  const onSegment = useCallback((key: string) => {
    const v = latest.current;
    if (!v) return;
    const next = runSegment(v, key);
    if (next) setPick(next);
  }, []);
  const onDelete = useCallback(() => {
    const v = latest.current;
    if (v) runDelete(v);
  }, []);
  const picked = useRef(pick);
  picked.current = pick;
  const closePick = useCallback(() => setPick(null), []);
  // Окно даты само закрывается после выбора (onClose)
  const onPickDate = useCallback((date: IsoDate) => {
    if (picked.current) moveOccurrence(picked.current, date);
  }, []);

  return (
    <>
      {view ? (
        <QuickActionsSheet
          {...view.sheet}
          lift={lift}
          bottomInset={insets.bottom}
          onTile={onTile}
          onSegment={onSegment}
          onClose={closeQuickActions}
          onDelete={onDelete}
        />
      ) : null}
      <UntilSheet
        visible={!!pick}
        until={pick?.occ ?? null}
        from={ANY_DAY}
        today={today}
        bottomInset={insets.bottom}
        onPick={onPickDate}
        onClose={closePick}
      />
    </>
  );
};
