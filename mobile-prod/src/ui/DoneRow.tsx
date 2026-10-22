import { memo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Checkbox } from './Checkbox';
import { Marquee } from './Marquee';
import { size as S, type as T } from './tokens';
import { useTheme } from './useTheme';

type Props = {
  title: string;
  /** Справа моноширинным: «ОТ КАРИНЫ», «28 СЕН» */
  meta?: string;
  onToggle?: () => void;
  /** Что делает снятие галочки: «Вернуть в список» */
  checkLabel: string;
  style?: StyleProp<ViewStyle>;
};

/** Строка «сделано» 34px: отмеченная галочка, зачёркнутое название */
export const DoneRow = memo(function DoneRow({ title, meta, onToggle, checkLabel, style }: Props) {
  const { c } = useTheme();
  return (
    <View style={[styles.row, { borderTopColor: c.hair }, style]}>
      <Checkbox checked onPress={onToggle} accessibilityLabel={checkLabel} tapWidth={34} tapHeight={33} />
      <Marquee style={[T.doneTitle, styles.title, { color: c.muted }]}>{title}</Marquee>
      {meta ? <Text style={[T.doneMeta, { color: c.muted }]}>{meta}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    height: S.doneRow,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 8,
    borderTopWidth: S.hairline,
  },
  title: { flex: 1, minWidth: 0, textDecorationLine: 'line-through' },
});
