/**
 * Переключатель «Дела»: ≡ (список) | ДЕНЬ | НЕДЕЛЯ | МЕСЯЦ | ГОД — одна строка в списке и в календаре.
 * Рамки встык (margin-left −1.5), высота 28; «≡» — узкая клетка с иконкой.
 */
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon, fonts, size as S, useTheme } from '@/ui';
import type { CalendarView } from '../types';

/** Что выбрано: список или вид календаря */
export type TasksSwitchValue = 'list' | CalendarView;

const VIEWS: ReadonlyArray<{ key: CalendarView; label: string }> = [
  { key: 'day', label: 'ДЕНЬ' },
  { key: 'week', label: 'НЕДЕЛЯ' },
  { key: 'month', label: 'МЕСЯЦ' },
  { key: 'year', label: 'ГОД' },
];

type Props = {
  value: TasksSwitchValue;
  onChange?: (value: TasksSwitchValue) => void;
  style?: StyleProp<ViewStyle>;
};

export const ViewSwitch = memo(function ViewSwitch({ value, onChange, style }: Props) {
  const { c } = useTheme();
  const press = (key: TasksSwitchValue) => (onChange && key !== value ? () => onChange(key) : undefined);
  const listOn = value === 'list';
  return (
    <View style={[styles.row, style]}>
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: listOn }}
        accessibilityLabel="Список"
        onPress={press('list')}
        style={[styles.list, { borderColor: c.border, backgroundColor: listOn ? c.text : c.panel }]}
      >
        <Icon name="list" size={S.iconSmall} color={listOn ? c.bg : c.text} />
      </Pressable>
      {VIEWS.map(({ key, label }) => {
        const on = key === value;
        return (
          <View key={key} style={styles.cell}>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={label}
              onPress={press(key)}
              style={[styles.button, styles.overlap, { borderColor: c.border, backgroundColor: on ? c.text : c.panel }]}
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
  list: { width: 40, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
  cell: { flex: 1, minWidth: 0 },
  button: { flex: 1, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
  overlap: { marginLeft: -S.border },
  label: { fontFamily: fonts.mono400, fontSize: 10.5, letterSpacing: 0.84 },
  labelOn: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.84 },
});
