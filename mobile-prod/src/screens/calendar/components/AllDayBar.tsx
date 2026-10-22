/**
 * Полоса над сеткой (на весь день, многодневное, план): заливка цветом людей, полоса 2px слева,
 * название и приглушённая моно-подпись в одну строку; не влезает — бегущая строка (Marquee).
 */
import { memo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Marquee, fonts, useTheme } from '@/ui';
import { PeopleFill, PeopleTip } from './PeopleColor';

export type AllDayBarSize = {
  height: number;
  fontSize: number;
  letterSpacing?: number;
  paddingLeft: number;
};

/** C-Week: 20px, 8/600 */
export const WEEK_BAR: AllDayBarSize = { height: 20, fontSize: 8, letterSpacing: -0.08, paddingLeft: 7 };
/** C-Day: 22px, 11/600 */
export const DAY_BAR: AllDayBarSize = { height: 22, fontSize: 11, paddingLeft: 10 };

const TIP = 2;

type Props = {
  x: number;
  y: number;
  width: number;
  size: AllDayBarSize;
  title: string;
  /** Подпись сразу за названием вместе с разделителем: « · 8–10 окт» */
  meta?: string;
  colors: readonly string[];
  onPress?: () => void;
};

export const AllDayBar = memo(function AllDayBar({ x, y, width, size, title, meta, colors, onPress }: Props) {
  const { c } = useTheme();
  const { height, fontSize, letterSpacing, paddingLeft } = size;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={[styles.bar, { left: x, top: y, width, height, paddingLeft }]}
    >
      <PeopleFill colors={colors} alpha={c.tintAlpha} />
      <PeopleTip colors={colors} width={TIP} />
      <Marquee style={[styles.title, { fontSize, letterSpacing, lineHeight: height, color: c.text }]}>
        {title}
        {meta ? <Text style={[styles.meta, { color: c.muted }]}>{meta}</Text> : null}
      </Marquee>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  bar: { position: 'absolute', overflow: 'hidden' },
  title: { fontFamily: fonts.sans600 },
  meta: { fontFamily: fonts.mono400 },
});
