/**
 * Блок «Связи» для записи self: связанное, убрать связь, связать с другой записью (окно выбора с поиском).
 * Новой записи (ещё не сохранена) блока нет
 */
import { useCallback, useMemo, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { linkCandidates, linkRows, type LinkData, type LinkRow } from '@/adapters/links';
import { useStore } from '@/lib/store';
import type { LinkRef } from '@/lib/types';
import { LinkPickerSheet, LinksSection } from '@/screens/links';
import { useClock, useInsets } from '../common';
import { openRef } from './open';

/** Что нужно блоку из хранилища — те же ссылки на списки, лишних перерисовок нет */
export function useLinkData(): LinkData {
  return useStore(
    useShallow((s) => ({ tasks: s.tasks, watch: s.watch, wishes: s.wishes, topics: s.topics, ideas: s.ideas, links: s.links, users: s.users, meId: s.me?.id ?? '' })),
  );
}

type Props = { self: LinkRef; style?: StyleProp<ViewStyle> };

export function LinksContainer({ self, style }: Props) {
  const data = useLinkData();
  const clock = useClock();
  const insets = useInsets();
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');
  const rows = useMemo(() => linkRows(self, data), [self, data]);
  const candidates = useMemo(() => (picking ? linkCandidates(self, data, query, clock.today) : []), [picking, self, data, query, clock.today]);

  const onUnlink = useCallback((r: LinkRow) => r.linkId && useStore.getState().unlink(r.linkId), []);
  const onOpen = useCallback((r: LinkRow) => openRef(r.ref), []);
  const onAdd = useCallback(() => {
    setQuery('');
    setPicking(true);
  }, []);
  const onPick = useCallback(
    (r: LinkRow) => {
      useStore.getState().linkItems(self, r.ref);
      setPicking(false);
    },
    [self],
  );
  const onClose = useCallback(() => setPicking(false), []);

  return (
    <>
      <LinksSection rows={rows} onOpen={onOpen} onUnlink={onUnlink} onAdd={onAdd} style={style} />
      <LinkPickerSheet visible={picking} query={query} rows={candidates} bottomInset={insets.bottom} onQuery={setQuery} onPick={onPick} onClose={onClose} />
    </>
  );
}
