/**
 * Панель действий режима выбора — на месте нижней навигации: «ОТМЕНА» и действия с числом выбранного
 * («УДАЛИТЬ 3»). Опасное действие — красная рамка; без выбранного — бледное. Одна на все экраны с выбором.
 */
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { fonts, size as S } from './tokens';
import { useTheme } from './useTheme';

export type SelectAction = { label: string; onPress?: () => void; danger?: boolean };

type Props = { count: number; actions: readonly SelectAction[]; onCancel?: () => void; style?: StyleProp<ViewStyle> };

export const SelectBar = memo(function SelectBar({ count, actions, onCancel, style }: Props) {
  const { c } = useTheme();
  return (
    <View style={[styles.bar, style]}>
      <Pressable accessibilityRole="button" onPress={onCancel} style={[styles.button, { borderColor: c.border, backgroundColor: c.panel }]}>
        <Text style={[styles.text, { color: c.text }]}>ОТМЕНА</Text>
      </Pressable>
      {actions.map((a) => (
        <Pressable
          key={a.label}
          accessibilityRole="button"
          accessibilityState={{ disabled: !count }}
          disabled={!count}
          onPress={a.onPress}
          style={[styles.button, { borderColor: a.danger ? c.red : c.border, backgroundColor: c.panel }, !count && styles.off]}
        >
          <Text numberOfLines={1} style={[styles.text, { color: a.danger ? c.red : c.text }]}>{count ? `${a.label} ${count}` : a.label}</Text>
        </Pressable>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  bar: { height: S.navHeight, flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  button: { flex: 1, borderWidth: S.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  text: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 1 },
  off: { opacity: 0.4 },
});
