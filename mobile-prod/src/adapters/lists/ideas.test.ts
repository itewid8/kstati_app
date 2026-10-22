import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { INBOX, type Idea, type Topic } from '@/lib/types';
import { ideasFixture } from '@/screens/fixtures/lists/ideas';
import { CLOCK, snapshot } from '../common/fixture';
import { colorMap } from '../common/people';
import { ALL_IDEAS, ideasProps } from './ideas';

const topic = (id: string, ownerId: string, title: string, extra: Partial<Topic> = {}): Topic => ({
  id,
  ownerId,
  title,
  groupIds: [],
  createdAt: '2026-08-01T09:00:00.000Z',
  ...extra,
});

/** n идей темы: последняя — text в день day, остальные раньше */
function ideas(topicId: string | null, ownerId: string, n: number, text: string, day: string): Idea[] {
  return Array.from({ length: n }, (_, i) => {
    const at = i === 0 ? `${day}T09:00:00.000Z` : `2026-08-${String(10 + i).padStart(2, '0')}T09:00:00.000Z`;
    return { id: `${topicId ?? 'inbox'}-${i}`, ownerId, topicId, text: i === 0 ? text : `Идея ${i}`, createdAt: at, updatedAt: at };
  });
}

/** Данные макета C-Ideas: мои темы, «Без темы», тема Карины, открытая группе, и архив */
const TOPICS: Topic[] = [
  topic('i1', 's', 'Идеи для приложения', { groupIds: ['g1'] }),
  topic('i2', 's', 'Подарки'),
  topic('i3', 's', 'Поздравления'),
  topic('i5', 'k', 'Куда поехать летом', { groupIds: ['g1'] }),
  topic('a1', 's', 'Свадьба Ани: что подарить', { archivedAt: '2026-09-20T09:00:00.000Z' }),
  topic('a2', 's', 'Ремонт в ванной', { archivedAt: '2026-08-20T09:00:00.000Z' }),
  topic('a3', 's', 'Отпуск в Грузии', { archivedAt: '2026-07-20T09:00:00.000Z' }),
];
const IDEAS: Idea[] = [
  ...ideas('i1', 's', 12, 'В виджете показывать погоду на выходные', '2026-10-04'),
  ...ideas('i2', 's', 5, 'Лене — сертификат на мастер-класс по керамике', '2026-10-02'),
  ...ideas('i3', 's', 4, 'Маме: стих про осень и дачу', '2026-09-28'),
  ...ideas(null, 's', 3, 'Позвонить в автосервис насчёт резины', '2026-10-05'),
  ...ideas('i5', 'k', 7, 'Алтай, Чуйский тракт — 10 дней на машине', '2026-10-03'),
  // Идеи тем в архиве в «31 запись» не входят
  ...ideas('a1', 's', 2, 'Сервиз', '2026-09-10'),
];

const s = snapshot({ topics: TOPICS, ideas: IDEAS });
const colors = colorMap(s);

describe('ideasProps (C-Ideas)', () => {
  test('совпадает с макетом: темы, «Без темы» серой полосой, архив отдельно', () => {
    const fx = ideasFixture('light');
    const got = ideasProps(s, colors, CLOCK, { personId: ALL_IDEAS, collapsed: [] });
    assert.equal(got.caption, fx.caption);
    assert.deepEqual(got.me, fx.me);
    assert.deepEqual(got.people.map(({ id: _, ...p }) => p), fx.people.map(({ id: _, ...p }) => p));
    assert.equal(got.selectedPersonId, fx.selectedPersonId);
    assert.deepEqual(got.topics.map(({ id: _, ...t }) => t), fx.topics.map(({ id: _, ...t }) => t));
    assert.equal(got.topics[3]?.id, INBOX);
    assert.deepEqual(got.archive.map(({ id: _, ...a }) => a), fx.archive.map(({ id: _, ...a }) => a));
    assert.deepEqual([got.topicsOpen, got.archiveOpen], [fx.topicsOpen, fx.archiveOpen]);
    assert.equal(ideasProps(s, colors, CLOCK, { personId: ALL_IDEAS, collapsed: ['ideas.archive'] }).archiveOpen, ideasFixture('dark').archiveOpen);
  });

  test('вкладки людей: я — мои темы и «Без темы», Карина — её темы; подпись блокнота не меняется', () => {
    const mine = ideasProps(s, colors, CLOCK, { personId: 's', collapsed: [] });
    assert.deepEqual(mine.topics.map((t) => t.id), ['i1', 'i2', 'i3', INBOX]);
    assert.equal(mine.archive.length, 3);
    const karina = ideasProps(s, colors, CLOCK, { personId: 'k', collapsed: [] });
    assert.deepEqual(karina.topics.map((t) => t.id), ['i5']);
    assert.deepEqual(karina.archive, []);
    assert.equal(karina.caption, 'БЛОКНОТ · 31 ЗАПИСЬ');
    // Человека больше нет во вкладках — снова ВСЕ
    assert.equal(ideasProps(s, colors, CLOCK, { personId: 'o', collapsed: [] }).selectedPersonId, ALL_IDEAS);
  });

  test('тема без идей — время создания и «—»; без идей без темы строки «Без темы» нет', () => {
    const got = ideasProps(snapshot({ topics: [topic('e', 's', 'Пусто', { createdAt: '2026-10-04T09:00:00.000Z' })], ideas: [] }), colors, CLOCK, {
      personId: ALL_IDEAS,
      collapsed: [],
    });
    assert.deepEqual(got.topics.map((t) => [t.id, t.updated, t.last, t.count]), [['e', 'ВЧЕРА', '—', '00']]);
    assert.equal(got.caption, 'БЛОКНОТ · 0 ЗАПИСЕЙ');
    assert.deepEqual(got.people.map((p) => p.label), ['Я']);
  });
});
