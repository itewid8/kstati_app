/**
 * Нижнее сообщение «УДАЛЕНО · ВЕРНУТЬ»: квадратная плашка, инвертированная (как шапка секции),
 * моноширинный текст заглавными; кнопка отмены — плашка цвета фона.
 */
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Marquee, fonts, size as S, type as T, useTheme } from '@/ui';

export type UndoToastViewProps = {
  /** «Удалено «Йога»», «Нет группы» */
  label: string;
  /** Есть — кнопка «ВЕРНУТЬ» */
  onUndo?: () => void;
  style?: StyleProp<ViewStyle>;
};

export const UndoToastView = memo(function UndoToastView({ label, onUndo, style }: UndoToastViewProps) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="alert" style={[styles.toast, { borderColor: c.border, backgroundColor: c.text }, style]}>
      <Marquee style={[styles.label, { color: c.bg }]}>{label.toLocaleUpperCase('ru-RU')}</Marquee>
      {onUndo ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Вернуть" onPress={onUndo} hitSlop={6} style={[styles.button, { backgroundColor: c.bg }]}>
          <Text style={[T.action, { color: c.text }]}>ВЕРНУТЬ</Text>
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  toast: {
    minHeight: S.row,
    borderWidth: S.border,
    paddingLeft: 12,
    paddingRight: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  label: { flex: 1, minWidth: 0, fontFamily: fonts.mono500, fontSize: 11, letterSpacing: 0.66 },
  button: { height: 30, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
});
