import { forwardRef, useEffect } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { fonts, size as S, useTheme } from '@/ui';
import { gridColumn } from './accountTheme';

type Props = {
  /** Введённые цифры */
  value: string;
  onChange?: (digits: string) => void;
  length?: number;
  /** Код не подошёл: цифры краснеют, ряд вздрагивает */
  error?: boolean;
  editable?: boolean;
  autoFocus?: boolean;
  /** digits — код из письма (цифры, подсказка кода с клавиатуры); text — код группы (буквы и цифры, заглавные) */
  kind?: 'digits' | 'text';
  accessibilityLabel?: string;
};

/** Код группы: латиница, кириллица и цифры; регистр не трогаем (иначе поле пересоздаётся и клавиатура «прыгает») */
const NOT_CODE = /[^0-9A-Za-zА-Яа-яЁё]/g;

const SHAKE_STEP = 50;

/**
 * Код из письма: шесть ячеек 60px в общей рамке, пустые — «·», следующая — красная черта.
 * Ввод идёт в одно прозрачное поле поверх ячеек: так работают вставка целого кода,
 * подсказка кода с клавиатуры (one-time-code / sms-otp) и стирание.
 */
export const CodeCells = forwardRef<TextInput, Props>(function CodeCells(
  { value, onChange, length = 6, error = false, editable = true, autoFocus, kind = 'digits', accessibilityLabel },
  ref,
) {
  const { c } = useTheme();
  const shake = useSharedValue(0);

  useEffect(() => {
    if (!error) return;
    shake.value = withSequence(
      withTiming(-8, { duration: SHAKE_STEP }),
      withTiming(8, { duration: SHAKE_STEP }),
      withTiming(-5, { duration: SHAKE_STEP }),
      withTiming(5, { duration: SHAKE_STEP }),
      withTiming(0, { duration: SHAKE_STEP }),
    );
  }, [error, shake]);

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const width = gridColumn(length);
  const current = editable && value.length < length ? value.length : -1;
  const ink = error ? c.red : c.text;
  const text = kind === 'text';
  const clean = (t: string) => (text ? t.replace(NOT_CODE, '') : t.replace(/\D/g, '')).slice(0, length);

  return (
    <Animated.View style={[styles.row, { borderColor: c.border }, shakeStyle]}>
      {Array.from({ length }, (_, i) => {
        const digit = value[i];
        return (
          <View
            key={i}
            style={[styles.cell, { width, backgroundColor: c.panel }, i > 0 && { borderLeftWidth: S.border, borderLeftColor: c.border }]}
          >
            <Text style={[styles.digit, { color: digit ? ink : c.muted }]}>{digit ? digit.toLocaleUpperCase('ru-RU') : '·'}</Text>
            {i === current ? <View style={[styles.caret, { backgroundColor: c.red, boxShadow: `0 0 6px ${c.glow}` }]} /> : null}
          </View>
        );
      })}
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChange ? (t: string) => onChange(clean(t)) : undefined}
        keyboardType={text ? 'default' : 'number-pad'}
        autoComplete={text ? 'off' : Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        textContentType={text ? 'none' : 'oneTimeCode'}
        autoCapitalize={text ? 'characters' : 'none'}
        autoCorrect={false}
        maxLength={length}
        autoFocus={autoFocus}
        editable={editable}
        caretHidden
        contextMenuHidden={false}
        accessibilityLabel={accessibilityLabel ?? 'Код из письма'}
        style={styles.input}
      />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', borderWidth: S.border },
  cell: { height: 60, alignItems: 'center', justifyContent: 'center' },
  digit: { fontFamily: fonts.mono600, fontSize: 28 },
  caret: { position: 'absolute', left: 9, right: 9, bottom: 10, height: 3 },
  /** Невидимое поле на всю площадь ячеек: нажатие и долгое нажатие (вставка) попадают в него */
  input: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.011, color: 'transparent', fontSize: 1 },
});
