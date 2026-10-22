import { Redirect } from 'expo-router';
import React from 'react';
import { CalendarContainer } from '@/containers/calendar/CalendarContainer';
import { TasksListContainer } from '@/containers/lists/TasksListContainer';
import { useStore } from '@/lib/store';

/**
 * «Дела»: список (C-List) или календарь (C-Day / Week / Month / Year) — вид хранится в s.tasksView.
 * Дела живут в группе: без групп любой вид ведёт на онбординг (как «Смотреть»), иначе «+» и голос молча ничего не сохранят
 */
export default function TasksTab() {
  const list = useStore((s) => s.tasksView === 'list');
  const hasGroups = useStore((s) => s.groups.length > 0);
  if (!hasGroups) return <Redirect href="/onboarding" />;
  return list ? <TasksListContainer /> : <CalendarContainer />;
}
