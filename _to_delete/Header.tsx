import { useRouter } from 'expo-router';
import { Bell, ChevronDown, ChevronLeft, Plus } from '@/components/icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '@/lib/store';
import { ICON, space, useColors } from '@/theme';
import { Avatar } from './Avatar';
import { T } from './ui';

/** Шапка: слева название группы со стрелкой (или заголовок), справа «+» и иконка */

export function Header({
  title,
  groupSwitch,
  onPlus,
  actions,
}: {
  title: string;
  groupSwitch?: boolean;
  onPlus?: () => void;
  actions?: React.ReactNode;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const me = useStore((s) => s.me);
  const setGroupSheet = useStore((s) => s.setGroupSheet);
  // Точка на колокольчике — есть записи в ленте, которые ещё не видели
  const unread = useStore((s) => !!s.activity[0] && s.activity[0].id > s.activitySeen);

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8, backgroundColor: c.background }]}>
      <Pressable
        disabled={!groupSwitch}
        onPress={() => setGroupSheet(true)}
        hitSlop={8}
        style={({ pressed }) => [styles.title, { opacity: pressed ? 0.6 : 1 }]}
      >
        <T variant="title" numberOfLines={1}>
          {title}
        </T>
        {groupSwitch && <ChevronDown size={ICON.size} strokeWidth={ICON.stroke} color={c.textMuted} />}
      </Pressable>
      <View style={styles.right}>
        {actions}
        {onPlus && (
          <Pressable onPress={onPlus} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <Plus size={22} strokeWidth={ICON.stroke} color={c.text} />
          </Pressable>
        )}
        <Pressable onPress={() => router.push('/activity')} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
          <Bell size={21} strokeWidth={ICON.stroke} color={c.text} />
          {unread && <View style={[styles.badge, { backgroundColor: c.event, borderColor: c.background }]} />}
        </Pressable>
        <Pressable
          onPress={() => router.push('/settings')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Настройки"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          {me ? <Avatar id={me.id} size={32} /> : null}
        </Pressable>
      </View>
    </View>
  );
}

/** Шапка вложенного экрана со стрелкой назад */
export function BackHeader({ title }: { title: string }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8, backgroundColor: c.background, justifyContent: 'flex-start', gap: 8 }]}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, marginLeft: -4 })}>
        <ChevronLeft size={22} strokeWidth={ICON.stroke} color={c.text} />
      </Pressable>
      <T variant="title">{title}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: space.side,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  badge: { position: 'absolute', top: -1, right: -1, width: 9, height: 9, borderRadius: 5, borderWidth: 1.5 },
});
