/**
 * Шапка голосового окна (C-Voice, C-Ask*, окно записи): точка и длительность («REC 00:04» во время записи),
 * волна громкости, ярлык распознанного действия.
 */
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fonts, type as T, useTheme } from '@/ui';
import type { VoiceSheetHeader } from '../types';
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
});
