import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyFilters, type WatchItem } from '@/lib/types';
import { watchFixture } from '@/screens/fixtures/lists/watch';
import { CLOCK, snapshot } from '../common/fixture';
import { colorMap } from '../common/people';
import { hasExtraFilters, kindsOf, segmentOf, watchMeta, watchProps } from './watch';

let n = 0;
const item = (title: string, extra: Partial<WatchItem>): WatchItem => ({
  id: `m${++n}`,
  groupId: 'g1',
  title,
  kind: null,
  genres: [],
  origin: null,
  year: null,
  addedBy: 's',
  watchedAt: null,
  // Новые сверху: каждая следующая запись добавлена раньше
  createdAt: `2026-09-${String(30 - n).padStart(2, '0')}T10:00:00.000Z`,
  ...extra,
});

/** Очередь и «Посмотрели» макета C-Watch. Жанров «криминал» и «военный» в приложении нет — заменены */
const WATCH: WatchItem[] = [
  item('Дюна: часть вторая', { kind: 'movie', genres: ['scifi'], origin: 'foreign', year: 2024 }),
  item('Разделение', { kind: 'series', genres: ['thriller'], origin: 'foreign', year: 2022, addedBy: 'k' }),
  item('Слово пацана', { kind: 'series', genres: ['drama'], origin: 'ru', year: 2023, addedBy: 'k' }),
  item('Брат', { kind: 'movie', genres: ['detective'], origin: 'ru', year: 1997 }),
  item('Шрэк', { kind: 'cartoon', genres: ['comedy'], year: 2001, addedBy: 'k' }),
  item('Бесславные ублюдки', { kind: 'movie', genres: ['action'], origin: 'foreign', year: 2009 }),
  item('Оппенгеймер', { kind: 'movie', watchedAt: '2026-09-28T19:00:00.000Z' }),
  item('Настоящий детектив, 1 сезон', { kind: 'series', watchedAt: '2026-09-21T19:00:00.000Z' }),
  item('Бесконечность', { kind: 'movie', watchedAt: '2026-09-14T19:00:00.000Z' }),
  item('Чужая группа', { groupId: 'g2' }),
];

const s = snapshot({ watch: WATCH });
const colors = colorMap(s);

describe('watchProps (C-Watch)', () => {
  test('совпадает с макетом, кроме id и жанров, которых нет в приложении', () => {
    const fx = watchFixture('light');
    const got = watchProps(s, colors, CLOCK, { filters: emptyFilters, collapsed: [] });
    assert.equal(got.groupLabel, fx.groupLabel);
    assert.deepEqual(got.me, fx.me);
    assert.equal(got.filter, 'all');
    const CHANGED = new Set(['Брат', 'Бесславные ублюдки']);
    assert.deepEqual(
      got.queue.map((q) => [q.title, CHANGED.has(q.title) ? '' : q.meta, q.year, q.addedByColor]),
      fx.queue.map((q) => [q.title, CHANGED.has(q.title) ? '' : q.meta, q.year, q.addedByColor]),
    );
    assert.equal(watchMeta({ kind: 'movie', genres: ['detective'], origin: 'ru' }), 'ФИЛЬМ · ДЕТЕКТИВ · НАШЕ');
    assert.deepEqual(got.watched.map(({ id: _, ...w }) => w), fx.watched.map(({ id: _, ...w }) => w));
    assert.deepEqual([got.queueOpen, got.watchedOpen], [true, true]);
    assert.equal(watchProps(s, colors, CLOCK, { filters: emptyFilters, collapsed: ['watch.watched'] }).watchedOpen, watchFixture('dark').watchedOpen);
  });

  test('сегменты ФИЛЬМЫ / СЕРИАЛЫ = фильтр типа, действуют и на «Посмотрели»', () => {
    const movies = watchProps(s, colors, CLOCK, { filters: { ...emptyFilters, kind: kindsOf('movies') }, collapsed: [] });
    assert.equal(movies.filter, 'movies');
    assert.deepEqual(movies.queue.map((q) => q.title), ['Дюна: часть вторая', 'Брат', 'Бесславные ублюдки']);
    assert.deepEqual(movies.watched.map((q) => q.title), ['Оппенгеймер', 'Бесконечность']);
    const series = watchProps(s, colors, CLOCK, { filters: { ...emptyFilters, kind: ['series'], origin: ['ru'] }, collapsed: [] });
    assert.equal(series.filter, 'series');
    assert.deepEqual(series.queue.map((q) => q.title), ['Слово пацана']);
  });

  test('segmentOf / kindsOf / hasExtraFilters', () => {
    assert.equal(segmentOf([]), 'all');
    assert.equal(segmentOf(['movie', 'series']), 'all');
    assert.equal(segmentOf(['cartoon']), 'all');
    assert.deepEqual(kindsOf('all'), []);
    assert.equal(hasExtraFilters(emptyFilters), false);
    assert.equal(hasExtraFilters({ ...emptyFilters, kind: ['movie'] }), false);
    assert.equal(hasExtraFilters({ ...emptyFilters, kind: ['cartoon'] }), true);
    assert.equal(hasExtraFilters({ ...emptyFilters, fresh: ['new'] }), true);
  });

  test('«новое» — этого и прошлого года', () => {
    // В макете самое новое — 2024: при сегодня 2026 «новых» нет
    assert.deepEqual(watchProps(s, colors, CLOCK, { filters: { ...emptyFilters, fresh: ['new'] }, collapsed: [] }).queue, []);
    const old = watchProps(snapshot({ watch: [item('A', { year: 2025 }), item('B', { year: 2024 })] }), colors, CLOCK, {
      filters: { ...emptyFilters, fresh: ['new'] },
      collapsed: [],
    });
    assert.deepEqual(old.queue.map((q) => q.title), ['A']);
  });
});
