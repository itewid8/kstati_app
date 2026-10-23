/** Типы react-native-reanimated для scripts/typecheck-lite.sh: общие значения, анимации, Animated.View */
declare module 'react-native-reanimated' {
  import type { ComponentType } from 'react';
  import type { ScrollViewProps, TextProps, ViewProps } from 'react-native';

  export type SharedValue<T> = { value: T; get(): T; set(value: T | ((prev: T) => T)): void };
  export type EasingFunction = (t: number) => number;
  export type AnimationCallback = (finished?: boolean, current?: unknown) => void;
  export type WithTimingConfig = { duration?: number; easing?: EasingFunction };

  export function useSharedValue<T>(initial: T): SharedValue<T>;
  export function useAnimatedStyle<T extends object>(updater: () => T, deps?: ReadonlyArray<unknown>): T;
  export function useAnimatedReaction<T>(prepare: () => T, react: (current: T, previous: T | null) => void, deps?: ReadonlyArray<unknown>): void;
  export function useDerivedValue<T>(updater: () => T, deps?: ReadonlyArray<unknown>): SharedValue<T>;
  export function withTiming<T extends number | string>(toValue: T, config?: WithTimingConfig, callback?: AnimationCallback): T;
  export function withSpring<T extends number | string>(toValue: T, config?: { damping?: number; stiffness?: number; mass?: number }, callback?: AnimationCallback): T;
  export function withSequence<T>(...animations: T[]): T;
  export function withDelay<T>(delayMs: number, animation: T): T;
  export function withRepeat<T>(animation: T, count?: number, reverse?: boolean, callback?: AnimationCallback): T;
  export function cancelAnimation<T>(value: SharedValue<T>): void;
  export function useReducedMotion(): boolean;
  export function interpolate(value: number, input: readonly number[], output: readonly number[], extrapolate?: 'clamp' | 'extend' | 'identity'): number;

  export const Easing: {
    linear: EasingFunction;
    quad: EasingFunction;
    cubic: EasingFunction;
    sin: EasingFunction;
    exp: EasingFunction;
    in(easing: EasingFunction): EasingFunction;
    out(easing: EasingFunction): EasingFunction;
    inOut(easing: EasingFunction): EasingFunction;
    bezier(x1: number, y1: number, x2: number, y2: number): EasingFunction;
  };

  /** Анимации появления и ухода (entering / exiting у Animated.View) */
  export type LayoutAnimationBuilder = { duration(ms: number): LayoutAnimationBuilder; delay(ms: number): LayoutAnimationBuilder };
  export const FadeIn: LayoutAnimationBuilder;
  export const FadeOut: LayoutAnimationBuilder;
  export const SlideInDown: LayoutAnimationBuilder;
  export const SlideOutDown: LayoutAnimationBuilder;
  export type AnimatedViewProps = ViewProps & { entering?: LayoutAnimationBuilder; exiting?: LayoutAnimationBuilder };

  const Animated: {
    View: ComponentType<AnimatedViewProps>;
    Text: ComponentType<TextProps>;
    ScrollView: ComponentType<ScrollViewProps>;
  };
  export default Animated;
}
