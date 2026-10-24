import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore, type NickStatus } from '@/lib/store';
import type { Gender } from '@/lib/types';
import { EditFieldScreen, type EditableField, type NickState } from '@/screens/account/EditFieldScreen';
import { NO_ME, signedInOnly, useInsets } from '../common';
import { backToProfile } from './back';

const NICK_RULE = 'От 3 до 20 символов: буквы, цифры, «_» и «.»';
/** Пробелы и «@» в начале не вводятся */
const cleanNick = (t: string) => t.replace(/\s/g, '').replace(/^@/, '');

/**
 * Имя, никнейм или пол: черновик до СОХРАНИТЬ. Новый ник проверяется на сервере (с задержкой 0.4 с) и сохраняется
 * сразу на сервере — нет связи: страница остаётся с введённым и текстом ошибки
 */
export const EditFieldContainer = signedInOnly(function EditField({ field }: { field: EditableField }) {
  const me = useStore((s) => s.me) ?? NO_ME;
  const insets = useInsets();
  const [name, setName] = useState(me.name);
  const [nick, setNick] = useState(me.nick ?? '');
  const [gender, setGender] = useState<Gender | null>(me.gender ?? null);
  const [status, setStatus] = useState<NickStatus | 'checking' | 'empty'>('same');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const reqId = useRef(0);

  const nickChanged = nick.toLowerCase() !== (me.nick ?? '').toLowerCase();
  useEffect(() => {
    if (field !== 'nick') return;
    if (!nickChanged) return setStatus('same');
    if (!nick) return setStatus('empty');
    const id = ++reqId.current;
    setStatus('checking');
    const t = setTimeout(async () => {
      const res = await useStore.getState().checkNick(nick);
      if (id === reqId.current) setStatus(res);
    }, 400);
    return () => clearTimeout(t);
  }, [field, nick, nickChanged]);

  const changed =
    field === 'name' ? name.trim().length > 0 && name.trim() !== me.name : field === 'nick' ? nickChanged : gender !== (me.gender ?? null);
  const nickOk = status === 'same' || status === 'free' || status === 'empty';
  const canSave = changed && (field !== 'nick' || nickOk);

  const onChangeName = useCallback((t: string) => {
    setName(t);
    setError(null);
  }, []);
  const onChangeNick = useCallback((t: string) => {
    setNick(cleanNick(t));
    setError(null);
  }, []);
  const onChangeGender = useCallback((g: Gender | null) => {
    setGender(g);
    setError(null);
  }, []);

  const onSave = useCallback(async () => {
    if (!canSave || busy) return;
    setBusy(true);
    const err = await useStore.getState().saveProfile({ name, nick, gender });
    setBusy(false);
    if (err) return setError(err);
    backToProfile();
  }, [canSave, busy, name, nick, gender]);

  const nickState: NickState = status;
  return (
    <EditFieldScreen
      field={field}
      name={name}
      nick={nick}
      gender={gender}
      nickState={nickState}
      error={error ?? (field === 'nick' && status === 'invalid' ? NICK_RULE : null)}
      canSave={canSave}
      busy={busy}
      insets={insets}
      onBack={backToProfile}
      onChangeName={onChangeName}
      onChangeNick={onChangeNick}
      onChangeGender={onChangeGender}
      onCancel={backToProfile}
      onSave={onSave}
    />
  );
});
