/**
 * Подзадачи плана (C-EditPlan): шапка «ПОДЗАДАЧИ 1/5», полоска прогресса, строки 44px
 * (полоса цвета плана, отметка, название, когда; вне дат плана — полоса и подпись цветом warn),
 * снизу «+ ПОДЗАДАЧА».
 */
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ID } from '@/lib/types';
import { Icon, Marquee, size as S, type as T, useTheme } from '@/ui';
import { ET } from './text';

export type SubtaskItem = {
  id: ID;
  title: string;
  /** «ЧТ 8 ОКТ · 09:00–15:00», «СБ 10 ОКТ · ВНЕ ДАТ ПЛАНА» */
  meta: string;
  done: boolean;
  /** Вне дат плана (план перенесли, подзадача осталась на месте) */
  outside?: boolean;
};

type Props = {
  items: readonly SubtaskItem[];
  /** Цвет плана под тему: полоса строк и сделанные шаги прогресса */
  color: string;
  onToggle?: (id: ID, done: boolean) => void;
  onOpen?: (id: ID) => void;
  onAdd?: () => void;
};

export const SubtaskBox = memo(function SubtaskBox({ items, color, onToggle, onOpen, onAdd }: Props) {
  const { c } = useTheme();
  const done = items.filter((i) => i.done).length;
  return (
    <View style={[styles.box, { borderColor: c.border }]}>
      <View style={[styles.header, { backgroundColor: c.text }]}>
        <Text style={[T.section, { color: c.bg }]}>ПОДЗАДАЧИ</Text>
        <Text style={[T.section, { color: c.bg }]}>{`${done}/${items.length}`}</Text>
      </View>
      <View style={[styles.progress, { backgroundColor: c.panel }]}>
        {items.map((i) => (
          <View key={i.id} style={[styles.step, { backgroundColor: i.done ? color : c.hair }]} />
        ))}
      </View>
      {items.map((item) => (
        <SubtaskRow key={item.id} item={item} color={color} onToggle={onToggle} onOpen={onOpen} />
      ))}
      <Pressable
        accessibilityRole="button"
        onPress={onAdd}
        style={[styles.add, { backgroundColor: c.panel, borderTopColor: c.hair }]}
      >
        <Text style={[ET.blockAction, { color: c.text }]}>+ ПОДЗАДАЧА</Text>
      </Pressable>
    </View>
  );
});

type RowProps = {
  item: SubtaskItem;
  color: string;
  onToggle?: (id: ID, done: boolean) => void;
  onOpen?: (id: ID) => void;
};

const SubtaskRow = memo(function SubtaskRow({ item, color, onToggle, onOpen }: RowProps) {
  const { c } = useTheme();
  const strip = item.outside ? c.warn : color;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${item.meta}`}
      onPress={onOpen ? () => onOpen(item.id) : undefined}
      style={[styles.row, { backgroundColor: c.panel, borderTopColor: c.hair }]}
    >
      <View style={[styles.strip, { backgroundColor: strip }]} />
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.done }}
        accessibilityLabel="Сделано"
        hitSlop={4}
        onPress={onToggle ? () => onToggle(item.id, !item.done) : undefined}
        style={styles.checkTap}
      >
        <View style={[styles.check, { borderColor: c.border, backgroundColor: item.done ? c.text : c.bg }]}>
          {item.done ? <Icon name="check" size={11} color={c.bg} /> : null}
        </View>
      </Pressable>
      <View style={styles.text}>
        <Marquee
          style={[ET.subtaskTitle, { color: item.done ? c.muted : c.text }, item.done && styles.struck]}
        >
          {item.title}
        </Marquee>
        <Marquee style={[ET.subtaskMeta, { color: item.outside ? c.warn : c.muted }]}>
          {item.meta}
        </Marquee>
      </View>
      <Icon name="chevronRight" size={12} color={c.muted} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  box: { borderWidth: S.border },
  header: {
    height: S.sectionHeader,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progress: { flexDirection: 'row', gap: 3, paddingVertical: 6, paddingHorizontal: 8 },
  step: { flex: 1, height: 4 },
  /** 44 вместе с разделителем (border-box в макете) */
  row: {
    height: S.row,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 7,
    paddingRight: 8,
    borderTopWidth: S.hairline,
  },
  strip: { position: 'absolute', left: 0, top: 0, bottom: 0, width: S.strip },
  checkTap: { marginLeft: 3, width: S.checkTap, height: S.checkTap, alignItems: 'center', justifyContent: 'center' },
  check: { width: S.checkbox, height: S.checkbox, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0, gap: 1 },
  struck: { textDecorationLine: 'line-through' },
  add: { height: 40, borderTopWidth: S.hairline, paddingHorizontal: 12, justifyContent: 'center' },
});
