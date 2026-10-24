/**
 * Вход и регистрация (кроме кода из письма — это CodeScreen):
 *   login — почта и пароль; register / reset, шаг email — почта; шаг password — имя (регистрация), пароль и повтор.
 * Презентационный экран: поля, оценка пароля и ошибка — пропсами, отправка — у вызывающего.
 */
import { memo, useCallback, useRef } from 'react';
import type { TextInput } from 'react-native';
import { SectionBox } from '@/ui';
import { AccountPage, type PageInsets } from './components/AccountPage';
import { BrandTile } from './components/AccountIcons';
import { ErrorLine } from './components/ErrorLine';
import { Field } from './components/Field';
import { STRENGTH_LABEL, StrengthMeter, type Strength } from './components/StrengthMeter';
import { TextLink } from './components/TextLink';
import { WideButton } from './components/WideButton';

export type AuthMode = 'login' | 'register' | 'reset';
/** Шаги регистрации и сброса без кода */
export type AuthStep = 'email' | 'password';

export type AuthScreenProps = {
  mode: AuthMode;
  step: AuthStep;
  email: string;
  password: string;
  repeat: string;
  name: string;
  strength: Strength;
  /** Можно нажать главную кнопку */
  canSubmit: boolean;
  busy?: boolean;
  error?: string | null;
  /** «Забыли пароль» (без сервера — нет) */
  canReset?: boolean;
  /** Вход через VK ID */
  vk?: boolean;
  insets?: PageInsets;

  onBack?: () => void;
  onChangeEmail?: (text: string) => void;
  onChangePassword?: (text: string) => void;
  onChangeRepeat?: (text: string) => void;
  onChangeName?: (text: string) => void;
  onSubmit?: () => void;
  onForgot?: () => void;
  onVk?: () => void;
  /** Вход ↔ регистрация */
  onSwitch?: () => void;
};

const NO_INSETS: PageInsets = { top: 0, bottom: 0 };

const TITLE: Record<AuthMode, string> = { login: 'Вход', register: 'Регистрация', reset: 'Новый пароль' };

function submitLabel(mode: AuthMode, step: AuthStep): string {
  if (mode === 'login') return 'ВОЙТИ';
  if (step === 'email') return 'ПОЛУЧИТЬ КОД';
  return mode === 'register' ? 'ЗАРЕГИСТРИРОВАТЬСЯ' : 'СОХРАНИТЬ И ВОЙТИ';
}

export const AuthScreen = memo(function AuthScreen(props: AuthScreenProps) {
  const {
    mode,
    step,
    email,
    password,
    repeat,
    name,
    strength,
    canSubmit,
    busy = false,
    error,
    canReset = true,
    vk = false,
    insets = NO_INSETS,
    onBack,
    onChangeEmail,
    onChangePassword,
    onChangeRepeat,
    onChangeName,
    onSubmit,
    onForgot,
    onVk,
    onSwitch,
  } = props;
  const passwordRef = useRef<TextInput>(null);
  const repeatRef = useRef<TextInput>(null);
  const toPassword = useCallback(() => passwordRef.current?.focus(), []);
  const toRepeat = useCallback(() => repeatRef.current?.focus(), []);
  const submit = canSubmit && !busy ? onSubmit : undefined;
  const login = mode === 'login';
  const mismatch = repeat.length > 0 && !password.startsWith(repeat);

  return (
    <AccountPage
      title={TITLE[mode]}
      insets={insets}
      back={!login}
      onBack={onBack}
      headerRight={<BrandTile />}
      footer={
        <TextLink label={login ? 'НЕТ АККАУНТА → СОЗДАТЬ' : 'УЖЕ ЕСТЬ АККАУНТ → ВОЙТИ'} disabled={busy} onPress={onSwitch} />
      }
    >
      {login ? (
        <SectionBox title="АККАУНТ">
          <Field
            framed={false}
            value={email}
            onChangeText={onChangeEmail}
            placeholder="Почта"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            editable={!busy}
            returnKeyType="next"
            onSubmitEditing={toPassword}
          />
          <Field
            ref={passwordRef}
            framed={false}
            value={password}
            onChangeText={onChangePassword}
            placeholder="Пароль"
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            editable={!busy}
            returnKeyType="go"
            onSubmitEditing={submit}
          />
        </SectionBox>
      ) : null}

      {!login && step === 'email' ? (
        <SectionBox title="ПОЧТА">
          <Field
            framed={false}
            value={email}
            onChangeText={onChangeEmail}
            placeholder="Почта"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            autoFocus
            editable={!busy}
            returnKeyType="go"
            onSubmitEditing={submit}
          />
        </SectionBox>
      ) : null}

      {!login && step === 'password' ? (
        <>
          {mode === 'register' ? (
            <SectionBox title="ИМЯ">
              <Field
                framed={false}
                value={name}
                onChangeText={onChangeName}
                placeholder="Имя"
                autoComplete="name"
                textContentType="givenName"
                maxLength={40}
                autoFocus
                editable={!busy}
                returnKeyType="next"
                onSubmitEditing={toPassword}
              />
            </SectionBox>
          ) : null}
          <SectionBox title="ПАРОЛЬ" count={password ? STRENGTH_LABEL[strength] : undefined}>
            <Field
              ref={passwordRef}
              framed={false}
              value={password}
              onChangeText={onChangePassword}
              placeholder={mode === 'register' ? 'Пароль' : 'Новый пароль'}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              autoFocus={mode === 'reset'}
              editable={!busy}
              returnKeyType="next"
              onSubmitEditing={toRepeat}
            />
            {password ? <StrengthMeter strength={strength} /> : null}
            <Field
              ref={repeatRef}
              framed={false}
              value={repeat}
              onChangeText={onChangeRepeat}
              placeholder="Повторите пароль"
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              editable={!busy}
              invalid={mismatch}
              returnKeyType="go"
              onSubmitEditing={submit}
            />
          </SectionBox>
        </>
      ) : null}

      <ErrorLine text={mismatch ? 'Пароли не совпадают' : error} />

      <WideButton label={busy ? '…' : submitLabel(mode, step)} disabled={!canSubmit || busy} onPress={onSubmit} />
      {login && canReset ? <WideButton label="ЗАБЫЛИ ПАРОЛЬ" variant="outline" disabled={busy} onPress={onForgot} /> : null}
      {login && vk ? <WideButton label="ВОЙТИ ЧЕРЕЗ VK ID" variant="outline" disabled={busy} onPress={onVk} /> : null}
    </AccountPage>
  );
});
