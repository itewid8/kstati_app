/**
 * Рамка голосового окна поверх затемнённого экрана (C-Voice, C-Ask*):
 * ручка, шапка (длительность + волна + ярлык действия), фраза, содержимое, ряд кнопок.
 * Окно и затемнение — BottomSheet из src/ui; между блоками 10.
 */
import { memo, type ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';
import { BottomSheet, fonts, useTheme } from '@/ui';
import type { SheetAction, VoiceSheetHeader } from '../types';
import { SheetActions } from './SheetActions';
import { VoiceHeader } from './VoiceHeader';

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
  return (
    <BottomSheet visible={visible} onClose={onClose} bottomInset={bottomInset}>
      <VoiceHeader header={header} />
      <Text style={[styles.phrase, { color: c.text }]}>{quoted ? `«${phrase}»` : phrase}</Text>
      {children}
      <SheetActions actions={actions} />
    </BottomSheet>
  );
});

const styles = StyleSheet.create({
  phrase: { fontFamily: fonts.sans600, fontSize: 18, lineHeight: 22, letterSpacing: -0.36 },
});
