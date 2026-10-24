/**
 * Тема идей (экран темы, src/screens/sheets/TopicScreen): подпись, заголовок, цвет владельца, идеи новыми сверху.
 * «Без темы» (INBOX) — мои идеи без темы. Своя тема — можно добавлять, править, удалять, открывать группам.
 */
import { INBOX, type ID } from '@/lib/types';
import type { TopicScreenProps } from '@/screens/sheets/TopicScreen';
import type { DataOf, Snapshot } from '../snapshot';
import { colorOf, userOf, type ColorMap } from '../common/people';
import { upper } from '../common/ru';
import { dateOfStamp, dayMonthShort } from '../common/when';

export type TopicData = Omit<DataOf<TopicScreenProps>, 'Scroll'> & {
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
  const caption = inbox ? 'ИДЕИ' : !topic ? 'ТЕМЫ НЕТ' : owner ? `ТЕМА · ${upper(owner.name)}` : 'ТЕМА';
  return {
    caption,
    title: inbox ? 'Без темы' : (topic?.title ?? 'Тема'),
    color: topic ? colorOf(colors, topic.ownerId) : null,
    shared: topic && own ? topic.groupIds.length > 0 : null,
    ideas: list.map((i) => ({ id: i.id, text: i.text, date: dayMonthShort(dateOfStamp(i.createdAt)) })),
    own,
    exists,
  };
}
