import { router } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Logo } from '@/components/Logo';
import { Button, Field, T } from '@/components/ui';
import { login, loginWithVk, register, resetPassword, sendCode } from '@/lib/auth';
import { syncNow } from '@/lib/sync';
import { DEMO, useStore } from '@/lib/store';
import { space, useColors } from '@/theme';

type Mode = 'login' | 'register' | 'reset';

/**
 * Вход и регистрация.
 *   Вход: почта + пароль, или VK ID одной кнопкой.
 *   Регистрация: почта → код из письма + имя + пароль.
 *   Забыли пароль: почта → код из письма + новый пароль.
 * Без сервера (демо) — любые данные подходят.
 */
export default function Login() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('login');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');

  const switchTo = (m: Mode) => {
    setMode(m);
    setStep('email');
    setCode('');
    setPassword('');
    setError('');
    setHint('');
  };

  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());
  const passOk = password.length >= 8;
  const after = () => router.replace(useStore.getState().groups.length ? '/tasks' : '/onboarding');

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(true);
    setError('');
    const r = await fn();
    // Сначала забираем свои группы с сервера — чтобы не показать «создайте группу» тому, у кого они есть
    if (r.ok) await syncNow();
    setBusy(false);
    if (r.ok) after();
    else if (r.error) setError(r.error);
  };

  const askCode = async () => {
    setBusy(true);
    setError('');
    const r = await sendCode(email.trim(), mode === 'register' ? 'register' : 'reset');
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setStep('code');
    setHint(r.devCode ? `Код (без почты, для проверки): ${r.devCode}` : `Код отправлен на ${email.trim()}. Проверьте «Спам», если письма нет.`);
  };

  const submit = () => {
    if (busy) return;
    if (DEMO) {
      if (mode === 'register') useStore.getState().demoRegister(name);
      else useStore.getState().demoLogin();
      return after();
    }
    if (mode === 'login') return run(() => login(email.trim(), password));
    if (step === 'email') return askCode();
    if (mode === 'register') return run(() => register({ email: email.trim(), code: code.trim(), name: name.trim(), password }));
    return run(() => resetPassword({ email: email.trim(), code: code.trim(), password }));
  };

  const valid =
    DEMO ||
    (mode === 'login'
      ? emailOk && password.length > 0
      : step === 'email'
        ? emailOk
        : code.trim().length === 6 && passOk && (mode === 'reset' || name.trim().length > 0));

  const title = mode === 'login' ? 'Вход' : mode === 'register' ? 'Регистрация' : 'Новый пароль';
  const button =
    mode === 'login' ? 'Войти' : step === 'email' ? 'Получить код' : mode === 'register' ? 'Зарегистрироваться' : 'Сохранить и войти';

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 16 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Logo />
        <T variant="title" muted style={{ marginTop: 40 }}>
          {title}
        </T>

        <View style={{ gap: 12, marginTop: 24 }}>
          <Field
            placeholder="Почта"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              if (step === 'code') setStep('email');
            }}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            autoCorrect={false}
            editable={!busy}
          />

          {mode === 'login' && (
            <Field
              placeholder="Пароль"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              onSubmitEditing={() => valid && submit()}
            />
          )}

          {mode !== 'login' && step === 'code' && (
            <>
              <Field
                placeholder="Код из письма"
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                code
              />
              {mode === 'register' && (
                <Field placeholder="Имя" value={name} onChangeText={setName} autoComplete="name" textContentType="givenName" maxLength={40} />
              )}
              <Field
                placeholder={mode === 'register' ? 'Пароль, от 8 символов' : 'Новый пароль, от 8 символов'}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="new-password"
                onSubmitEditing={() => valid && submit()}
              />
            </>
          )}

          {hint && !error ? (
            <T variant="caption" muted>
              {hint}
            </T>
          ) : null}
          {error ? (
            <T variant="caption" danger>
              {error}
            </T>
          ) : null}

          <Button title={busy ? '…' : button} onPress={submit} disabled={!valid || busy} style={{ marginTop: 4 }} />

          {mode === 'login' && !DEMO && (
            <Button kind="text" title="Забыли пароль?" color={c.textMuted} onPress={() => switchTo('reset')} style={{ alignSelf: 'flex-start', height: 36 }} />
          )}
          {mode !== 'login' && step === 'code' && (
            <Button kind="text" title="Отправить код ещё раз" color={c.textMuted} onPress={askCode} disabled={busy} style={{ alignSelf: 'flex-start', height: 36 }} />
          )}
        </View>

        {!DEMO && mode === 'login' && (
          <View style={{ marginTop: 24, gap: 12 }}>
            <View style={styles.or}>
              <View style={[styles.line, { backgroundColor: c.border }]} />
              <T variant="caption" muted>
                или
              </T>
              <View style={[styles.line, { backgroundColor: c.border }]} />
            </View>
            <Button kind="outline" title="Войти через VK ID" onPress={() => run(loginWithVk)} disabled={busy} />
          </View>
        )}

        <View style={{ flex: 1, minHeight: 32 }} />
        <Button
          kind="text"
          title={mode === 'login' ? 'Создать аккаунт' : 'Уже есть аккаунт — войти'}
          color={c.textMuted}
          onPress={() => switchTo(mode === 'login' ? 'register' : 'login')}
          style={{ alignSelf: 'center' }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, paddingHorizontal: space.side * 1.5 },
  or: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  line: { flex: 1, height: 1 },
});
