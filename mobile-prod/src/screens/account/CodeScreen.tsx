/**
 * Код из письма (C-Code): шаг регистрации и сброса пароля после ввода почты.
 * Шесть ячеек кода, повторная отправка с обратным отсчётом, переход ко входу.
 * Презентационный экран: код, отсчёт и ошибка — пропсами, проверка и отправка — у вызывающего.
 */
import { memo } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Marquee, fonts, size as S, space, useTheme } from '@/ui';
import { AccountHeader } from './components/AccountHeader';
import { BrandTile } from './components/AccountIcons';
import { CodeCells } from './components/CodeCells';
import { accountText, useAccountPalette } from './components/accountTheme';

export type CodeScreenProps = {
  /** Куда ушло письмо */
  email: string;
  /** Введённые цифры (0…length) */
  code: string;
  length?: number;
  /** Код не подошёл: цифры красные, ряд вздрагивает */
  error?: boolean;
  /** Текст ошибки сервера под кодом */
  errorText?: string | null;
  /** Секунд до повторной отправки; 0 — можно отправить */
  resendIn: number;
  /** Идёт проверка или отправка: ввод и кнопки неактивны */
  busy?: boolean;
  autoFocus?: boolean;
  insets?: { top: number; bottom: number };

  onBack?: () => void;
  /** Цифры без лишних символов, не длиннее length. Полный код вызывающий проверяет сам */
  onChangeCode?: (digits: string) => void;
  onResend?: () => void;
  /** «УЖЕ ЕСТЬ АККАУНТ → ВОЙТИ» */
  onLogin?: () => void;
};

const NO_INSETS = { top: 0, bottom: 0 };

/** 42 → «0:42» */
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

export const CodeScreen = memo(function CodeScreen(props: CodeScreenProps) {
  const {
    email,
    code,
    length = 6,
    error = false,
    errorText,
    resendIn,
    busy = false,
    autoFocus = true,
    insets = NO_INSETS,
    onBack,
    onChangeCode,
    onResend,
    onLogin,
  } = props;
  const { c } = useTheme();
  const pal = useAccountPalette();
  const waiting = resendIn > 0;
  const canResend = !waiting && !busy && !!onResend;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { backgroundColor: c.bg, paddingTop: insets.top + S.topBarTop, paddingBottom: insets.bottom + 18 }]}
    >
      <AccountHeader title="Код" onBack={onBack} right={<BrandTile />} />
      <View style={styles.sentTo}>
        <Text style={[styles.sentText, { color: c.muted }]}>ИЗ ПИСЬМА →</Text>
        <Marquee style={[styles.sentText, styles.email, { color: c.text }]}>
          {email.toLocaleUpperCase('ru-RU')}
        </Marquee>
      </View>

      <View style={styles.code}>
        <CodeCells value={code} onChange={onChangeCode} length={length} error={error} editable={!busy} autoFocus={autoFocus} />
      </View>

      {errorText ? (
        <Text accessibilityLiveRegion="polite" style={[styles.error, { color: c.red }]}>
          {errorText}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={waiting ? `Отправить ещё раз через ${resendIn} с` : 'Отправить ещё раз'}
        accessibilityState={{ disabled: !canResend }}
        disabled={!canResend}
        onPress={onResend}
        style={[styles.resend, { borderColor: canResend ? c.border : pal.fieldHair }]}
      >
        <Text style={[accountText.wideAction, { color: canResend ? c.text : c.muted }]}>
          {waiting ? `ОТПРАВИТЬ ЕЩЁ РАЗ · ${clock(resendIn)}` : 'ОТПРАВИТЬ ЕЩЁ РАЗ'}
        </Text>
      </Pressable>

      <Pressable accessibilityRole="button" onPress={onLogin} disabled={busy} style={styles.login}>
        <Text style={[styles.loginText, { color: c.muted }]}>УЖЕ ЕСТЬ АККАУНТ → ВОЙТИ</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space.side },
  sentTo: { marginTop: 14, flexDirection: 'row', gap: 8 },
  sentText: { fontFamily: fonts.mono400, fontSize: 9.5, letterSpacing: 0.57 },
  email: { flexShrink: 1 },
  code: { marginTop: 22 },
  error: { marginTop: 8, fontFamily: fonts.mono400, fontSize: 9.5, letterSpacing: 0.57 },
  resend: { marginTop: 8, height: 40, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
  login: { marginTop: 'auto', height: 40, alignItems: 'center', justifyContent: 'center' },
  loginText: { fontFamily: fonts.mono400, fontSize: 10.5, letterSpacing: 0.84 },
});
