import { memo } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon } from './Icon';
import { size as S } from './tokens';
import { useTheme } from './useTheme';

type Props = {
  checked: boolean;
  onPress?: () => void;
  accessibilityLabel: string;
  /** Зона нажатия (по умолчанию 32×32; в строке «сделано» — 34×33) */
  tapWidth?: number;
  tapHeight?: number;
  /** Заливка пустого квадрата: фон экрана (по умолчанию) или прозрачный */
  emptyFill?: 'bg' | 'none';
  style?: StyleProp<ViewStyle>;
};

/** Квадрат 18px: пустой — рамка 1.5px, отмеченный — заливка цветом текста с галочкой */
export const Checkbox = memo(function Checkbox({
  checked,
  onPress,
  accessibilityLabel,
  tapWidth = S.checkTap,
  tapHeight = S.checkTap,
  emptyFill = 'bg',
  style,
}: Props) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={4}
      style={[styles.tap, { width: tapWidth, height: tapHeight }, style]}
    >
      {checked ? (
        <View style={[styles.box, { backgroundColor: c.text }]}>
          <Icon name="check" size={11} color={c.bg} />
        </View>
      ) : (
        <View
          style={[
            styles.box,
            styles.empty,
            { borderColor: c.border, backgroundColor: emptyFill === 'bg' ? c.bg : 'transparent' },
          ]}
        />
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  tap: { flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  box: { width: S.checkbox, height: S.checkbox, alignItems: 'center', justifyContent: 'center' },
  empty: { borderWidth: S.border },
});
