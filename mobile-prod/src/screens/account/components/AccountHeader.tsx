import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { IconButton, Marquee, fonts, size as S, space, type as T, useTheme } from '@/ui';

type Props = {
  /** «НАСТРОЙКИ», «ГРУППА · ВЫ СОЗДАТЕЛЬ» */
  caption?: string;
  /** Название страницы прямо в шапке (над ним — подпись мелко): одна строка 40 вместо шапки и заголовка 40/42 */
  title?: string;
  /** Нажатие на название (переименовать группу) */
  onPressTitle?: () => void;
  /** Без кнопки «Назад» (вход, первая группа) */
  back?: boolean;
  onBack?: () => void;
  /** Справа, прижато к краю (знак приложения на экране кода) */
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Верхняя панель вложенных экранов: «Назад» 40×40 и рядом — название 22/24 с подписью 9 над ним
 * (или только подпись 10px, если названия нет — вход, первая группа)
 */
export const AccountHeader = memo(function AccountHeader({ caption, title, onPressTitle, back = true, onBack, right, style }: Props) {
  const { c } = useTheme();
  const name = title ? (
    <View style={styles.names}>
      {caption ? <Marquee style={[styles.small, { color: c.muted }]}>{caption}</Marquee> : null}
      <Marquee style={[styles.title, { color: c.text }]}>
        {title}
      </Marquee>
    </View>
  ) : null;
  return (
    <View style={[styles.bar, style]}>
      {back ? <IconButton icon="back" accessibilityLabel="Назад" onPress={onBack} iconSize={S.iconSmall} /> : null}
      {title ? (
        onPressTitle ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Название: ${title}`} onPress={onPressTitle} style={styles.flex}>
            {name}
          </Pressable>
        ) : (
          <View style={styles.flex}>{name}</View>
        )
      ) : caption ? (
        <Marquee style={[T.caption, styles.flex, { color: c.muted }]}>
          {caption}
        </Marquee>
      ) : (
        <View style={styles.flex} />
      )}
      {right}
    </View>
  );
});

const styles = StyleSheet.create({
  bar: { height: S.topBarHeight, flexDirection: 'row', alignItems: 'center', gap: space.barGap + 2 },
  flex: { flex: 1, minWidth: 0 },
  names: { gap: 1 },
  small: { fontFamily: fonts.mono400, fontSize: 9, letterSpacing: 0.72, lineHeight: 11 },
  title: { fontFamily: fonts.sans700, fontSize: 22, letterSpacing: -0.88, lineHeight: 24 },
});
