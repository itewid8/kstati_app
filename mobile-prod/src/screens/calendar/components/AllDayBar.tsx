/**
 * Полоса над сеткой (на весь день, многодневное, план): заливка цветом людей, полоса 2px слева,
 * название и приглушённая моно-подпись в одну строку; не влезает — бегущая строка (Marquee).
 * Строка рисуется, только если полоса вмещает её по высоте целиком (fitTextLines).
 */
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fitTextLines } from '@/lib/calendarLayout';
import type { TaskKind } from '@/lib/types';
import { Hatch, Icon, LONG_PRESS_MS, Marquee, fonts, tint, useLift, useTheme, type LiftHandler } from '@/ui';
import { EventMarks } from './EventMarks';
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
/** Строке нужно хотя бы 1.2 кегля (line-height: normal) */
const LINE = 1.2;

type Props = {
  x: number;
  y: number;
  width: number;
  size: AllDayBarSize;
  title: string;
  /** Подпись сразу за названием вместе с разделителем: « · 8–10 окт» */
  meta?: string;
  colors: readonly string[];
  /** Моё дело, скрытое от этой группы, — заштриховано */
  hidden?: boolean;
  /** Значки перед названием: сделано (зелёная галочка), тип, общее дело, повтор */
  kind?: TaskKind;
  done?: boolean;
  plan?: boolean;
  repeat?: boolean;
  /** Событие календаря телефона: пунктир, без цвета людей, значок телефона */
  phone?: boolean;
  onPress?: () => void;
  /** Удержание: полоса отдаёт своё место в окне и копию (быстрые действия) */
  onLongPress?: LiftHandler;
};

export const AllDayBar = memo(function AllDayBar(props: Props) {
  const { x, y, width, size, title, meta, colors, onPress, onLongPress } = props;
  const { c } = useTheme();
  const { height, fontSize, letterSpacing, paddingLeft } = size;
  const lift = useLift(onLongPress, 'block', () => <AllDayBar {...props} x={0} y={0} onPress={undefined} onLongPress={undefined} />);
  const fits = fitTextLines(height, [{ lineHeight: fontSize * LINE, lines: 1 }]).height > 0;
  if (props.phone) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Из телефона: ${title}`}
        onPress={onPress}
        style={[styles.bar, styles.phone, { left: x, top: y, width, height, paddingLeft: paddingLeft - 2, borderColor: c.muted, backgroundColor: tint(c.panel, 0.75) }]}
      >
        {fits ? (
          <View style={styles.row}>
            <Icon name="phone" size={Math.round(fontSize + 1)} color={c.muted} />
            <Marquee style={[styles.title, styles.flex, { fontSize, letterSpacing, lineHeight: height - 2, color: c.muted }]}>
              {title}
              {meta ? <Text style={[styles.meta, { color: c.muted }]}>{meta}</Text> : null}
            </Marquee>
          </View>
        ) : null}
      </Pressable>
    );
  }
  return (
    <Pressable
      ref={lift.ref}
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      onLongPress={lift.onLongPress}
      delayLongPress={LONG_PRESS_MS}
      style={[styles.bar, { left: x, top: y, width, height, paddingLeft }]}
    >
      <PeopleFill colors={colors} alpha={c.tintAlpha} />
      {props.hidden ? <Hatch /> : null}
      <PeopleTip colors={colors} width={TIP} />
      {fits ? (
        <View style={styles.row}>
          <EventMarks done={props.done} kind={props.kind} plan={props.plan} repeat={props.repeat} size={Math.round(fontSize + 1)} lineHeight={height} />
          <Marquee style={[styles.title, styles.flex, { fontSize, letterSpacing, lineHeight: height, color: props.done ? c.muted : c.text }, props.done && styles.done]}>
            {title}
            {meta ? <Text style={[styles.meta, { color: c.muted }]}>{meta}</Text> : null}
          </Marquee>
        </View>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  bar: { position: 'absolute', overflow: 'hidden' },
  phone: { borderWidth: 1, borderStyle: 'dashed' },
  title: { fontFamily: fonts.sans600 },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 3 },
  flex: { flex: 1, minWidth: 0 },
  meta: { fontFamily: fonts.mono400 },
  done: { textDecorationLine: 'line-through' },
});
