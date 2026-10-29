import { memo, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
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
  /** Цвет отмеченного квадрата; нет — цвет текста */
  checkedFill?: string;
  style?: StyleProp<ViewStyle>;
};

/** Отметка «щёлкает»: сжимается и пружинит обратно — видно, что нажатие прошло */
const POP = { damping: 9, stiffness: 320, mass: 0.6 };

/** Квадрат 18px: пустой — рамка 1.5px, отмеченный — заливка цветом текста с галочкой. Смена отметки анимирована */
export const Checkbox = memo(function Checkbox({
  checked,
  onPress,
  accessibilityLabel,
  tapWidth = S.checkTap,
  tapHeight = S.checkTap,
  emptyFill = 'bg',
  checkedFill,
  style,
}: Props) {
  const { c } = useTheme();
  const scale = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    // Первый показ — без анимации: отмечено так и было
    if (first.current) {
      first.current = false;
      return;
    }
    scale.value = withSequence(withTiming(0.72, { duration: 70 }), withSpring(1, POP));
  }, [checked, scale]);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={4}
      style={[styles.tap, { width: tapWidth, height: tapHeight }, style]}
    >
      <Animated.View
        style={[
          styles.box,
          checked
            ? { backgroundColor: checkedFill ?? c.text }
            : [styles.empty, { borderColor: c.border, backgroundColor: emptyFill === 'bg' ? c.bg : 'transparent' }],
          pop,
        ]}
      >
        {checked ? <Icon name="check" size={11} color={c.bg} /> : null}
      </Animated.View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  tap: { flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  box: { width: S.checkbox, height: S.checkbox, alignItems: 'center', justifyContent: 'center' },
  empty: { borderWidth: S.border },
});
