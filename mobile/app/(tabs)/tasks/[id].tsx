import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openMenu } from '@/components/ActionMenu';
import { useBottomSpace, useTabBarSpace } from '@/components/BottomBar';
import { ChevronLeft, Ellipsis, Plus } from '@/components/icons';
import { PullScreen, PullScrollView } from '@/components/PullRefresh';
import { DayHeader, TimeGrid, type GridColumn } from '@/components/TimeGrid';
import { deleteTaskAsk, editTask, TaskRow, taskMenu } from '@/components/TaskRow';
import { Divider, SectionLabel, T } from '@/components/ui';
import { fromISODate, shortDate, sortKey, WEEKDAYS_SHORT } from '@/lib/dates';
import { uid } from '@/lib/ids';
import { daysOf, fromMin, spanLabel } from '@/lib/span';
import { useStore } from '@/lib/store';
import type { Task } from '@/lib/types';
import { ICON, space, useColors } from '@/theme';

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * План большого дела (поездка на три дня): подзадачи по дням и по времени, как в недельной сетке,
 * и списком — с пунктами без времени (чек-лист). «+», нажатие на пустое место сетки и микрофон добавляют подзадачи сюда.
 */
export default function PlanScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const task = useStore((s) => s.tasks.find((t) => t.id === id) ?? null);
  const all = useStore((s) => s.tasks);
  const { setCard, setVoiceParent } = useStore.getState();
  const bottom = useBottomSpace();
  const tabBar = useTabBarSpace();

  const kids = useMemo(() => all.filter((t) => t.parentId === id), [all, id]);
  const done = kids.filter((t) => t.doneAt).length;
  const days = useMemo(() => (task ? daysOf(task).slice(0, 14) : []), [task]);
  const timed = kids.some((t) => t.time);
  const [mode, setMode] = useState<'grid' | 'list'>(() => (days.length && timed ? 'grid' : 'list'));

  // Голос, начатый на этом экране, добавляет подзадачи в план
  useFocusEffect(
    useCallback(() => {
      setVoiceParent(id ?? null);
      return () => setVoiceParent(null);
    }, [id]),
  );

  const add = (date: string | null = null, minutes?: number) =>
    setCard({
      source: 'manual',
      editing: true,
      items: [
        {
          key: uid(),
          type: 'task',
          data: {
            title: '',
            date,
            time: minutes !== undefined ? fromMin(minutes) : null,
            endTime: minutes !== undefined ? fromMin(Math.min(minutes + 60, 23 * 60 + 59)) : null,
            parentId: id,
            people: task?.people,
          },
        },
      ],
    });

  if (!task) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <ChevronLeft size={22} strokeWidth={ICON.stroke} color={c.text} />
          </Pressable>
        </View>
        <T muted style={{ padding: space.side }}>
          Дела больше нет
        </T>
      </View>
    );
  }

  const columns: GridColumn[] = days.map((d) => {
    const date = fromISODate(d);
    return {
      key: d,
      day: d,
      header: <DayHeader date={date} label={WEEKDAYS_SHORT[(date.getDay() + 6) % 7]} />,
      tasks: kids.filter((t) => daysOf(t).includes(d)),
    };
  });

  // Списком: по дням плана, потом — без даты (чек-лист)
  const byDay = days.map((d) => ({
    day: d,
    list: kids.filter((t) => t.date === d).sort((a, b) => sortKey(a.date, a.time).localeCompare(sortKey(b.date, b.time))),
  }));
  const other = kids
    .filter((t) => !t.date || !days.includes(t.date))
    .sort((a, b) => sortKey(a.date, a.time).localeCompare(sortKey(b.date, b.time)));

  const menu = () =>
    openMenu({
      title: task.title,
      actions: [
        { label: 'Изменить', onPress: () => editTask(task.id) },
        {
          label: 'Удалить план',
          danger: true,
          onPress: () => {
            deleteTaskAsk(task as Task);
            router.back();
          },
        },
      ],
    });

  return (
    <PullScreen>
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.navigate('/tasks'))} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, marginLeft: -4 })}>
            <ChevronLeft size={22} strokeWidth={ICON.stroke} color={c.text} />
          </Pressable>
          <Pressable onPress={() => editTask(task.id)} style={{ flex: 1 }}>
            <T variant="title" numberOfLines={1}>
              {task.title}
            </T>
            <T variant="caption" muted mono numberOfLines={1}>
              {[spanLabel(task), kids.length ? `${done}/${kids.length}` : ''].filter(Boolean).join(' · ')}
            </T>
          </Pressable>
          <Pressable onPress={() => add()} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <Plus size={22} strokeWidth={ICON.stroke} color={c.text} />
          </Pressable>
          <Pressable onPress={menu} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <Ellipsis size={22} strokeWidth={ICON.stroke} color={c.text} />
          </Pressable>
        </View>

        {days.length > 0 && (
          <View style={styles.segment}>
            {(['grid', 'list'] as const).map((m) => (
              <Pressable key={m} onPress={() => setMode(m)} hitSlop={6} style={{ paddingVertical: 6 }}>
                <T weight="medium" color={mode === m ? c.text : c.textMuted}>
                  {m === 'grid' ? 'По дням' : 'Списком'}
                </T>
                <View style={{ height: 1, marginTop: 4, backgroundColor: mode === m ? c.text : 'transparent' }} />
              </Pressable>
            ))}
          </View>
        )}

        {mode === 'grid' && days.length > 0 ? (
          <View style={{ flex: 1, paddingBottom: tabBar }}>
            {other.length > 0 && (
              <Pressable onPress={() => setMode('list')} style={({ pressed }) => [styles.other, { opacity: pressed ? 0.6 : 1 }]}>
                <T variant="caption" muted>
                  Без даты · {other.length}
                </T>
              </Pressable>
            )}
            <TimeGrid
              columns={columns}
              minColumnWidth={days.length > 4 ? 96 : undefined}
              onTask={(t) => editTask(t.id)}
              onLongTask={taskMenu}
              onSlot={(col, m) => add(col.day, m)}
            />
          </View>
        ) : (
          <PullScrollView contentContainerStyle={{ paddingBottom: bottom }}>
            {kids.length === 0 && (
              <T muted style={{ padding: space.side, paddingTop: 24 }}>
                Пока пусто
              </T>
            )}
            {byDay
              .filter((g) => g.list.length)
              .map((g) => (
                <View key={g.day}>
                  <SectionLabel>{cap(shortDate(g.day))}</SectionLabel>
                  {g.list.map((t, i) => (
                    <View key={t.id}>
                      {i > 0 && <Divider inset={space.side + 36} />}
                      <TaskRow task={t} whenFormat="time" day={g.day} markDelay={0} />
                    </View>
                  ))}
                </View>
              ))}
            {other.length > 0 && (
              <View>
                {days.length > 0 && <SectionLabel>Без даты</SectionLabel>}
                {other.map((t, i) => (
                  <View key={t.id}>
                    {i > 0 && <Divider inset={space.side + 36} />}
                    <TaskRow task={t} markDelay={0} />
                  </View>
                ))}
              </View>
            )}
          </PullScrollView>
        )}
      </View>
    </PullScreen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.side, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 16 },
  segment: { flexDirection: 'row', gap: 20, paddingHorizontal: space.side, paddingBottom: 8 },
  other: { paddingHorizontal: space.side, paddingBottom: 8 },
});
