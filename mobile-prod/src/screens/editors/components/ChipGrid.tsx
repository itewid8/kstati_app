/**
 * Сетка пресетов 32px с зазором 4px (повтор, напоминания).
 * selected — инвертирован; used — уже добавлен (бледная рамка и текст).
 */
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { size as S, useTheme } from '@/ui';
import { ET } from './text';

export type ChipState = 'normal' | 'selected' | 'used';

export type ChipItem<K extends string> = {
  key: K;
  label: string;
  state?: ChipState;
};

type Props<K extends string> = {
  items: ReadonlyArray<ChipItem<K>>;
  columns?: number;
  /** Начертание невыбранных: regular (повтор) или medium (напоминания) */
  weight?: 'regular' | 'medium';
  onPress?: (key: K) => void;
};

function ChipGridInner<K extends string>({ items, columns = 3, weight = 'regular', onPress }: Props<K>) {
  const { c } = useTheme();
  const rows: ChipItem<K>[][] = [];
  for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns));
  return (
    <View style={styles.grid}>
      {rows.map((row) => (
        <View key={row[0].key} style={styles.row}>
          {row.map(({ key, label, state = 'normal' }) => {
            const selected = state === 'selected';
            const used = state === 'used';
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: used }}
                accessibilityLabel={label}
                disabled={used}
                onPress={onPress ? () => onPress(key) : undefined}
                style={[
                  styles.chip,
                  { borderColor: used ? c.hair : c.border, backgroundColor: selected ? c.text : c.panel },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    selected ? ET.chipStrong : weight === 'medium' || used ? ET.chipMedium : ET.chip,
                    { color: selected ? c.bg : used ? c.faint : c.text },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
          {Array.from({ length: columns - row.length }, (_, i) => (
            <View key={`gap${i}`} style={styles.empty} />
          ))}
        </View>
      ))}
    </View>
  );
}

export const ChipGrid = memo(ChipGridInner) as typeof ChipGridInner;

const styles = StyleSheet.create({
  grid: { gap: 4 },
  row: { flexDirection: 'row', gap: 4 },
  chip: { flex: 1, minWidth: 0, height: 32, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1 },
});
