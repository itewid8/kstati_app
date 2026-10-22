/**
 * Данные макета C-Watch (design/mockups/C-Watch.dc.html).
 * Светлый макет: обе секции открыты; тёмный: «Посмотрели» свёрнуто.
 */
import type { Scheme } from '@/ui';
import type { WatchItem, WatchScreenProps, WatchedItem } from '../../lists/WatchScreen';

export const watchQueue: WatchItem[] = [
  { id: 'm1', title: 'Дюна: часть вторая', meta: 'ФИЛЬМ · ФАНТАСТИКА · ЗАРУБЕЖНОЕ', year: '2024', addedByColor: 'blue' },
  { id: 'm2', title: 'Разделение', meta: 'СЕРИАЛ · ТРИЛЛЕР · ЗАРУБЕЖНОЕ', year: '2022', addedByColor: 'pink' },
  { id: 'm3', title: 'Слово пацана', meta: 'СЕРИАЛ · ДРАМА · НАШЕ', year: '2023', addedByColor: 'pink' },
  { id: 'm4', title: 'Брат', meta: 'ФИЛЬМ · КРИМИНАЛ · НАШЕ', year: '1997', addedByColor: 'blue' },
  { id: 'm5', title: 'Шрэк', meta: 'МУЛЬТФИЛЬМ · КОМЕДИЯ', year: '2001', addedByColor: 'pink' },
  { id: 'm6', title: 'Бесславные ублюдки', meta: 'ФИЛЬМ · ВОЕННЫЙ · ЗАРУБЕЖНОЕ', year: '2009', addedByColor: 'blue' },
];

export const watchedItems: WatchedItem[] = [
  { id: 'd1', title: 'Оппенгеймер', date: '28 СЕН' },
  { id: 'd2', title: 'Настоящий детектив, 1 сезон', date: '21 СЕН' },
  { id: 'd3', title: 'Бесконечность', date: '14 СЕН' },
];

export function watchFixture(scheme: Scheme): WatchScreenProps {
  return {
    groupLabel: 'МЫ С КАРИНОЙ',
    me: { letter: 'С', color: 'blue' },
    filter: 'all',
    queue: watchQueue,
    watched: watchedItems,
    watchedCount: 14,
    queueOpen: true,
    watchedOpen: scheme === 'light',
  };
}
