/**
 * «Дела» списком (C-List): секции СЕГОДНЯ / ЗАВТРА / НЕДЕЛЯ в рамках, внутри — дела и планы
 * с шагами. Презентационный экран: секции и строки приходят пропсами, действия — колбэками.
 * Контент от top 122 до bottom 98 (над навигацией), прокручивается целиком.
 */
import { memo, useCallback, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { ID, PersonColor } from '@/lib/types';
import { BottomNav, ScreenTitle, SectionBox, Tabs, size as S, space, tint, useTheme, type LiftTarget, type NavTab, type Scheme, type TabItem } from '@/ui';
import { CompactGroupBar } from './components/CompactGroupBar';
import { TaskRow } from './components/TaskRow';

/** Одно или два цвета (общее дело: верх — первый, низ — второй) */
export type Owners = readonly [PersonColor] | readonly [PersonColor, PersonColor];

export type TaskItem = {
  kind: 'task';
  id: ID;
  title: string;
  /** «09:30», «—» */
  time: string;
  owners: Owners;
  done: boolean;
  /** Моё дело, скрытое от этой группы, — заштриховано */
  hidden?: boolean;
};

export type PlanStep = {
  id: ID;
  title: string;
  /** «СР 06» */
  when: string;
  done: boolean;
};

export type PlanItem = {
  kind: 'plan';
  id: ID;
  title: string;
  /** «1/3» — дописывается к названию через « · » */
  progress?: string;
  /** «7—9» */
  range: string;
  /** Цвет плана: полоса и заливка */
  color: PersonColor;
  steps: PlanStep[];
};

export type TaskListEntry = TaskItem | PlanItem;

export type TaskSection = {
  id: ID;
  /** «СЕГОДНЯ» */
  label: string;
  /** «ПН 05», «07—11» */
  date: string;
  items: TaskListEntry[];
};

export type TasksView = 'list' | 'week';

export type TasksListScreenProps = {
  groupLabel: string;
  me: { letter: string; color: PersonColor };
  sections: TaskSection[];
  hasNews?: boolean;
  insets?: { top: number; bottom: number };

  onPickGroup?: () => void;
  onChangeView?: (view: TasksView) => void;
  /** Дело или шаг плана отмечен/снят */
  onToggleTask?: (id: ID, done: boolean) => void;
  onOpenTask?: (id: ID) => void;
  onOpenPlan?: (id: ID) => void;
  /** Удержание дела, плана или шага (быстрые действия): id и нажатая строка */
  onLongPressTask?: (id: ID, lift: LiftTarget) => void;
  onAdd?: () => void;
  onOpenFeed?: () => void;
  onOpenSettings?: () => void;
  onNavigate?: (tab: NavTab) => void;
  onRec?: () => void;
};

const NO_INSETS = { top: 0, bottom: 0 };
const VIEWS: ReadonlyArray<TabItem<TasksView>> = [
  { key: 'list', label: 'СПИСОК' },
  { key: 'week', label: 'НЕДЕЛЯ' },
];
/** Заливка плана и шагов цветом плана (в C-List плотнее не нужна: 0.14 / 0.16) */
const PLAN_ALPHA: Record<Scheme, number> = { light: 0.14, dark: 0.16 };
/** Секции начинаются сразу под заголовком (без вкладок) */
const SECTIONS_TOP = 122;

type RowCallbacks = Pick<TasksListScreenProps, 'onToggleTask' | 'onOpenTask' | 'onOpenPlan' | 'onLongPressTask'>;

const TaskEntry = memo(function TaskEntry({ task, onToggleTask, onOpenTask, onLongPressTask }: { task: TaskItem } & RowCallbacks) {
  const { person } = useTheme();
  const [a, b] = task.owners;
  return (
    <TaskRow
      kind="task"
      title={task.title}
      time={task.time}
      strip={b ? [person(a), person(b)] : person(a)}
      done={task.done}
      hidden={task.hidden}
      onToggle={onToggleTask ? () => onToggleTask(task.id, !task.done) : undefined}
      onPress={onOpenTask ? () => onOpenTask(task.id) : undefined}
      onLongPress={onLongPressTask ? (lift) => onLongPressTask(task.id, lift) : undefined}
    />
  );
});

const PlanEntry = memo(function PlanEntry({ plan, onToggleTask, onOpenTask, onOpenPlan, onLongPressTask }: { plan: PlanItem } & RowCallbacks) {
  const { scheme, person } = useTheme();
  const color = person(plan.color);
  const fill = tint(color, PLAN_ALPHA[scheme]);
  const allDone = plan.steps.length > 0 && plan.steps.every((s) => s.done);
  return (
    <>
      <TaskRow
        kind="plan"
        title={plan.progress ? `${plan.title} · ${plan.progress}` : plan.title}
        time={plan.range}
        strip={color}
        fill={fill}
        done={allDone}
        onPress={onOpenPlan ? () => onOpenPlan(plan.id) : undefined}
        onLongPress={onLongPressTask ? (lift) => onLongPressTask(plan.id, lift) : undefined}
      />
      {plan.steps.map((s) => (
        <TaskRow
          key={s.id}
          kind="step"
          title={s.title}
          time={s.when}
          strip={color}
          fill={fill}
          done={s.done}
          onToggle={onToggleTask ? () => onToggleTask(s.id, !s.done) : undefined}
          onPress={onOpenTask ? () => onOpenTask(s.id) : undefined}
          onLongPress={onLongPressTask ? (lift) => onLongPressTask(s.id, lift) : undefined}
        />
      ))}
    </>
  );
});

export const TasksListScreen = memo(function TasksListScreen(props: TasksListScreenProps) {
  const {
    groupLabel,
    me,
    sections,
    hasNews,
    insets = NO_INSETS,
    onPickGroup,
    onChangeView,
    onToggleTask,
    onOpenTask,
    onOpenPlan,
    onLongPressTask,
    onAdd,
    onOpenFeed,
    onOpenSettings,
    onNavigate,
    onRec,
  } = props;
  const { c } = useTheme();
  const viewSwitch = useMemo(
    () => <Tabs variant="view" items={VIEWS} value="list" onChange={onChangeView} style={styles.view} />,
    [onChangeView],
  );
  const renderEntry = useCallback(
    (e: TaskListEntry) =>
      e.kind === 'plan' ? (
        <PlanEntry
          key={e.id}
          plan={e}
          onToggleTask={onToggleTask}
          onOpenTask={onOpenTask}
          onOpenPlan={onOpenPlan}
          onLongPressTask={onLongPressTask}
        />
      ) : (
        <TaskEntry key={e.id} task={e} onToggleTask={onToggleTask} onOpenTask={onOpenTask} onLongPressTask={onLongPressTask} />
      ),
    [onToggleTask, onOpenTask, onOpenPlan, onLongPressTask],
  );

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <CompactGroupBar
        groupLabel={groupLabel}
        me={me}
        hasNews={hasNews}
        onPickGroup={onPickGroup}
        onAdd={onAdd}
        onOpenFeed={onOpenFeed}
        onOpenSettings={onOpenSettings}
        style={[styles.abs, { top: insets.top + S.topBarTop }]}
      />
      <ScreenTitle title="Дела" right={viewSwitch} style={[styles.abs, { top: insets.top + S.titleTop }]} />

      <ScrollView
        // Непрозрачный фон: на web прозрачный слой прокрутки выключает субпиксельное сглаживание текста
        style={[styles.abs, { top: insets.top + SECTIONS_TOP, bottom: insets.bottom + S.contentBottom, backgroundColor: c.bg }]}
        contentContainerStyle={styles.sections}
        showsVerticalScrollIndicator={false}
      >
        {sections.map((sec) => (
          <SectionBox key={sec.id} title={sec.label} count={sec.date} style={styles.section}>
            {sec.items.map(renderEntry)}
          </SectionBox>
        ))}
      </ScrollView>

      <BottomNav active="tasks" onSelect={onNavigate} onRec={onRec} style={[styles.abs, { bottom: insets.bottom + S.navBottom }]} />
    </View>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  abs: { position: 'absolute', left: space.side, right: space.side },
  view: { marginBottom: 5 },
  sections: { gap: 10 },
  section: { flexShrink: 0 },
});
