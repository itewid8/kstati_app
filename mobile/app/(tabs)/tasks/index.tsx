import { CalendarDays, ChevronDown, List } from '@/components/icons';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { usePullRefresh } from '@/components/PullRefresh';
// Прокрутка из gesture-handler: щипок в календаре может её перехватить
import { ScrollView } from 'react-native-gesture-handler';
import { useBottomSpace, useTabBarSpace } from '@/components/BottomBar';
import { CalendarView } from '@/components/Calendar';
import { emptyDraft } from '@/components/CardSheet';
import { Header } from '@/components/Header';
import { NoGroup } from '@/components/NoGroup';
import { LayoutAnimationConfig, ListItem } from '@/components/ListItem';
import { TaskRow } from '@/components/TaskRow';
import { Divider, T } from '@/components/ui';
import { addDays, fromISODate, SECTION_ORDER, SECTION_TITLE, sectionFor, sortKey, toISODate, type Section } from '@/lib/dates';
import { expandTasks, listInstances, taskKey } from '@/lib/recur';
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
  const tabBar = useTabBarSpace();
  // Два пальца на календаре — прокрутку выключаем, чтобы щипок не превращался в прокрутку
  const [pinching, setPinching] = useState(false);
  const selected = useStore((st) => st.calendarDate);
  const setSelected = useStore((st) => st.setCalendarDate);

  const groupTasks = useMemo(() => allTasks.filter((t) => t.groupId === group?.id), [allTasks, group?.id]);
  // В календаре повторы серий разворачиваются в отдельные дни (на год с небольшим вокруг выбранной даты)
  // Пересчитываем при смене месяца, а не дня: иначе каждое нажатие на день недели разворачивало бы все повторы заново
  const month = selected.slice(0, 7);
  const calTasks = useMemo(() => {
    const d = fromISODate(`${month}-01`);
    return expandTasks(groupTasks, toISODate(addDays(d, -400)), toISODate(addDays(d, 430)));
  }, [groupTasks, month]);
  const calendar = view !== 'list';

  // Во время щипка по календарю обновление выключено, чтобы жест не превращался в «потянуть»
  const refreshControl = usePullRefresh(!pinching);

  const add = () => {
    const d = emptyDraft('task') as Extract<DraftItem, { type: 'task' }>;
    if (calendar) d.data.date = selected; // в календаре — на выбранный день
    setCard({ source: 'manual', items: [d], editing: true });
  };

  const toggle = (
    <Pressable
      onPress={() => setTasksView(calendar ? 'list' : 'week')}
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
          {calendar ? (
            // Календарь тянется до вкладок, микрофон — поверх; месяц и год листаются внутри листа
            <View style={{ flex: 1, paddingBottom: tabBar }}>
              <CalendarView
                tasks={calTasks}
                zoom={view}
                onZoom={setTasksView}
                selected={selected}
                onSelect={setSelected}
                onPinching={setPinching}
                members={group.memberIds}
                refreshControl={refreshControl}
              />
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ paddingBottom: bottom }} refreshControl={refreshControl}>
              <ListView tasks={groupTasks} />
            </ScrollView>
          )}
        </>
      )}
    </View>
  );
}

/** «День · Неделя · Месяц · Год» — текстовый переключатель в стиле таб-бара */
function Segmented({ value, onChange }: { value: TasksView; onChange: (v: TasksView) => void }) {
  const c = useColors();
  const items: { key: TasksView; label: string }[] = [
    { key: 'day', label: 'День' },
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

/** Список по разделам; раздел сворачивается нажатием на заголовок (по умолчанию свёрнуто «Прошло») */
function ListView({ tasks }: { tasks: Task[] }) {
  const c = useColors();
  const collapsed = useStore((s) => s.collapsedSections);
  const toggleSection = useStore((s) => s.toggleSection);
  const sections = useMemo(() => {
    const now = new Date();
    // Выполненные остаются на своём месте (затемнены) и исчезают через 30 дней.
    // У серии — один ближайший раз (и сегодняшний, если уже отмечен)
    // Все дела, в том числе подзадачи планов — отдельными строками
    const visible = listInstances(tasks, toISODate(now))
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
      {sections.map((s) => {
        const open = !collapsed.includes(s.key);
        return (
          <ListItem key={s.key}>
            <Pressable
              onPress={() => toggleSection(s.key)}
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              style={({ pressed }) => [styles.sectionHead, { opacity: pressed ? 0.6 : 1 }]}
            >
              <T variant="caption" muted>
                {SECTION_TITLE[s.key]}
              </T>
              {!open && (
                <T variant="caption" muted mono>
                  {s.items.length}
                </T>
              )}
              <View style={{ transform: [{ rotate: open ? '0deg' : '-90deg' }] }}>
                <ChevronDown size={14} strokeWidth={ICON.stroke} color={c.textMuted} />
              </View>
            </Pressable>
            {open &&
              s.items.map((t, i) => (
                <ListItem key={taskKey(t)}>
                  {i > 0 && <Divider inset={space.side + 36} />}
                  <TaskRow task={t} past={s.key === 'past'} markDelay={0} />
                </ListItem>
              ))}
          </ListItem>
        );
      })}
    </LayoutAnimationConfig>
  );
}

const styles = StyleSheet.create({
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingHorizontal: space.side, paddingTop: 20, paddingBottom: 6, minHeight: 44 },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: space.side,
    paddingBottom: 8,
  },
});
