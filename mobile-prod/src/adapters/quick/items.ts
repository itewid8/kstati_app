/**
 * Хотелка (C-QuickWish), «Смотреть» (C-QuickWatch) и идея (C-QuickIdea) по удержанию.
 * Хотелка: чужая — ПОДАРЮ / ССЫЛКА / В ДЕЛА без удаления; своя — ПОЛУЧИЛ / ИЗМЕНИТЬ / ССЫЛКА + УДАЛИТЬ.
 * Владелец не видит, что его хотелку подарили: в своей карточке подарок не упоминается.
 */
import { GENRE_LABEL, KIND_LABEL, ORIGIN_LABEL, type ID, type Idea, type Topic, type WatchItem, type Wish } from '@/lib/types';
import type { QuickSegment, QuickSheetData, QuickTile } from '@/screens/quick/types';
import { colorOf, userOf, type ColorMap } from '../common/people';
import { upper } from '../common/ru';
import { dateOfStamp, dayMonthShort } from '../common/when';
import { linkDomain, safeLink } from '../lists/wishes';
import { splitIdea } from './convert';
import { off, type QuickEnv, type QuickSnapshot } from './types';

/** Ключ «Без темы» в ряду «В ТЕМУ» */
export const NO_TOPIC = 'inbox';

const nameOf = (s: QuickSnapshot, id: ID) => upper(userOf(s, id)?.name ?? '—');
const added = (stamp: string) => dayMonthShort(dateOfStamp(stamp));

export type QuickWishView = { kind: 'wish'; sheet: QuickSheetData; wish: Wish; own: boolean; link: string | null };

export const quickWishView = (s: QuickSnapshot, colors: ColorMap, env: QuickEnv, target: { ownerId: ID; id: ID }): QuickWishView | null => {
  const wish = s.wishes.find((w) => w.ownerId === target.ownerId && w.id === target.id);
  if (!wish) return null;
  const own = wish.ownerId === s.me.id;
  const link = safeLink(wish.link);
  const tiles: QuickTile[] = own
    ? [
        { key: 'received', label: 'ПОЛУЧИЛ', primary: true, ...off(!!wish.receivedAt) },
        { key: 'edit', label: 'ИЗМЕНИТЬ' },
        { key: 'link', label: 'ССЫЛКА', ...off(!link) },
      ]
    : [
        // Подарить можно, пока никто не подарил и владелец не получил; без API 2 — нельзя
        { key: 'gift', label: 'ПОДАРЮ', primary: true, ...off(!env.gifts || !!wish.giftedBy || !!wish.receivedAt) },
        { key: 'link', label: 'ССЫЛКА', ...off(!link) },
        { key: 'toTask', label: 'В ДЕЛА' },
      ];
  return {
    kind: 'wish',
    wish,
    own,
    link,
    sheet: {
      card: {
        title: wish.title,
        tag: link ? linkDomain(link) : undefined,
        meta: `${nameOf(s, wish.ownerId)} · ДОБАВЛЕНО ${added(wish.createdAt)}`,
        colors: [colorOf(colors, wish.ownerId)],
      },
      tiles,
      deletable: own,
    },
  };
};

export type QuickWatchView = { kind: 'watch'; sheet: QuickSheetData; item: WatchItem };

export const quickWatchView = (s: QuickSnapshot, colors: ColorMap, target: { id: ID }): QuickWatchView | null => {
  const item = s.watch.find((w) => w.id === target.id);
  if (!item) return null;
  const tag = [item.kind ? upper(KIND_LABEL[item.kind]) : '', item.year ? String(item.year) : ''].filter(Boolean).join(' · ');
  const genres = item.genres.map((g) => upper(GENRE_LABEL[g])).join(', ');
  const meta = [nameOf(s, item.addedBy), genres, item.origin ? upper(ORIGIN_LABEL[item.origin]) : ''].filter(Boolean).join(' · ');
  return {
    kind: 'watch',
    item,
    sheet: {
      card: { title: item.title, tag: tag || undefined, meta, colors: [colorOf(colors, item.addedBy)] },
      tiles: [
        { key: 'watched', label: item.watchedAt ? 'ВЕРНУТЬ' : 'ПОСМОТРЕЛИ', primary: true },
        { key: 'edit', label: 'ИЗМЕНИТЬ' },
        { key: 'toTask', label: 'В ДЕЛА' },
      ],
      deletable: true,
    },
  };
};

/** Когда в теме что-то было: последняя идея, иначе создание темы */
const lastActivity = (t: Topic, ideas: readonly Idea[]) =>
  ideas.reduce((m, i) => (i.topicId === t.id && i.createdAt > m ? i.createdAt : m), t.createdAt);

/**
 * Список «В ТЕМУ»: все мои темы (не в архиве), кроме текущей, свежие первыми, и «БЕЗ ТЕМЫ», если идея в теме
 */
export const topicSegments = (s: Pick<QuickSnapshot, 'me' | 'topics' | 'ideas'>, idea: Pick<Idea, 'topicId'>): QuickSegment[] => {
  const inbox: QuickSegment[] = idea.topicId ? [{ key: NO_TOPIC, label: 'БЕЗ ТЕМЫ' }] : [];
  const topics = s.topics
    .filter((t) => t.ownerId === s.me.id && !t.archivedAt && t.id !== idea.topicId)
    .map((t) => ({ t, at: lastActivity(t, s.ideas) }))
    .sort((a, b) => b.at.localeCompare(a.at))
    .map(({ t }) => ({ key: t.id, label: upper(t.title) }));
  return [...topics, ...inbox];
};

export type QuickIdeaView = { kind: 'idea'; sheet: QuickSheetData; idea: Idea; own: boolean };

/** Чужая идея (из открытой мне темы) — только в дела и копией к себе */
export const quickIdeaView = (s: QuickSnapshot, colors: ColorMap, target: { id: ID }): QuickIdeaView | null => {
  const idea = s.ideas.find((x) => x.id === target.id);
  if (!idea) return null;
  const own = idea.ownerId === s.me.id;
  const topic = idea.topicId ? s.topics.find((t) => t.id === idea.topicId) : undefined;
  const segments = own ? topicSegments(s, idea) : [];
  return {
    kind: 'idea',
    idea,
    own,
    sheet: {
      card: {
        title: splitIdea(idea.text).title,
        tag: topic ? upper(topic.title) : 'БЕЗ ТЕМЫ',
        meta: `${nameOf(s, idea.ownerId)} · ${added(idea.createdAt)}`,
        colors: [colorOf(colors, idea.ownerId)],
      },
      tiles: [
        { key: 'edit', label: 'ИЗМЕНИТЬ', ...off(!own) },
        { key: 'toTask', label: 'В ДЕЛА', primary: true },
        { key: 'copy', label: 'КОПИЯ' },
      ],
      ...(segments.length ? { section: { label: 'В ТЕМУ', segments, dropdown: { current: topic ? upper(topic.title) : 'БЕЗ ТЕМЫ' } } } : null),
      deletable: own,
    },
  };
};
