import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { openConfirm } from '@/components/ActionMenu';
import { useStore } from '@/lib/store';
import { TRASH_LABEL, daysLeft, trashKey, trashTitle, type TrashKind } from '@/lib/trash';
import { MONTHS_SHORT } from '@/screens/calendar/format';
import { TrashScreen, type TrashDay } from '@/screens/account/TrashScreen';
import { useInsets } from '../common';

const back = () => (router.canGoBack() ? router.back() : router.replace('/settings/app'));
const FILTERS: { key: 'all' | TrashKind | 'notes'; label: string }[] = [
  { key: 'all', label: 'ВСЕ' },
  { key: 'task', label: 'ДЕЛА' },
  { key: 'wish', label: 'ХОЧУ' },
  { key: 'watch', label: 'СМОТРЕТЬ' },
  { key: 'notes', label: 'ЗАМЕТКИ' },
];
const pad = (n: number) => String(n).padStart(2, '0');
const word = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? 'ЗАПИСЬ' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'ЗАПИСИ' : 'ЗАПИСЕЙ');

/** Недавно удалённые: вернуть или удалить навсегда — всё или выбранное */
export function TrashContainer() {
  const insets = useInsets();
  const trash = useStore((s) => s.trash);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const shown = useMemo(
    () => trash.filter((e) => filter === 'all' || (filter === 'notes' ? e.kind === 'topic' || e.kind === 'idea' : e.kind === filter)),
    [trash, filter],
  );
  const keys = useMemo(() => shown.map(trashKey), [shown]);
  const chosen = keys.filter((k) => selected.has(k));

  const days = useMemo<TrashDay[]>(() => {
    const today = new Date();
    const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const yest = new Date(today.getTime() - 86_400_000);
    const map = new Map<string, TrashDay & { rows: TrashDay['rows'][number][] }>();
    for (const e of shown) {
      const d = new Date(e.deletedAt);
      const k = dayKey(d);
      const title = k === dayKey(today) ? 'СЕГОДНЯ' : k === dayKey(yest) ? 'ВЧЕРА' : `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
      if (!map.has(k)) map.set(k, { key: k, title, rows: [] });
      const left = daysLeft(e);
      map.get(k)!.rows.push({
        key: trashKey(e),
        type: TRASH_LABEL[e.kind],
        title: trashTitle(e),
        meta: `${pad(d.getHours())}:${pad(d.getMinutes())} · ${left ? `ОСТАЛОСЬ ${left} ДН.` : 'УДАЛИТСЯ СЕГОДНЯ'}`,
        checked: selected.has(trashKey(e)),
      });
    }
    return [...map.values()];
  }, [shown, selected]);

  const toggle = useCallback((ks: readonly string[]) => {
    setSelected((cur) => {
      const next = new Set(cur);
      const all = ks.every((k) => next.has(k));
      ks.forEach((k) => (all ? next.delete(k) : next.add(k)));
      return next;
    });
  }, []);

  const target = chosen.length ? chosen : keys;
  const onRestore = () => {
    const n = useStore.getState().restoreTrash(target);
    useStore.getState().notice(`Возвращено: ${n}`);
    setSelected(new Set());
  };
  const onPurge = () =>
    openConfirm({
      title: `Удалить навсегда ${target.length} ${word(target.length).toLowerCase()}? Вернуть будет нельзя`,
      action: 'УДАЛИТЬ НАВСЕГДА',
      onConfirm: () => {
        useStore.getState().purgeTrash(target);
        setSelected(new Set());
      },
    });

  return (
    <TrashScreen
      filters={FILTERS.filter((f) => f.key === 'all' || trash.some((e) => (f.key === 'notes' ? e.kind === 'topic' || e.kind === 'idea' : e.kind === f.key))).map((f) => ({ ...f, on: f.key === filter }))}
      days={days}
      total={shown.length}
      selected={chosen.length}
      allSelected={!!keys.length && chosen.length === keys.length}
      insets={insets}
      onBack={back}
      onFilter={(k) => {
        setFilter(k as typeof filter);
        setSelected(new Set());
      }}
      onToggleRow={(k) => toggle([k])}
      onToggleDay={(k) => {
        const d = days.find((x) => x.key === k);
        if (d) toggle(d.rows.map((r) => r.key));
      }}
      onSelectAll={() => setSelected(chosen.length === keys.length ? new Set() : new Set(keys))}
      onRestore={onRestore}
      onPurge={onPurge}
    />
  );
}
