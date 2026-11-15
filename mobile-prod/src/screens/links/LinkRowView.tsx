/** Строка связанной записи: ярлык типа, название и пояснение; справа — «×» (убрать связь) или галочка выбора */
import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { LinkRow } from '@/adapters/links';
import { Icon, Marquee, size as S, type as T, useTheme } from '@/ui';

type Props = { row: LinkRow; onPress?: () => void; onRemove?: () => void; right?: ReactNode };

export const LinkRowView = memo(function LinkRowView({ row, onPress, onRemove, right }: Props) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${row.kind}: ${row.title}`}
      onPress={onPress}
      disabled={!onPress}
      style={[styles.row, { backgroundColor: c.panel, borderTopColor: c.hair }]}
    >
      <View style={[styles.kind, { borderColor: c.border }]}>
        <Text style={[T.section, { color: c.text }]}>{row.kind.toLocaleUpperCase('ru-RU')}</Text>
      </View>
      <View style={styles.text}>
        <Marquee style={[T.rowTitle, { color: c.text }]}>{row.title}</Marquee>
        {row.meta ? <Marquee style={[T.rowMeta, { color: c.muted }]}>{row.meta}</Marquee> : null}
      </View>
      {right}
      {onRemove ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Убрать связь с «${row.title}»`} hitSlop={8} onPress={onRemove} style={styles.remove}>
          <Icon name="close" size={14} color={c.muted} />
        </Pressable>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { minHeight: S.row, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 8, paddingRight: 6, borderTopWidth: S.hairline },
  kind: { height: 20, paddingHorizontal: 5, borderWidth: 1, justifyContent: 'center', flexShrink: 0 },
  text: { flex: 1, minWidth: 0, gap: 1 },
  remove: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
