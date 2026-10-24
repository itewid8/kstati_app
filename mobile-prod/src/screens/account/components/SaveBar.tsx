import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { size as S, space, type as T, useTheme } from '@/ui';

/** Плашка 76px над линией: кнопки 44px с полями 16 (как в окнах редактирования) */
export const SAVE_BAR = 76;
const BUTTON = 44;

type Props = {
  /** Есть что сохранить: иначе СОХРАНИТЬ бледная и не нажимается */
  canSave: boolean;
  /** Идёт сохранение: обе кнопки неактивны */
  busy?: boolean;
  /** «СОХРАНИТЬ» по умолчанию; «СОЗДАТЬ», «ВСТУПИТЬ» */
  saveLabel?: string;
  bottomInset?: number;
  onCancel?: () => void;
  onSave?: () => void;
};

/**
 * Нижняя плашка страниц профиля и настроек: ОТМЕНА (без изменений назад) и СОХРАНИТЬ (залита).
 * Стоит в колонке страницы последней — клавиатура поднимает её вместе со страницей
 */
export const SaveBar = memo(function SaveBar({ canSave, busy = false, saveLabel = 'СОХРАНИТЬ', bottomInset = 0, onCancel, onSave }: Props) {
  const { c } = useTheme();
  const saveOff = !canSave || busy;
  return (
    <View style={[styles.bar, { height: SAVE_BAR + S.hairline + bottomInset, paddingBottom: 16 + bottomInset, backgroundColor: c.bg, borderTopColor: c.hair }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Отмена"
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={onCancel}
        style={[styles.button, styles.cancel, { borderColor: c.border, backgroundColor: c.panel }]}
      >
        <Text style={[T.action, { color: c.text }]}>ОТМЕНА</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={saveLabel}
        accessibilityState={{ disabled: saveOff, busy }}
        disabled={saveOff}
        onPress={onSave}
        style={[styles.button, styles.save, { borderColor: c.border, backgroundColor: c.text, opacity: saveOff ? 0.4 : 1 }]}
      >
        <Text style={[T.action, { color: c.bg }]}>{saveLabel}</Text>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  bar: {
    paddingTop: 16,
    paddingHorizontal: space.side,
    borderTopWidth: S.hairline,
    flexDirection: 'row',
    gap: 8,
  },
  button: { height: BUTTON, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
  /** 1 : 1.6 от основы 15px — как УДАЛИТЬ / СОХРАНИТЬ в окнах редактирования (EditorScaffold) */
  cancel: { flexGrow: 1, flexShrink: 1, flexBasis: 15 },
  save: { flexGrow: 1.6, flexShrink: 1, flexBasis: 15 },
});
