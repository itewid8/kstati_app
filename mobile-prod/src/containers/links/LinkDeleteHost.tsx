/** Окно «удалить вместе со связанным» (хранилище: linkAsk). Кладётся в корень приложения рядом с UndoToast */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { describeRef, type LinkRow } from '@/adapters/links';
import { LINK_TYPE_LABEL, refKey } from '@/lib/linked';
import { useStore } from '@/lib/store';
import { LinkDeleteSheet } from '@/screens/links';
import { useInsets } from '../common';
import { useLinkData } from './LinksContainer';

export function LinkDeleteHost() {
  const ask = useStore((s) => s.linkAsk);
  const data = useLinkData();
  const insets = useInsets();
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => setChosen(new Set()), [ask]);

  const rows = useMemo<LinkRow[]>(() => {
    if (!ask) return [];
    return ask.linked.flatMap((r) => {
      const d = describeRef(r, data);
      return d ? [{ key: refKey(r), ref: r, kind: LINK_TYPE_LABEL[r.type], ...d }] : [];
    });
  }, [ask, data]);
  const what = useMemo(() => {
    if (!ask) return '';
    if (ask.refs.length !== 1) return `Удалить записи: ${ask.refs.length}`;
    const r = ask.refs[0]!;
    const d = describeRef(r, data);
    return `Удалить: ${LINK_TYPE_LABEL[r.type].toLowerCase()} «${d?.title ?? ''}»`;
  }, [ask, data]);

  const onToggle = useCallback((r: LinkRow) => {
    setChosen((cur) => {
      const next = new Set(cur);
      if (next.has(r.key)) next.delete(r.key);
      else next.add(r.key);
      return next;
    });
  }, []);
  const onConfirm = useCallback(() => {
    const st = useStore.getState();
    st.resolveLinkAsk(rows.filter((r) => chosen.has(r.key)).map((r) => r.ref));
  }, [rows, chosen]);
  const onClose = useCallback(() => useStore.getState().resolveLinkAsk(null), []);

  if (!ask) return null;
  return <LinkDeleteSheet visible what={what} rows={rows} chosen={chosen} bottomInset={insets.bottom} onToggle={onToggle} onConfirm={onConfirm} onClose={onClose} />;
}
