/**
 * Одна правка в голосовом ответе из нескольких (без макета, блоки C-AskMove / C-AskDelete):
 * карточка записи с ярлыком действия (удаление — зачёркнуто), таблица «было → стало», пересечения,
 * выбор записи, если подходит несколько.
 */
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fonts, size as S, useTheme } from '@/ui';
import type { MoveChange, MoveConflict } from '../voice/AskMoveSheet';
import type { VoiceTaskCard } from '../voice/types';
import { SheetSection } from './components/ChoiceSection';
import { Notice } from './components/Notice';
import { OptionList, type OptionItem } from './components/OptionList';
import { SheetCard } from './components/SheetCard';

export type ChangeBlockProps = {
  card: VoiceTaskCard;
  /** «ПЕРЕНЕСТИ», «УДАЛИТЬ», «ОТМЕТИТЬ» */
  badge: string;
  struck?: boolean;
  rows?: readonly MoveChange[];
  conflicts?: readonly MoveConflict[];
  /** Подходящие записи (больше одной) — выбор */
  candidates?: readonly OptionItem[];
  onChoose?: (id: string) => void;
  onRemove?: () => void;
};

export const ChangeBlock = memo(function ChangeBlock({ card, badge, struck, rows, conflicts, candidates, onChoose, onRemove }: ChangeBlockProps) {
  const { c } = useTheme();
  return (
    <>
      <SheetCard title={card.title} tag={badge} meta={card.meta} colors={card.colors} struck={struck} onRemove={onRemove} />
      {rows?.length ? (
        <View style={[styles.table, { borderColor: c.border, backgroundColor: c.panel }]}>
          {rows.map((d, i) => (
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
      ) : null}
      {conflicts?.map((w) => <Notice key={w.key} label={w.who} text={w.what} />)}
      {candidates && candidates.length > 1 ? (
        <SheetSection label="КАКАЯ ЗАПИСЬ">
          <OptionList variant="radio" options={candidates} onPress={onChoose} />
        </SheetSection>
      ) : null}
    </>
  );
});

const styles = StyleSheet.create({
  table: { borderWidth: S.border },
  row: { flexDirection: 'row', alignItems: 'stretch', minHeight: 40 },
  rowSep: { minHeight: 41, borderTopWidth: S.hairline },
  labelCell: { width: 72, flexShrink: 0, justifyContent: 'center', paddingLeft: 8, borderRightWidth: S.hairline },
  label: { fontFamily: fonts.mono400, fontSize: 8.5, letterSpacing: 0.68 },
  valueCell: { flex: 1, justifyContent: 'center', gap: 2, paddingVertical: 4, paddingHorizontal: 10 },
  was: { fontFamily: fonts.mono400, fontSize: 9.5, textDecorationLine: 'line-through' },
  now: { fontFamily: fonts.mono600, fontSize: 11.5 },
});
