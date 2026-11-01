/**
 * Режим выбора на любом экране списка: null — выбора нет; «ВЫБРАТЬ» — пустой выбор; «ВЫБРАТЬ ВСЕ» — все
 * доступные (pickable), второй раз — снять; группа (день, раздел) — toggleMany. «Назад» Android выходит из выбора.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler } from 'react-native';
import type { ID } from '@/lib/types';

export type Selection = {
  selected: ID[] | null;
  start: () => void;
  cancel: () => void;
  toggle: (id: ID) => void;
  toggleMany: (ids: readonly ID[]) => void;
  selectAll: () => void;
  allSelected: boolean;
};

export function useSelection(pickable: readonly ID[]): Selection {
  const [selected, setSelected] = useState<ID[] | null>(null);
  const can = useMemo(() => new Set(pickable), [pickable]);
  const start = useCallback(() => setSelected([]), []);
  const cancel = useCallback(() => setSelected(null), []);
  const toggle = useCallback(
    (id: ID) => {
      if (!can.has(id)) return;
      setSelected((cur) => (cur ? (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]) : cur));
    },
    [can],
  );
  const toggleMany = useCallback(
    (ids: readonly ID[]) => {
      const list = ids.filter((id) => can.has(id));
      setSelected((cur) => {
        const set = new Set(cur ?? []);
        const all = list.every((id) => set.has(id));
        list.forEach((id) => (all ? set.delete(id) : set.add(id)));
        return [...set];
      });
    },
    [can],
  );
  const allSelected = !!selected && !!pickable.length && pickable.every((id) => selected.includes(id));
  const selectAll = useCallback(() => setSelected(allSelected ? [] : [...pickable]), [allSelected, pickable]);
  useEffect(() => {
    if (!selected) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelected(null);
      return true;
    });
    return () => sub.remove();
  }, [selected]);
  return { selected, start, cancel, toggle, toggleMany, selectAll, allSelected };
}
