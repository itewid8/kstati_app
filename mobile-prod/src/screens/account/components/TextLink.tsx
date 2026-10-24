import { memo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { fonts, useTheme } from '@/ui';

/** Ссылка 40px моно приглушённым: «УЖЕ ЕСТЬ АККАУНТ → ВОЙТИ», «ПОЗЖЕ →» */
export const TextLink = memo(function TextLink({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress?: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={styles.link}>
      <Text style={[styles.text, { color: c.muted }]}>{label}</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  link: { height: 40, alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: fonts.mono400, fontSize: 10.5, letterSpacing: 0.84 },
});
