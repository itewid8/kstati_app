import { Redirect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { openMenu } from '@/components/ActionMenu';
import { emptyDraft } from '@/components/CardSheet';
import { FILTER_META, FilterSheet, type FilterKey } from '@/components/FilterSheet';
import { WATCH_SECTIONS, hasExtraFilters, kindsOf, watchProps, type WatchSnapshot } from '@/adapters/lists/watch';
import type { Snapshot } from '@/adapters/snapshot';
import { enrichWatch } from '@/lib/api';
import { useStore } from '@/lib/store';
import { syncNow } from '@/lib/sync';
import { emptyFilters, type ID } from '@/lib/types';
import { WatchScreen, type WatchFilter, type WatchSection } from '@/screens/lists/WatchScreen';
import { NO_ME, signedInOnly, useChrome, useClock, useInsets, usePersonColors, type StoreState } from '../common';
import { holdWatch } from '../quick/quickStore';

const FILTER_KEYS: readonly FilterKey[] = ['kind', 'genre', 'origin', 'fresh'];
/** Меню закрывается анимацией — следующее окно открываем после неё */
const AFTER_MENU_MS = 250;

const changeFilter = (segment: WatchFilter) => {
  const st = useStore.getState();
  st.setWatchFilters({ ...st.watchFilters, kind: kindsOf(segment) });
};

const toggleWatched = (id: ID, watched: boolean) => {
  const st = useStore.getState();
  const item = st.watch.find((w) => w.id === id);
  if (item && !!item.watchedAt !== watched) st.toggleWatched(id);
};

/** Правка в старой карточке (и из быстрых действий — ИЗМЕНИТЬ) */
export const openItem = (id: ID) => {
  const st = useStore.getState();
  const w = st.watch.find((x) => x.id === id);
  if (!w) return;
  st.setCard({
    source: 'edit',
    editing: true,
    items: [{ key: w.id, id: w.id, type: 'watch', data: { title: w.title, kind: w.kind, genres: w.genres, origin: w.origin, year: w.year } }],
  });
};

/** Только то, что нужно «Смотреть» (и цветам людей): дела, хотелки и идеи экран не перерисовывают */
const pickWatch = (s: StoreState): WatchSnapshot & Pick<Snapshot, 'users'> => ({
  me: s.me ?? NO_ME,
  users: s.users,
  groups: s.groups,
  currentGroupId: s.currentGroupId,
  watch: s.watch,
  activity: s.activity,
  activitySeen: s.activitySeen,
});

/**
 * Старые фильмы группы — дополнить рейтингом и описанием (сервер ищет в ПоискКино по 8 за раз).
 * Раз за запуск приложения на группу; что-то дополнилось — забрать с сервера
 */
const enriched = new Set<ID>();
async function enrichGroup(groupId: ID) {
  if (enriched.has(groupId)) return;
  enriched.add(groupId);
  for (let i = 0; i < 5; i++) {
    const r = await enrichWatch(groupId);
    if (!r) return enriched.delete(groupId);
    if (r.updated) void syncNow();
    if (!r.updated || !r.left) return;
  }
}

const addItem = () => useStore.getState().setCard({ source: 'manual', items: [emptyDraft('watch')], editing: true });
const toggleSection = (section: WatchSection) => useStore.getState().toggleSection(WATCH_SECTIONS[section]);

/** C-Watch: «Смотреть» текущей группы; фильтры жанра, страны и новизны — в старом окне FilterSheet */
export const WatchContainer = signedInOnly(function Watch() {
  const s = useStore(useShallow(pickWatch));
  const { today } = useClock();
  const insets = useInsets();
  const { onPickGroup, onOpenFeed, onOpenSettings, onNavigate, onRec } = useChrome('watch');
  const filters = useStore((st) => st.watchFilters);
  const collapsed = useStore((st) => st.collapsedSections);
  const colors = usePersonColors(s);
  const data = useMemo(() => watchProps(s, colors, { today }, { filters, collapsed }), [s, colors, today, filters, collapsed]);
  const [field, setField] = useState<FilterKey | null>(null);
  useEffect(() => {
    if (s.currentGroupId) void enrichGroup(s.currentGroupId);
  }, [s.currentGroupId]);

  const onOpenFilters = useCallback(() => {
    const f = useStore.getState().watchFilters;
    const label = (k: FilterKey) => (f[k].length ? `${FILTER_META[k].title} · ${f[k].length}` : FILTER_META[k].title);
    openMenu({
      title: 'Фильтры',
      actions: [
        ...FILTER_KEYS.map((k) => ({ label: label(k), onPress: () => setTimeout(() => setField(k), AFTER_MENU_MS) })),
        ...(hasExtraFilters(f) || f.kind.length ? [{ label: 'Сбросить', danger: true, onPress: () => useStore.getState().setWatchFilters(emptyFilters) }] : []),
      ],
    });
  }, []);
  const onCloseFilter = useCallback(() => setField(null), []);
  const setFilters = useStore((st) => st.setWatchFilters);

  if (!s.groups.length) return <Redirect href="/onboarding" />;

  return (
    <View style={styles.screen}>
      <WatchScreen
        {...data}
        insets={insets}
        onPickGroup={onPickGroup}
        onChangeFilter={changeFilter}
        onOpenFilters={onOpenFilters}
        onToggleWatched={toggleWatched}
        onOpenItem={openItem}
        onLongPressItem={holdWatch}
        onToggleSection={toggleSection}
        onAdd={addItem}
        onOpenFeed={onOpenFeed}
        onOpenSettings={onOpenSettings}
        onNavigate={onNavigate}
        onRec={onRec}
      />
      <FilterSheet field={field} filters={filters} onChange={setFilters} onClose={onCloseFilter} />
    </View>
  );
});

const styles = StyleSheet.create({ screen: { flex: 1 } });
