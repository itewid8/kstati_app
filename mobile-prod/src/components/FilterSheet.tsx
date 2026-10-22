import { Check } from '@/components/icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { FRESH_LABEL, GENRE_LABEL, KIND_LABEL, ORIGIN_LABEL, type WatchFilters } from '@/lib/types';
import { ICON, space, useColors } from '@/theme';
import { Sheet } from './Sheet';
import { Button, T } from './ui';

export type FilterKey = keyof WatchFilters;

export const FILTER_META: Record<FilterKey, { title: string; labels: Record<string, string> }> = {
  kind: { title: 'Тип', labels: KIND_LABEL },
  genre: { title: 'Жанр', labels: GENRE_LABEL },
  origin: { title: 'Страна', labels: ORIGIN_LABEL },
  fresh: { title: 'Новизна', labels: FRESH_LABEL },
};

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
  const c = useColors();
  const meta = field ? FILTER_META[field] : null;
  const selected: string[] = field ? filters[field] : [];

  const toggle = (v: string) => {
    if (!field) return;
    const cur = filters[field] as string[];
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    onChange({ ...filters, [field]: next } as WatchFilters);
  };

  return (
    <Sheet visible={!!field} onClose={onClose}>
      {meta && (
        <View>
          <T weight="semibold" style={styles.title}>
            {meta.title}
          </T>
          {Object.entries(meta.labels).map(([k, label]) => {
            const on = selected.includes(k);
            return (
              <Pressable
                key={k}
                onPress={() => toggle(k)}
                style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.background : 'transparent' }]}
              >
                <T style={{ flex: 1 }}>{label[0].toUpperCase() + label.slice(1)}</T>
                {on && <Check size={ICON.size} strokeWidth={ICON.stroke} color={c.text} />}
              </Pressable>
            );
          })}
          <View style={styles.actions}>
            <Button
              kind="text"
              title="Очистить"
              disabled={!selected.length}
              onPress={() => field && onChange({ ...filters, [field]: [] } as WatchFilters)}
            />
            <Button title="Готово" onPress={onClose} />
          </View>
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { paddingHorizontal: space.side, paddingVertical: 8 },
  row: { minHeight: 48, paddingHorizontal: space.side, flexDirection: 'row', alignItems: 'center' },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.side,
    paddingTop: 8,
  },
});
