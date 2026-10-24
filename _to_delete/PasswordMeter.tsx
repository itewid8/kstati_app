import React from 'react';
import { StyleSheet, View } from 'react-native';
import { STRENGTH_LABEL, type Strength } from '@/lib/password';
import { useColors } from '@/theme';
import { T } from './ui';

/** Надёжность пароля: три деления и оценка словом */
export function PasswordMeter({ strength }: { strength: Strength }) {
  const c = useColors();
  const color = strength === 2 ? c.success : strength === 1 ? c.warning : c.danger;
  return (
    <View style={styles.wrap} accessibilityLabel={`Пароль: ${STRENGTH_LABEL[strength].toLowerCase()}`}>
      <View style={styles.bars}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.bar, { backgroundColor: i <= strength ? color : c.border }]} />
        ))}
      </View>
      <T variant="label" color={color} style={styles.label}>
        {STRENGTH_LABEL[strength]}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bars: { flex: 1, flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
  label: { minWidth: 84, textAlign: 'right' },
});
