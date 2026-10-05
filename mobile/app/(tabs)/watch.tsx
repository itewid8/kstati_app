import { ChevronDown, ChevronRight } from '@/components/icons';
import { PullScreen, PullScrollView } from '@/components/PullRefresh';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useBottomSpace } from '@/components/BottomBar';
import { emptyDraft } from '@/components/CardSheet';
import { FILTER_META, FilterSheet, type FilterKey } from '@/components/FilterSheet';
import { Header } from '@/components/Header';
import { openMenu } from '@/components/ActionMenu';
import { NoGroup } from '@/components/NoGroup';
import { SwipeRow } from '@/components/SwipeRow';
import { LayoutAnimationConfig, ListItem } from '@/components/ListItem';
import { Button, Checkbox, Chip, Divider, T } from '@/components/ui';
import { useDelayedMark } from '@/lib/useMark';
import { useCurrentGroup, userName, useStore } from '@/lib/store';
import { emptyFilters, GENRE_LABEL, KIND_LABEL, type WatchFilters, type WatchItem } from '@/lib/types';
import { ICON, space, useColors } from '@/theme';

const KEYS: FilterKey[] = ['kind', 'genre', 'origin', 'fresh'];

function applyFilters(items: WatchItem[], f: WatchFilters): WatchItem[] {
  const year = new Date().getFullYear();
  return items.filter((w) => {
    if (f.kind.length && (!w.kind || !f.kind.includes(w.kind))) return false;
    if (f.genre.length && !w.genres.some((g) => f.genre.includes(g))) return false;
    if (f.origin.length && (!w.origin || !f.origin.includes(w.origin))) return false;
    if (f.fresh.length) {
      if (!w.year) return false;
      const fresh = w.year >= year - 1 ? 'new' : 'old';
      if (!f.fresh.includes(fresh)) return false;
    }
    return true;
  });
}

function chipLabel(key: FilterKey, f: WatchFilters): string {
  const sel = f[key] as string[];
  const meta = FILTER_META[key];
  if (sel.length === 0) return meta.title;
  if (sel.length === 1) {
    const l = meta.labels[sel[0]];
    return l[0].toUpperCase() + l.slice(1);
  }
  return `${meta.title} · ${sel.length}`;
}

export default function Watch() {
  const c = useColors();
  const group = useCurrentGroup();
  const all = useStore((s) => s.watch);
  const filters = useStore((s) => s.watchFilters);
  const { setWatchFilters, setCard } = useStore.getState();
  const bottom = useBottomSpace();
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const [showWatched, setShowWatched] = useState(false);

  const active = KEYS.some((k) => filters[k].length > 0);
  const { list, watched } = useMemo(() => {
    const mine = all.filter((w) => w.groupId === group?.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return {
      list: applyFilters(mine.filter((w) => !w.watchedAt), filters),
      watched: mine.filter((w) => w.watchedAt),
    };
  }, [all, group?.id, filters]);

  return (
    <PullScreen>
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <Header
          title={group?.name ?? 'Смотреть'}
          groupSwitch
          onPlus={group ? () => setCard({ source: 'manual', items: [emptyDraft('watch')], editing: true }) : undefined}
        />
        {!group ? (
          <NoGroup />
        ) : (
          <>
            <View style={styles.filtersRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ flex: 1 }}>
                {KEYS.map((k) => (
                  <Chip key={k} label={chipLabel(k, filters)} selected={filters[k].length > 0} onPress={() => setOpenFilter(k)} />
                ))}
              </ScrollView>
              {active && (
                <Button kind="text" title="Сбросить" color={c.textMuted} onPress={() => setWatchFilters(emptyFilters)} style={{ height: 32, marginRight: space.side, marginLeft: 8 }} />
              )}
            </View>

            <PullScrollView contentContainerStyle={{ paddingBottom: bottom }}>
              <LayoutAnimationConfig skipEntering>
              {list.length === 0 && active && (
                <View style={{ padding: space.side, paddingTop: 24, gap: 4, alignItems: 'flex-start' }}>
                  <T muted>Ничего не нашлось</T>
                  <Button kind="text" title="Сбросить фильтры" onPress={() => setWatchFilters(emptyFilters)} />
                </View>
              )}
              {list.length === 0 && !active && watched.length === 0 && (
                <T muted style={{ padding: space.side, paddingTop: 24 }}>
                  Список пуст
                </T>
              )}
              {list.map((w, i) => (
                <ListItem key={w.id}>
                  {i > 0 && <Divider inset={space.side + 36} />}
                  <WatchRow item={w} />
                </ListItem>
              ))}

              {watched.length > 0 && (
                <ListItem>
                  <Pressable onPress={() => setShowWatched((v) => !v)} style={styles.toggle}>
                    <T variant="caption" muted>
                      Посмотрели · {watched.length}
                    </T>
                    {showWatched ? (
                      <ChevronDown size={16} strokeWidth={ICON.stroke} color={c.textMuted} />
                    ) : (
                      <ChevronRight size={16} strokeWidth={ICON.stroke} color={c.textMuted} />
                    )}
                  </Pressable>
                  {showWatched &&
                    watched.map((w, i) => (
                      <ListItem key={w.id}>
                        {i > 0 && <Divider inset={space.side + 36} />}
                        <WatchRow item={w} />
                      </ListItem>
                    ))}
                </ListItem>
              )}
              </LayoutAnimationConfig>
            </PullScrollView>
          </>
        )}
        <FilterSheet field={openFilter} filters={filters} onChange={setWatchFilters} onClose={() => setOpenFilter(null)} />
      </View>
    </PullScreen>
  );
}

function WatchRow({ item }: { item: WatchItem }) {
  const c = useColors();
  const users = useStore((s) => s.users);
  // Кто добавил — как у дел
  const sub = [userName(users, item.addedBy), item.genres.map((g) => GENRE_LABEL[g]).join(', ')].filter(Boolean).join(' · ');
  const { toggleWatched, deleteWatch, setCard } = useStore.getState();
  const meta = [item.kind ? KIND_LABEL[item.kind] : null, item.year].filter(Boolean).join(' · ');
  const { marked: watched, toggle } = useDelayedMark(!!item.watchedAt, () => toggleWatched(item.id));

  const edit = () =>
    setCard({
      source: 'edit',
      editing: true,
      items: [
        {
          key: item.id,
          id: item.id,
          type: 'watch',
          data: { title: item.title, kind: item.kind, genres: item.genres, origin: item.origin, year: item.year },
        },
      ],
    });

  return (
    <SwipeRow onSwipeRight={toggle} onSwipeLeft={() => deleteWatch(item.id)}>
      <Pressable
        onPress={edit}
        onLongPress={() =>
          openMenu({
            title: item.title,
            actions: [
              { label: 'Изменить', onPress: edit },
              { label: 'Удалить', danger: true, onPress: () => deleteWatch(item.id) },
            ],
          })
        }
        delayLongPress={350}
        style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.surface : c.background }]}>
        <Checkbox checked={watched} onPress={toggle} />
        <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 12 }}>
          <T style={[{ flex: 1 }, watched && { textDecorationLine: 'line-through' }]} muted={watched} numberOfLines={2}>
            {item.title}
          </T>
          {meta ? (
            <T variant="caption" mono muted>
              {meta}
            </T>
          ) : null}
        </View>
        <T variant="label" muted>
          {sub}
        </T>
        </View>
      </Pressable>
    </SwipeRow>
  );
}

const styles = StyleSheet.create({
  filtersRow: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8 },
  chips: { paddingHorizontal: space.side, gap: 8 },
  row: {
    minHeight: space.rowMin,
    paddingHorizontal: space.side,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.side,
    paddingTop: 24,
    paddingBottom: 8,
  },
});
