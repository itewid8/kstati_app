/**
 * Панель действий режима выбора — на месте нижней навигации: «×» (выйти из выбора) и до трёх действий,
 * характерных для типа записей, с числом записей, к которым действие применится («ЗАКРЫТЬ 3»).
 * Число 0 — кнопка бледная; опасное действие — красная рамка. Одна на все экраны с выбором.
 */
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon } from './Icon';
import { fonts, size as S } from './tokens';
import { useTheme } from './useTheme';

/** n — к скольким применится (нет — без числа, например «ПЕРЕНЕСТИ…» с выбором) */
export type SelectAction = { label: string; n?: number; onPress?: () => void; danger?: boolean };

type Props = { actions: readonly SelectAction[]; onCancel?: () => void; style?: StyleProp<ViewStyle> };

export const SelectBar = memo(function SelectBar({ actions, onCancel, style }: Props) {
  const { c } = useTheme();
  return (
    <View style={[styles.bar, style]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Выйти из выбора" onPress={onCancel} style={[styles.cancel, { borderColor: c.border, backgroundColor: c.panel }]}>
        <Icon name="close" size={16} color={c.text} />
      </Pressable>
      {actions.map((a) => {
        const off = a.n === 0;
        return (
          <Pressable
            key={a.label}
            accessibilityRole="button"
            accessibilityState={{ disabled: off }}
            disabled={off}
            onPress={a.onPress}
            style={[styles.button, { borderColor: a.danger ? c.red : c.border, backgroundColor: c.panel }, off && styles.off]}
          >
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.text, { color: a.danger ? c.red : c.text }]}>
              {a.n ? `${a.label} ${a.n}` : a.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  bar: { height: S.navHeight, flexDirection: 'row', gap: 6, alignItems: 'stretch' },
  cancel: { width: 44, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
  button: { flex: 1, borderWidth: S.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  text: { fontFamily: fonts.mono600, fontSize: 10, letterSpacing: 0.6 },
  off: { opacity: 0.4 },
});
