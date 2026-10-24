/**
 * Строка, которую можно смахнуть влево — удалить. Под строкой — красная рамка с «×»; дальше порога — строка
 * уезжает и вызывается onDelete. Без onDelete — обычная строка.
 */
import { memo, useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Icon, size as S, useTheme } from '@/ui';

const THRESHOLD = 84;
const BACK_MS = 150;
const AWAY_MS = 200;

type Props = { children: ReactNode; onDelete?: () => void };

export const SwipeDelete = memo(function SwipeDelete({ children, onDelete }: Props) {
  const { c } = useTheme();
  const x = useSharedValue(0);
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!!onDelete)
        .activeOffsetX([-14, 14])
        .failOffsetY([-10, 10])
        .onUpdate((e) => {
          x.value = Math.min(0, e.translationX);
        })
        .onEnd(() => {
          if (x.value < -THRESHOLD && onDelete) {
            x.value = withTiming(-600, { duration: AWAY_MS }, () => scheduleOnRN(onDelete));
          } else {
            x.value = withTiming(0, { duration: BACK_MS });
          }
        }),
    [onDelete, x],
  );
  const front = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const under = useAnimatedStyle(() => ({ opacity: Math.min(1, -x.value / THRESHOLD) }));
  if (!onDelete) return <>{children}</>;
  return (
    <View style={styles.clip}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.under, { borderColor: c.red, backgroundColor: c.bg }, under]}>
        <Icon name="close" size={16} color={c.red} />
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={front}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
});

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  under: { borderWidth: S.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 18 },
});
