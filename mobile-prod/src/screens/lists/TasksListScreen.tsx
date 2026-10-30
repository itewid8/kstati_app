/**
 * «Дела» списком (C-List): секции СЕГОДНЯ / ЗАВТРА / НЕДЕЛЯ в рамках, внутри — дела и планы
 * с шагами. Презентационный экран: секции и строки приходят пропсами, действия — колбэками.
 * Контент от top 122 до bottom 98 (над навигацией), прокручивается целиком.
 */
import { memo, useCallback, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { ID, PersonColor, TaskKind } from '@/lib/types';
import {
  BottomNav,
  ListMotion,
  RowMotion,
  SectionBox,
  TopBar,
  size as S,
  space,
  tint,
  useTheme,
  type LiftTarget,
  type NavTab,
  type Scheme,
  type TopBarAction,
} from '@/ui';
import { CAL } from '@/screens/calendar/components/CalendarScaffold';
import { PeriodNote, PeriodTitle, PeriodWeekday } from '@/screens/calendar/components/PeriodBar';
import { ViewSwitch, type TasksSwitchValue } from '@/screens/calendar/components/ViewSwitch';
import { MONTHS_SHORT, WEEKDAYS, pad2 as pad, parts, weekday } from '@/screens/calendar/format';
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
  /** Тип дела (значок после названия); нет — обычное */
  taskType?: TaskKind;
  /** Повторяется — значок ↻ после названия */
  repeat?: boolean;
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
  /** План закрыт (вручную: сам по подзадачам не закрывается) */
  done?: boolean;
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
  /** Свёрнут: видна только шапка (нажать — раскрыть) */
  collapsed?: boolean;
};

/** Куда переключились из списка: вид календаря */
export type TasksView = TasksSwitchValue;

export type TasksListScreenProps = {
  groupLabel: string;
  /** Сегодня (YYYY-MM-DD) — строка даты на месте строки периода календаря */
  today?: string;
  me: { letter: string; color: PersonColor };
  sections: TaskSection[];
  hasNews?: boolean;
  insets?: { top: number; bottom: number };

  onPickGroup?: () => void;
  onChangeView?: (view: TasksView) => void;
  /** Раскрытые планы (подзадачи видны); остальные свёрнуты */
  expandedPlans?: readonly ID[];
  /** Раскрыть или свернуть подзадачи плана */
  onTogglePlan?: (id: ID) => void;
  /** Свернуть или раскрыть раздел */
  onToggleSection?: (id: ID) => void;
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
/** Заливка плана и шагов цветом плана (в C-List плотнее не нужна: 0.14 / 0.16) */
const PLAN_ALPHA: Record<Scheme, number> = { light: 0.14, dark: 0.16 };
/** Секции начинаются сразу под заголовком (без вкладок) */
/** Строка даты и переключатель — там же, где в календаре (CAL), секции — под переключателем */
const SECTIONS_TOP = CAL.viewTop + S.viewSwitch + 12;

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
      taskType={task.taskType}
      repeat={task.repeat}
      onToggle={onToggleTask ? () => onToggleTask(task.id, !task.done) : undefined}
      onPress={onOpenTask ? () => onOpenTask(task.id) : undefined}
      onLongPress={onLongPressTask ? (lift) => onLongPressTask(task.id, lift) : undefined}
    />
  );
});

type PlanProps = { plan: PlanItem; expanded: boolean; onExpand?: (id: ID) => void } & RowCallbacks;

/** План и его подзадачи: подзадачи видны, только когда план раскрыт (по умолчанию свёрнут) */
const PlanEntry = memo(function PlanEntry({ plan, expanded, onExpand, onToggleTask, onOpenTask, onOpenPlan, onLongPressTask }: PlanProps) {
  const { scheme, person } = useTheme();
  const color = person(plan.color);
  const fill = tint(color, PLAN_ALPHA[scheme]);
  const done = !!plan.done;
  return (
    <>
      <TaskRow
        kind="plan"
        title={plan.progress ? `${plan.title} · ${plan.progress}` : plan.title}
        time={plan.range}
        strip={color}
        fill={fill}
        done={done}
        onToggle={onToggleTask ? () => onToggleTask(plan.id, !done) : undefined}
        expanded={plan.steps.length ? expanded : undefined}
        onExpand={onExpand ? () => onExpand(plan.id) : undefined}
        onPress={onOpenPlan ? () => onOpenPlan(plan.id) : undefined}
        onLongPress={onLongPressTask ? (lift) => onLongPressTask(plan.id, lift) : undefined}
      />
      {(expanded ? plan.steps : []).map((s) => (
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
    onToggleSection,
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
  const { c, person, personInk } = useTheme();
  const lead = useMemo(() => ({ kind: 'group' as const, label: groupLabel, onPress: onPickGroup }), [groupLabel, onPickGroup]);
  // Та же панель, что в календаре (CalendarScaffold): группа, «список / календарь», «+», лента, профиль
  const actions = useMemo<TopBarAction[]>(
    () => [
      { key: 'add', icon: 'plus', accessibilityLabel: 'Добавить', onPress: onAdd },
      { key: 'feed', icon: 'bell', accessibilityLabel: 'Лента', onPress: onOpenFeed, badge: hasNews },
      { key: 'me', letter: me.letter, fill: person(me.color), ink: personInk(me.color), accessibilityLabel: 'Настройки', onPress: onOpenSettings },
    ],
    [onAdd, onOpenFeed, onOpenSettings, hasNews, me.letter, me.color, person, personInk],
  );
  const expandedSet = useMemo(() => new Set(props.expandedPlans ?? []), [props.expandedPlans]);
  const renderEntry = useCallback(
    (e: TaskListEntry) =>
      e.kind === 'plan' ? (
        <RowMotion key={e.id}>
          <PlanEntry
            plan={e}
            expanded={expandedSet.has(e.id)}
            onExpand={props.onTogglePlan}
            onToggleTask={onToggleTask}
            onOpenTask={onOpenTask}
            onOpenPlan={onOpenPlan}
            onLongPressTask={onLongPressTask}
          />
        </RowMotion>
      ) : (
        <RowMotion key={e.id}>
          <TaskEntry task={e} onToggleTask={onToggleTask} onOpenTask={onOpenTask} onLongPressTask={onLongPressTask} />
        </RowMotion>
      ),
    [onToggleTask, onOpenTask, onOpenPlan, onLongPressTask, expandedSet, props.onTogglePlan],
  );

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <TopBar lead={lead} actions={actions} style={[styles.abs, { top: insets.top + S.topBarTop }]} />
      {props.today ? (
        <View style={[styles.abs, styles.period, { top: insets.top + CAL.periodTop }]}>
          <PeriodWeekday label={WEEKDAYS[weekday(props.today)]} today />
          <PeriodTitle text={pad(parts(props.today).d)} />
          <PeriodNote lines={[MONTHS_SHORT[parts(props.today).m - 1], String(parts(props.today).y)]} style={styles.periodNote} />
        </View>
      ) : null}
      <ViewSwitch value="list" onChange={onChangeView} style={[styles.abs, { top: insets.top + CAL.viewTop }]} />

      <ScrollView
        // Непрозрачный фон: на web прозрачный слой прокрутки выключает субпиксельное сглаживание текста
        style={[styles.abs, { top: insets.top + SECTIONS_TOP, bottom: insets.bottom + S.contentBottom, backgroundColor: c.bg }]}
        contentContainerStyle={styles.sections}
        showsVerticalScrollIndicator={false}
      >
        {/* Смена группы — новый список целиком, без анимации строк */}
        <ListMotion key={groupLabel}>
          {sections.map((sec) => (
            <SectionBox
              key={sec.id}
              title={sec.label}
              count={sec.date}
              collapsed={!!sec.collapsed}
              onToggle={onToggleSection ? () => onToggleSection(sec.id) : undefined}
              style={styles.section}
            >
              {sec.items.map(renderEntry)}
            </SectionBox>
          ))}
        </ListMotion>
      </ScrollView>

      <BottomNav active="tasks" onSelect={onNavigate} onRec={onRec} style={[styles.abs, { bottom: insets.bottom + S.navBottom }]} />
    </View>
  );
});

const styles = StyleSheet.create({
  period: { height: CAL.periodHeight, flexDirection: 'row', alignItems: 'center', gap: 6 },
  periodNote: { marginLeft: 2 },
  screen: { flex: 1 },
  abs: { position: 'absolute', left: space.side, right: space.side },
  sections: { gap: 10 },
  section: { flexShrink: 0 },
});
