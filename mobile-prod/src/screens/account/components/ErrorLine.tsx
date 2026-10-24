import { memo } from 'react';
import { StyleSheet, Text } from 'react-native';
import { fonts, useTheme } from '@/ui';

/** Ошибка под полем или кодом: моно 9.5 красным; пусто — ничего */
export const ErrorLine = memo(function ErrorLine({ text }: { text?: string | null }) {
  const { c } = useTheme();
  if (!text) return null;
  return (
    <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={[styles.text, { color: c.red }]}>
      {text}
    </Text>
  );
});

const styles = StyleSheet.create({
  text: { fontFamily: fonts.mono400, fontSize: 9.5, letterSpacing: 0.57, lineHeight: 13 },
});
