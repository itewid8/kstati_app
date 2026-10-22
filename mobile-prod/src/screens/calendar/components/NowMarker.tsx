/**
 * Линия «сейчас»: красная полоса 2px по колонке сегодняшнего дня, точка 8px со свечением на её левом конце
 * и (в дне) плашка времени «17:52» у правого края сетки.
 */
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fonts, useTheme } from '@/ui';

type Props = {
  /** y линии, px экрана */
  y: number;
  left: number;
  width: number;
  /** «17:52»; нет — без плашки */
  label?: string;
  /** Отступ плашки от правого края экрана */
  labelRight?: number;
};

const NOW_WHITE = '#FFFFFF';

export const NowMarker = memo(function NowMarker({ y, left, width, label, labelRight = 30 }: Props) {
  const { c } = useTheme();
  return (
    <>
      <View pointerEvents="none" style={[styles.line, { top: y, left, width, backgroundColor: c.red }]} />
      <View
        pointerEvents="none"
        style={[styles.dot, { top: y - 3, left: left - 4, backgroundColor: c.red, boxShadow: `0 0 6px ${c.glow}` }]}
      />
      {label ? (
        <Text style={[styles.label, { top: y - 6, right: labelRight, backgroundColor: c.red }]}>{label}</Text>
      ) : null}
    </>
  );
});

const styles = StyleSheet.create({
  line: { position: 'absolute', height: 2 },
  dot: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
  label: {
    position: 'absolute',
    paddingHorizontal: 4,
    color: NOW_WHITE,
    fontFamily: fonts.mono600,
    fontSize: 9,
    lineHeight: 14,
  },
});
