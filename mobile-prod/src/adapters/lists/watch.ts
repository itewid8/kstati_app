/**
 * C-Watch: «Смотреть» текущей группы. Быстрые сегменты ВСЁ / ФИЛЬМЫ / СЕРИАЛЫ — это фильтр типа (watchFilters.kind);
 * остальные фильтры (жанр, страна, новизна) задаются в старом окне фильтров и действуют вместе с ними.
 */
import { GENRE_LABEL, KIND_LABEL, ORIGIN_LABEL, type Kind, type WatchFilters, type WatchItem as Item } from '@/lib/types';
import type { WatchFilter, WatchItem, WatchScreenProps, WatchedItem } from '@/screens/lists/WatchScreen';
import { colorOf, meBadge, type ColorMap } from '../common/people';
import { upper } from '../common/ru';
import { dateOfStamp, dayMonthShort } from '../common/when';
import type { Clock, DataOf, Snapshot } from '../snapshot';

export type WatchUi = { filters: WatchFilters; collapsed: readonly string[] };

export const WATCH_SECTIONS = { queue: 'watch.queue', watched: 'watch.watched' } as const;

/** Сегмент по фильтру типа: [] — ВСЁ, только фильм — ФИЛЬМЫ, только сериал — СЕРИАЛЫ, иначе ВСЁ (+ фильтры окна) */
export function segmentOf(kind: readonly Kind[]): WatchFilter {
  if (kind.length !== 1) return 'all';
  return kind[0] === 'movie' ? 'movies' : kind[0] === 'series' ? 'series' : 'all';
}

/** Фильтр типа для сегмента */
export const kindsOf = (segment: WatchFilter): Kind[] => (segment === 'movies' ? ['movie'] : segment === 'series' ? ['series'] : []);

/** Подходит ли запись под фильтры. «Новое» — этого и прошлого года */
export function matches(w: Item, f: WatchFilters, year: number): boolean {
  if (f.kind.length && (!w.kind || !f.kind.includes(w.kind))) return false;
  if (f.genre.length && !w.genres.some((g) => f.genre.includes(g))) return false;
  if (f.origin.length && (!w.origin || !f.origin.includes(w.origin))) return false;
  if (f.fresh.length) {
    if (!w.year) return false;
    if (!f.fresh.includes(w.year >= year - 1 ? 'new' : 'old')) return false;
  }
  return true;
}

/** Фильтры, кроме сегмента, заданы — сбросить их можно в окне фильтров */
export const hasExtraFilters = (f: WatchFilters) =>
  f.genre.length > 0 || f.origin.length > 0 || f.fresh.length > 0 || (f.kind.length > 0 && segmentOf(f.kind) === 'all');

/** «ФИЛЬМ · ФАНТАСТИКА · ЗАРУБЕЖНОЕ»; несколько жанров — через запятую */
export function watchMeta(w: Pick<Item, 'kind' | 'genres' | 'origin' | 'rating'>): string {
  const genres = w.genres.map((g) => GENRE_LABEL[g]).join(', ');
  const rating = w.rating ? `КП ${w.rating.toFixed(1)}` : '';
  return upper([rating, w.kind ? KIND_LABEL[w.kind] : '', genres, w.origin ? ORIGIN_LABEL[w.origin] : ''].filter(Boolean).join(' · '));
}

export type WatchSnapshot = Pick<Snapshot, 'me' | 'groups' | 'currentGroupId' | 'watch' | 'activity' | 'activitySeen'>;

export function watchProps(s: WatchSnapshot, colors: ColorMap, clock: Pick<Clock, 'today'>, ui: WatchUi): DataOf<WatchScreenProps> {
  const group = s.groups.find((g) => g.id === s.currentGroupId);
  const year = Number(clock.today.slice(0, 4));
  const items = s.watch.filter((w) => w.groupId === s.currentGroupId && matches(w, ui.filters, year));

  const queue: WatchItem[] = items
    .filter((w) => !w.watchedAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((w) => ({ id: w.id, title: w.title, meta: watchMeta(w), year: w.year ? String(w.year) : '', addedByColor: colorOf(colors, w.addedBy) }));

  const watched: WatchedItem[] = items
    .flatMap((w) => (w.watchedAt ? [{ w, at: w.watchedAt }] : []))
    .sort((a, b) => b.at.localeCompare(a.at))
    .map(({ w, at }) => ({ id: w.id, title: w.title, date: dayMonthShort(dateOfStamp(at)) }));

  return {
    groupLabel: upper(group?.name ?? ''),
    me: meBadge(s, colors),
    hasNews: (s.activity[0]?.id ?? '') > s.activitySeen,
    filter: segmentOf(ui.filters.kind),
    queue,
    watched,
    queueOpen: !ui.collapsed.includes(WATCH_SECTIONS.queue),
    watchedOpen: !ui.collapsed.includes(WATCH_SECTIONS.watched),
  };
}
