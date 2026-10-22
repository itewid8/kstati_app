/**
 * Рамка голосового окна поверх затемнённого экрана (C-Voice, C-Ask*):
 * ручка, шапка (длительность + волна + ярлык действия), фраза, содержимое, ряд кнопок.
 * Окно и затемнение — BottomSheet из src/ui; между блоками 10.
 */
import { memo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BottomSheet, fonts, type as T, useTheme } from '@/ui';
import type { SheetAction, VoiceSheetHeader } from '../types';
import { SheetActions } from './SheetActions';
import { Waveform } from './Waveform';

/** Столбиков в волне */
const BARS = 40;

export type VoiceSheetProps = {
  header: VoiceSheetHeader;
  /** Распознанная фраза */
  phrase: string;
  /** Взять фразу в «ёлочки» (законченная команда); во время записи — без кавычек */
  quoted?: boolean;
  actions: readonly SheetAction[];
  /** Содержимое между фразой и кнопками; каждый ребёнок — отдельный блок с отступом 10 */
  children?: ReactNode;
  visible?: boolean;
  /** Нажатие на затемнение */
  onClose?: () => void;
  bottomInset?: number;
};

export const VoiceSheet = memo(function VoiceSheet({
  header,
  phrase,
  quoted = true,
  actions,
  children,
  visible = true,
  onClose,
  bottomInset,
}: VoiceSheetProps) {
  const { c } = useTheme();
  const { live = false } = header;
  return (
    <BottomSheet visible={visible} onClose={onClose} bottomInset={bottomInset}>
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
        {header.badge ? (
          <View style={[styles.badge, { backgroundColor: c.text }]}>
            <Text style={[T.section, { color: c.bg }]}>{header.badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.phrase, { color: c.text }]}>{quoted ? `«${phrase}»` : phrase}</Text>
      {children}
      <SheetActions actions={actions} />
    </BottomSheet>
  );
});

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  time: { fontFamily: fonts.mono600, fontSize: 10, letterSpacing: 1 },
  badge: { height: 22, paddingHorizontal: 7, justifyContent: 'center' },
  phrase: { fontFamily: fonts.sans600, fontSize: 18, lineHeight: 22, letterSpacing: -0.36 },
});
