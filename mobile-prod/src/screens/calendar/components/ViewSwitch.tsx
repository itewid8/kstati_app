/**
 * Переключатель вида календаря ДЕНЬ / НЕДЕЛЯ / МЕСЯЦ / ГОД: 4 равные колонки 28px, рамки встык
 * (margin-left −1.5 как в макете). Отличается от Tabs: шрифт 10.5 и высота 28 при равных колонках.
 */
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { fonts, size as S, useTheme } from '@/ui';
import type { CalendarView } from '../types';

const VIEWS: ReadonlyArray<{ key: CalendarView; label: string }> = [
  { key: 'day', label: 'ДЕНЬ' },
  { key: 'week', label: 'НЕДЕЛЯ' },
  { key: 'month', label: 'МЕСЯЦ' },
  { key: 'year', label: 'ГОД' },
];

type Props = {
  value: CalendarView;
  onChange?: (view: CalendarView) => void;
  style?: StyleProp<ViewStyle>;
};

export const ViewSwitch = memo(function ViewSwitch({ value, onChange, style }: Props) {
  const { c } = useTheme();
  return (
    <View style={[styles.row, style]}>
      {VIEWS.map(({ key, label }, i) => {
        const on = key === value;
        return (
          <View key={key} style={styles.cell}>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={label}
              onPress={onChange ? () => onChange(key) : undefined}
              style={[styles.button, { borderColor: c.border, backgroundColor: on ? c.text : c.panel }, i > 0 && styles.overlap]}
            >
              <Text numberOfLines={1} style={[on ? styles.labelOn : styles.label, { color: on ? c.bg : c.text }]}>
                {label}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { height: S.viewSwitch, flexDirection: 'row' },
  cell: { flex: 1, minWidth: 0 },
  button: { flex: 1, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
  overlap: { marginLeft: -S.border },
  label: { fontFamily: fonts.mono400, fontSize: 10.5, letterSpacing: 0.84 },
  labelOn: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.84 },
});
