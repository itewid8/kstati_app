/**
 * Окно ошибки голоса (макета нет — из VoiceSheet и токенов, как предупреждение C-AskMove):
 * сказанная фраза и причина в красной рамке; не расслышали — причина вместо фразы. ЗАКРЫТЬ / ЕЩЁ РАЗ / ОТКРЫТЬ НАСТРОЙКИ;
 * если сказанное можно записать вручную — ещё ДОБАВИТЬ (меню типов записи).
 */
import { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ProblemSheetData } from '@/adapters/voice/problem';
import { VoiceSheet, type SheetAction, type VoiceSheetHeader } from '@/screens/voice';
import { fonts, size as S, useTheme } from '@/ui';

type Props = {
  header: VoiceSheetHeader;
  data: ProblemSheetData;
  bottomInset?: number;
  onClose: () => void;
  onRetry: () => void;
  onOpenSettings: () => void;
  /** «ДОБАВИТЬ» (есть data.add) */
  onAdd?: () => void;
};

export const ProblemSheet = memo(function ProblemSheet({ header, data, bottomInset, onClose, onRetry, onOpenSettings, onAdd }: Props) {
  const { c } = useTheme();
  const actions = useMemo<SheetAction[]>(() => {
    const close: SheetAction = { key: 'close', label: 'ЗАКРЫТЬ', onPress: onClose };
    const add: SheetAction[] = data.add && onAdd ? [{ key: 'add', label: 'ДОБАВИТЬ', onPress: onAdd }] : [];
    if (data.action === 'retry') return [close, ...add, { key: 'retry', label: 'ЕЩЁ РАЗ', tone: 'primary', flex: add.length ? 1.3 : 1.6, onPress: onRetry }];
    if (data.action === 'settings') {
      return [close, { key: 'settings', label: 'ОТКРЫТЬ НАСТРОЙКИ', tone: 'primary', onPress: onOpenSettings }];
    }
    return add.length ? [close, ...add] : [{ ...close, tone: 'primary' }];
  }, [data.action, data.add, onClose, onRetry, onOpenSettings, onAdd]);

  const said = data.phrase.length > 0;
  return (
    <VoiceSheet header={header} phrase={said ? data.phrase : data.text} quoted={said} actions={actions} onClose={onClose} bottomInset={bottomInset}>
      {said ? (
        <View style={[styles.box, { borderColor: c.red, backgroundColor: c.panel }]}>
          <View style={[styles.strip, { backgroundColor: c.red }]} />
          <Text style={[styles.text, { color: c.text }]}>{data.text}</Text>
        </View>
      ) : null}
    </VoiceSheet>
  );
});

const styles = StyleSheet.create({
  /** Как предупреждение о занятости в C-AskMove: высота 34 без рамки, полоса слева */
  box: { borderWidth: S.border, minHeight: 34 + 2 * S.border, justifyContent: 'center', paddingLeft: 11, paddingRight: 8, paddingVertical: 6 },
  strip: { position: 'absolute', left: 0, top: 0, bottom: 0, width: S.strip },
  text: { fontFamily: fonts.sans500, fontSize: 13 },
});
