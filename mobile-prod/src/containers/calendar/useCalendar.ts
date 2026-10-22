/**
 * Общее для видов календаря (C-Day, C-Week, C-Month, C-Year) и плана (C-Plan): срез хранилища, цвета людей,
 * верхняя панель с переключателем вида и переходы по нажатию на дело. Колбэки — на уровне модуля:
 * читают хранилище в момент нажатия, поэтому ссылки стабильны и memo-экраны не перерисовываются зря.
 */
import { router } from 'expo-router';
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { CalendarSnapshot } from '@/adapters/calendar/events';
import { isPlan, parseKey } from '@/adapters/common/tasks';
import { useStore } from '@/lib/store';
import type { ID } from '@/lib/types';
import type { CalendarChromeProps, CalendarView } from '@/screens/calendar/types';
import { NO_ME, nav, toPlanGrid, useChrome, useInsets, type StoreState } from '../common';

const pickCalendar = (s: StoreState): CalendarSnapshot => ({
  me: s.me ?? NO_ME,
  users: s.users,
  groups: s.groups,
  currentGroupId: s.currentGroupId,
  tasks: s.tasks,
});

/** Только то, что нужно календарю: хотелки, идеи и лента его не перерисовывают */
export const useCalendarSnapshot = (): CalendarSnapshot => useStore(useShallow(pickCalendar));

/** Дело по ключу «id@occ»: план — его сетка (C-Plan), иначе окно дела (открытый раз серии — occ) */
export function openTaskKey(key: string): void {
  const { id, occ } = parseKey(key);
  const tasks = useStore.getState().tasks;
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  if (isPlan(task, tasks)) toPlanGrid(id);
  else router.push(nav.taskEditor(occ ? { id, occ } : { id }));
}

const openList = () => useStore.getState().setTasksView('list');
const changeView = (view: CalendarView) => useStore.getState().setTasksView(view);
const addTask = () => router.push(nav.taskEditor({ date: useStore.getState().calendarDate }));
export const togglePerson = (id: ID) => useStore.getState().toggleCalendarPerson(id);

/** Верхняя панель, переключатель вида и нижняя навигация экранов календаря */
export type CalendarChrome = Required<Pick<CalendarChromeProps, 'groupLabel' | 'me' | 'hasNews' | 'insets'>> &
  Required<
    Pick<CalendarChromeProps, 'onOpenGroup' | 'onOpenList' | 'onAdd' | 'onOpenFeed' | 'onOpenSettings' | 'onChangeView' | 'onNavigate' | 'onRec'>
  >;

export function useCalendarChrome(): CalendarChrome {
  const { me, hasNews, groupLabel, onNavigate, onRec, onOpenFeed, onOpenSettings, onOpenGroup } = useChrome('tasks');
  const insets = useInsets();
  return useMemo(
    () => ({
      groupLabel,
      me,
      hasNews,
      insets,
      onOpenGroup,
      onOpenList: openList,
      onAdd: addTask,
      onOpenFeed,
      onOpenSettings,
      onChangeView: changeView,
      onNavigate,
      onRec,
    }),
    [groupLabel, me, hasNews, insets, onOpenGroup, onOpenFeed, onOpenSettings, onNavigate, onRec],
  );
}
