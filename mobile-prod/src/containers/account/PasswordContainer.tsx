import { useCallback, useMemo, useState } from 'react';
import { errorText, request } from '@/lib/net';
import { passwordStrength } from '@/lib/password';
import { DEMO, useStore } from '@/lib/store';
import { PasswordScreen } from '@/screens/account/PasswordScreen';
import { NO_ME, signedInOnly, useInsets } from '../common';
import { backToProfile } from './back';

/** Смена пароля: текущий (если он есть), новый от «среднего» по шкале и повтор. Ошибка — страница остаётся с введённым */
export const PasswordContainer = signedInOnly(function ChangePassword() {
  const me = useStore((s) => s.me) ?? NO_ME;
  const token = useStore((s) => s.session?.token);
  const insets = useInsets();
  const hasOld = me.hasPassword !== false;
  const [old, setOld] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const strength = useMemo(() => passwordStrength(password, [me.name, me.email?.split('@')[0] ?? '']), [password, me.name, me.email]);
  const canSave = strength >= 1 && repeat === password && (!hasOld || old.length > 0);

  const edit = useCallback(
    (set: (t: string) => void) => (t: string) => {
      set(t);
      setError(null);
    },
    [],
  );
  const onChangeOld = useMemo(() => edit(setOld), [edit]);
  const onChangePassword = useMemo(() => edit(setPassword), [edit]);
  const onChangeRepeat = useMemo(() => edit(setRepeat), [edit]);

  const onSave = useCallback(async () => {
    if (!canSave || busy) return;
    if (DEMO) return backToProfile();
    setBusy(true);
    setError(null);
    try {
      await request('/me/password', { token, body: { ...(hasOld && { old }), password } });
      setBusy(false);
      useStore.getState().notice('Пароль изменён');
      backToProfile();
    } catch (e) {
      setBusy(false);
      setError(errorText(e));
    }
  }, [canSave, busy, token, hasOld, old, password]);

  return (
    <PasswordScreen
      hasOld={hasOld}
      old={old}
      password={password}
      repeat={repeat}
      strength={strength}
      error={error}
      canSave={canSave}
      busy={busy}
      insets={insets}
      onBack={backToProfile}
      onChangeOld={onChangeOld}
      onChangePassword={onChangePassword}
      onChangeRepeat={onChangeRepeat}
      onCancel={backToProfile}
      onSave={onSave}
    />
  );
});
