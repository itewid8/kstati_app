/**
 * Событие ленты (C-Activity): квадрат-аватар 24px цветом человека, «Имя действие» 12.5/16
 * (переносится), под ним «17:40 · ГРУППА», справа красная точка непрочитанного.
 */
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Marquee, fonts, size as S, useTheme } from '@/ui';

type Props = {
  letter: string;
  /** Цвет человека и текст поверх (уже под тему) */
  color: string;
  ink: string;
  name: string;
  text: string;
  /** «17:40 · МЫ С КАРИНОЙ» */
  meta: string;
  fresh?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export const FeedRow = memo(function FeedRow({ letter, color, ink, name, text, meta, fresh, onPress, style }: Props) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[styles.row, { backgroundColor: c.panel, borderTopColor: c.hair }, style]}
    >
      <View style={[styles.avatar, { backgroundColor: color }]}>
        <Text style={[styles.letter, { color: ink }]}>{letter}</Text>
      </View>
      <View style={styles.body}>
        <Text style={[styles.text, { color: c.text }]}>
          <Text style={styles.name}>{name}</Text> {text}
        </Text>
        <Marquee style={[styles.meta, { color: c.muted }]}>
          {meta}
        </Marquee>
      </View>
      {fresh ? <NewDot style={styles.fresh} /> : null}
    </Pressable>
  );
});

/** Красная точка 7px со свечением — «новое» */
export const NewDot = memo(function NewDot({ style }: { style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return <View style={[styles.dot, { backgroundColor: c.red, boxShadow: `0 0 6px ${c.glow}` }, style]} />;
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, padding: 8, borderTopWidth: S.hairline },
  avatar: { width: 24, height: 24, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  letter: { fontFamily: fonts.mono600, fontSize: 11 },
  body: { flex: 1, minWidth: 0, gap: 2 },
  text: { fontFamily: fonts.sans400, fontSize: 12.5, lineHeight: 16 },
  name: { fontFamily: fonts.sans600 },
  meta: { fontFamily: fonts.mono400, fontSize: 9, lineHeight: 11, letterSpacing: 0.36 },
  dot: { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
  fresh: { marginTop: 4 },
});
