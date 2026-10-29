import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import { login, loginWithVk, register, resetPassword, sendCode, verifyCode } from '@/lib/auth';
import { passwordStrength } from '@/lib/password';
import { DEMO, useStore } from '@/lib/store';
import { syncNow } from '@/lib/sync';
import { AuthScreen, type AuthMode } from '@/screens/account/AuthScreen';
import { CodeScreen } from '@/screens/account/CodeScreen';
import { fonts, useTheme } from '@/ui';
import { resetTo, useInsets } from '../common';

/** Регистрация и сброс идут по шагам: почта → код из письма → пароль */
type Step = 'email' | 'code' | 'password';

/**
 * Вход через VK ID в «Кстати» скрыт: у сервера одна схема APP_SCHEME=kstati, и /auth/vk/start ответит bad_redirect
 * на kstatiapp://auth (docs/redesign/INTEGRATION.md, риск 6.2). Включать — только после серверной правки со списком схем
 */
const VK_LOGIN = false;
const CODE_LEN = 6;
/** Сервер отправляет код не чаще раза в минуту */
const RESEND_SEC = 60;

/** С чистого стека: под вкладками не остаётся ничего от прошлого входа */
const after = () => resetTo(useStore.getState().groups.length ? '/tasks' : '/onboarding');

/**
 * Вход и регистрация.
 *   Вход: почта + пароль (VK ID — за флагом VK_LOGIN).
 *   Регистрация: почта → код (C-Code, проверяется сразу после 6-й цифры) → имя, пароль и повтор.
 *   Забыли пароль: почта → код → новый пароль и повтор.
 * Пароль принимается от «среднего» по шкале надёжности и только если повтор совпадает.
 * Без сервера (демо) — любые данные подходят.
 */
export function AuthContainer() {
  const { c } = useTheme();
  const insets = useInsets();
  const [mode, setMode] = useState<AuthMode>('login');
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

  const purpose = mode === 'reset' ? 'reset' : 'register';
  const mail = email.trim();
  const emailOk = /^\S+@\S+\.\S+$/.test(mail);
  const strength = useMemo(() => passwordStrength(password, [name.trim(), mail.split('@')[0] ?? '']), [password, name, mail]);
  const matches = repeat.length > 0 && repeat === password;

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

  const switchTo = (m: AuthMode) => {
    setMode(m);
    setStep('email');
    setCode('');
    setCodeError(false);
    setPassword('');
    setRepeat('');
    setError('');
  };

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

  // С шага пароля — снова к коду: у экрана кода нет кнопки «Далее», код проверится заново на шестой цифре (он ещё действует)
  const backToCode = () => {
    setCode('');
    setCodeError(false);
    go('code');
  };

  // «Назад» (и Android «назад») на шагах регистрации и сброса — на шаг раньше (код → почта, почта → вход), а не выход
  const stepBack = mode === 'login' ? null : step === 'password' ? backToCode : step === 'code' ? () => go('email') : () => switchTo('login');
  const stepBackRef = useRef(stepBack);
  stepBackRef.current = stepBack;
  const hasStepBack = stepBack !== null;
  useEffect(() => {
    if (!hasStepBack) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      stepBackRef.current?.();
      return true;
    });
    return () => sub.remove();
  }, [hasStepBack]);
  const onBack = useCallback(() => stepBackRef.current?.(), []);

  const edit = (set: (t: string) => void) => (t: string) => {
    set(t);
    if (error) setError('');
  };

  if (mode !== 'login' && step === 'code') {
    return (
      <View style={styles.screen}>
        <CodeScreen
          email={mail}
          code={code}
          length={CODE_LEN}
          error={codeError}
          errorText={error || null}
          resendIn={left}
          busy={busy}
          insets={insets}
          onBack={() => go('email')}
          onChangeCode={onCode}
          onResend={askCode}
          onLogin={() => switchTo('login')}
        />
        {/* Код с сервера без почты (разработка на Mac) */}
        {devCode ? <Text style={[styles.devCode, { bottom: insets.bottom + 64, color: c.muted }]}>{devCode}</Text> : null}
      </View>
    );
  }

  const authStep = step === 'password' ? 'password' : 'email';
  const canSubmit =
    DEMO ||
    (mode === 'login'
      ? emailOk && password.length > 0
      : authStep === 'email'
        ? emailOk
        : strength >= 1 && matches && (mode === 'reset' || name.trim().length > 0));
  const onSubmit = mode === 'login' ? signIn : authStep === 'email' ? askCode : finish;

  return (
    <AuthScreen
      mode={mode}
      step={authStep}
      email={email}
      password={password}
      repeat={repeat}
      name={name}
      strength={strength}
      canSubmit={canSubmit}
      busy={busy}
      error={error || null}
      canReset={!DEMO}
      vk={VK_LOGIN && !DEMO}
      insets={insets}
      onBack={onBack}
      onChangeEmail={edit(setEmail)}
      onChangePassword={edit(setPassword)}
      onChangeRepeat={edit(setRepeat)}
      onChangeName={edit(setName)}
      onSubmit={() => void onSubmit()}
      onForgot={() => switchTo('reset')}
      onVk={() => void run(loginWithVk)}
      onSwitch={() => switchTo(mode === 'login' ? 'register' : 'login')}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  devCode: { position: 'absolute', alignSelf: 'center', fontFamily: fonts.mono400, fontSize: 10.5, letterSpacing: 0.84 },
});
