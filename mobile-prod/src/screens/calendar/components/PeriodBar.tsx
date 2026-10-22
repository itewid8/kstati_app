/**
 * Части строки периода (top 104, h 40, зазор 6): крупный заголовок «05—11», приглушённая подпись «ОКТ / 2026»,
 * стрелки назад/вперёд (прижаты вправо) и «СЕГОДНЯ».
 */
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { IconButton, fonts, size as S, useTheme } from '@/ui';

/** onPress — заголовок становится кнопкой (месяц → год); без него рендер тот же */
export const PeriodTitle = memo(function PeriodTitle({ text, onPress }: { text: string; onPress?: () => void }) {
  const { c } = useTheme();
  return (
    <Text accessibilityRole={onPress ? 'button' : undefined} onPress={onPress} style={[styles.title, { color: c.text }]}>
      {text}
    </Text>
  );
});

/** Две строки 10px: «ОКТ» / «2026» */
export const PeriodNote = memo(function PeriodNote({ lines, style }: { lines: readonly string[]; style?: StyleProp<TextStyle> }) {
  const { c } = useTheme();
  return <Text style={[styles.note, { color: c.muted }, style]}>{lines.join('\n')}</Text>;
});

/** «ПН» с красной точкой — выбранный день недели (C-Day) */
export const PeriodWeekday = memo(function PeriodWeekday({ label, today }: { label: string; today: boolean }) {
  const { c } = useTheme();
  return (
    <View style={styles.weekday}>
      {today ? <View style={[styles.dot, { backgroundColor: c.red, boxShadow: `0 0 6px ${c.glow}` }]} /> : null}
      <Text style={[styles.weekdayText, { color: c.text }]}>{label}</Text>
    </View>
  );
});

type NavProps = {
  prevLabel: string;
  nextLabel: string;
  onPrev?: () => void;
  onNext?: () => void;
};

export const PeriodArrows = memo(function PeriodArrows({ prevLabel, nextLabel, onPrev, onNext }: NavProps) {
  return (
    <>
      <IconButton icon="back" iconSize={S.iconSmall} accessibilityLabel={prevLabel} onPress={onPrev} style={styles.push} />
      <IconButton icon="forward" iconSize={S.iconSmall} accessibilityLabel={nextLabel} onPress={onNext} />
    </>
  );
});

/** «СЕГОДНЯ»: залита, когда на экране уже сегодняшний день */
export const TodayButton = memo(function TodayButton({ active, onPress }: { active?: boolean; onPress?: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Сегодня"
      onPress={onPress}
      style={[styles.today, { borderColor: c.border, backgroundColor: active ? c.text : c.panel }]}
    >
      <Text style={[styles.todayText, { color: active ? c.bg : c.text }]}>СЕГОДНЯ</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  title: { fontFamily: fonts.sans700, fontSize: 34, lineHeight: 36, letterSpacing: -1.7 },
  note: { fontFamily: fonts.mono400, fontSize: 10, lineHeight: 13, letterSpacing: 0.8 },
  weekday: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  weekdayText: { fontFamily: fonts.mono600, fontSize: 11, letterSpacing: 0.88 },
  push: { marginLeft: 'auto' },
  today: { height: S.iconButton, paddingHorizontal: 10, borderWidth: S.border, justifyContent: 'center' },
  todayText: { fontFamily: fonts.mono600, fontSize: 10, letterSpacing: 0.8 },
});
