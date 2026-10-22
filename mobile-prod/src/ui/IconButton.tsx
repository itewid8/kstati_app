import { memo } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon, type IconName } from './Icon';
import { size as S, type as T } from './tokens';
import { useTheme } from './useTheme';

type Props = {
  accessibilityLabel: string;
  onPress?: () => void;
  /** Иконка или буква (кнопка профиля) */
  icon?: IconName;
  letter?: string;
  /** Заливка (цвет человека на кнопке профиля); по умолчанию panel */
  fill?: string;
  /** Цвет иконки/буквы; по умолчанию text */
  ink?: string;
  /** Красная точка «есть новое» */
  badge?: boolean;
  /** Сторона кнопки, по умолчанию 40 */
  side?: number;
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
};

export const IconButton = memo(function IconButton({
  accessibilityLabel,
  onPress,
  icon,
  letter,
  fill,
  ink,
  badge,
  side = S.iconButton,
  iconSize = S.icon,
  style,
}: Props) {
  const { c } = useTheme();
  const color = ink ?? c.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={[styles.button, { width: side, height: side, borderColor: c.border, backgroundColor: fill ?? c.panel }, style]}
    >
      {icon ? <Icon name={icon} size={iconSize} color={color} /> : null}
      {letter ? <Text style={[T.avatar, { color }]}>{letter}</Text> : null}
      {badge ? <View style={[styles.badge, { backgroundColor: c.red, boxShadow: `0 0 6px ${c.glow}` }]} /> : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  button: { borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: 4 },
});
