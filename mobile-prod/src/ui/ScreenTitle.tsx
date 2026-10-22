import { memo, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { size as S, type as T } from './tokens';
import { useTheme } from './useTheme';

type Props = {
  title: string;
  /** Справа, прижато к низу строки (переключатель вида) */
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Заголовок экрана 40/42 */
export const ScreenTitle = memo(function ScreenTitle({ title, right, style }: Props) {
  const { c } = useTheme();
  return (
    <View style={[styles.row, style]}>
      {/* Без numberOfLines: при letterSpacing −2 обрезка по рамке текста срезает хвост последней буквы */}
      <Text accessibilityRole="header" style={[T.h1, { color: c.text }]}>
        {title}
      </Text>
      {right}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { height: S.titleHeight, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
});
