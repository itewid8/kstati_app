import React, { forwardRef, useEffect, useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { font, useColors } from '@/theme';
import { T } from './ui';

type Props = {
  value: string;
  onChange: (digits: string) => void;
  length?: number;
  /** Код не подошёл: ячейки краснеют и вздрагивают */
  error?: boolean;
  editable?: boolean;
  autoFocus?: boolean;
};

/**
 * Код из письма: по цифре в ячейке. Ввод идёт в одно прозрачное поле поверх ячеек —
 * так работают вставка целого кода, подсказка кода с клавиатуры и стирание.
 */
export const CodeInput = forwardRef<TextInput, Props>(function CodeInput({ value, onChange, length = 6, error, editable = true, autoFocus }, ref) {
  const c = useColors();
  const [focused, setFocused] = useState(false);
  const shake = useSharedValue(0);

  useEffect(() => {
    if (!error) return;
    shake.value = withSequence(
      withTiming(-8, { duration: 50 }),
      withTiming(8, { duration: 50 }),
      withTiming(-5, { duration: 50 }),
      withTiming(5, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
  }, [error, shake]);

  const anim = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const current = Math.min(value.length, length - 1);

  return (
    <Animated.View style={anim}>
      <View style={styles.row}>
        {Array.from({ length }, (_, i) => {
          const active = focused && editable && i === current;
          return (
            <View
              key={i}
              style={[styles.cell, { borderColor: error ? c.danger : active ? c.text : c.border, borderWidth: active ? 1.5 : 1 }]}
            >
              <T style={[styles.digit, { color: error ? c.danger : c.text }]}>{value[i] ?? ''}</T>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, length))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        textContentType="oneTimeCode"
        autoFocus={autoFocus}
        editable={editable}
        caretHidden
        contextMenuHidden={false}
        accessibilityLabel="Код из письма"
        style={styles.input}
      />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  cell: { flex: 1, height: 56, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  digit: { fontFamily: font.mono, fontSize: 24, lineHeight: 30 },
  // Невидимое поле на всю площадь ячеек: нажатие и долгое нажатие (вставка) попадают в него
  input: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.011, color: 'transparent', fontSize: 1 },
});
