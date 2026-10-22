/** Типы react-native-gesture-handler для scripts/typecheck-lite.sh: Gesture.Pan / Tap, GestureDetector, ScrollView */
declare module 'react-native-gesture-handler' {
  import { Component, type ComponentType, type ReactNode } from 'react';
  import type { ScrollViewProps, ViewProps } from 'react-native';

  export type PanGestureEvent = {
    x: number;
    y: number;
    absoluteX: number;
    absoluteY: number;
    translationX: number;
    translationY: number;
    velocityX: number;
    velocityY: number;
  };
  export type TapGestureEvent = { x: number; y: number; absoluteX: number; absoluteY: number };

  /** Цепочка настроек жеста: каждый метод возвращает тот же жест, колбэки получают событие типа E */
  export type GestureChain<E> = {
    enabled(enabled: boolean): GestureChain<E>;
    runOnJS(runOnJS: boolean): GestureChain<E>;
    shouldCancelWhenOutside(value: boolean): GestureChain<E>;
    hitSlop(slop: number | { top?: number; bottom?: number; left?: number; right?: number }): GestureChain<E>;
    minDistance(distance: number): GestureChain<E>;
    activeOffsetX(offset: number | readonly number[]): GestureChain<E>;
    activeOffsetY(offset: number | readonly number[]): GestureChain<E>;
    failOffsetX(offset: number | readonly number[]): GestureChain<E>;
    failOffsetY(offset: number | readonly number[]): GestureChain<E>;
    maxDuration(ms: number): GestureChain<E>;
    onBegin(callback: (event: E) => void): GestureChain<E>;
    onStart(callback: (event: E) => void): GestureChain<E>;
    onUpdate(callback: (event: E) => void): GestureChain<E>;
    onChange(callback: (event: E) => void): GestureChain<E>;
    onEnd(callback: (event: E, success: boolean) => void): GestureChain<E>;
    onFinalize(callback: (event: E, success: boolean) => void): GestureChain<E>;
  };
  export type PanGesture = GestureChain<PanGestureEvent>;
  export type TapGesture = GestureChain<TapGestureEvent>;
  export type GestureType = GestureChain<PanGestureEvent> | GestureChain<TapGestureEvent>;

  export const Gesture: {
    Pan(): PanGesture;
    Tap(): TapGesture;
    Simultaneous(...gestures: GestureType[]): GestureType;
    Exclusive(...gestures: GestureType[]): GestureType;
  };
  export const GestureDetector: ComponentType<{ gesture: GestureType; children?: ReactNode }>;
  export const GestureHandlerRootView: ComponentType<ViewProps>;
  export class ScrollView extends Component<ScrollViewProps> {
    scrollTo(options?: { x?: number; y?: number; animated?: boolean }): void;
  }
}
