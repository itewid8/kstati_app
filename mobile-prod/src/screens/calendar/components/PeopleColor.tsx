/**
 * Цвета дел по людям. Одно дело на несколько человек в макетах — градиент:
 *  - заливка: по горизонтали от цвета первого к цвету последнего (linear-gradient(90deg, …));
 *  - полоса слева: цвета стопкой сверху вниз, жёсткими границами (linear-gradient(s 50%, k 50%));
 *  - квадрат года: по диагонали 135° жёсткими границами.
 * Один человек — обычный цвет без SVG.
 */
import { memo, useId, useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { ID } from '@/lib/types';
import { tint, useTheme } from '@/ui';
import type { CalendarPerson } from '../types';

/** id для url(#…) в SVG: на вебе id общие для всей страницы, двоеточия из useId там не годятся */
export function useSvgId(prefix: string): string {
  const raw = useId();
  return `${prefix}${raw.replace(/[^A-Za-z0-9_-]/g, '_')}`;
}

/** Люди по id для быстрого поиска */
export function usePeopleMap(people: readonly CalendarPerson[]): ReadonlyMap<ID, CalendarPerson> {
  return useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
}

/** Цвета людей дела под текущую тему; нет людей — приглушённый цвет */
export function usePeopleColors(ids: readonly ID[], byId: ReadonlyMap<ID, CalendarPerson>): readonly string[] {
  const { person, c } = useTheme();
  return useMemo(() => {
    const list = ids.flatMap((id) => {
      const p = byId.get(id);
      return p ? [person(p.color)] : [];
    });
    return list.length ? list : [c.muted];
  }, [ids, byId, person, c.muted]);
}

/** Равномерные жёсткие ступени: [цвет, от, до] в долях 0…1 */
export const hardStops = (colors: readonly string[]) => colors.map((col, i) => [col, i / colors.length, (i + 1) / colors.length] as const);

type FillProps = {
  colors: readonly string[];
  alpha: number;
  style?: StyleProp<ViewStyle>;
};

/** Заливка на весь родитель (absoluteFill) */
export const PeopleFill = memo(function PeopleFill({ colors, alpha, style }: FillProps) {
  const id = useSvgId('pf');
  if (colors.length < 2) return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: tint(colors[0], alpha) }, style]} />;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
            {colors.map((col, i) => (
              <Stop key={i} offset={i / (colors.length - 1)} stopColor={col} stopOpacity={alpha} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
});

type TipProps = {
  colors: readonly string[];
  width: number;
  style?: StyleProp<ViewStyle>;
};

/** Цветная полоса у левого края на всю высоту: цвета стопкой */
export const PeopleTip = memo(function PeopleTip({ colors, width, style }: TipProps) {
  return (
    <View pointerEvents="none" style={[styles.tip, { width }, style]}>
      {colors.map((col, i) => (
        <View key={i} style={[styles.flex, { backgroundColor: col }]} />
      ))}
    </View>
  );
});

type SwatchProps = {
  colors: readonly string[];
  width: number;
  height: number;
  /** Прозрачность цветов (насыщенность дня в годе) */
  alpha?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Квадрат с диагональным делением (linear-gradient(135deg, a 50%, b 50%)): граница k/N проходит по x + y = k·(w + h)/N,
 * поэтому градиент идёт из (0,0) в ((w+h)/2, (w+h)/2) в координатах квадрата.
 */
export const DiagonalSwatch = memo(function DiagonalSwatch({ colors, width, height, alpha = 1, style }: SwatchProps) {
  const id = useSvgId('ds');
  if (colors.length < 2) {
    return <View style={[{ width, height, backgroundColor: alpha < 1 ? tint(colors[0], alpha) : colors[0] }, style]} />;
  }
  const end = (width + height) / 2;
  return (
    <View style={[{ width, height }, style]}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={end} y2={end}>
            {hardStops(colors).flatMap(([col, a, b], i) => [
              <Stop key={`${i}a`} offset={a} stopColor={col} stopOpacity={alpha} />,
              <Stop key={`${i}b`} offset={b} stopColor={col} stopOpacity={alpha} />,
            ])}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
});

type DiagonalFillProps = {
  colors: readonly string[];
  alpha?: number;
};

/**
 * Диагональное деление на весь родитель (absoluteFill), когда его размер задаёт раскладка (flex), а не числа.
 * Градиент в долях рамки (0,0)→(1,1): для почти квадратных клеток совпадает с CSS 135°.
 */
export const DiagonalFill = memo(function DiagonalFill({ colors, alpha = 1 }: DiagonalFillProps) {
  const id = useSvgId('df');
  if (colors.length < 2) {
    return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: alpha < 1 ? tint(colors[0], alpha) : colors[0] }]} />;
  }
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            {hardStops(colors).flatMap(([col, a, b], i) => [
              <Stop key={`${i}a`} offset={a} stopColor={col} stopOpacity={alpha} />,
              <Stop key={`${i}b`} offset={b} stopColor={col} stopOpacity={alpha} />,
            ])}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  tip: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  flex: { flex: 1 },
});
