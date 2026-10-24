/**
 * Мои дела в группе (C-ShareMine; join — сразу после вступления, C-ShareJoin): режим группы и отметки моих дел.
 * Переход на «Все, кроме скрытых» из настроек группы — через подтверждение (C-ShareAsk).
 */
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { shareAsk, shareProps, type ShareSnapshot } from '@/adapters/account/share';
import { useStore } from '@/lib/store';
import type { ID } from '@/lib/types';
import { visibleIn } from '@/lib/visibility';
import { ShareScreen, type ShareAsk } from '@/screens/account/ShareScreen';
import { NO_ME, resetTo, signedInOnly, useInsets, usePersonColors, type StoreState } from '../common';
import { backToProfile } from './back';
import type { GroupFrom } from './routes';

const pick = (s: StoreState): ShareSnapshot & Pick<StoreState, 'users'> => ({ me: s.me ?? NO_ME, users: s.users, groups: s.groups, tasks: s.tasks });

const back = () => {
  if (router.canGoBack()) router.back();
  else resetTo('/tasks');
};

export type ShareContainerProps = { id: ID; join?: GroupFrom | null };

export const ShareContainer = signedInOnly(function Share({ id, join }: ShareContainerProps) {
  const s = useStore(useShallow(pick));
  const insets = useInsets();
  const colors = usePersonColors(s);
  const [ask, setAsk] = useState<ShareAsk | null>(null);
  const variant = join ? 'join' : 'group';
  const data = useMemo(() => shareProps(s, colors, id, variant), [s, colors, id, variant]);

  const onMode = useCallback(
    (selectOnly: boolean) => {
      const st = useStore.getState();
      const g = st.groups.find((x) => x.id === id);
      if (!g || !st.me) return;
      // «Все» откроет группе все мои дела — из настроек спрашиваем; при вступлении человек как раз выбирает
      if (!selectOnly && !join) return setAsk(shareAsk(pick(st), g));
      st.setShareMode(id, selectOnly);
    },
    [id, join],
  );
  const onAskConfirm = useCallback(() => {
    setAsk(null);
    useStore.getState().setShareMode(id, false);
  }, [id]);
  const onAskCancel = useCallback(() => setAsk(null), []);
  const onToggle = useCallback(
    (taskId: ID) => {
      const st = useStore.getState();
      const g = st.groups.find((x) => x.id === id);
      const t = st.tasks.find((x) => x.id === taskId);
      if (g && t) st.setTaskShare([taskId], id, !visibleIn(t, g));
    },
    [id],
  );
  const onToggleAll = useCallback(() => {
    const st = useStore.getState();
    const g = st.groups.find((x) => x.id === id);
    const me = st.me;
    if (!g || !me) return;
    // Как в списке: несделанные мои, кроме «Только я»
    const mine = st.tasks.filter((t) => t.createdBy === me.id && !t.doneAt && !t.only);
    const allOn = mine.length > 0 && mine.every((t) => visibleIn(t, g));
    st.setTaskShare(
      mine.map((t) => t.id),
      id,
      !allOn,
    );
  }, [id]);
  const onDone = useCallback(() => {
    if (join === 'onboarding') resetTo('/tasks');
    else backToProfile();
  }, [join]);

  if (!data) return null;
  return (
    <ShareScreen
      {...data}
      ask={ask}
      insets={insets}
      onBack={back}
      onMode={onMode}
      onToggle={onToggle}
      onToggleAll={onToggleAll}
      onDone={onDone}
      onAskCancel={onAskCancel}
      onAskConfirm={onAskConfirm}
    />
  );
});
