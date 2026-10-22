import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { meBadge } from '@/adapters/common/people';
import { upper } from '@/adapters/common/ru';
import { useStore } from '@/lib/store';
import type { PersonColor } from '@/lib/types';
import { toggleRecording } from '@/lib/voice';
import type { NavTab } from '@/ui';
import { nav } from './nav';
import { usePersonColors } from './usePersonColors';
import { NO_ME } from './useSnapshot';

/** Общее для экранов с верхней панелью и нижней навигацией. Контейнер берёт только нужные экрану ключи */
export type Chrome = {
  /** Кнопка профиля: буква и цвет */
  me: { letter: string; color: PersonColor };
  /** Точка на колокольчике: в ленте есть непросмотренное */
  hasNews: boolean;
  /** Текущая группа заглавными: «МЫ С КАРИНОЙ» */
  groupLabel: string;
  onNavigate: (tab: NavTab) => void;
  onRec: () => void;
  onOpenFeed: () => void;
  onOpenSettings: () => void;
  /** Выбор группы (списки) и группа в шапке календаря — одно окно GroupSheet */
  onPickGroup: () => void;
  onOpenGroup: () => void;
};

const openFeed = () => router.push(nav.activity());
const openSettings = () => router.push(nav.profile());
const openGroupSheet = () => useStore.getState().setGroupSheet(true);
const rec = () => toggleRecording();

/** active — вкладка экрана: её кнопка возвращает к началу вкладки (из плана — к календарю) */
export function useChrome(active: NavTab): Chrome {
  const people = useStore(useShallow((s) => ({ me: s.me ?? NO_ME, users: s.users, groups: s.groups })));
  const hasNews = useStore((s) => (s.activity[0]?.id ?? '') > s.activitySeen);
  const groupName = useStore((s) => s.groups.find((g) => g.id === s.currentGroupId)?.name ?? '');
  const colors = usePersonColors(people);
  const badge = useMemo(() => meBadge(people, colors), [people, colors]);
  // Синхронизация заменяет me и users новыми объектами — кнопка профиля меняется, только если поменялись буква или цвет
  const me = useMemo(() => ({ letter: badge.letter, color: badge.color }), [badge.letter, badge.color]);

  // Чужая вкладка — переключение (стек той вкладки сохраняется), своя — к её началу
  const onNavigate = useCallback(
    (tab: NavTab) => (tab === active ? router.dismissTo(nav.tab(tab)) : router.navigate(nav.tab(tab))),
    [active],
  );

  return useMemo(
    () => ({
      me,
      hasNews,
      groupLabel: upper(groupName),
      onNavigate,
      onRec: rec,
      onOpenFeed: openFeed,
      onOpenSettings: openSettings,
      onPickGroup: openGroupSheet,
      onOpenGroup: openGroupSheet,
    }),
    [me, hasNews, groupName, onNavigate],
  );
}
