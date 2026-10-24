import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Marquee, fonts, size as S, useTheme } from '@/ui';

type Props = {
  /** «УЖЕ ЕСТЬ», «КАРИНА ЗАНЯТА» */
  label: string;
  text: string;
  /** red — запись не сохранится / занят; muted — решено (добавится ещё раз) */
  tone?: 'red' | 'muted';
  /** Кнопка справа: «ВСЁ РАВНО», «НЕ ДОБАВЛЯТЬ» */
  action?: { label: string; onPress: () => void };
};

/** Плашка под записью (как пересечения в C-AskMove): полоса и рамка цвета тона, ярлык, текст, кнопка */
export const Notice = memo(function Notice({ label, text, tone = 'red', action }: Props) {
  const { c } = useTheme();
  const ink = tone === 'red' ? c.red : c.muted;
  return (
    <View style={[styles.box, { borderColor: tone === 'red' ? c.red : c.hairStrong, backgroundColor: c.panel }]}>
      <View style={[styles.strip, { backgroundColor: ink }]} />
      <Text style={[styles.label, { color: ink }]}>{label}</Text>
      <Marquee style={[styles.text, { color: c.text }]}>{text}</Marquee>
      {action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          style={[styles.button, { borderColor: c.border, backgroundColor: c.bg }]}
        >
          <Text style={[styles.buttonLabel, { color: c.text }]}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  box: { borderWidth: S.border, minHeight: 37, paddingLeft: 11, paddingRight: 4, flexDirection: 'row', alignItems: 'center', gap: 8 },
  strip: { position: 'absolute', left: 0, top: 0, bottom: 0, width: S.strip },
  label: { fontFamily: fonts.mono600, fontSize: 9, letterSpacing: 0.54 },
  text: { flex: 1, minWidth: 0, fontFamily: fonts.sans400, fontSize: 12 },
  button: { height: 26, borderWidth: S.border, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  buttonLabel: { fontFamily: fonts.mono600, fontSize: 9, letterSpacing: 0.72 },
});
