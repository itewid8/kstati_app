import { useCallback, useEffect, useMemo, useState } from 'react';
import { FRESH_LABEL, GENRE_LABEL, KIND_LABEL, ORIGIN_LABEL, type Freshness, type Genre, type Kind, type Origin, type WatchFilters } from '@/lib/types';
import { FilterSheetView, type FilterOption } from '@/screens/sheets';
import { Sheet } from './Sheet';

export type FilterKey = keyof WatchFilters;

export const FILTER_META: Record<FilterKey, { title: string; labels: Record<string, string> }> = {
  kind: { title: 'Тип', labels: KIND_LABEL },
  genre: { title: 'Жанр', labels: GENRE_LABEL },
  origin: { title: 'Страна', labels: ORIGIN_LABEL },
  fresh: { title: 'Новизна', labels: FRESH_LABEL },
};

const only =
  <K extends string>(labels: Record<K, string>) =>
  (values: readonly string[]): K[] =>
    values.filter((v): v is K => v in labels);

/** Те же фильтры с новым набором значений одного поля (незнакомые значения отбрасываются) */
function withField(f: WatchFilters, key: FilterKey, values: readonly string[]): WatchFilters {
  switch (key) {
    case 'kind':
      return { ...f, kind: only<Kind>(KIND_LABEL)(values) };
    case 'genre':
      return { ...f, genre: only<Genre>(GENRE_LABEL)(values) };
    case 'origin':
      return { ...f, origin: only<Origin>(ORIGIN_LABEL)(values) };
    case 'fresh':
      return { ...f, fresh: only<Freshness>(FRESH_LABEL)(values) };
  }
}

/** Фильтр «Смотреть» по одному полю: варианты плитками, «ОЧИСТИТЬ» / «ГОТОВО» */
export function FilterSheet({
  field,
  filters,
  onChange,
  onClose,
}: {
  field: FilterKey | null;
  filters: WatchFilters;
  onChange: (f: WatchFilters) => void;
  onClose: () => void;
}) {
  // Держим последнее поле, чтобы окно не «пустело» во время закрытия
  const [shown, setShown] = useState<FilterKey | null>(field);
  useEffect(() => {
    if (field) setShown(field);
  }, [field]);

  const meta = shown ? FILTER_META[shown] : null;
  const selected: readonly string[] = shown ? filters[shown] : [];
  const options = useMemo<FilterOption[]>(
    () => (meta ? Object.entries(meta.labels).map(([key, label]) => ({ key, label, selected: selected.includes(key) })) : []),
    [meta, selected],
  );

  const toggle = useCallback(
    (v: string) => {
      if (!shown) return;
      const cur: readonly string[] = filters[shown];
      const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
      onChange(withField(filters, shown, next));
    },
    [shown, filters, onChange],
  );
  const clear = useCallback(() => {
    if (shown) onChange(withField(filters, shown, []));
  }, [shown, filters, onChange]);

  return (
    <Sheet visible={!!field} onClose={onClose} inset>
      {meta ? <FilterSheetView title={meta.title} options={options} onToggle={toggle} onClear={clear} onDone={onClose} /> : null}
    </Sheet>
  );
}
