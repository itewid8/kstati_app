import { router } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackHeader } from '@/components/Header';
import { usePullRefresh } from '@/components/PullRefresh';
import { Divider, SectionLabel, T } from '@/components/ui';
import { activityText } from '@/lib/activity';
import { addDays, shortDate, toISODate } from '@/lib/dates';
import { useStore } from '@/lib/store';
import { fetchActivity } from '@/lib/sync';
import type { Activity } from '@/lib/types';
import { space, useColors } from '@/theme';

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Лента: кто, что и в какой группе сделал за последние 30 дней. Свои действия не показываются */
export default function ActivityScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const events = useStore((s) => s.activity);
  const users = useStore((s) => s.users);
  const groups = useStore((s) => s.groups);
  const refreshControl = usePullRefresh();
  // Точку на колокольчике запоминаем при входе: что было непрочитанным — подсвечиваем до выхода
  const seenBefore = useMemo(() => useStore.getState().activitySeen, []);

  useEffect(() => {
    fetchActivity(true).then(() => useStore.getState().markActivitySeen());
    useStore.getState().markActivitySeen();
  }, []);

  const days = useMemo(() => {
    const today = toISODate(new Date());
    const yesterday = toISODate(addDays(new Date(), -1));
    const by = new Map<string, Activity[]>();
    for (const e of events) {
      const d = toISODate(new Date(e.at));
      by.set(d, [...(by.get(d) ?? []), e]);
    }
    return [...by.entries()].map(([d, list]) => ({ title: d === today ? 'Сегодня' : d === yesterday ? 'Вчера' : cap(shortDate(d)), list }));
  }, [events]);

  const open = (e: Activity) => {
    const s = useStore.getState();
    if (e.kind.startsWith('wish.')) {
      s.setWishPerson(e.actor);
      return router.navigate('/wishes');
    }
    if (e.groupId && s.groups.some((g) => g.id === e.groupId)) {
      s.selectGroup(e.groupId);
      if (e.kind.startsWith('watch.')) return router.navigate('/watch');
      if (e.kind.startsWith('task.')) {
        if (e.date) s.setCalendarDate(e.date);
        return router.navigate('/tasks');
      }
      return router.navigate('/group');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <BackHeader title="Активность" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} refreshControl={refreshControl}>
        {days.length === 0 && (
          <T muted style={{ padding: space.side, paddingTop: 24 }}>
            Здесь появится, что добавляют и отмечают участники ваших групп.
          </T>
        )}
        {days.map((day) => (
          <View key={day.title}>
            <SectionLabel>{day.title}</SectionLabel>
            <Divider />
            {day.list.map((e, i) => {
              const actor = users.find((u) => u.id === e.actor);
              const where = e.kind.startsWith('wish.') ? 'Хотелки' : (groups.find((g) => g.id === e.groupId)?.name ?? '');
              const fresh = e.id > seenBefore;
              const time = new Date(e.at);
              return (
                <View key={e.id}>
                  {i > 0 && <Divider inset={space.side} />}
                  <Pressable onPress={() => open(e)} style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.surface : 'transparent' }]}>
                    <View style={[styles.dot, { backgroundColor: fresh ? c.event : 'transparent' }]} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <T>
                        <T weight="medium">{actor?.name ?? 'Кто-то'}</T> {activityText(e, actor, users)}
                      </T>
                      <T variant="label" muted>
                        {[where, `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`].filter(Boolean).join(' · ')}
                      </T>
                    </View>
                  </Pressable>
                </View>
              );
            })}
            <Divider />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: space.side, paddingVertical: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 9 },
});
