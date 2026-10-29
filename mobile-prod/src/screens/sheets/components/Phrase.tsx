/**
 * Распознанная фраза в «ёлочках» (как в C-Voice): нажатие — правка текста в рамке,
 * текст изменился — «РАЗОБРАТЬ ЗАНОВО» (повторный разбор без записи).
 */
import { memo, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { fonts, size as S, type as T, useInputColors, useTheme } from '@/ui';

type Props = {
  text: string;
  /** Нет — фраза только для чтения */
  onReparse?: (text: string) => void;
};

export const Phrase = memo(function Phrase({ text, onReparse }: Props) {
  const { c } = useTheme();
  const ic = useInputColors();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  useEffect(() => {
    setDraft(text);
    setEditing(false);
  }, [text]);

  if (!editing || !onReparse) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={text} disabled={!onReparse} onPress={() => setEditing(true)}>
        <Text style={[styles.phrase, { color: c.text }]}>{`«${text}»`}</Text>
      </Pressable>
    );
  }
  const changed = draft.trim() !== text.trim() && draft.trim().length > 0;
  return (
    <View style={styles.edit}>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        autoFocus
        multiline
        accessibilityLabel="Фраза"
        selectionColor={ic.selectionColor}
        cursorColor={ic.cursorColor}
        style={[styles.input, { borderColor: c.border, backgroundColor: c.panel, color: c.text }]}
      />
      {changed ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Разобрать заново"
          onPress={() => onReparse(draft.trim())}
          style={[styles.button, { borderColor: c.border, backgroundColor: c.text }]}
        >
          <Text style={[T.action, { color: c.bg }]}>РАЗОБРАТЬ ЗАНОВО</Text>
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  phrase: { fontFamily: fonts.sans600, fontSize: 18, lineHeight: 22, letterSpacing: -0.36 },
  edit: { gap: 8 },
  input: {
    borderWidth: S.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 64,
    maxHeight: 160,
    fontFamily: fonts.sans400,
    fontSize: 15,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  button: { height: 36, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
});
