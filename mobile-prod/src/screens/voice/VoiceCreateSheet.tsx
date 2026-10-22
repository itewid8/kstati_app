/**
 * C-Voice — голосовая запись нового: таймер REC, живая волна, распознанная фраза
 * и поля только для просмотра. «Изменить» открывает полный редактор, «Сохранить» создаёт.
 */
import { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PersonTag, fonts, size as S, useTheme } from '@/ui';
import { VoiceSheet } from './components/VoiceSheet';
import type { SheetAction, VoicePerson } from './types';

/**
 * Распознанное поле: подпись слева («КОГДА») и значение.
 * tag — тип записи («ДЕЛО»), title — название, text — дата/группа/напоминание, people — кто участвует.
 */
export type RecognizedField =
  | { key: string; label: string; kind: 'tag' | 'title' | 'text'; value: string }
  | { key: string; label: string; kind: 'people'; people: readonly VoicePerson[] };

export type VoiceCreateSheetProps = {
  /** «00:04» */
  duration: string;
  /** Громкость записанных столбиков, 0–100 */
  levels: readonly number[];
  /** Идёт запись */
  recording: boolean;
  /** Распознанная фраза (без кавычек) */
  phrase: string;
  fields: readonly RecognizedField[];
  visible?: boolean;
  bottomInset?: number;
  onCancel?: () => void;
  onEdit?: () => void;
  onSave?: () => void;
  onClose?: () => void;
};

const FieldValue = memo(function FieldValue({ field }: { field: RecognizedField }) {
  const { c, person } = useTheme();
  if (field.kind === 'people') {
    return (
      <>
        {field.people.map((p) => (
          <PersonTag key={p.id} name={p.name} color={person(p.color)} />
        ))}
      </>
    );
  }
  return <Text style={[valueStyles[field.kind], { color: c.text }]}>{field.value}</Text>;
});

export const VoiceCreateSheet = memo(function VoiceCreateSheet({
  duration,
  levels,
  recording,
  phrase,
  fields,
  visible,
  bottomInset,
  onCancel,
  onEdit,
  onSave,
  onClose,
}: VoiceCreateSheetProps) {
  const { c } = useTheme();
  const header = useMemo(() => ({ duration, levels, live: recording }), [duration, levels, recording]);
  const actions = useMemo<SheetAction[]>(
    () => [
      { key: 'cancel', label: 'ОТМЕНА', onPress: onCancel },
      { key: 'edit', label: 'ИЗМЕНИТЬ', onPress: onEdit },
      { key: 'save', label: 'СОХРАНИТЬ', tone: 'primary', flex: 1.3, onPress: onSave },
    ],
    [onCancel, onEdit, onSave],
  );
  return (
    <VoiceSheet
      header={header}
      phrase={phrase}
      quoted={false}
      actions={actions}
      visible={visible}
      onClose={onClose}
      bottomInset={bottomInset}
    >
      <View style={[styles.table, { borderColor: c.border, backgroundColor: c.panel }]}>
        {fields.map((f, i) => (
          <View key={f.key} style={[styles.row, i > 0 && [styles.rowSep, { borderTopColor: c.hair }]]}>
            <View style={[styles.labelCell, { borderRightColor: c.hair }]}>
              <Text style={[styles.label, { color: c.muted }]}>{f.label}</Text>
            </View>
            <View style={styles.valueCell}>
              <FieldValue field={f} />
            </View>
          </View>
        ))}
      </View>
    </VoiceSheet>
  );
});

const valueStyles = StyleSheet.create({
  tag: { fontFamily: fonts.mono600, fontSize: 11 },
  title: { fontFamily: fonts.sans600, fontSize: 13 },
  text: { fontFamily: fonts.mono500, fontSize: 11 },
});

const styles = StyleSheet.create({
  table: { borderWidth: S.border },
  row: { flexDirection: 'row', alignItems: 'stretch', minHeight: 34 },
  /** 34 + разделитель 1 */
  rowSep: { minHeight: 35, borderTopWidth: S.hairline },
  labelCell: { width: 84, flexShrink: 0, justifyContent: 'center', paddingLeft: 8, borderRightWidth: S.hairline },
  label: { fontFamily: fonts.mono400, fontSize: 8.5, letterSpacing: 0.68 },
  valueCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10 },
});
