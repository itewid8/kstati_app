/**
 * Мелкие кнопки окон редактирования: кнопка-строка со стрелкой, счётчик «− 1 +», кнопка «БЕЗ ВРЕМЕНИ».
 */
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon, Marquee, size as S, useTheme } from '@/ui';
import { ET } from './text';

type LinkButtonProps = {
  label: string;
  /** value — значение 32px («31 ДЕК 2026»); action — действие 40px («ПЛАН СЕТКОЙ») */
  variant?: 'value' | 'action';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/** Кнопка во всю ширину: подпись слева, «›» справа */
export const LinkButton = memo(function LinkButton({ label, variant = 'value', onPress, style }: LinkButtonProps) {
  const { c } = useTheme();
  const action = variant === 'action';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.link, action ? styles.linkAction : styles.linkValue, { borderColor: c.border, backgroundColor: c.panel }, style]}
    >
      <Marquee style={[action ? ET.blockAction : ET.linkValue, { color: c.text }]}>
        {label}
      </Marquee>
      <Icon name="chevronRight" size={12} color={c.muted} />
    </Pressable>
  );
});

type StepperProps = {
  value: number;
  onDecrement?: () => void;
  onIncrement?: () => void;
};

/** «− 1 +»: кнопки 32×32 и число 34px между ними */
export const Stepper = memo(function Stepper({ value, onDecrement, onIncrement }: StepperProps) {
  const { c } = useTheme();
  const button = [styles.stepButton, { borderColor: c.border, backgroundColor: c.panel }];
  return (
    <View style={styles.stepper}>
      <Pressable accessibilityRole="button" accessibilityLabel="Меньше" onPress={onDecrement} style={button}>
        <Text style={[ET.stepperSign, { color: c.text }]}>−</Text>
      </Pressable>
      <View style={[styles.stepValue, { borderColor: c.border }]}>
        <Text style={[ET.stepperValue, { color: c.text }]}>{value}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Больше" onPress={onIncrement} style={button}>
        <Text style={[ET.stepperSign, { color: c.text }]}>+</Text>
      </Pressable>
    </View>
  );
});

type NoTimeProps = {
  active: boolean;
  onPress?: () => void;
};

/** «БЕЗ ВРЕМЕНИ» 104×40 рядом с колесом времени; включённая — инвертирована */
export const NoTimeButton = memo(function NoTimeButton({ active, onPress }: NoTimeProps) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel="Без времени"
      onPress={onPress}
      style={[styles.noTime, { borderColor: c.border, backgroundColor: active ? c.text : c.panel }]}
    >
      <Text style={[ET.noTime, { color: active ? c.bg : c.text }]}>БЕЗ ВРЕМЕНИ</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  link: {
    borderWidth: S.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  linkValue: { height: 32, paddingHorizontal: 8 },
  linkAction: { height: 40, paddingHorizontal: 12 },
  stepper: { flexDirection: 'row' },
  stepButton: { width: 32, height: 32, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
  stepValue: {
    width: 34,
    height: 32,
    borderTopWidth: S.border,
    borderBottomWidth: S.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noTime: { width: 104, height: 40, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
});
