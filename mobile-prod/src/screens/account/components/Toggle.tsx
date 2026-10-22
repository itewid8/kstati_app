import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { size as S, useTheme } from '@/ui';

type Props = {
  value: boolean;
  onChange?: (value: boolean) => void;
  accessibilityLabel: string;
};

/** Переключатель 48×26: включён — квадрат справа и красная точка слева; выключен — квадрат слева */
export const Toggle = memo(function Toggle({ value, onChange, accessibilityLabel }: Props) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
      onPress={onChange ? () => onChange(!value) : undefined}
      style={[styles.track, { borderColor: c.border, backgroundColor: c.bg }, !value && styles.off]}
    >
      {value ? <View style={[styles.dot, { backgroundColor: c.red, boxShadow: `0 0 6px ${c.glow}` }]} /> : null}
      <View style={[styles.knob, { backgroundColor: value ? c.text : c.muted }]} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  track: {
    width: 48,
    height: 26,
    borderWidth: S.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  off: { justifyContent: 'flex-start' },
  dot: { marginLeft: 7, width: 7, height: 7, borderRadius: 4 },
  knob: { width: 22, height: 22 },
});
