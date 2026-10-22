/**
 * C-AskWeek / C-AskWeekend — голосовой вопрос «что у нас…»: ответ списком по дням
 * (многодневное — заметкой у дня или строкой «ВЕСЬ»), для выходных — пунктирная рамка «Свободно».
 * Кнопки «Закрыть» и «Открыть неделю / день».
 */
import { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fonts, size as S, useTheme } from '@/ui';
import { AgendaList, type AgendaDay } from './components/AgendaList';
import { VoiceSheet } from './components/VoiceSheet';
import type { SheetAction, VoiceSheetHeader } from './types';

export type AskAgendaSheetProps = {
  header: VoiceSheetHeader;
  /** Вопрос (без кавычек) */
  phrase: string;
  /** Шапка ответа: «05—11 ОКТ · МЫ С КАРИНОЙ» */
  title: string;
  /** «16 ДЕЛ» */
  count?: string;
  days: readonly AgendaDay[];
  /** Свободные окна: «СБ 18:30 → · ВС ДО 11:00 · ВС 13:00 →». Нет — рамка не показывается */
  free?: string;
  /** «ОТКРЫТЬ НЕДЕЛЮ», «ОТКРЫТЬ ДЕНЬ» */
  openLabel: string;
  visible?: boolean;
  bottomInset?: number;
  onOpen?: () => void;
  onClose?: () => void;
};

export const AskAgendaSheet = memo(function AskAgendaSheet({
  header,
  phrase,
  title,
  count,
  days,
  free,
  openLabel,
  visible,
  bottomInset,
  onOpen,
  onClose,
}: AskAgendaSheetProps) {
  const { c } = useTheme();
  const actions = useMemo<SheetAction[]>(
    () => [
      { key: 'close', label: 'ЗАКРЫТЬ', onPress: onClose },
      { key: 'open', label: openLabel, tone: 'primary', flex: 1.6, onPress: onOpen },
    ],
    [onClose, onOpen, openLabel],
  );
  return (
    <VoiceSheet header={header} phrase={phrase} actions={actions} visible={visible} onClose={onClose} bottomInset={bottomInset}>
      <AgendaList title={title} count={count} days={days} />
      {free ? (
        <View style={[styles.free, { borderColor: c.hairStrong }]}>
          <Text style={[styles.freeLabel, { color: c.muted }]}>СВОБОДНО</Text>
          <Text style={[styles.freeText, { color: c.text }]}>{free}</Text>
        </View>
      ) : null}
    </VoiceSheet>
  );
});

const styles = StyleSheet.create({
  free: { borderWidth: S.border, borderStyle: 'dashed', paddingVertical: 8, paddingHorizontal: 10, gap: 4 },
  freeLabel: { fontFamily: fonts.mono600, fontSize: 8.5, letterSpacing: 0.68 },
  freeText: { fontFamily: fonts.mono600, fontSize: 11 },
});
