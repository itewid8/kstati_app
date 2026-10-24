import { memo } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { size as S, type as T, useTheme } from '@/ui';

type Props = {
  label: string;
  /** primary — залита цветом текста; outline — рамка на панели */
  variant?: 'primary' | 'outline';
  disabled?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/** Кнопка во всю ширину 44px: «ВОЙТИ», «ПОЛУЧИТЬ КОД» */
export const WideButton = memo(function WideButton({ label, variant = 'primary', disabled = false, onPress, style }: Props) {
  const { c } = useTheme();
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        { borderColor: c.border, backgroundColor: primary ? c.text : c.panel, opacity: disabled ? 0.4 : 1 },
        style,
      ]}
    >
      <Text style={[T.action, { color: primary ? c.bg : c.text }]}>{label}</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  button: { height: S.row, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
});
