/**
 * Название темы или заметки: пока не правят — бегущей строкой (длинное видно целиком), нажатие — поле ввода
 * с курсором в конце. Пустое и новое — сразу поле. Enter (клавиша «Далее») — дальше, к тексту (onNext).
 */
import { memo, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, type StyleProp, type TextStyle } from 'react-native';
import { Marquee, useInputColors, useTheme } from '@/ui';

type Props = {
  value: string;
  /** Без onChange — только показывается */
  onChange?: (value: string) => void;
  onNext?: () => void;
  autoFocus?: boolean;
  placeholder: string;
  maxLength: number;
  textStyle: StyleProp<TextStyle>;
};

export const TitleField = memo(function TitleField({ value, onChange, onNext, autoFocus, placeholder, maxLength, textStyle }: Props) {
  const { c } = useTheme();
  const ic = useInputColors();
  const [editing, setEditing] = useState(!!autoFocus);
  const editable = !!onChange && Platform.OS !== 'web';
  if (editable && (editing || !value)) {
    return (
      <TextInput
        value={value}
        onChangeText={(t) => onChange?.(t.replace(/\s*\n\s*/g, ' '))}
        autoFocus={editing}
        onBlur={() => setEditing(false)}
        placeholder={placeholder}
        placeholderTextColor={c.muted}
        maxLength={maxLength}
        returnKeyType="next"
        submitBehavior="blurAndSubmit"
        onSubmitEditing={onNext}
        selectionColor={ic.selectionColor}
        cursorColor={ic.cursorColor}
        style={[textStyle, styles.input, { color: c.text }]}
      />
    );
  }
  return (
    <Pressable accessibilityRole={editable ? 'button' : 'header'} accessibilityLabel={value} disabled={!editable} onPress={() => setEditing(true)}>
      <Marquee ellipsis={false} style={[textStyle, styles.text, { color: c.text }]}>
        {value}
      </Marquee>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  input: { padding: 0, margin: 0, includeFontPadding: false, paddingRight: 2 },
  /** Хвост последней буквы при отрицательном межбуквенном не срезается */
  text: { paddingRight: 2 },
});
