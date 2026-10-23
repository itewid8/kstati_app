/**
 * Нажатый элемент над затемнением: копия строки в рамке шире строки (как в макетах C-Quick*) или копия блока календаря
 * в рамке вплотную, увеличенная на 3%. Тень 0 8 24 rgba(0,0,0,0.25). Нажатия проходят сквозь (на затемнение).
 * shift — сдвиг вверх, когда нижнее окно закрыло бы элемент (плавно).
 */
import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { BLOCK_SCALE, LIFT_BORDER, liftFrame, useTheme, type LiftTarget } from '@/ui';

const SHADOW = '0 8px 24px rgba(0,0,0,0.25)';
const SHIFT_MS = 180;

type Props = { lift: LiftTarget; shift: number };

export const QuickLift = memo(function QuickLift({ lift, shift }: Props) {
  const { c } = useTheme();
  const block = lift.shape === 'block';
  const frame = liftFrame(lift.rect, lift.shape);
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withTiming(shift, { duration: SHIFT_MS });
  }, [shift, y]);
  const moved = useAnimatedStyle(() => ({ transform: block ? [{ translateY: y.value }, { scale: BLOCK_SCALE }] : [{ translateY: y.value }] }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.frame,
        {
          left: frame.x,
          top: frame.y,
          width: block ? undefined : frame.width,
          borderColor: c.border,
          backgroundColor: block ? c.bg : c.panel,
        },
        moved,
      ]}
    >
      {/* Высоту задаёт содержимое, рамка снаружи (как content-box в макете) */}
      <View style={block ? { width: lift.rect.width, height: lift.rect.height } : [styles.row, { height: frame.height - 2 * LIFT_BORDER }]}>
        {lift.node}
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  frame: { position: 'absolute', borderWidth: LIFT_BORDER, boxShadow: SHADOW },
  /** Копия строки — по всей ширине рамки, по центру по высоте */
  row: { justifyContent: 'center' },
});
