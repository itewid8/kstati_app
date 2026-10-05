import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CodeInput } from '@/components/CodeInput';
import { ChevronLeft } from '@/components/icons';
import { Logo } from '@/components/Logo';
import { PasswordMeter } from '@/components/PasswordMeter';
import { Button, Field, T } from '@/components/ui';
import { login, loginWithVk, register, resetPassword, sendCode, verifyCode } from '@/lib/auth';
import { passwordStrength } from '@/lib/password';
import { syncNow } from '@/lib/sync';
import { DEMO, useStore } from '@/lib/store';
import { ICON, space, useColors } from '@/theme';

type Mode = 'login' | 'register' | 'reset';
/** Регистрация и сброс идут по шагам: почта → код из письма → пароль */
type Step = 'email' | 'code' | 'password';

/** Вход через VK ID отложен: кнопка вернётся, когда настроим приложение в VK */
const VK_LOGIN = false;
const CODE_LEN = 6;
/** Сервер отправляет код не чаще раза в минуту */
const RESEND_SEC = 60;

/**
 * Вход и регистрация.
 *   Вход: почта + пароль (VK ID — за флагом VK_LOGIN).
 *   Регистрация: почта → код (проверяется сразу после 6-й цифры) → имя, пароль и повтор.
 *   Забыли пароль: почта → код → новый пароль и повтор.
 * Пароль принимается от «среднего» по шкале надёжности и только если повтор совпадает.
 * Без сервера (демо) — любые данные подходят.
 */
export default function Login() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('login');
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState(false);
  const [devCode, setDevCode] = useState('');
  const [sentAt, setSentAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const repeatRef = useRef<TextInput>(null);

  const purpose = mode === 'reset' ? 'reset' : 'register';
  const mail = email.trim();
  const emailOk = /^\S+@\S+\.\S+$/.test(mail);
  const strength = useMemo(() => passwordStrength(password, [name.trim(), mail.split('@')[0] ?? '']), [password, name, mail]);
  const matches = repeat.length > 0 && repeat === password;
  const mismatch = repeat.length > 0 && !password.startsWith(repeat);

  // Обратный отсчёт до повторной отправки кода
  const left = Math.max(0, RESEND_SEC - Math.floor((now - sentAt) / 1000));
  useEffect(() => {
    if (step !== 'code' || left === 0) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [step, left]);

  const go = (s: Step) => {
    setStep(s);
    setError('');
  };

  const switchTo = (m: Mode) => {
    setMode(m);
    setStep('email');
    setCode('');
    setCodeError(false);
    setPassword('');
    setRepeat('');
    setError('');
  };

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
    if (DEMO) return go('code');
    setBusy(true);
    setError('');
    const r = await sendCode(mail, purpose);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setDevCode(r.devCode ?? '');
    setSentAt(Date.now());
    setNow(Date.now());
    setCode('');
    setCodeError(false);
    go('code');
  };

  const onCode = async (digits: string) => {
    setCode(digits);
    setCodeError(false);
    setError('');
    if (digits.length < CODE_LEN) return;
    if (DEMO) return go('password');
    setBusy(true);
    const r = await verifyCode(mail, purpose, digits);
    setBusy(false);
    if (r.ok) return go('password');
    setCodeError(true);
    setCode('');
    setError(r.error);
  };

  const finish = () => {
    if (busy) return;
    if (DEMO) {
      if (mode === 'register') useStore.getState().demoRegister(name);
      else useStore.getState().demoLogin();
      return after();
    }
    const done = async () => {
      const r = mode === 'register' ? await register({ email: mail, code, name: name.trim(), password }) : await resetPassword({ email: mail, code, password });
      // Код успел устареть, пока придумывали пароль — назад к коду
      if (!r.ok && /код/i.test(r.error)) {
        setCode('');
        setCodeError(true);
        go('code');
      }
      return r;
    };
    return run(done);
  };

  const signIn = () => {
    if (busy) return;
    if (DEMO) {
      useStore.getState().demoLogin();
      return after();
    }
    return run(() => login(mail, password));
  };

  const passwordReady = strength >= 1 && matches && (mode === 'reset' || name.trim().length > 0);
  const title = mode === 'login' ? 'Вход' : step === 'code' ? 'Код из письма' : mode === 'register' ? 'Регистрация' : 'Новый пароль';
  const back = mode !== 'login' && step !== 'email' ? () => go(step === 'password' ? 'code' : 'email') : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 16 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Logo />
        <View style={styles.titleRow}>
          {back && (
            <Pressable onPress={back} hitSlop={12} accessibilityRole="button" accessibilityLabel="Назад" style={({ pressed }) => [styles.back, { opacity: pressed ? 0.6 : 1 }]}>
              <ChevronLeft size={22} strokeWidth={ICON.stroke} color={c.textMuted} />
            </Pressable>
          )}
          <T variant="title" muted>
            {title}
          </T>
        </View>

        <View style={{ gap: 12, marginTop: 24 }}>
          {/* ---------- вход ---------- */}
          {mode === 'login' && (
            <>
              <Field
                placeholder="Почта"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                autoCorrect={false}
                editable={!busy}
              />
              <Field
                placeholder="Пароль"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="current-password"
                onSubmitEditing={() => (DEMO || (emailOk && password)) && signIn()}
              />
            </>
          )}

          {/* ---------- шаг 1: почта ---------- */}
          {mode !== 'login' && step === 'email' && (
            <Field
              placeholder="Почта"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              autoCorrect={false}
              autoFocus
              editable={!busy}
              onSubmitEditing={() => (DEMO || emailOk) && askCode()}
            />
          )}

          {/* ---------- шаг 2: код ---------- */}
          {mode !== 'login' && step === 'code' && (
            <>
              {!DEMO && (
                <T variant="caption" muted numberOfLines={1}>
                  {mail}
                </T>
              )}
              <CodeInput value={code} onChange={onCode} length={CODE_LEN} error={codeError} editable={!busy} autoFocus />
              {devCode ? (
                <T variant="caption" muted mono>
                  {devCode}
                </T>
              ) : null}
            </>
          )}

          {/* ---------- шаг 3: пароль ---------- */}
          {mode !== 'login' && step === 'password' && (
            <>
              {mode === 'register' && (
                <Field placeholder="Имя" value={name} onChangeText={setName} autoComplete="name" textContentType="givenName" maxLength={40} autoFocus />
              )}
              <Field
                placeholder={mode === 'register' ? 'Пароль' : 'Новый пароль'}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                autoFocus={mode === 'reset'}
                returnKeyType="next"
                onSubmitEditing={() => repeatRef.current?.focus()}
              />
              {password.length > 0 && <PasswordMeter strength={strength} />}
              <Field
                ref={repeatRef}
                placeholder="Повторите пароль"
                value={repeat}
                onChangeText={setRepeat}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                style={mismatch ? { borderColor: c.danger } : matches ? { borderColor: c.success } : null}
                onSubmitEditing={() => passwordReady && finish()}
              />
              {repeat.length > 0 && (mismatch || matches) ? (
                <T variant="label" color={mismatch ? c.danger : c.success}>
                  {mismatch ? 'Пароли не совпадают' : 'Пароли совпадают'}
                </T>
              ) : null}
            </>
          )}

          {error ? (
            <T variant="caption" danger>
              {error}
            </T>
          ) : null}

          {/* ---------- кнопки ---------- */}
          {mode === 'login' && (
            <>
              <Button title={busy ? '…' : 'Войти'} onPress={signIn} disabled={busy || !(DEMO || (emailOk && password.length > 0))} style={{ marginTop: 4 }} />
              {!DEMO && (
                <Button kind="text" title="Забыли пароль?" color={c.textMuted} onPress={() => switchTo('reset')} style={styles.small} />
              )}
            </>
          )}
          {mode !== 'login' && step === 'email' && (
            <Button title={busy ? '…' : 'Получить код'} onPress={askCode} disabled={busy || !(DEMO || emailOk)} style={{ marginTop: 4 }} />
          )}
          {/* Вернулись с шага пароля: код уже проверен */}
          {mode !== 'login' && step === 'code' && code.length === CODE_LEN && !codeError && !busy && (
            <Button title="Далее" onPress={() => go('password')} style={{ marginTop: 4 }} />
          )}
          {mode !== 'login' && step === 'code' && !DEMO && (
            <Button
              kind="text"
              title={left > 0 ? `Отправить ещё раз · 0:${String(left).padStart(2, '0')}` : 'Отправить код ещё раз'}
              color={c.textMuted}
              onPress={askCode}
              disabled={busy || left > 0}
              style={styles.small}
            />
          )}
          {mode !== 'login' && step === 'password' && (
            <Button
              title={busy ? '…' : mode === 'register' ? 'Зарегистрироваться' : 'Сохранить и войти'}
              onPress={finish}
              disabled={busy || !(DEMO || passwordReady)}
              style={{ marginTop: 4 }}
            />
          )}
        </View>

        {VK_LOGIN && !DEMO && mode === 'login' && (
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 40 },
  back: { marginLeft: -6 },
  small: { alignSelf: 'flex-start', height: 36 },
  or: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  line: { flex: 1, height: 1 },
});
