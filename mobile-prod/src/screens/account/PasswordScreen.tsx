/**
 * Смена пароля: текущий (если он есть — после входа через VK его нет), новый с оценкой надёжности и повтор.
 * Снизу ОТМЕНА / СОХРАНИТЬ. Презентационный экран.
 */
import { memo, useCallback, useRef } from 'react';
import type { TextInput } from 'react-native';
import { SectionBox } from '@/ui';
import { AccountPage, type PageInsets } from './components/AccountPage';
import { ErrorLine } from './components/ErrorLine';
import { Field } from './components/Field';
import { STRENGTH_LABEL, StrengthMeter, type Strength } from './components/StrengthMeter';

export type PasswordScreenProps = {
  /** Есть текущий пароль — нужно ввести его */
  hasOld: boolean;
  old: string;
  password: string;
  repeat: string;
  strength: Strength;
  error?: string | null;
  canSave: boolean;
  busy?: boolean;
  insets?: PageInsets;

  onBack?: () => void;
  onChangeOld?: (text: string) => void;
  onChangePassword?: (text: string) => void;
  onChangeRepeat?: (text: string) => void;
  onCancel?: () => void;
  onSave?: () => void;
};

const NO_INSETS: PageInsets = { top: 0, bottom: 0 };

export const PasswordScreen = memo(function PasswordScreen(props: PasswordScreenProps) {
  const {
    hasOld,
    old,
    password,
    repeat,
    strength,
    error,
    canSave,
    busy = false,
    insets = NO_INSETS,
    onBack,
    onChangeOld,
    onChangePassword,
    onChangeRepeat,
    onCancel,
    onSave,
  } = props;
  const newRef = useRef<TextInput>(null);
  const repeatRef = useRef<TextInput>(null);
  const toNew = useCallback(() => newRef.current?.focus(), []);
  const toRepeat = useCallback(() => repeatRef.current?.focus(), []);
  const mismatch = repeat.length > 0 && !password.startsWith(repeat);

  return (
    <AccountPage caption="ПРОФИЛЬ" title="Пароль" insets={insets} onBack={onBack} save={{ canSave, busy, onCancel, onSave }}>
      {hasOld ? (
        <SectionBox title="ТЕКУЩИЙ ПАРОЛЬ">
          <Field
            framed={false}
            value={old}
            onChangeText={onChangeOld}
            placeholder="Текущий пароль"
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            autoFocus
            editable={!busy}
            returnKeyType="next"
            onSubmitEditing={toNew}
          />
        </SectionBox>
      ) : null}

      <SectionBox title="НОВЫЙ ПАРОЛЬ" count={password ? STRENGTH_LABEL[strength] : undefined}>
        <Field
          ref={newRef}
          framed={false}
          value={password}
          onChangeText={onChangePassword}
          placeholder="Новый пароль"
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          autoFocus={!hasOld}
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
          returnKeyType="done"
          onSubmitEditing={canSave && !busy ? onSave : undefined}
        />
      </SectionBox>

      <ErrorLine text={mismatch ? 'Пароли не совпадают' : error} />
    </AccountPage>
  );
});
