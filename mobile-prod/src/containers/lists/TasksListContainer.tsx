import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { canEditTask } from '@/lib/visibility';
import { useSelection } from '../common/useSelection';
import { openMenu } from '@/components/ActionMenu';
import type { SelectAction } from '@/ui';
import { MOVE_LABELS, moveTasks, setTasksDone, taskStates, type MoveTarget } from './bulk';
import { tasksListProps, type TasksListSnapshot } from '@/adapters/lists/tasksList';
import type { Snapshot } from '@/adapters/snapshot';
import { parseKey } from '@/adapters/common/tasks';
import { useStore } from '@/lib/store';
import type { ID } from '@/lib/types';
import { TasksListScreen, type TasksView } from '@/screens/lists/TasksListScreen';
import { NO_ME, nav, openTaskEditor, signedInOnly, toPlanGrid, useChrome, useClock, useInsets, usePersonColors, type StoreState } from '../common';
import { holdTask } from '../quick/quickStore';

/** Из списка — в выбранный вид календаря */
const changeView = (v: TasksView) => {
  if (v !== 'list') useStore.getState().setTasksView(v);
};

const toggleSection = (id: ID) => useStore.getState().toggleSection(id);
const togglePlan = (id: ID) => useStore.getState().togglePlanOpen(id);

/** Отметка по ключу строки: «id@дата» — раз серии */
const toggleTask = (key: ID) => {
  const { id, occ } = parseKey(key);
  useStore.getState().toggleTask(id, occ);
};

const openTask = (key: ID) => {
  const { id, occ } = parseKey(key);
  openTaskEditor(id, occ);
};
const addTask = () => router.push(nav.taskEditor({}));

/** Только то, что нужно списку (и цветам людей): хотелки, идеи и «Смотреть» его не перерисовывают */
const pickList = (s: StoreState): TasksListSnapshot & Pick<Snapshot, 'users'> => ({
  me: s.me ?? NO_ME,
  users: s.users,
  groups: s.groups,
  currentGroupId: s.currentGroupId,
  tasks: s.tasks,
  activity: s.activity,
  activitySeen: s.activitySeen,
  collapsedSections: s.collapsedSections,
});

/** C-List: вкладка «Дела» списком (s.tasksView === 'list'); без групп сюда не попадают (app/(tabs)/tasks/index.tsx) */
export const TasksListContainer = signedInOnly(function TasksList() {
  const s = useStore(useShallow(pickList));
  // Список меняется раз в день, а не каждую минуту
  const { today } = useClock();
  const insets = useInsets();
  const expandedPlans = useStore((st) => st.expandedPlans);
  const { onPickGroup, onOpenFeed, onOpenSettings, onNavigate, onRec } = useChrome('tasks');
  const colors = usePersonColors(s);
  const data = useMemo(() => tasksListProps(s, colors, { today }), [s, colors, today]);
  // Выбор: дела, которые я могу менять (свои; чужие — если я создатель или админ группы)
  const pickable = useMemo(() => {
    const st = useStore.getState();
    const byId = new Map(st.tasks.map((t) => [t.id, t]));
    return data.sections
      .flatMap((sec) => sec.items.flatMap((e) => (e.kind === 'plan' ? [e.id, ...e.steps.map((x) => x.id)] : [e.id])))
      .filter((key) => {
        const t = byId.get(parseKey(key).id);
        return !!t && canEditTask(t, st.groups, st.me?.id);
      });
  }, [data.sections]);
  const sel = useSelection(pickable);
  const deleteSelected = useCallback(() => {
    if (sel.selected?.length) useStore.getState().deleteTasksMany(sel.selected);
    sel.cancel();
  }, [sel]);
  // Действия выбранного: закрыть (или открыть, если все уже сделаны), перенести, удалить
  const picked = sel.selected ?? [];
  const states = taskStates(picked);
  const selectActions: SelectAction[] = [
    states.open.length || !states.done.length
      ? { label: 'ЗАКРЫТЬ', n: states.open.length, onPress: () => (setTasksDone(states.open, true), sel.cancel()) }
      : { label: 'ОТКРЫТЬ', n: states.done.length, onPress: () => (setTasksDone(states.done, false), sel.cancel()) },
    {
      label: 'ПЕРЕНЕСТИ',
      n: picked.length,
      onPress: () =>
        openMenu({
          title: `Перенести: ${picked.length}`,
          actions: (Object.keys(MOVE_LABELS) as MoveTarget[]).map((to) => ({ label: MOVE_LABELS[to], onPress: () => (moveTasks(picked, to), sel.cancel()) })),
        }),
    },
    { label: 'УДАЛИТЬ', n: picked.length, danger: true, onPress: deleteSelected },
  ];

  return (
    <TasksListScreen
      {...data}
      today={today}
      insets={insets}
      onPickGroup={onPickGroup}
      onChangeView={changeView}
      onToggleSection={toggleSection}
      expandedPlans={expandedPlans}
      onTogglePlan={togglePlan}
      onToggleTask={toggleTask}
      onOpenTask={openTask}
      onOpenPlan={toPlanGrid}
      onLongPressTask={holdTask}
      onAdd={addTask}
      onOpenFeed={onOpenFeed}
      onOpenSettings={onOpenSettings}
      onNavigate={onNavigate}
      onRec={onRec}
      selected={sel.selected}
      pickable={pickable}
      allSelected={sel.allSelected}
      onStartSelect={sel.start}
      onToggleSelect={sel.toggle}
      onSelectMany={sel.toggleMany}
      onSelectAll={sel.selectAll}
      onCancelSelect={sel.cancel}
      onDeleteSelected={deleteSelected}
      selectActions={selectActions}
    />
  );
});
