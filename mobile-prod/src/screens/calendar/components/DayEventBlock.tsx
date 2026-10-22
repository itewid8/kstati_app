/**
 * Дело в дне (C-Day): прямоугольник дорожки из layoutDayLanes, заливка цветом людей, полоса 1.5px слева.
 * Строки: название + время справа, описание, кто (заглавными).
 */
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts, useTheme } from '@/ui';
import { PeopleFill, PeopleTip } from './PeopleColor';

const TIP = 1.5;

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
  onPress?: () => void;
};

export const DayEventBlock = memo(function DayEventBlock({ x, y, width, height, title, time, note, who, done, colors, onPress }: Props) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${time}`}
      onPress={onPress}
      style={[styles.block, { left: x, top: y, width, height }]}
    >
      <PeopleFill colors={colors} alpha={c.tintAlpha} />
      <PeopleTip colors={colors} width={TIP} />
      <View style={styles.head}>
        <Text style={[styles.title, { color: c.text }, done && styles.done]}>{title}</Text>
        <Text numberOfLines={1} style={[styles.time, { color: c.text }]}>
          {time}
        </Text>
      </View>
      {note ? <Text style={[styles.note, { color: c.muted }]}>{note}</Text> : null}
      <Text style={[styles.who, { color: c.muted }]}>{who}</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  block: { position: 'absolute', overflow: 'hidden', paddingTop: 4, paddingRight: 6, paddingLeft: 10, gap: 2 },
  head: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  title: { flexShrink: 1, fontFamily: fonts.sans600, fontSize: 12, lineHeight: 14 },
  done: { textDecorationLine: 'line-through' },
  time: { flexShrink: 0, fontFamily: fonts.mono400, fontSize: 9.5, lineHeight: 14 },
  note: { fontFamily: fonts.sans400, fontSize: 10.5, lineHeight: 13 },
  who: { fontFamily: fonts.mono400, fontSize: 9, lineHeight: 11, letterSpacing: 0.36 },
});
