import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { useStore } from '@/lib/store';
import { JoinGroupScreen } from '@/screens/account/JoinGroupScreen';
import { resetTo, signedInOnly, useInsets } from '../common';
import { backToProfile } from './back';
import { accountRoutes, type GroupFrom } from './routes';

/**
 * Вступить по коду: код проверяет сервер (нужна связь). Не подошёл или нет связи — код остаётся, под ним причина.
 * С первой группы — на вкладки с чистого стека, из профиля — назад
 */
export const JoinGroupContainer = signedInOnly(function JoinGroup({ from }: { from: GroupFrom }) {
  const insets = useInsets();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onChangeCode = useCallback((t: string) => {
    setCode(t);
    setError(null);
  }, []);
  const onJoin = useCallback(async () => {
    if (busy || !code) return;
    setBusy(true);
    const err = await useStore.getState().joinGroup(code);
    setBusy(false);
    if (err) return setError(err);
    // Сразу — как показывать группе мои дела (C-ShareJoin); ГОТОВО там ведёт туда же, куда раньше вело вступление
    const gid = useStore.getState().currentGroupId;
    if (gid) return router.replace(accountRoutes.share(gid, from));
    if (from === 'onboarding') resetTo('/tasks');
    else backToProfile();
  }, [busy, code, from]);

  return (
    <JoinGroupScreen
      code={code}
      error={!!error}
      errorText={error}
      busy={busy}
      caption={from === 'onboarding' ? 'ПЕРВАЯ ГРУППА' : 'ГРУППЫ'}
      insets={insets}
      onBack={backToProfile}
      onChangeCode={onChangeCode}
      onCancel={backToProfile}
      onJoin={onJoin}
    />
  );
});
