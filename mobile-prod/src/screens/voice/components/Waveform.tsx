import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/ui';

type Props = {
  /** Громкость по столбикам, 0–100 */
  levels: readonly number[];
  /**
   * live — идёт запись: высота 32, столбики по центру, громкие (> 60) красные,
   * недописанный хвост до `bars` — серые точки 3px.
   * Иначе — приглушённая волна записанной фразы: высота 24, от левого края, цвет hairStrong.
   */
  live?: boolean;
  /** Сколько столбиков рисовать всего (хвост дополняется пустыми) */
  bars?: number;
  style?: StyleProp<ViewStyle>;
};

const BAR_MIN = 3;
/** Высота столбика на единицу громкости */
const SCALE_LIVE = 0.38;
const SCALE_MUTED = 0.28;
const LOUD = 60;

/** Волна громкости из столбиков 3px через 2px */
export const Waveform = memo(function Waveform({ levels, live = false, bars = levels.length, style }: Props) {
  const { c } = useTheme();
  const scale = live ? SCALE_LIVE : SCALE_MUTED;
  const count = Math.max(bars, levels.length);
  const items = [];
  for (let i = 0; i < count; i++) {
    const v = levels[i];
    const filled = v != null;
    const height = filled ? Math.max(BAR_MIN, Math.round(v * scale)) : BAR_MIN;
    const color = !live ? c.hairStrong : !filled ? c.hair : v > LOUD ? c.red : c.text;
    items.push(<View key={i} style={[styles.bar, { height, backgroundColor: color }]} />);
  }
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.wave, live ? styles.live : styles.muted, style]}
    >
      {items}
    </View>
  );
});

const styles = StyleSheet.create({
  wave: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, overflow: 'hidden' },
  live: { height: 32, justifyContent: 'center' },
  muted: { height: 24 },
  bar: { width: 3 },
});
