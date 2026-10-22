import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { PersonColor } from '@/lib/types';
import { size as S, useTheme } from '@/ui';

type Props = {
  /** Цвета участников сверху вниз; несколько — полоса делится поровну */
  colors: readonly PersonColor[];
};

/** Полоса 1.5px по левому краю строки/карточки (absolute, на всю высоту внутри рамки) */
export const PersonStrip = memo(function PersonStrip({ colors }: Props) {
  const { person } = useTheme();
  if (colors.length === 0) return null;
  return (
    <View pointerEvents="none" style={styles.strip}>
      {colors.map((color, i) => (
        <View key={i} style={[styles.part, { backgroundColor: person(color) }]} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  strip: { position: 'absolute', left: 0, top: 0, bottom: 0, width: S.strip },
  part: { flex: 1 },
});
