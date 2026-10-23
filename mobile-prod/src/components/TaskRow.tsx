import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { toPlanGrid } from '@/containers/common/go';
import { openQuickActions } from '@/containers/quick/quickStore';
import { peopleOf, spanLabel, timeOn } from '@/lib/span';
import { userName, useStore } from '@/lib/store';
import type { Task } from '@/lib/types';
import { useDelayedMark } from '@/lib/useMark';
import { ICON, space, useColors } from '@/theme';
import { LONG_PRESS_MS, useLift, type LiftTarget } from '@/ui';
import { openMenu } from './ActionMenu';
import { ChevronDown, Repeat } from './icons';
import { SwipeRow } from './SwipeRow';
import { Checkbox, T } from './ui';

type TaskRowProps = {
  task: Task;
  /** План в списке: раскрыт ли (подзадачи под ним) и что делать по нажатию — раскрыть/свернуть */
  expanded?: boolean;
  onToggle?: () => void;
  /** Отступ слева: подзадача под своим планом */
  indent?: number;
  past?: boolean;
  whenFormat?: 'full' | 'time';
  /** День календаря, в котором показана строка (для многодневных: «с 10:00», «весь день») */
  day?: string;
  /** 0 — отметка сразу, строка остаётся на месте */
  markDelay?: number;
};

/**
 * Строка дела. Используется в списке и в календаре.
 * whenFormat: 'full' — «сб 3 окт · 19:00», 'time' — только время (в календаре, где день уже известен).
 */
export function TaskRow(props: TaskRowProps) {
  const { task, past, whenFormat = 'full', markDelay, day, expanded, onToggle, indent = 0 } = props;
  const c = useColors();
  const users = useStore((s) => s.users);
  // План: сколько подзадач и сколько из них сделано (числа, а не новый массив — иначе бесконечная перерисовка)
  const kidsCount = useStore((s) => s.tasks.reduce((n, t) => (t.parentId === task.id ? n + 1 : n), 0));
  const doneKids = useStore((s) => s.tasks.reduce((n, t) => (t.parentId === task.id && t.doneAt ? n + 1 : n), 0));
  const { toggleTask, setCard } = useStore.getState();
  const { marked: done, toggle } = useDelayedMark(!!task.doneAt, () => toggleTask(task.id, task.occ), markDelay);

  // Удержание — окно быстрых действий над поднятой копией строки
  const hold = useCallback((lift: LiftTarget) => openQuickActions({ kind: 'task', id: task.id, occ: task.occ }, lift), [task.id, task.occ]);
  const lift = useLift(hold, 'row', () => <TaskRow {...props} />);

  const edit = () => editTask(task.id, setCard);
  const remove = () => deleteTaskAsk(task);
  // Большое дело с подзадачами: в списке раскрывается на месте, в остальных местах открывается планом
  const press = kidsCount ? (onToggle ?? (() => openPlan(task.id))) : edit;

  const when = whenFormat === 'time' ? timeOn(task, day ?? task.date ?? '') : task.date || task.time ? spanLabel(task) : '';
  const who = peopleOf(task)
    .map((id) => userName(users, id))
    .join(', ');
  const sub = kidsCount ? `${who} · ${doneKids}/${kidsCount}` : who;

  return (
    <SwipeRow onSwipeRight={toggle} onSwipeLeft={remove}>
      <Pressable
        ref={lift.ref}
        onPress={press}
        onLongPress={lift.onLongPress}
        delayLongPress={LONG_PRESS_MS}
        style={({ pressed }) => [styles.row, { paddingLeft: space.side + indent, backgroundColor: pressed ? c.surface : c.background }]}>
        <Checkbox checked={done} onPress={toggle} />
        <View style={{ flex: 1 }}>
          <T numberOfLines={2} muted={done} style={done ? { textDecorationLine: 'line-through' } : undefined}>
            {task.title}
          </T>
          <T variant="label" muted numberOfLines={1}>
            {sub}
          </T>
        </View>
        {task.repeat ? <Repeat size={14} strokeWidth={ICON.stroke} color={c.textMuted} /> : null}
        {when ? (
          <T variant="caption" mono muted={!past} danger={past && !done}>
            {when}
          </T>
        ) : null}
        {kidsCount && onToggle ? (
          <View style={{ transform: [{ rotate: expanded ? '0deg' : '-90deg' }] }}>
            <ChevronDown size={16} strokeWidth={ICON.stroke} color={c.textMuted} />
          </View>
        ) : null}
      </Pressable>
    </SwipeRow>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: space.rowMin,
    paddingHorizontal: space.side,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});

/** Открыть дело на правку. У повтора правится вся серия — берём её из хранилища (с датой первого раза) */
export function editTask(id: string, setCard = useStore.getState().setCard) {
  const s = useStore.getState();
  const t = s.tasks.find((x) => x.id === id);
  if (!t) return;
  setCard({
    source: 'edit',
    editing: true,
    items: [
      {
        key: t.id,
        id: t.id,
        type: 'task',
        data: {
          title: t.title,
          date: t.date,
          time: t.time,
          note: t.note ?? '',
          repeat: t.repeat ?? null,
          mine: s.overrides[t.id],
          shared: t.reminders ?? null,
          endDate: t.endDate ?? null,
          endTime: t.endTime ?? null,
          people: t.people,
          parentId: t.parentId ?? null,
        },
      },
    ],
  });
}

/** Экран плана большого дела (подзадачи по дням и чек-лист) — во вкладке «Дела», из любого места без второго (tabs) */
export function openPlan(id: string) {
  toPlanGrid(id);
}

/** Удалить: у повтора — спросить, только этот раз или всю серию */
export function deleteTaskAsk(task: Task) {
  const { deleteTask, endSeries } = useStore.getState();
  if (!task.repeat || !task.occ) return deleteTask(task.id);
  openMenu({
    title: `Удалить «${task.title}»?`,
    actions: [
      { label: 'Только этот раз', danger: true, onPress: () => deleteTask(task.id, task.occ) },
      { label: 'Этот и все следующие', danger: true, onPress: () => endSeries(task.id, prevDay(task.occ!)) },
      { label: 'Всю серию', danger: true, onPress: () => deleteTask(task.id) },
    ],
  });
}

const prevDay = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};
