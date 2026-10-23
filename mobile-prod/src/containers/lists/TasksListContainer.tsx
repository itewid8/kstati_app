import { router } from 'expo-router';
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { tasksListProps, type TasksListSnapshot } from '@/adapters/lists/tasksList';
import type { Snapshot } from '@/adapters/snapshot';
import { parseKey } from '@/adapters/common/tasks';
import { useStore } from '@/lib/store';
import type { ID } from '@/lib/types';
import { TasksListScreen, type TasksView } from '@/screens/lists/TasksListScreen';
import { NO_ME, nav, signedInOnly, toPlanGrid, useChrome, useClock, useInsets, usePersonColors, type StoreState } from '../common';
import { holdTask } from '../quick/quickStore';

const changeView = (v: TasksView) => {
  if (v !== 'list') useStore.getState().setTasksView(v);
};

/** Отметка по ключу строки: «id@дата» — раз серии */
const toggleTask = (key: ID) => {
  const { id, occ } = parseKey(key);
  useStore.getState().toggleTask(id, occ);
};

const openTask = (key: ID) => router.push(nav.taskEditor(parseKey(key)));
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
});

/** C-List: вкладка «Дела» списком (s.tasksView === 'list'); без групп сюда не попадают (app/(tabs)/tasks/index.tsx) */
export const TasksListContainer = signedInOnly(function TasksList() {
  const s = useStore(useShallow(pickList));
  // Список меняется раз в день, а не каждую минуту
  const { today } = useClock();
  const insets = useInsets();
  const { onPickGroup, onOpenFeed, onOpenSettings, onNavigate, onRec } = useChrome('tasks');
  const colors = usePersonColors(s);
  const data = useMemo(() => tasksListProps(s, colors, { today }), [s, colors, today]);

  return (
    <TasksListScreen
      {...data}
      insets={insets}
      onPickGroup={onPickGroup}
      onChangeView={changeView}
      onToggleTask={toggleTask}
      onOpenTask={openTask}
      onOpenPlan={toPlanGrid}
      onLongPressTask={holdTask}
      onAdd={addTask}
      onOpenFeed={onOpenFeed}
      onOpenSettings={onOpenSettings}
      onNavigate={onNavigate}
      onRec={onRec}
    />
  );
});
