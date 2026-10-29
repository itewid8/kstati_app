/**
 * Дело в дне (C-Day): прямоугольник дорожки из layoutDayLanes, заливка цветом людей, полоса 1.5px слева.
 * Строки: название + время справа, описание, кто (заглавными). Рисуются только строки, которые влезают
 * в блок целиком (fitTextLines): у короткого дела нет обрезанного по высоте текста.
 */
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fitTextLines } from '@/lib/calendarLayout';
import type { TaskKind } from '@/lib/types';
import { Hatch, Icon, KIND_ICON, LONG_PRESS_MS, fonts, useLift, useTheme, type LiftHandler } from '@/ui';
import { PeopleFill, PeopleTip } from './PeopleColor';
import { useTextLines } from './useTextLines';

const TIP = 1.5;
const PAD_TOP = 4;
const GAP = 2;
/** Высоты строк: шапка (название и время), описание, кто */
const LINE = { head: 14, note: 13, who: 11 } as const;
const LINE_HEIGHTS = [LINE.head, LINE.note, LINE.who] as const;

type Props = {
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  time: string;
  note?: string;
  /** «САНЯ, КАРИНА» */
  who: string;
  done?: boolean;
  colors: readonly string[];
  /** Моё дело, скрытое от этой группы, — заштриховано */
  hidden?: boolean;
  /** Тип — мини-иконка перед названием */
  kind?: TaskKind;
  onPress?: () => void;
  /** Удержание: блок отдаёт своё место в окне и копию (быстрые действия) */
  onLongPress?: LiftHandler;
};

export const DayEventBlock = memo(function DayEventBlock(props: Props) {
  const { x, y, width, height, title, time, note, who, done, colors, onPress, onLongPress } = props;
  const { c, person } = useTheme();
  const lift = useLift(onLongPress, 'block', () => <DayEventBlock {...props} x={0} y={0} onPress={undefined} onLongPress={undefined} />);
  const [lines, measure] = useTextLines(LINE_HEIGHTS);
  const fit = fitTextLines(height - PAD_TOP, [
    { lineHeight: LINE.head, lines: lines[0] },
    { lineHeight: LINE.note, lines: note ? lines[1] : 0, gapBefore: GAP },
    { lineHeight: LINE.who, lines: who ? lines[2] : 0, gapBefore: GAP },
  ]);
  return (
    <Pressable
      ref={lift.ref}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${time}`}
      onPress={onPress}
      onLongPress={lift.onLongPress}
      delayLongPress={LONG_PRESS_MS}
      style={[styles.block, { left: x, top: y, width, height }]}
    >
      <PeopleFill colors={colors} alpha={c.tintAlpha} />
      {props.hidden ? <Hatch /> : null}
      <PeopleTip colors={colors} width={TIP} />
      {fit.height > 0 ? (
        <View style={[styles.text, { height: fit.height }]}>
          <View onLayout={measure[0]} style={styles.head}>
            <View style={styles.titleRow}>
              {props.kind ? (
                <View style={styles.kind}>
                  <Icon name={KIND_ICON[props.kind]} size={11} color={c.text} />
                </View>
              ) : null}
              {done ? (
                <View style={styles.kind}>
                  <Icon name="check" size={11} color={person('green')} />
                </View>
              ) : null}
              <Text style={[styles.title, { color: c.text }, done && styles.done]}>{title}</Text>
            </View>
            <Text numberOfLines={1} style={[styles.time, { color: c.text }]}>
              {time}
            </Text>
          </View>
          {fit.lines[1] ? (
            <Text onLayout={measure[1]} style={[styles.note, { color: c.muted }]}>
              {note}
            </Text>
          ) : null}
          {fit.lines[2] ? (
            <Text onLayout={measure[2]} style={[styles.who, { color: c.muted }]}>
              {who}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  block: { position: 'absolute', overflow: 'hidden', paddingTop: PAD_TOP, paddingRight: 6, paddingLeft: 10 },
  /** Окно текста высотой в целые строки: что ниже — не видно */
  text: { overflow: 'hidden', gap: GAP },
  head: { flexShrink: 0, flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  titleRow: { flexShrink: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 3 },
  kind: { marginTop: 1.5 },
  title: { flexShrink: 1, fontFamily: fonts.sans600, fontSize: 12, lineHeight: LINE.head },
  done: { textDecorationLine: 'line-through' },
  time: { flexShrink: 0, fontFamily: fonts.mono400, fontSize: 9.5, lineHeight: LINE.head },
  note: { flexShrink: 0, fontFamily: fonts.sans400, fontSize: 10.5, lineHeight: LINE.note },
  who: { flexShrink: 0, fontFamily: fonts.mono400, fontSize: 9, lineHeight: LINE.who, letterSpacing: 0.36 },
});
