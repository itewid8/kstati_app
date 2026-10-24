import * as Haptics from 'expo-haptics';
import { Check, Trash2 } from '@/components/icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ICON, motion, useColors } from '@/theme';

const THRESHOLD = 84;

/**
 * Строка со смахиваниями.
 * Вправо — onSwipeRight (выполнено / посмотрели), влево — onSwipeLeft (удалить).
 * Если обработчик не передан, направление отключено.
 */
export function SwipeRow({
  children,
  onSwipeRight,
  onSwipeLeft,
  rightLabelIcon = 'check',
}: {
  children: React.ReactNode;
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  rightLabelIcon?: 'check';
}) {
  const c = useColors();
  const x = useSharedValue(0);
  const allowR = !!onSwipeRight;
  const allowL = !!onSwipeLeft;

  const buzz = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

  const pan = Gesture.Pan()
    .maxPointers(1) // два пальца — это щипок календаря, а не свайп строки
    .activeOffsetX([-14, 14])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      let v = e.translationX;
      if (v > 0 && !allowR) v = 0;
      if (v < 0 && !allowL) v = 0;
      x.value = v;
    })
    .onEnd(() => {
      if (x.value > THRESHOLD && onSwipeRight) {
        x.value = withTiming(0, { duration: motion.base });
        runOnJS(buzz)();
        runOnJS(onSwipeRight)();
      } else if (x.value < -THRESHOLD && onSwipeLeft) {
        x.value = withTiming(-600, { duration: motion.base }, () => {
          runOnJS(onSwipeLeft)();
        });
      } else {
        x.value = withTiming(0, { duration: motion.fast });
      }
    });

  const fg = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const leftBg = useAnimatedStyle(() => ({ opacity: x.value > 0 ? Math.min(1, x.value / THRESHOLD) : 0 }));
  const rightBg = useAnimatedStyle(() => ({ opacity: x.value < 0 ? Math.min(1, -x.value / THRESHOLD) : 0 }));

  return (
    <View style={{ overflow: 'hidden' }}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.bg, { backgroundColor: c.surface, justifyContent: 'flex-start' }, leftBg]}>
        {rightLabelIcon === 'check' && <Check size={ICON.size} strokeWidth={ICON.stroke} color={c.text} />}
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.bg, { backgroundColor: c.surface, justifyContent: 'flex-end' }, rightBg]}>
        <Trash2 size={ICON.size} strokeWidth={ICON.stroke} color={c.danger} />
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={[{ backgroundColor: c.background }, fg]}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 },
});
