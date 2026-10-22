import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts, size as S, useTheme } from '@/ui';

export type ScopeOption<K extends string> = { key: K; label: string };

type Props<K extends string> = {
  options: readonly ScopeOption<K>[];
  value: K;
  onChange?: (key: K) => void;
};

/** Выбор из двух-трёх вариантов высотой 32: «ТОЛЬКО 10 ОКТ | ВСЕ ПОВТОРЫ», рамки сливаются */
function ScopeSwitchImpl<K extends string>({ options, value, onChange }: Props<K>) {
  const { c } = useTheme();
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {options.map((o, i) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
            onPress={onChange ? () => onChange(o.key) : undefined}
            style={[
              styles.option,
              // Колонки равные; следующая наезжает на рамку предыдущей
              i < options.length - 1 ? { width: `${100 / options.length}%` as const } : styles.last,
              i > 0 && styles.overlap,
              { borderColor: c.border, backgroundColor: on ? c.text : c.panel },
            ]}
          >
            <Text numberOfLines={1} style={[styles.label, on && styles.labelOn, { color: on ? c.bg : c.text }]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const ScopeSwitch = memo(ScopeSwitchImpl) as typeof ScopeSwitchImpl;

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  option: { height: 32, borderWidth: S.border, paddingHorizontal: 2, alignItems: 'center', justifyContent: 'center' },
  last: { flex: 1 },
  overlap: { marginLeft: -S.border },
  label: { fontFamily: fonts.mono400, fontSize: 9, letterSpacing: 0.36 },
  labelOn: { fontFamily: fonts.mono600 },
});
