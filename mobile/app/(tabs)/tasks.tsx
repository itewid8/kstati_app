import { CalendarDays, List } from '@/components/icons';
import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
// Прокрутка из gesture-handler: щипок в календаре может её перехватить
import { ScrollView } from 'react-native-gesture-handler';
import { useBottomSpace } from '@/components/BottomBar';
import { CalendarView } from '@/components/Calendar';
import { emptyDraft } from '@/components/CardSheet';
import { Header } from '@/components/Header';
import { NoGroup } from '@/components/NoGroup';
import { LayoutAnimationConfig, ListItem } from '@/components/ListItem';
import { TaskRow } from '@/components/TaskRow';
import { Divider, SectionLabel, T } from '@/components/ui';
import { SECTION_ORDER, SECTION_TITLE, sectionFor, sortKey, toISODate, type Section } from '@/lib/dates';
import { useCurrentGroup, useStore, type TasksView } from '@/lib/store';
import type { DraftItem, Task } from '@/lib/types';
import { ICON, space, useColors } from '@/theme';

const DONE_KEEP_MS = 30 * 86400000;

export default function Tasks() {
  const c = useColors();
  const group = useCurrentGroup();
  const allTasks = useStore((s) => s.tasks);
  const view = useStore((s) => s.tasksView);
  const { setCard, setTasksView } = useStore.getState();
  const bottom = useBottomSpace();
  const [refreshing, setRefreshing] = useState(false);
  // Два пальца на календаре — прокрутку выключаем, чтобы щипок не превращался в прокрутку
  const [pinching, setPinching] = useState(false);
  const selected = useStore((st) => st.calendarDate);
  const setSelected = useStore((st) => st.setCalendarDate);

  const groupTasks = useMemo(() => allTasks.filter((t) => t.groupId === group?.id), [allTasks, group?.id]);
  const calendar = view !== 'list';

  const refresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600); // заглушка синхронизации
  };

  const add = () => {
    const d = emptyDraft('task') as Extract<DraftItem, { type: 'task' }>;
    if (calendar) d.data.date = selected; // в календаре — на выбранный день
    setCard({ source: 'manual', items: [d], editing: true });
  };

  const toggle = (
    <Pressable
      onPress={() => setTasksView(calendar ? 'list' : 'month')}
      hitSlop={10}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      {calendar ? (
        <List size={22} strokeWidth={ICON.stroke} color={c.text} />
      ) : (
        <CalendarDays size={22} strokeWidth={ICON.stroke} color={c.text} />
      )}
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Header title={group?.name ?? 'Дела'} groupSwitch onPlus={group ? add : undefined} actions={group ? toggle : null} />
      {!group ? (
        <NoGroup />
      ) : (
        <>
          {calendar && <Segmented value={view} onChange={setTasksView} />}
          <ScrollView
            contentContainerStyle={{ paddingBottom: bottom }}
            scrollEnabled={!pinching}
            refreshControl={
              // «Потянуть, чтобы обновить» — только в списке: в календаре оно ловило щипки и свайпы
              calendar ? undefined : (
                <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.textMuted} colors={[c.text]} progressBackgroundColor={c.surface} />
              )
            }
          >
            {view === 'list' && <ListView tasks={groupTasks} />}
            {view !== 'list' && (
              <CalendarView
                tasks={groupTasks}
                zoom={view}
                onZoom={setTasksView}
                selected={selected}
                onSelect={setSelected}
                onPinching={setPinching}
              />
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
}

/** «Неделя · Месяц» — текстовый переключатель в стиле таб-бара */
function Segmented({ value, onChange }: { value: TasksView; onChange: (v: TasksView) => void }) {
  const c = useColors();
  const items: { key: TasksView; label: string }[] = [
    { key: 'week', label: 'Неделя' },
    { key: 'month', label: 'Месяц' },
    { key: 'year', label: 'Год' },
  ];
  return (
    <View style={styles.segment}>
      {items.map((it) => {
        const active = value === it.key;
        return (
          <Pressable key={it.key} onPress={() => onChange(it.key)} hitSlop={6} style={{ paddingVertical: 6 }}>
            <T weight="medium" color={active ? c.text : c.textMuted}>
              {it.label}
            </T>
            <View style={{ height: 1, marginTop: 4, backgroundColor: active ? c.text : 'transparent' }} />
          </Pressable>
        );
      })}
    </View>
  );
}

function ListView({ tasks }: { tasks: Task[] }) {
  const sections = useMemo(() => {
    const now = new Date();
    // Выполненные остаются на своём месте (затемнены) и исчезают через 30 дней
    const visible = tasks
      .filter((t) => !t.doneAt || now.getTime() - new Date(t.doneAt).getTime() < DONE_KEEP_MS)
      .sort((a, b) => sortKey(a.date, a.time).localeCompare(sortKey(b.date, b.time)));
    const by = new Map<Section, Task[]>();
    for (const t of visible) {
      const s = sectionFor(t.date, t.time, now);
      by.set(s, [...(by.get(s) ?? []), t]);
    }
    // «Без даты» — новые сверху
    by.get('none')?.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return SECTION_ORDER.filter((s) => by.has(s)).map((s) => ({ key: s, items: by.get(s)! }));
  }, [tasks]);

  return (
    <LayoutAnimationConfig skipEntering>
      {sections.length === 0 && (
        <T muted style={{ padding: space.side, paddingTop: 24 }}>
          Дел нет
        </T>
      )}
      {sections.map((s) => (
        <ListItem key={s.key}>
          <SectionLabel>{SECTION_TITLE[s.key]}</SectionLabel>
          {s.items.map((t, i) => (
            <ListItem key={t.id}>
              {i > 0 && <Divider inset={space.side + 36} />}
              <TaskRow task={t} past={s.key === 'past'} markDelay={0} />
            </ListItem>
          ))}
        </ListItem>
      ))}
    </LayoutAnimationConfig>
  );
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: 'row',
    gap: 20,
    paddingHorizontal: space.side,
    paddingBottom: 8,
  },
});
