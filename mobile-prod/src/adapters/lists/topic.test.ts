import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { INBOX, type Idea, type Topic, type WatchItem, type Wish } from '@/lib/types';
import { snapshot } from '../common/fixture';
import { colorMap } from '../common/people';
import { candidateOptions, changesConfirm, draftHead, duplicates, ownTopics, savable } from './cardSheet';
import { topicProps } from './topic';

const at = (day: string) => `${day}T09:00:00.000Z`;
const TOPICS: Topic[] = [
  { id: 't1', ownerId: 's', title: 'Подарки', groupIds: ['g1'], createdAt: at('2026-08-01') },
  { id: 't2', ownerId: 'k', title: 'Куда поехать', groupIds: ['g1'], createdAt: at('2026-08-02') },
];
const idea = (id: string, ownerId: string, topicId: string | null, text: string, day: string): Idea => ({
  id,
  ownerId,
  topicId,
  text,
  createdAt: at(day),
  updatedAt: at(day),
});
const IDEAS: Idea[] = [
  idea('a', 's', 't1', 'Сертификат на керамику', '2026-09-28'),
  idea('b', 's', 't1', 'Шарф', '2026-10-02'),
  idea('c', 'k', 't2', 'Алтай', '2026-10-03'),
  idea('d', 's', null, 'Позвонить в сервис', '2026-10-05'),
  idea('e', 'k', null, 'Чужая без темы', '2026-10-05'),
];
const WISH: Wish = { id: 'w1', ownerId: 's', title: 'Наушники', note: '', link: '', receivedAt: null, createdAt: at('2026-09-28') };
const WATCH: WatchItem = {
  id: 'm1',
  groupId: 'g1',
  title: 'Дюна',
  kind: 'movie',
  genres: [],
  origin: null,
  year: null,
  addedBy: 'k',
  watchedAt: null,
  createdAt: at('2026-09-30'),
};

const s = snapshot({ topics: TOPICS, ideas: IDEAS, wishes: [WISH], watch: [WATCH] });
const colors = colorMap(s);

describe('topicProps (тема идей)', () => {
  test('своя тема: идеи новыми сверху, открыта группе, цвет владельца', () => {
    const got = topicProps(s, colors, 't1');
    assert.equal(got.caption, 'ТЕМА');
    assert.equal(got.title, 'Подарки');
    assert.equal(got.color, 'blue');
    assert.equal(got.shared, true);
    assert.equal(got.own, true);
    assert.deepEqual(got.ideas, [
      { id: 'b', title: 'Шарф', line: '', checks: null, date: '2 ОКТ' },
      { id: 'a', title: 'Сертификат на керамику', line: '', checks: null, date: '28 СЕН' },
    ]);
  });

  test('чужая тема: имя владельца в подписи, кнопки «открыть группам» нет', () => {
    const got = topicProps(s, colors, 't2');
    assert.equal(got.caption, 'ТЕМА · КАРИНА');
    assert.equal(got.shared, null);
    assert.equal(got.own, false);
    assert.deepEqual(got.ideas.map((i) => i.id), ['c']);
  });

  test('«Без темы» — только мои идеи без темы, полоса нейтральная', () => {
    const got = topicProps(s, colors, INBOX);
    assert.deepEqual([got.caption, got.title, got.color, got.shared, got.own], ['ЗАМЕТКИ', 'Без темы', null, null, true]);
    assert.deepEqual(got.ideas.map((i) => i.id), ['d']);
  });

  test('темы нет — пусто', () => {
    const got = topicProps(s, colors, 'gone');
    assert.deepEqual([got.caption, got.exists, got.ideas.length], ['ТЕМЫ НЕТ', false, 0]);
  });
});

describe('cardSheet (окно записей)', () => {
  test('карточка: новая — имя автора, своя — «ДОБАВИЛИ ВЫ», чужая — «ДОБАВИЛА КАРИНА», идея — «ЗАПИСАНО»', () => {
    assert.deepEqual(draftHead({ key: 'n', type: 'wish', data: { title: '', note: '', link: '' } }, s, colors), {
      tag: 'ХОЧУ',
      colors: ['blue'],
      meta: 'САНЯ',
    });
    assert.equal(draftHead({ key: 'w1', id: 'w1', type: 'wish', data: { title: 'Наушники', note: '', link: '' } }, s, colors).meta, 'ДОБАВИЛИ ВЫ · 28 СЕН');
    const watch = draftHead({ key: 'm1', id: 'm1', type: 'watch', data: { title: 'Дюна', kind: 'movie', genres: [], origin: null, year: null } }, s, colors);
    assert.deepEqual([watch.tag, watch.meta, watch.colors], ['СМОТРЕТЬ', 'ДОБАВИЛА КАРИНА · 30 СЕН', ['pink']]);
    assert.equal(draftHead({ key: 'a', id: 'a', type: 'idea', data: { title: 'x', topicId: 't1', newTopic: null } }, s, colors).meta, 'ЗАПИСАНО 28 СЕН');
    assert.equal(draftHead({ key: 't1', id: 't1', type: 'topic', data: { title: 'Подарки' } }, s, colors).meta, undefined);
  });

  test('темы для идеи — только свои', () => {
    assert.deepEqual(ownTopics(s), [{ id: 't1', title: 'Подарки' }]);
  });

  test('повторы: уже есть и внутри ответа; «всё равно» снимает блокировку', () => {
    const items = [
      { key: '1', type: 'wish' as const, data: { title: 'наушники', note: '', link: '' } },
      { key: '2', type: 'watch' as const, data: { title: 'Онегин', kind: null, genres: [], origin: null, year: null } },
      { key: '3', type: 'watch' as const, data: { title: 'Онегин', kind: null, genres: [], origin: null, year: null } },
    ];
    const dups = duplicates(items, s);
    assert.deepEqual([...dups.keys()], ['1', '3']);
    assert.deepEqual(savable(items, dups).save.map((i) => i.key), ['2']);
    const forced = items.map((i) => (i.key === '1' ? { ...i, force: true } : i));
    assert.deepEqual(savable(forced, dups).save.map((i) => i.key), ['1', '2']);
    assert.equal(savable([{ key: 'x', type: 'topic', data: { title: ' ' } }], new Map()).ok, false);
  });

  test('правки: выбор записи и главная кнопка', () => {
    const del = { key: 'c1', action: 'delete' as const, type: 'watch' as const, candidates: ['m1'], chosen: 'm1' };
    assert.deepEqual(changesConfirm([del]), { label: 'УДАЛИТЬ', danger: true });
    assert.deepEqual(changesConfirm([del, { ...del, action: 'mark' as const }]), { label: 'ПРИМЕНИТЬ', danger: false });
    assert.deepEqual(candidateOptions(del, s), []);
    const two = { key: 'c2', action: 'mark' as const, type: 'task' as const, candidates: s.tasks.slice(0, 2).map((t) => t.id), chosen: s.tasks[1]?.id ?? '' };
    const opts = candidateOptions(two, s);
    assert.equal(opts.length, 2);
    assert.deepEqual(opts.map((o) => o.selected), [false, true]);
  });
});
