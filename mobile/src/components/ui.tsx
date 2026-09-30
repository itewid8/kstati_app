import { Check } from '@/components/icons';
import React, { forwardRef, useEffect, useRef, useState } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { font, size, space, useColors } from '@/theme';

/* ---------- Текст ---------- */

type TProps = TextProps & {
  variant?: 'title' | 'body' | 'caption' | 'label';
  weight?: 'regular' | 'medium' | 'semibold';
  mono?: boolean;
  muted?: boolean;
  danger?: boolean;
  color?: string;
};

export function T({ variant = 'body', weight = 'regular', mono, muted, danger, color, style, ...rest }: TProps) {
  const c = useColors();
  const fs = size[variant];
  const s: TextStyle = {
    fontFamily: mono ? font.mono : font[weight],
    fontSize: fs,
    lineHeight: Math.round(fs * 1.4),
    color: color ?? (danger ? c.danger : muted ? c.textMuted : c.text),
  };
  if (variant === 'title') s.fontFamily = font.semibold;
  return <Text {...rest} style={[s, style]} />;
}

/* ---------- Кнопки ---------- */

type BtnProps = Omit<PressableProps, 'style'> & {
  title: string;
  kind?: 'primary' | 'outline' | 'text';
  danger?: boolean;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, kind = 'primary', danger, color, style, disabled, ...rest }: BtnProps) {
  const c = useColors();
  if (kind === 'text') {
    return (
      <Pressable
        hitSlop={8}
        disabled={disabled}
        style={({ pressed }) => [styles.textBtn, { opacity: disabled ? 0.4 : pressed ? 0.6 : 1 }, style]}
        {...rest}
      >
        <T weight="medium" color={color ?? (danger ? c.danger : c.text)}>
          {title}
        </T>
      </Pressable>
    );
  }
  const outline = kind === 'outline';
  return (
    <Pressable
      disabled={disabled}
      style={({ pressed }) => [
        styles.primaryBtn,
        outline
          ? { borderWidth: 1, borderColor: c.border, backgroundColor: pressed ? c.surface : 'transparent', opacity: disabled ? 0.4 : 1 }
          : { backgroundColor: c.primary, opacity: disabled ? 0.4 : pressed ? 0.85 : 1 },
        style,
      ]}
      {...rest}
    >
      <T weight="medium" color={color ?? (outline ? c.text : c.onPrimary)}>
        {title}
      </T>
    </Pressable>
  );
}

/* ---------- Чип ---------- */

export function Chip({
  label,
  selected,
  onPress,
  style,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          borderColor: selected ? c.primary : c.border,
          backgroundColor: selected ? c.primary : 'transparent',
          opacity: pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      <T variant="caption" weight="medium" color={selected ? c.onPrimary : c.text}>
        {label}
      </T>
    </Pressable>
  );
}

/* ---------- Кружок «выполнено» ---------- */

export function Checkbox({ checked, onPress }: { checked: boolean; onPress: () => void }) {
  const c = useColors();
  const scale = useSharedValue(1);
  const first = useRef(true);

  // Короткий «щелчок» при отметке: 0.7 → 1.15 → 1, без пружин
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (checked) scale.value = withSequence(withTiming(0.7, { duration: 80 }), withTiming(1.15, { duration: 120 }), withTiming(1, { duration: 100 }));
  }, [checked, scale]);

  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable onPress={onPress} hitSlop={12} style={styles.checkWrap}>
      <Animated.View
        style={[
          styles.check,
          { borderColor: checked ? c.primary : c.textMuted, backgroundColor: checked ? c.primary : 'transparent' },
          anim,
        ]}
      >
        {checked && <Check size={13} strokeWidth={2.5} color={c.onPrimary} />}
      </Animated.View>
    </Pressable>
  );
}

/* ---------- Поле ввода ---------- */

/** Цвет выделения текста: полупрозрачный, чтобы выделенные буквы оставались видны */
export const selectionTint = (text: string) => `${text}40`;

/**
 * Поле ввода. Текст живёт в самом поле (полуконтролируемо): при каждом нажатии мы не переписываем
 * его обратно из состояния. Иначе на Android после выделения и удаления курсор прыгал в начало
 * и буквы шли задом наперёд. Если значение поменяли снаружи (или обработчик поправил ввод) —
 * поле пересоздаётся с новым текстом и, если было в фокусе, остаётся в фокусе.
 */
export const Field = forwardRef<TextInput, TextInputProps & { label?: string; code?: boolean }>(function Field(
  { label, code, style, value, defaultValue, onChangeText, onFocus, onBlur, autoFocus, ...rest },
  ref,
) {
  const c = useColors();
  const last = useRef(value ?? defaultValue ?? '');
  const focused = useRef(false);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    if (value !== undefined && value !== last.current) {
      last.current = value;
      setRev((r) => r + 1);
    }
  }, [value]);

  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <T variant="label" muted>
          {label}
        </T>
      ) : null}
      <TextInput
        key={rev}
        ref={ref}
        defaultValue={value ?? defaultValue}
        autoFocus={rev > 0 ? focused.current : autoFocus}
        onChangeText={(t) => {
          last.current = t;
          onChangeText?.(t);
        }}
        onFocus={(e) => {
          focused.current = true;
          onFocus?.(e);
        }}
        onBlur={(e) => {
          focused.current = false;
          onBlur?.(e);
        }}
        // Пароли и почта: на iPhone по умолчанию первая буква заглавная и включена автозамена —
        // поле отправляло «Parol» вместо «parol». Для паролей выключаем всё это всегда.
        {...(rest.secureTextEntry || rest.keyboardType === 'email-address'
          ? { autoCapitalize: 'none' as const, autoCorrect: false, spellCheck: false, smartInsertDelete: false }
          : null)}
        placeholderTextColor={c.textMuted}
        selectionColor={selectionTint(c.text)}
        selectionHandleColor={c.text}
        cursorColor={c.text}
        style={[
          styles.field,
          { backgroundColor: c.background, borderColor: c.border, color: c.text, fontFamily: font.regular },
          // Коды (из письма, приглашения) — как код группы на экране группы: моноширинный, мелкий, приглушённый
          code && { fontFamily: font.mono, fontSize: size.caption, color: c.textMuted },
          style,
        ]}
        {...rest}
      />
    </View>
  );
});

/* ---------- Разделитель и строка ---------- */

export function Divider({ inset = 0 }: { inset?: number }) {
  const c = useColors();
  return <View style={{ height: 1,backgroundColor: c.border, marginLeft: inset }} />;
}

/** Строка настроек / выбора: подпись слева, значение справа */
export function ListRow({
  label,
  value,
  onPress,
  danger,
  right,
  mono,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  right?: React.ReactNode;
  mono?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.listRow, { backgroundColor: pressed ? c.surface : 'transparent' }]}
    >
      <T danger={danger} numberOfLines={1} style={{ flexShrink: 0, flexGrow: value ? 0 : 1 }}>
        {label}
      </T>
      {value ? (
        <T muted mono={mono} variant={mono ? 'caption' : 'body'} numberOfLines={1} style={{ flex: 1, textAlign: 'right' }}>
          {value}
        </T>
      ) : null}
      {right}
    </Pressable>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <T variant="caption" muted style={{ paddingHorizontal: space.side, paddingTop: 20, paddingBottom: 6 }}>
      {children}
    </T>
  );
}

const styles = StyleSheet.create({
  primaryBtn: {
    height: 48,
    borderRadius: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBtn: {
    height: 48,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkWrap: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  check: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: size.body,
  },
  listRow: {
    minHeight: space.rowMin,
    paddingHorizontal: space.side,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
