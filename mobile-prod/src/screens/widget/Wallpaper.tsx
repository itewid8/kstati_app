/**
 * Обои рабочего стола для превью виджета: линейный градиент как CSS linear-gradient(160deg, a 0%, b 55%, c 100%)
 * (макеты C-Widget*). Направление и длина линии градиента считаются так же, как в CSS.
 */
import { memo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

export const WALLPAPER = {
  light: ['#C9D6E3', '#93A9C0', '#E8E2D6'],
  dark: ['#0E1622', '#1E2B3B', '#2B2533'],
} as const;

const ANGLE = (160 * Math.PI) / 180;

/** Концы линии CSS-градиента под углом ANGLE для прямоугольника w × h */
export const cssGradientLine = (w: number, h: number) => {
  const dx = Math.sin(ANGLE);
  const dy = -Math.cos(ANGLE);
  const len = Math.abs(w * dx) + Math.abs(h * dy);
  return { x1: w / 2 - (dx * len) / 2, y1: h / 2 - (dy * len) / 2, x2: w / 2 + (dx * len) / 2, y2: h / 2 + (dy * len) / 2 };
};

export const Wallpaper = memo(function Wallpaper({ dark }: { dark: boolean }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const [a, b, c] = dark ? WALLPAPER.dark : WALLPAPER.light;
  const g = cssGradientLine(size.w, size.h);
  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="none">
      {size.w > 0 ? (
        <Svg width={size.w} height={size.h}>
          <Defs>
            <LinearGradient id="wp" gradientUnits="userSpaceOnUse" x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2}>
              <Stop offset="0" stopColor={a} />
              <Stop offset="0.55" stopColor={b} />
              <Stop offset="1" stopColor={c} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={size.w} height={size.h} fill="url(#wp)" />
        </Svg>
      ) : null}
    </View>
  );
});
