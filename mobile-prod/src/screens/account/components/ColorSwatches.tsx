import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { PERSON_COLORS, type PaletteKey, type PersonColor } from '@/lib/types';
import { useTheme } from '@/ui';

const SWATCH = 14;
const HIT = { top: 15, bottom: 15, left: 1, right: 1 };

const COLOR_NAME: Record<PaletteKey, string> = {
  blue: 'Синий',
  pink: 'Розовый',
  green: 'Зелёный',
  yellow: 'Жёлтый',
  orange: 'Оранжевый',
  violet: 'Фиолетовый',
  teal: 'Бирюзовый',
};

type Props = {
  value: PersonColor;
  onPick?: (color: PaletteKey) => void;
  /** Последний образец — свой цвет с полосы спектра */
  onPickCustom?: () => void;
};

/* ---------- Образец «свой цвет»: conic-gradient из макета, нарисованный клиньями ---------- */

const SPECTRUM = ['#E0281E', '#E0A800', '#1F9D57', '#0E9AA7', '#2F6BDB', '#7C4DDB', '#E0281E'];
const WEDGES = 72;

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255] as const;
};

function spectrumAt(t: number): string {
  const pos = t * (SPECTRUM.length - 1);
  const i = Math.min(Math.floor(pos), SPECTRUM.length - 2);
  const f = pos - i;
  const a = rgb(SPECTRUM[i]);
  const b = rgb(SPECTRUM[i + 1]);
  const ch = (k: 0 | 1 | 2) => Math.round(a[k] + (b[k] - a[k]) * f);
  return `rgb(${ch(0)},${ch(1)},${ch(2)})`;
}

/** Клинья от центра; угол 0 — вверх, по часовой стрелке (как у conic-gradient). Чуть внахлёст, без щелей */
const SPECTRUM_WEDGES = Array.from({ length: WEDGES }, (_, i) => {
  const c = SWATCH / 2;
  const r = SWATCH;
  const pt = (k: number) => {
    const a = (k / WEDGES) * 2 * Math.PI;
    return `${(c + r * Math.sin(a)).toFixed(3)} ${(c - r * Math.cos(a)).toFixed(3)}`;
  };
  return { d: `M${c} ${c}L${pt(i - 0.25)}L${pt(i + 1.25)}Z`, fill: spectrumAt((i + 0.5) / WEDGES) };
});

const SpectrumSwatch = memo(function SpectrumSwatch() {
  return (
    <Svg width={SWATCH} height={SWATCH} viewBox={`0 0 ${SWATCH} ${SWATCH}`}>
      {SPECTRUM_WEDGES.map((w) => (
        <Path key={w.d} d={w.d} fill={w.fill} />
      ))}
    </Svg>
  );
});

/** Цвет человека: семь цветов палитры и свой цвет */
export const ColorSwatches = memo(function ColorSwatches({ value, onPick, onPickCustom }: Props) {
  const { c, person } = useTheme();
  const custom = value.startsWith('#');
  /** Выбранный образец: зазор цвета фона 1.5px и контур цвета текста 1.5px */
  const ring = { boxShadow: `0 0 0 1.5px ${c.bg}, 0 0 0 3px ${c.text}` };
  return (
    <View accessibilityRole="radiogroup" style={styles.row}>
      {PERSON_COLORS.map((key) => (
        <Pressable
          key={key}
          accessibilityRole="radio"
          accessibilityLabel={COLOR_NAME[key]}
          accessibilityState={{ selected: value === key }}
          hitSlop={HIT}
          onPress={onPick ? () => onPick(key) : undefined}
          style={[styles.swatch, { backgroundColor: person(key) }, value === key && ring]}
        />
      ))}
      <Pressable
        accessibilityRole="radio"
        accessibilityLabel="Свой цвет"
        accessibilityState={{ selected: custom }}
        hitSlop={HIT}
        onPress={onPickCustom}
        style={[styles.swatch, custom && ring]}
      >
        <SpectrumSwatch />
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 3 },
  swatch: { width: SWATCH, height: SWATCH },
});
