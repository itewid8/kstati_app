/**
 * «Смотреть» (C-Watch): очередь фильмов и сериалов. Раскладка как у «Хочу»: «В очереди» прижата
 * к верху (top 162), «Посмотрели» — к низу (bottom 98). Обе секции сворачиваются по шапке,
 * длинный список прокручивается внутри рамки. Галочка в строке — быстрая отметка «посмотрели».
 */
import { memo, useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ID, PersonColor } from '@/lib/types';
import {
  BottomNav,
  DoneRow,
  ListMotion,
  ListRow,
  RowMotion,
  ScreenTitle,
  SectionBox,
  TopBar,
  pad2,
  size as S,
  space,
  type as T,
  useTheme,
  type LiftTarget,
  type NavTab,
  type TopBarAction,
} from '@/ui';
import { FilterTabs, type FilterTab } from './components/FilterTabs';

export type WatchFilter = 'all' | 'movies' | 'series';

export type WatchItem = {
  id: ID;
  title: string;
  /** «ФИЛЬМ · ФАНТАСТИКА · ЗАРУБЕЖНОЕ» */
  meta: string;
  /** «2024» */
  year: string;
  /** Кто добавил — полоса слева */
  addedByColor: PersonColor;
};

export type WatchedItem = {
  id: ID;
  title: string;
  /** «28 СЕН» */
  date: string;
};

export type WatchSection = 'queue' | 'watched';

export type WatchScreenProps = {
  groupLabel: string;
  me: { letter: string; color: PersonColor };
  filter: WatchFilter;
  queue: WatchItem[];
  watched: WatchedItem[];
  queueOpen: boolean;
  watchedOpen: boolean;
  /** Сколько посмотрели всего (по умолчанию watched.length) */
  watchedCount?: number;
  hasNews?: boolean;
  insets?: { top: number; bottom: number };

  onPickGroup?: () => void;
  onChangeFilter?: (filter: WatchFilter) => void;
  onOpenFilters?: () => void;
  /** Посмотрели (true) или вернуть в очередь (false) */
  onToggleWatched?: (id: ID, watched: boolean) => void;
  onOpenItem?: (id: ID) => void;
  /** Удержание фильма в очереди (быстрые действия): id и нажатая строка */
  onLongPressItem?: (id: ID, lift: LiftTarget) => void;
  onToggleSection?: (section: WatchSection) => void;
  onAdd?: () => void;
  onOpenFeed?: () => void;
  onOpenSettings?: () => void;
  onNavigate?: (tab: NavTab) => void;
  onRec?: () => void;
};

const NO_INSETS = { top: 0, bottom: 0 };
const FILTERS: ReadonlyArray<FilterTab<WatchFilter>> = [
  { key: 'all', label: 'ВСЁ' },
  { key: 'movies', label: 'ФИЛЬМЫ', flex: 1.4 },
  { key: 'series', label: 'СЕРИАЛЫ', flex: 1.4 },
];

type QueueRowProps = {
  item: WatchItem;
  onToggleWatched?: (id: ID, watched: boolean) => void;
  onOpenItem?: (id: ID) => void;
  onLongPressItem?: (id: ID, lift: LiftTarget) => void;
};

const QueueRow = memo(function QueueRow({ item, onToggleWatched, onOpenItem, onLongPressItem }: QueueRowProps) {
  const { c, person } = useTheme();
  return (
    <ListRow
      title={item.title}
      meta={item.meta}
      strip={person(item.addedByColor)}
      checkLabel="Посмотрели"
      onToggle={onToggleWatched ? () => onToggleWatched(item.id, true) : undefined}
      onPress={onOpenItem ? () => onOpenItem(item.id) : undefined}
      onLongPress={onLongPressItem ? (lift) => onLongPressItem(item.id, lift) : undefined}
      right={<Text style={[T.rowValue, { color: c.text }]}>{item.year}</Text>}
    />
  );
});

export const WatchScreen = memo(function WatchScreen(props: WatchScreenProps) {
  const {
    groupLabel,
    me,
    filter,
    queue,
    watched,
    queueOpen,
    watchedOpen,
    watchedCount = watched.length,
    hasNews,
    insets = NO_INSETS,
    onPickGroup,
    onChangeFilter,
    onOpenFilters,
    onToggleWatched,
    onOpenItem,
    onLongPressItem,
    onToggleSection,
    onAdd,
    onOpenFeed,
    onOpenSettings,
    onNavigate,
    onRec,
  } = props;
  const { c, person, personInk } = useTheme();

  const actions = useMemo<TopBarAction[]>(
    () => [
      { key: 'add', icon: 'plus', accessibilityLabel: 'Добавить', onPress: onAdd },
      { key: 'feed', icon: 'bell', accessibilityLabel: 'Лента', onPress: onOpenFeed, badge: hasNews },
      {
        key: 'me',
        letter: me.letter,
        fill: person(me.color),
        ink: personInk(me.color),
        accessibilityLabel: 'Настройки',
        onPress: onOpenSettings,
      },
    ],
    [onAdd, onOpenFeed, onOpenSettings, hasNews, me.letter, me.color, person, personInk],
  );

  const toggleQueue = useCallback(() => onToggleSection?.('queue'), [onToggleSection]);
  const toggleWatched = useCallback(() => onToggleSection?.('watched'), [onToggleSection]);

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <TopBar
        lead={{ kind: 'group', label: groupLabel, onPress: onPickGroup }}
        actions={actions}
        style={[styles.abs, { top: insets.top + S.topBarTop }]}
      />
      <ScreenTitle title="Смотреть" style={[styles.abs, { top: insets.top + S.titleTop }]} />
      <FilterTabs
        items={FILTERS}
        value={filter}
        onChange={onChangeFilter}
        onOpenFilters={onOpenFilters}
        style={[styles.abs, { top: insets.top + S.tabsTop }]}
      />

      <View style={[styles.abs, { top: insets.top + S.contentTop, bottom: insets.bottom + S.contentBottom }]}>
        <ListMotion key={filter}>
        <SectionBox title="В ОЧЕРЕДИ" count={pad2(queue.length)} collapsed={!queueOpen} onToggle={toggleQueue} scrollable>
          {queue.map((item) => (
            <RowMotion key={item.id}>
              <QueueRow item={item} onToggleWatched={onToggleWatched} onOpenItem={onOpenItem} onLongPressItem={onLongPressItem} />
            </RowMotion>
          ))}
        </SectionBox>
        <View style={styles.spacer} />
        <SectionBox
          title="ПОСМОТРЕЛИ"
          variant="muted"
          count={pad2(watchedCount)}
          collapsed={!watchedOpen}
          onToggle={toggleWatched}
          scrollable
          style={styles.watched}
        >
          {watched.map((w) => (
            <RowMotion key={w.id}>
              <DoneRow
                title={w.title}
                meta={w.date}
                checkLabel="Вернуть в очередь"
                onToggle={onToggleWatched ? () => onToggleWatched(w.id, false) : undefined}
              />
            </RowMotion>
          ))}
        </SectionBox>
        </ListMotion>
      </View>

      <BottomNav active="watch" onSelect={onNavigate} onRec={onRec} style={[styles.abs, { bottom: insets.bottom + S.navBottom }]} />
    </View>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  abs: { position: 'absolute', left: space.side, right: space.side },
  spacer: { flexGrow: 1, minHeight: 10 },
  /** «Посмотрели» не выше ~5 строк, дальше прокрутка */
  watched: { flexShrink: 0, maxHeight: S.border * 2 + S.sectionHeader + S.doneRow * 5 },
});
