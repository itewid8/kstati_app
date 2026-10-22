import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Marquee } from './Marquee';
import { type as T } from './tokens';
import { useTheme } from './useTheme';

type Props = {
  /** Цвет человека (hex, уже под тему — useTheme().person) */
  color: string;
  name: string;
  /** sm — квадрат 9px и 9.5px текст (окно записи), md — 10px и 10px (карточка) */
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
};

/** Цветной квадрат человека + имя моноширинным */
export const PersonTag = memo(function PersonTag({ color, name, size = 'sm', style }: Props) {
  const { c } = useTheme();
  const md = size === 'md';
  return (
    <View style={[styles.row, md && styles.rowMd, style]}>
      <View style={[md ? styles.squareMd : styles.square, { backgroundColor: color }]} />
      <Marquee style={[T.person, styles.text, md && styles.textMd, { color: c.text }]}>{name}</Marquee>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rowMd: { gap: 6 },
  square: { width: 9, height: 9 },
  squareMd: { width: 10, height: 10 },
  /** Имя сжимается и едет, квадрат остаётся */
  text: { flexShrink: 1 },
  textMd: { fontSize: 10, letterSpacing: 0.6 },
});
