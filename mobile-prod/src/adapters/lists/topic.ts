/**
 * Тема заметок (экран темы, src/screens/sheets/TopicScreen, макет C-Topic): подпись, заголовок, цвет владельца,
 * заметки новыми сверху — первая строка, вторая и счёт чек-листа. «Без темы» (INBOX) — мои заметки без темы. Своя тема — можно добавлять, править, удалять, открывать группам.
 */
import { notePreview } from '@/lib/note';
import { INBOX, type ID } from '@/lib/types';
import type { TopicScreenProps } from '@/screens/sheets/TopicScreen';
import type { DataOf, Snapshot } from '../snapshot';
import { colorOf, userOf, type ColorMap } from '../common/people';
import { upper } from '../common/ru';
import { dateOfStamp, dayMonthShort } from '../common/when';

export type TopicData = Omit<DataOf<TopicScreenProps>, 'Scroll' | 'body' | 'focusTitle'> & {
  /** Текст самой темы (строки заметки); null — «Без темы», текста нет */
  bodyText: string | null;
  /** Своя тема или «Без темы»: добавление, правка, удаление */
  own: boolean;
  /** Темы нет (удалили) — только «назад» */
  exists: boolean;
};

export type TopicSnapshot = Pick<Snapshot, 'me' | 'users' | 'topics' | 'ideas'>;

export function topicProps(s: TopicSnapshot, colors: ColorMap, id: ID): TopicData {
  const inbox = id === INBOX;
  const topic = inbox ? undefined : s.topics.find((t) => t.id === id);
  const exists = inbox || !!topic;
  const own = inbox || topic?.ownerId === s.me.id;
  const list = (inbox ? s.ideas.filter((i) => i.ownerId === s.me.id && !i.topicId) : topic ? s.ideas.filter((i) => i.topicId === id) : [])
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const owner = topic && !own ? userOf(s, topic.ownerId) : undefined;
  const caption = inbox ? 'ЗАМЕТКИ' : !topic ? 'ТЕМЫ НЕТ' : owner ? `ТЕМА · ${upper(owner.name)}` : 'ТЕМА';
  return {
    caption,
    title: inbox ? 'Без темы' : (topic?.title ?? 'Тема'),
    color: topic ? colorOf(colors, topic.ownerId) : null,
    shared: topic && own ? topic.groupIds.length > 0 : null,
    bodyText: inbox ? null : (topic?.body ?? ''),
    ideas: list.map((i) => {
      const p = notePreview(i.text);
      return { id: i.id, title: p.title, line: p.line, checks: p.checks, date: dayMonthShort(dateOfStamp(i.createdAt)) };
    }),
    own,
    exists,
  };
}
