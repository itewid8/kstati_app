/**
 * Шапка голосового окна (C-Voice, C-Ask*, окно записи): точка и длительность («REC 00:04» во время записи),
 * волна громкости, ярлык распознанного действия.
 */
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts, Icon, type as T, useTheme } from '@/ui';
import type { VoiceRate, VoiceSheetHeader } from '../types';
import { Waveform } from './Waveform';

/** Столбиков в волне */
const BARS = 40;

export const VoiceHeader = memo(function VoiceHeader({ header }: { header: VoiceSheetHeader }) {
  const { c } = useTheme();
  const { live = false } = header;
  return (
    <View style={styles.head}>
      <View style={styles.timer}>
        <View
          style={[
            styles.dot,
            live ? { backgroundColor: c.red, boxShadow: `0 0 8px ${c.glow}` } : { backgroundColor: c.muted },
          ]}
        />
        <Text style={[styles.time, { color: live ? c.text : c.muted }]}>
          {live ? `REC ${header.duration}` : header.duration}
        </Text>
      </View>
      <Waveform levels={header.levels} live={live} bars={BARS} />
      {header.note ? (
        <Text style={[styles.note, { color: c.muted }]} numberOfLines={1}>
          {header.note}
        </Text>
      ) : header.badge ? (
        <View style={[styles.badge, { backgroundColor: c.text }]}>
          <Text style={[T.section, { color: c.bg }]}>{header.badge}</Text>
        </View>
      ) : null}
      {header.rate ? <RateButtons rate={header.rate} /> : null}
    </View>
  );
});

/** 👍 / 👎 разбора команды: выбранная — инвертированная плашка (как ярлык действия), остальные — контуром */
const RateButtons = memo(function RateButtons({ rate }: { rate: VoiceRate }) {
  const { c } = useTheme();
  const btn = (good: boolean) => {
    const on = rate.value === (good ? 'up' : 'down');
    return (
      <Pressable
        key={String(good)}
        accessibilityRole="button"
        accessibilityLabel={good ? 'Разобрано верно' : 'Разобрано неверно'}
        accessibilityState={{ selected: on }}
        hitSlop={6}
        onPress={good ? rate.onUp : rate.onDown}
        style={({ pressed }) => [styles.rateBtn, { borderColor: c.border, backgroundColor: on ? c.text : 'transparent', transform: [{ scale: pressed ? 0.92 : 1 }] }]}
      >
        <Icon name={good ? 'thumbUp' : 'thumbDown'} size={15} color={on ? c.bg : c.text} />
      </Pressable>
    );
  };
  return (
    <View style={styles.rate}>
      {btn(true)}
      {btn(false)}
    </View>
  );
});

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  time: { fontFamily: fonts.mono600, fontSize: 10, letterSpacing: 1 },
  badge: { height: 22, paddingHorizontal: 7, justifyContent: 'center' },
  note: { fontFamily: fonts.mono600, fontSize: 9.5, letterSpacing: 0.6 },
  rate: { flexDirection: 'row', gap: 6, marginLeft: 2 },
  rateBtn: { width: 30, height: 26, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
