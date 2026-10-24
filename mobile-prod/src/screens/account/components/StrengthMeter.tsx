import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/ui';
import { useAccountPalette } from './accountTheme';

/** 0 — ненадёжный, 1 — средний, 2 — надёжный (lib/password) */
export type Strength = 0 | 1 | 2;

export const STRENGTH_LABEL: Record<Strength, string> = { 0: 'НЕНАДЁЖНЫЙ', 1: 'СРЕДНИЙ', 2: 'НАДЁЖНЫЙ' };

/** Надёжность пароля: три деления 4px на панели, цвет — красный / жёлтый / зелёный */
export const StrengthMeter = memo(function StrengthMeter({ strength }: { strength: Strength }) {
  const { c } = useTheme();
  const pal = useAccountPalette();
  const color = strength === 2 ? pal.ok : strength === 1 ? c.warn : c.red;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Пароль: ${STRENGTH_LABEL[strength].toLocaleLowerCase('ru-RU')}`}
      style={[styles.row, { backgroundColor: c.panel, borderTopColor: c.hair }]}
    >
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.cell, { backgroundColor: i <= strength ? color : pal.meterEmpty }]} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 2, padding: 8, borderTopWidth: 1 },
  cell: { flex: 1, flexBasis: 0, height: 4 },
});
