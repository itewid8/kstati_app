import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { peopleOf, spanLabel, timeOn } from '@/lib/span';
import { userName, useStore } from '@/lib/store';
import type { Task } from '@/lib/types';
import { useDelayedMark } from '@/lib/useMark';
import { ICON, space, useColors } from '@/theme';
import { openMenu } from './ActionMenu';
import { ChevronDown, Repeat } from './icons';
import { SwipeRow } from './SwipeRow';
import { Checkbox, T } from './ui';

/**
 * Строка дела. Используется в списке и в календаре.
 * whenFormat: 'full' — «сб 3 окт · 19:00», 'time' — только время (в календаре, где день уже известен).
 */
export function TaskRow({
  task,
  past,
  whenFormat = 'full',
  markDelay,
  day,
  expanded,
  onToggle,
  indent = 0,
}: {
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
}) {
  const c = useColors();
  const users = useStore((s) => s.users);
  // План: сколько подзадач и сколько из них сделано (числа, а не новый массив — иначе бесконечная перерисовка)
  const kidsCount = useStore((s) => s.tasks.reduce((n, t) => (t.parentId === task.id ? n + 1 : n), 0));
  const doneKids = useStore((s) => s.tasks.reduce((n, t) => (t.parentId === task.id && t.doneAt ? n + 1 : n), 0));
  const { toggleTask, setCard } = useStore.getState();
  const { marked: done, toggle } = useDelayedMark(!!task.doneAt, () => toggleTask(task.id, task.occ), markDelay);

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
        onPress={press}
        onLongPress={() => taskMenu(task)}
        delayLongPress={350}
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

/** Можно ли разбить дело на подзадачи: не подзадача и не повтор */
export const canPlan = (t: Pick<Task, 'parentId' | 'repeat'>) => !t.parentId && !t.repeat;

/**
 * Меню дела по долгому нажатию — одно и то же в списке, календаре и сетке:
 * изменить, разбить на подзадачи / открыть план, удалить (у повтора — варианты).
 */
export function taskMenu(task: Task) {
  const s = useStore.getState();
  const kids = s.tasks.filter((t) => t.parentId === task.id).length;
  openMenu({
    title: task.title,
    actions: [
      { label: 'Изменить', onPress: () => editTask(task.id) },
      ...(canPlan(task) ? [{ label: kids ? 'Открыть план' : 'Разбить на подзадачи', onPress: () => openPlan(task.id) }] : []),
      ...(task.parentId ? [{ label: 'Открыть план', onPress: () => openPlan(task.parentId!) }] : []),
      ...(task.repeat && task.occ
        ? [
            { label: 'Удалить только этот раз', danger: true, onPress: () => s.deleteTask(task.id, task.occ) },
            { label: 'Завершить повторы после этого раза', onPress: () => s.endSeries(task.id, task.occ!) },
            { label: 'Удалить всю серию', danger: true, onPress: () => s.deleteTask(task.id) },
          ]
        : [{ label: 'Удалить', danger: true, onPress: () => deleteTaskAsk(task) }]),
    ],
  });
}

/** Экран плана большого дела (подзадачи по дням и чек-лист) */
export function openPlan(id: string) {
  router.push(`/tasks/${id}`);
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
