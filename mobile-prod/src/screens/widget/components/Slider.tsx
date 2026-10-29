/**
 * Полоска со значением 0…1 в стиле «Инструмент»: дорожка 1.5px, заполненная часть цветом текста, квадратный бегунок.
 * Бегунок не выходит за края полоски. Тянуть или нажать в любое место. Значение уходит наружу по ходу движения (onChange) — превью меняется сразу.
 */
import { memo, useCallback, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { size as S, useTheme } from '@/ui';

type Props = { value: number; onChange?: (value: number) => void; accessibilityLabel: string };

const THUMB = 20;
const STEP = 1 / 100;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const snap = (v: number) => Math.round(clamp01(v) / STEP) * STEP;

export const Slider = memo(function Slider({ value, onChange, accessibilityLabel }: Props) {
  const { c } = useTheme();
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width), []);
  /** Путь центра бегунка: от THUMB/2 до width − THUMB/2 */
  const track = Math.max(1, width - THUMB);

  const emit = useCallback((x: number) => onChange?.(snap((x - THUMB / 2) / track)), [onChange, track]);
  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .onBegin((e) => emit(e.x))
    .onUpdate((e) => emit(e.x));

  const left = clamp01(value) * track;
  return (
    <GestureDetector gesture={pan}>
      <View
        style={styles.area}
        onLayout={onLayout}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'increment') onChange?.(snap(value + STEP * 2));
          if (e.nativeEvent.actionName === 'decrement') onChange?.(snap(value - STEP * 2));
        }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      >
        <View style={[styles.track, { backgroundColor: c.hair }]} />
        <View style={[styles.fill, { width: left + THUMB / 2, backgroundColor: c.text }]} />
        <View style={[styles.thumb, { left, borderColor: c.border, backgroundColor: c.panel }]} />
      </View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  // Макет C-WidgetSettings: высота 30, дорожка на 14, бегунок 20 на 4
  area: { height: 30 },
  track: { position: 'absolute', left: 0, right: 0, top: 14, height: S.border },
  fill: { position: 'absolute', left: 0, top: 14, height: S.border },
  thumb: { position: 'absolute', top: 4, width: THUMB, height: THUMB, borderWidth: S.border },
});
