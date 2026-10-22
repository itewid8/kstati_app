/**
 * Все адреса экранов — только здесь. Корневые экраны (окна, лента, профиль, группа) открываются router.push(nav.*()),
 * адреса внутри вкладок (tab, planGrid, topic) из любого места — через go.ts (toTab / toPlanGrid / toTopic), иначе
 * в корневом стеке появится второй (tabs). Дерево маршрутов — docs/redesign/INTEGRATION.md, раздел 2.1.
 */
import type { Href } from 'expo-router';
import type { ID } from '@/lib/types';
import type { NavTab } from '@/ui';

const TAB: Record<NavTab, Href> = { tasks: '/tasks', wishes: '/wishes', watch: '/watch', ideas: '/ideas' };

/** «?a=1&b=2» без пустых значений */
function query(params: Record<string, string | null | undefined>): string {
  const parts = Object.entries(params).flatMap(([k, v]) => (v ? [`${k}=${encodeURIComponent(v)}`] : []));
  return parts.length ? `?${parts.join('&')}` : '';
}

/** Новое дело — id «new» */
export const NEW_TASK = 'new';

export type TaskEditorParams = { id?: ID; occ?: string; date?: string | null; time?: string | null; parentId?: ID | null };
/** Поле, которое раскрыть при открытии окна плана */
export type PlanEditorField = 'period' | 'note' | 'subtasks';
/** Поле старой формы профиля (app/settings/edit.tsx) */
export type ProfileField = 'name' | 'nick' | 'gender' | 'password';

export const nav = {
  tab: (tab: NavTab): Href => TAB[tab],
  /** Окно дела: id — правка (occ — открытый раз серии), без id — новое (date, time, parentId — подзадача плана) */
  taskEditor: ({ id, occ, date, time, parentId }: TaskEditorParams = {}): Href =>
    `/edit/task/${encodeURIComponent(id ?? NEW_TASK)}${query({ occ, date, time, parentId })}`,
  planEditor: (id: ID, field?: PlanEditorField): Href => `/edit/plan/${encodeURIComponent(id)}${query({ field })}`,
  /** Сетка плана по дням (C-Plan) — внутри вкладки «Дела» */
  planGrid: (id: ID): Href => `/tasks/plan/${encodeURIComponent(id)}`,
  activity: (): Href => '/activity',
  profile: (): Href => '/settings',
  appSettings: (): Href => '/settings/app',
  group: (id: ID): Href => `/group/${encodeURIComponent(id)}`,
  reminders: (): Href => '/settings/reminders',
  avatar: (): Href => '/settings/avatar',
  profileEdit: (field?: ProfileField): Href => `/settings/edit${query({ field })}`,
  topic: (id: ID): Href => `/ideas/${encodeURIComponent(id)}`,
} as const;

/** Параметр адреса из useLocalSearchParams: первое значение, пустое — undefined */
export function param(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v ? v : undefined;
}
