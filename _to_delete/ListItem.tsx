import React from 'react';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

/**
 * Элемент списка с плавным появлением, исчезновением и сдвигом соседей.
 * Список оборачивается в <LayoutAnimationConfig skipEntering>, чтобы при открытии экрана
 * строки не «проявлялись» все разом.
 */
export function ListItem({ children }: { children: React.ReactNode }) {
  return (
    <Animated.View layout={LinearTransition.duration(200)} entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
      {children}
    </Animated.View>
  );
}

export { LayoutAnimationConfig } from 'react-native-reanimated';
