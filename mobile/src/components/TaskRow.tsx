import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { taskWhen } from '@/lib/dates';
import { userName, useStore } from '@/lib/store';
import type { Task } from '@/lib/types';
import { useDelayedMark } from '@/lib/useMark';
import { space, useColors } from '@/theme';
import { openMenu } from './ActionMenu';
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
}: {
  task: Task;
  past?: boolean;
  whenFormat?: 'full' | 'time';
  /** 0 — отметка сразу, строка остаётся на месте */
  markDelay?: number;
}) {
  const c = useColors();
  const users = useStore((s) => s.users);
  const override = useStore((s) => s.overrides[task.id]);
  const { toggleTask, deleteTask, setCard } = useStore.getState();
  const { marked: done, toggle } = useDelayedMark(!!task.doneAt, () => toggleTask(task.id), markDelay);

  const edit = () =>
    setCard({
      source: 'edit',
      editing: true,
      items: [{ key: task.id, id: task.id, type: 'task', data: { title: task.title, date: task.date, time: task.time, note: task.note ?? '', reminder: override } }],
    });

  const when = whenFormat === 'time' ? (task.time ?? '') : task.date || task.time ? taskWhen(task.date, task.time) : '';

  return (
    <SwipeRow onSwipeRight={toggle} onSwipeLeft={() => deleteTask(task.id)}>
      <Pressable
        onPress={edit}
        onLongPress={() =>
          openMenu({
            title: task.title,
            actions: [
              { label: 'Изменить', onPress: edit },
              { label: 'Удалить', danger: true, onPress: () => deleteTask(task.id) },
            ],
          })
        }
        delayLongPress={350}
        style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.surface : c.background }]}>
        <Checkbox checked={done} onPress={toggle} />
        <View style={{ flex: 1 }}>
          <T numberOfLines={2} muted={done} style={done ? { textDecorationLine: 'line-through' } : undefined}>
            {task.title}
          </T>
          <T variant="label" muted>
            {userName(users, task.createdBy)}
          </T>
        </View>
        {when ? (
          <T variant="caption" mono muted={!past} danger={past && !done}>
            {when}
          </T>
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
