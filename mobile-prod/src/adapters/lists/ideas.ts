/**
 * C-Ideas: блокнот тем. Темы — мои (свежие сверху), «Без темы», затем открытые мне чужие; в архиве (API 2) — отдельно,
 * последние убранные сверху. Вкладки людей: я и владельцы открытых мне тем.
 */
import { notePreview } from '@/lib/note';
import { INBOX, type ID, type Idea, type Topic } from '@/lib/types';
import type { ALL_IDEAS as SCREEN_ALL, ArchivedTopic, IdeaTopic, IdeasPerson, IdeasScreenProps } from '@/screens/lists/IdeasScreen';
import { MONTHS_SHORT, pad2, parts } from '@/screens/calendar/format';
import { colorOf, meBadge, peopleIds, userOf, type ColorMap } from '../common/people';
import { plural, relativeDay, upper } from '../common/ru';
import { dateOfStamp } from '../common/when';
import type { Clock, DataOf, Snapshot } from '../snapshot';

/** Вкладка «ВСЕ» — то же значение, что ALL_IDEAS экрана (из экрана адаптеру можно брать только типы) */
export const ALL_IDEAS: typeof SCREEN_ALL = 'all';

/** Выбранная вкладка (локально в контейнере) и свёрнутые разделы */
export type IdeasUi = { personId: ID; collapsed: readonly string[] };

export const IDEAS_SECTIONS = { topics: 'ideas.topics', archive: 'ideas.archive' } as const;

/** Идеи темы, новые сверху; INBOX — мои идеи без темы */
function ideasIn(ideas: readonly Idea[], topicId: ID, meId: ID): Idea[] {
  const list = topicId === INBOX ? ideas.filter((i) => i.ownerId === meId && !i.topicId) : ideas.filter((i) => i.topicId === topicId);
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Когда в теме что-то происходило: последняя идея, иначе создание темы (как lastActivity в lib/ideas.ts) */
const lastOf = (t: Pick<Topic, 'createdAt'>, list: readonly Idea[]) => list.reduce((m, i) => (i.createdAt > m ? i.createdAt : m), t.createdAt);

type Row = { topic: Topic; list: Idea[]; last: string };

export type IdeasSnapshot = Pick<Snapshot, 'me' | 'users' | 'groups' | 'topics' | 'ideas' | 'activity' | 'activitySeen'>;

export function ideasProps(s: IdeasSnapshot, colors: ColorMap, clock: Pick<Clock, 'today'>, ui: IdeasUi): DataOf<IdeasScreenProps> {
  const meId = s.me.id;
  const rows: Row[] = s.topics.map((topic) => {
    const list = ideasIn(s.ideas, topic.id, meId);
    return { topic, list, last: lastOf(topic, list) };
  });
  const fresh = (a: Row, b: Row) => b.last.localeCompare(a.last);

  // Вкладки: я, затем владельцы открытых мне тем — в порядке людей моих групп
  const owners = new Set(s.topics.map((t) => t.ownerId));
  const order = [...new Set([...peopleIds(s), ...owners])];
  const people: IdeasPerson[] = order.flatMap((id) => {
    if (id !== meId && !owners.has(id)) return [];
    const u = userOf(s, id);
    return u ? [{ id, label: id === meId ? 'Я' : upper(u.name), color: colorOf(colors, id) }] : [];
  });
  const selectedPersonId = ui.personId === ALL_IDEAS || people.some((p) => p.id === ui.personId) ? ui.personId : ALL_IDEAS;
  const shown = (ownerId: ID) => selectedPersonId === ALL_IDEAS || selectedPersonId === ownerId;

  const live = rows.filter((r) => !r.topic.archivedAt);
  const mine = live.filter((r) => r.topic.ownerId === meId).sort(fresh);
  const others = live.filter((r) => r.topic.ownerId !== meId).sort(fresh);
  const inbox = ideasIn(s.ideas, INBOX, meId);
  const [newest] = inbox;

  const row = ({ topic, list, last }: Row): IdeaTopic => ({
    id: topic.id,
    title: topic.title,
    updated: relativeDay(dateOfStamp(last), clock.today),
    // Тема — сама заметка: первая строка её текста, иначе — свежая заметка внутри
    last: notePreview(topic.body ?? '').title || notePreview(list[0]?.text ?? '').title || '—',
    count: pad2(list.length),
    ownerColor: colorOf(colors, topic.ownerId),
    shared: topic.groupIds.length > 0 || topic.ownerId !== meId,
  });

  const topics: IdeaTopic[] = [
    ...(shown(meId) ? mine.map(row) : []),
    ...(shown(meId) && newest
      ? [
          {
            id: INBOX,
            title: 'Без темы',
            updated: relativeDay(dateOfStamp(newest.createdAt), clock.today),
            last: notePreview(newest.text).title,
            count: pad2(inbox.length),
            ownerColor: null,
            shared: false,
          },
        ]
      : []),
    ...others.filter((r) => shown(r.topic.ownerId)).map(row),
  ];

  const archive: ArchivedTopic[] = rows
    .flatMap((r) => (r.topic.archivedAt && shown(r.topic.ownerId) ? [{ topic: r.topic, at: r.topic.archivedAt }] : []))
    .sort((a, b) => b.at.localeCompare(a.at))
    .map(({ topic, at }) => ({ id: topic.id, title: topic.title, month: MONTHS_SHORT[parts(dateOfStamp(at)).m - 1] ?? '' }));

  // Записей в блокноте — во всех темах не в архиве и без темы (не зависит от вкладки)
  const total = live.reduce((n, r) => n + r.list.length, 0) + inbox.length;
  return {
    caption: `БЛОКНОТ · ${total} ${plural(total, 'ЗАПИСЬ', 'ЗАПИСИ', 'ЗАПИСЕЙ')}`,
    me: meBadge(s, colors),
    hasNews: (s.activity[0]?.id ?? '') > s.activitySeen,
    people,
    selectedPersonId,
    topics,
    archive,
    topicsOpen: !ui.collapsed.includes(IDEAS_SECTIONS.topics),
    archiveOpen: !ui.collapsed.includes(IDEAS_SECTIONS.archive),
  };
}
