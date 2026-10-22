import { memo, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { IconButton, Marquee, size as S, space, type as T, useTheme } from '@/ui';

type Props = {
  /** «НАСТРОЙКИ», «ГРУППА · ВЫ СОЗДАТЕЛЬ» */
  caption?: string;
  onBack?: () => void;
  /** Справа, прижато к краю (знак приложения на экране кода) */
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Верхняя панель вложенных экранов: «Назад» 40×40 и подпись 10px */
export const AccountHeader = memo(function AccountHeader({ caption, onBack, right, style }: Props) {
  const { c } = useTheme();
  return (
    <View style={[styles.bar, style]}>
      <IconButton icon="back" accessibilityLabel="Назад" onPress={onBack} iconSize={S.iconSmall} />
      {caption ? (
        <Marquee style={[T.caption, styles.caption, { color: c.muted }]}>
          {caption}
        </Marquee>
      ) : (
        <View style={styles.caption} />
      )}
      {right}
    </View>
  );
});

const styles = StyleSheet.create({
  bar: { height: S.topBarHeight, flexDirection: 'row', alignItems: 'center', gap: space.barGap },
  caption: { flex: 1 },
});
