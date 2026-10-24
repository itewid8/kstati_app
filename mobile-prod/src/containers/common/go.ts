/**
 * Переходы, которые не плодят копии экранов (docs/redesign/QA-1.md С3, С4, С5, М1).
 *
 * Корневой стек: (tabs) и экраны поверх него — окна дела и плана, лента, профиль, группа. push / navigate на адрес
 * внутри (tabs) из такого экрана кладёт в корень ВТОРОЙ (tabs) (expo-router v4+). Поэтому всё, что ведёт во вкладки,
 * идёт через dismissTo: корневой стек сворачивается до уже открытых вкладок, внутри них — переход на нужный экран
 * (такой же экран наверху стека вкладки не повторяется). Из самих вкладок dismissTo ведёт себя как navigate.
 */
import { router, type Href } from 'expo-router';
import { useStore } from '@/lib/store';
import type { ID } from '@/lib/types';
import { canEditTask } from '@/lib/visibility';
import type { NavTab } from '@/ui';
import { openQuickActions } from '../quick/quickStore';
import { nav } from './nav';

/** Адрес внутри (tabs) — из любого места */
export const toTabRoute = (href: Href) => router.dismissTo(href);
export const toTab = (tab: NavTab) => toTabRoute(nav.tab(tab));
/** Сетка плана (C-Plan) во вкладке «Дела» */
export const toPlanGrid = (id: ID) => toTabRoute(nav.planGrid(id));
/** Тема идей во вкладке «Идеи» */
export const toTopic = (id: ID) => toTabRoute(nav.topic(id));

/** Назад; если некуда (экран открыт ссылкой) — на fallback во вкладках */
export function backOrTab(fallback: NavTab = 'tasks') {
  if (router.canGoBack()) router.back();
  else toTab(fallback);
}

/** Начать с одного экрана (вход, вкладки после входа): всё, что было под ним, размонтируется */
export function resetTo(href: Href) {
  if (router.canDismiss()) router.dismissAll();
  router.replace(href);
}

/** Маршрут корневого стека — для поиска уже открытого окна */
export const ROUTE = { planEditor: 'edit/plan/[id]' } as const;

type StackLike = { index: number; routes: ReadonlyArray<{ name: string; params?: unknown }> };

const idOf = (params: unknown): string | undefined =>
  typeof params === 'object' && params !== null && 'id' in params && typeof params.id === 'string' ? params.id : undefined;

/** Сколько экранов закрыть, чтобы вернуться к открытому ниже экрану name с этим id; 0 — такого ниже нет */
export function depthTo(state: StackLike | undefined, name: string, id: ID): number {
  if (!state) return 0;
  for (let i = state.index - 1; i >= 0; i--) {
    const r = state.routes[i];
    if (r && r.name === name && idOf(r.params) === id) return state.index - i;
  }
  return 0;
}

/**
 * Окно плана из корневого экрана (окно подзадачи): если окно этого плана уже открыто ниже — вернуться к нему,
 * а не открывать второе со своим черновиком (QA-1 С4). state — состояние корневого стека (useNavigation().getState())
 */
export function openPlanEditor(state: StackLike | undefined, id: ID) {
  const n = depthTo(state, ROUTE.planEditor, id);
  if (n > 0) router.dismiss(n);
  else router.push(nav.planEditor(id));
}

/**
 * Нажали на дело: можно править — окно дела (occ — открытый раз серии); чужое без прав админа — окно быстрых действий
 * (C-TaskView: отметить, свои напоминания, копия)
 */
export function openTaskEditor(id: ID, occ?: string): void {
  const st = useStore.getState();
  const task = st.tasks.find((t) => t.id === id);
  if (task && !canEditTask(task, st.groups, st.me?.id)) return openQuickActions({ kind: 'task', id, ...(occ && { occ }) });
  router.push(nav.taskEditor(occ ? { id, occ } : { id }));
}
