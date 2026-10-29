/**
 * «Дела»: список или календарь — один переключатель на одном месте верхней панели (C-List, C-Day … C-Year).
 * Две кнопки 36×40 со общей линией; выбранная — залита цветом текста.
 */
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, type IconName } from './Icon';
import { size as S } from './tokens';
import { useTheme } from './useTheme';

export type TasksMode = 'list' | 'calendar';

const ITEMS: ReadonlyArray<{ key: TasksMode; icon: IconName; label: string }> = [
  { key: 'list', icon: 'list', label: 'Список' },
  { key: 'calendar', icon: 'calendar', label: 'Календарь' },
];

export const ModeSwitch = memo(function ModeSwitch({ value, onChange }: { value: TasksMode; onChange?: (mode: TasksMode) => void }) {
  const { c } = useTheme();
  return (
    <View style={styles.row}>
      {ITEMS.map((it, i) => {
        const on = it.key === value;
        return (
          <Pressable
            key={it.key}
            accessibilityRole="button"
            accessibilityLabel={it.label}
            accessibilityState={{ selected: on }}
            onPress={on || !onChange ? undefined : () => onChange(it.key)}
            style={[styles.cell, i > 0 && styles.next, { borderColor: c.border, backgroundColor: on ? c.text : c.panel }]}
          >
            <Icon name={it.icon} size={S.icon} color={on ? c.bg : c.text} />
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexShrink: 0 },
  cell: { width: 36, height: S.topBarHeight, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
  next: { marginLeft: -S.border },
});
