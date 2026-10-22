import { memo, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BottomSheet } from './BottomSheet';
import { size as S, fonts, type as T } from './tokens';
import { useTheme } from './useTheme';

type Props = {
  visible: boolean;
  /** Текст при открытии */
  value: string;
  /** Описание — несколько строк, можно сохранить пустым; одна строка (название) — только непустой */
  multiline?: boolean;
  maxLength?: number;
  /** Нижний отступ safe area (когда клавиатура закрыта) */
  bottomInset?: number;
  /** Текст без пробелов по краям */
  onSubmit: (text: string) => void;
  onClose: () => void;
};

/**
 * Окно ввода текста поверх экрана: поле Geist 15 в рамке 1.5px и кнопки ОТМЕНА / СОХРАНИТЬ.
 * Для названия дела, описания, переименования группы. Отдельное окно (Modal) — клавиатура поднимает его целиком
 */
export const InputSheet = memo(function InputSheet({ visible, value, multiline = false, maxLength, bottomInset = 0, onSubmit, onClose }: Props) {
  const { c } = useTheme();
  const [text, setText] = useState(value);
  // Каждое открытие начинается с переданного текста
  useEffect(() => {
    if (visible) setText(value);
  }, [visible, value]);

  const trimmed = text.trim();
  const canSave = multiline || trimmed.length > 0;
  const save = () => {
    if (canSave) onSubmit(trimmed);
  };

  return (
    <Modal transparent visible={visible} statusBarTranslucent navigationBarTranslucent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <BottomSheet visible onClose={onClose} bottomInset={bottomInset}>
          <TextInput
            value={text}
            onChangeText={setText}
            autoFocus
            multiline={multiline}
            maxLength={maxLength}
            textAlignVertical={multiline ? 'top' : 'center'}
            returnKeyType={multiline ? 'default' : 'done'}
            submitBehavior={multiline ? 'newline' : 'submit'}
            onSubmitEditing={multiline ? undefined : save}
            selectionColor={c.text}
            cursorColor={c.text}
            accessibilityLabel="Текст"
            style={[styles.input, multiline && styles.multiline, { borderColor: c.border, backgroundColor: c.panel, color: c.text }]}
          />
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Отмена"
              onPress={onClose}
              style={[styles.button, { borderColor: c.border, backgroundColor: c.panel }]}
            >
              <Text style={[T.action, { color: c.text }]}>ОТМЕНА</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Сохранить"
              accessibilityState={{ disabled: !canSave }}
              disabled={!canSave}
              onPress={save}
              style={[styles.button, styles.primary, { borderColor: c.border, backgroundColor: c.text, opacity: canSave ? 1 : 0.4 }]}
            >
              <Text style={[T.action, { color: c.bg }]}>СОХРАНИТЬ</Text>
            </Pressable>
          </View>
        </BottomSheet>
      </KeyboardAvoidingView>
    </Modal>
  );
});

const styles = StyleSheet.create({
  fill: { flex: 1 },
  input: {
    borderWidth: S.border,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontFamily: fonts.sans400,
    fontSize: 15,
    lineHeight: 20,
  },
  multiline: { minHeight: 112, maxHeight: 240 },
  actions: { flexDirection: 'row', gap: 8, height: 44 },
  button: { flex: 1, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
  primary: { flex: 1.3 },
});
