/**
 * C-AskMove — голосовой перенос/изменение: карточка дела, таблица «было → стало»,
 * красные предупреждения о пересечениях, «Отмена / Изменить / Перенести».
 */
import { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fonts, size as S, useTheme } from '@/ui';
import { TaskCard } from './components/TaskCard';
import { VoiceSheet } from './components/VoiceSheet';
import type { SheetAction, VoiceSheetHeader, VoiceTaskCard } from './types';

export type MoveChange = {
  key: string;
  /** «КОГДА» */
  label: string;
  /** Было (зачёркнуто): «ПН 05 ОКТ · 09:30» */
  was: string;
  /** Стало: «ПТ 09 ОКТ · 14:00» */
  now: string;
};

export type MoveConflict = {
  key: string;
  /** «САНЯ ЗАНЯТ» */
  who: string;
  /** «Обед с Олегом · 14:00–16:30» */
  what: string;
};

export type AskMoveSheetProps = {
  header: VoiceSheetHeader;
  /** Фраза команды (без кавычек) */
  phrase: string;
  task: VoiceTaskCard;
  changes: readonly MoveChange[];
  conflicts?: readonly MoveConflict[];
  /** Главная кнопка: «ПЕРЕНЕСТИ» (по умолчанию), «СОХРАНИТЬ» */
  confirmLabel?: string;
  visible?: boolean;
  bottomInset?: number;
  onCancel?: () => void;
  onEdit?: () => void;
  onConfirm?: () => void;
  onClose?: () => void;
};

const NONE: readonly MoveConflict[] = [];

export const AskMoveSheet = memo(function AskMoveSheet({
  header,
  phrase,
  task,
  changes,
  conflicts = NONE,
  confirmLabel = 'ПЕРЕНЕСТИ',
  visible,
  bottomInset,
  onCancel,
  onEdit,
  onConfirm,
  onClose,
}: AskMoveSheetProps) {
  const { c } = useTheme();
  const actions = useMemo<SheetAction[]>(
    () => [
      { key: 'cancel', label: 'ОТМЕНА', onPress: onCancel },
      { key: 'edit', label: 'ИЗМЕНИТЬ', onPress: onEdit },
      { key: 'confirm', label: confirmLabel, tone: 'primary', onPress: onConfirm },
    ],
    [onCancel, onEdit, onConfirm, confirmLabel],
  );
  return (
    <VoiceSheet header={header} phrase={phrase} actions={actions} visible={visible} onClose={onClose} bottomInset={bottomInset}>
      <TaskCard task={task} />
      <View style={[styles.table, { borderColor: c.border, backgroundColor: c.panel }]}>
        {changes.map((d, i) => (
          <View key={d.key} style={[styles.row, i > 0 && [styles.rowSep, { borderTopColor: c.hair }]]}>
            <View style={[styles.labelCell, { borderRightColor: c.hair }]}>
              <Text style={[styles.label, { color: c.muted }]}>{d.label}</Text>
            </View>
            <View style={styles.valueCell}>
              <Text style={[styles.was, { color: c.muted }]}>{d.was}</Text>
              <Text style={[styles.now, { color: c.text }]}>{d.now}</Text>
            </View>
          </View>
        ))}
      </View>
      {conflicts.map((w) => (
        <View key={w.key} style={[styles.conflict, { borderColor: c.red, backgroundColor: c.panel }]}>
          <View style={[styles.conflictStrip, { backgroundColor: c.red }]} />
          <View style={styles.conflictBody}>
            <Text style={[styles.conflictWho, { color: c.red }]}>{w.who}</Text>
            <Text style={[styles.conflictWhat, { color: c.text }]}>{w.what}</Text>
          </View>
        </View>
      ))}
    </VoiceSheet>
  );
});

const styles = StyleSheet.create({
  table: { borderWidth: S.border },
  row: { flexDirection: 'row', alignItems: 'stretch', minHeight: 40 },
  /** 40 + разделитель 1 */
  rowSep: { minHeight: 41, borderTopWidth: S.hairline },
  labelCell: { width: 72, flexShrink: 0, justifyContent: 'center', paddingLeft: 8, borderRightWidth: S.hairline },
  label: { fontFamily: fonts.mono400, fontSize: 8.5, letterSpacing: 0.68 },
  valueCell: { flex: 1, justifyContent: 'center', gap: 2, paddingVertical: 4, paddingHorizontal: 10 },
  was: { fontFamily: fonts.mono400, fontSize: 9.5, textDecorationLine: 'line-through' },
  now: { fontFamily: fonts.mono600, fontSize: 11.5 },
  conflict: { borderWidth: S.border },
  /** Высота 34 без рамки */
  conflictBody: {
    minHeight: 34,
    paddingLeft: 11,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  conflictStrip: { position: 'absolute', left: 0, top: 0, bottom: 0, width: S.strip },
  conflictWho: { fontFamily: fonts.mono600, fontSize: 9, letterSpacing: 0.54 },
  conflictWhat: { flexShrink: 1, fontFamily: fonts.sans400, fontSize: 12 },
});
