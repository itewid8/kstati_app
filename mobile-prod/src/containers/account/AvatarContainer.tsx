import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { autoColor, lookOf, lookPatch, type LookDraft } from '@/adapters/account/avatar';
import { useStore } from '@/lib/store';
import type { PersonColor } from '@/lib/types';
import { AvatarScreen } from '@/screens/account/AvatarScreen';
import { NO_ME, signedInOnly, useInsets, type StoreState } from '../common';
import { backToProfile } from './back';

const pickLook = (s: StoreState) => ({ me: s.me ?? NO_ME, users: s.users, groups: s.groups });

/**
 * «Иконка»: цвет и символ — черновик до СОХРАНИТЬ. color — цвет, нажатый в профиле: он сразу выбран.
 * Нет связи — правка уходит в очередь (setLook); отказ сервера — страница остаётся с текстом ошибки
 */
export const AvatarContainer = signedInOnly(function Avatar({ color }: { color?: PersonColor }) {
  const s = useStore(useShallow(pickLook));
  const insets = useInsets();
  const [draft, setDraft] = useState<LookDraft>(() => ({ ...lookOf(s.me), ...(color && { color }) }));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const auto = useMemo(() => autoColor(s), [s]);
  const patch = useMemo(() => lookPatch(draft, s.me), [draft, s.me]);
  const canSave = Object.keys(patch).length > 0;

  const onPickColor = useCallback((c: PersonColor | null) => {
    setDraft((d) => ({ ...d, color: c }));
    setError(null);
  }, []);
  const onChangeSymbol = useCallback((symbol: string) => {
    setDraft((d) => ({ ...d, symbol }));
    setError(null);
  }, []);
  const onSave = useCallback(async () => {
    if (!canSave || busy) return;
    setBusy(true);
    const err = await useStore.getState().setLook(patch);
    setBusy(false);
    if (err) return setError(err);
    backToProfile();
  }, [canSave, busy, patch]);

  return (
    <AvatarScreen
      name={s.me.name}
      color={draft.color}
      autoColor={auto}
      symbol={draft.symbol}
      canSave={canSave}
      busy={busy}
      error={error}
      insets={insets}
      onBack={backToProfile}
      onPickColor={onPickColor}
      onChangeSymbol={onChangeSymbol}
      onCancel={backToProfile}
      onSave={onSave}
    />
  );
});
