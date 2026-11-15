/**
 * Выбор записи для связи: поле поиска и список дел, фильмов, хотелок и заметок (другого типа, ещё не связанных).
 * Отдельное окно (Modal) — клавиатура поднимает его целиком, как InputSheet
 */
import { memo } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import type { LinkRow } from '@/adapters/links';
import { BottomSheet, SectionBox, fonts, size as S, type as T, useInputColors, useTheme } from '@/ui';
import { LinkRowView } from './LinkRowView';

export type LinkPickerSheetProps = {
  visible: boolean;
  query: string;
  rows: readonly LinkRow[];
  bottomInset?: number;
  onQuery: (q: string) => void;
  onPick: (row: LinkRow) => void;
  onClose: () => void;
};

/** Видно семь строк, дальше список прокручивается */
const MAX_LIST = S.sectionHeader + S.border * 2 + S.row * 7;

export const LinkPickerSheet = memo(function LinkPickerSheet({ visible, query, rows, bottomInset = 0, onQuery, onPick, onClose }: LinkPickerSheetProps) {
  const { c } = useTheme();
  const ic = useInputColors();
  return (
    <Modal transparent visible={visible} statusBarTranslucent navigationBarTranslucent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <BottomSheet visible onClose={onClose} bottomInset={bottomInset}>
          <TextInput
            value={query}
            onChangeText={onQuery}
            autoFocus
            placeholder="Поиск"
            placeholderTextColor={c.muted}
            returnKeyType="search"
            selectionColor={ic.selectionColor}
            cursorColor={ic.cursorColor}
            accessibilityLabel="Поиск записи"
            style={[styles.input, { borderColor: c.border, backgroundColor: c.panel, color: c.text }]}
          />
          <SectionBox title="СВЯЗАТЬ С" scrollable style={styles.list}>
            {rows.length ? (
              rows.map((r) => <LinkRowView key={r.key} row={r} onPress={() => onPick(r)} />)
            ) : (
              <View style={[styles.empty, { backgroundColor: c.panel }]}>
                <Text style={[T.rowMeta, { color: c.muted }]}>НИЧЕГО НЕ НАЙДЕНО</Text>
              </View>
            )}
          </SectionBox>
        </BottomSheet>
      </KeyboardAvoidingView>
    </Modal>
  );
});

const styles = StyleSheet.create({
  fill: { flex: 1 },
  input: { height: 44, borderWidth: S.border, paddingHorizontal: 12, fontFamily: fonts.sans400, fontSize: 15 },
  list: { maxHeight: MAX_LIST },
  empty: { height: S.row, alignItems: 'center', justifyContent: 'center' },
});
