import { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { fonts, size as S, useInputColors, useTheme } from '@/ui';

type Props = {
  value: string;
  onChangeText?: (text: string) => void;
  /** Название поля внутри него: «Почта», «Пароль» */
  placeholder?: string;
  /** Знак перед текстом: «@» у никнейма */
  prefix?: string;
  /** Поле в своей рамке; внутри SectionBox — без рамки и с разделителем сверху, как строки секций */
  framed?: boolean;
  divider?: boolean;
  /** Неверно: красная полоса слева */
  invalid?: boolean;
  secureTextEntry?: boolean;
  autoComplete?: 'email' | 'current-password' | 'new-password' | 'name' | 'username' | 'off';
  textContentType?: 'emailAddress' | 'password' | 'newPassword' | 'givenName' | 'nickname' | 'none';
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  autoFocus?: boolean;
  editable?: boolean;
  maxLength?: number;
  returnKeyType?: 'done' | 'next' | 'go';
  onSubmitEditing?: () => void;
  accessibilityLabel?: string;
};

/** Поле ввода 44px как в окне ввода (InputSheet): Geist 15 на панели, рамка 1.5px */
export const Field = forwardRef<TextInput, Props>(function Field(
  { value, onChangeText, placeholder, prefix, framed = true, divider = !framed, invalid = false, onSubmitEditing, accessibilityLabel, ...input },
  ref,
) {
  const { c } = useTheme();
  const ic = useInputColors();
  return (
    <View
      style={[
        styles.box,
        { backgroundColor: c.panel },
        framed && { borderWidth: S.border, borderColor: c.border },
        divider && { borderTopWidth: S.hairline, borderTopColor: c.hair },
      ]}
    >
      {invalid ? <View style={[styles.strip, { backgroundColor: c.red }]} /> : null}
      {prefix ? <Text style={[styles.text, styles.prefix, { color: c.muted }]}>{prefix}</Text> : null}
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.muted}
        selectionColor={ic.selectionColor}
        cursorColor={ic.cursorColor}
        onSubmitEditing={onSubmitEditing ? () => onSubmitEditing() : undefined}
        accessibilityLabel={accessibilityLabel ?? placeholder}
        style={[styles.text, styles.input, { color: c.text }]}
        {...input}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  box: { minHeight: S.row, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  strip: { position: 'absolute', left: 0, top: 0, bottom: 0, width: S.strip },
  text: { fontFamily: fonts.sans400, fontSize: 15, lineHeight: 20 },
  prefix: { marginRight: 2 },
  /** outlineWidth 0 — без рамки фокуса браузера (стенд сверки); рамка поля — у обёртки */
  input: { flex: 1, minWidth: 0, paddingVertical: 11, paddingHorizontal: 0, outlineWidth: 0 },
});
