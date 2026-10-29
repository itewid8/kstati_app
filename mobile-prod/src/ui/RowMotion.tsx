/**
 * Строки списков исчезают плавно: удалённая гаснет, соседние съезжают на её место.
 * Появление без анимации: на Android строки, пришедшие с сервера после показа экрана, с анимацией появления
 * могли остаться невидимыми. ListMotion — смена группы без анимации ухода.
 */
import { memo, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeOut, LayoutAnimationConfig, LinearTransition } from 'react-native-reanimated';

const LAYOUT = LinearTransition.duration(220);
const EXIT = FadeOut.duration(160);

export const RowMotion = memo(function RowMotion({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View layout={LAYOUT} exiting={EXIT} style={style}>
      {children}
    </Animated.View>
  );
});

/** Обёртка списка: при первом показе (и при смене группы — новый key) строки появляются сразу, без анимации */
export function ListMotion({ children }: { children: ReactNode }) {
  return (
    <LayoutAnimationConfig skipEntering skipExiting>
      {children}
    </LayoutAnimationConfig>
  );
}
