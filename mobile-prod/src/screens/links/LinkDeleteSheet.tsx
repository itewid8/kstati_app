/**
 * Удаляют запись, с которой что-то связано: список связанного, у каждого — «удалить тоже» (по умолчанию нет).
 * ОТМЕНА — ничего не удалять; УДАЛИТЬ — удалить запись и отмеченное.
 */
import { memo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { LinkRow } from '@/adapters/links';
import { BottomSheet, Checkbox, SectionBox, pad2, size as S, type as T, useTheme } from '@/ui';
import { LinkRowView } from './LinkRowView';

export type LinkDeleteSheetProps = {
  visible: boolean;
  /** Что удаляют: «Дело «Ужин у родителей»», «3 записи» */
  what: string;
  rows: readonly LinkRow[];
  /** key строк, которые удалить вместе */
  chosen: ReadonlySet<string>;
  bottomInset?: number;
  onToggle: (row: LinkRow) => void;
  onConfirm: () => void;
  onClose: () => void;
};

export const LinkDeleteSheet = memo(function LinkDeleteSheet({ visible, what, rows, chosen, bottomInset = 0, onToggle, onConfirm, onClose }: LinkDeleteSheetProps) {
  const { c } = useTheme();
  return (
    <Modal transparent visible={visible} statusBarTranslucent navigationBarTranslucent animationType="fade" onRequestClose={onClose}>
      <BottomSheet visible onClose={onClose} bottomInset={bottomInset}>
        <Text style={[T.rowTitle, { color: c.text }]}>{what}</Text>
        <SectionBox title="УДАЛИТЬ ВМЕСТЕ" count={pad2(rows.length)} scrollable style={styles.list}>
          {rows.map((r) => (
            <LinkRowView
              key={r.key}
              row={r}
              onPress={() => onToggle(r)}
              right={<Checkbox checked={chosen.has(r.key)} onPress={() => onToggle(r)} accessibilityLabel={`Удалить и «${r.title}»`} />}
            />
          ))}
        </SectionBox>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Отмена" onPress={onClose} style={[styles.button, { borderColor: c.border, backgroundColor: c.panel }]}>
            <Text style={[T.action, { color: c.text }]}>ОТМЕНА</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Удалить" onPress={onConfirm} style={[styles.button, { borderColor: c.border, backgroundColor: c.text }]}>
            <Text style={[T.action, { color: c.bg }]}>{chosen.size ? `УДАЛИТЬ И ОТМЕЧЕННОЕ` : 'УДАЛИТЬ'}</Text>
          </Pressable>
        </View>
      </BottomSheet>
    </Modal>
  );
});

const styles = StyleSheet.create({
  list: { maxHeight: S.sectionHeader + S.border * 2 + S.row * 6 },
  actions: { flexDirection: 'row', gap: 8, height: 44 },
  button: { flex: 1, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
});
