/**
 * Идеи: порядок тем, подписи и превращение идеи в дело, хотелку или фильм.
 * Превращение — это копия: идея остаётся на месте и никак не связана с новой записью.
 */
import { router } from 'expo-router';
import { openMenu } from '@/components/ActionMenu';
import { uid } from './ids';
import { useStore } from './store';
import { INBOX, type DraftItem, type ID, type Idea, type Topic } from './types';

/** Когда в теме что-то происходило: последняя идея, иначе создание темы */
export function lastActivity(t: Topic, ideas: Idea[]): string {
  return ideas.reduce((m, i) => (i.topicId === t.id && i.createdAt > m ? i.createdAt : m), t.createdAt);
}

/** Темы — свежие сверху */
export function sortTopics(topics: Topic[], ideas: Idea[]): Topic[] {
  return [...topics].sort((a, b) => lastActivity(b, ideas).localeCompare(lastActivity(a, ideas)));
}

/** Идеи темы (или «Без темы» — мои идеи без темы), новые сверху */
export function ideasOf(ideas: Idea[], topicId: ID, meId: ID): Idea[] {
  const list = topicId === INBOX ? ideas.filter((i) => i.ownerId === meId && !i.topicId) : ideas.filter((i) => i.topicId === topicId);
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Первая фраза — в название (до 120 знаков), весь текст — в описание, если он длиннее */
function split(text: string): { title: string; note: string } {
  const t = text.trim();
  const m = t.match(/[.!?…](\s|$)|\n/);
  let first = m && m.index !== undefined ? t.slice(0, m.index + (m[0].startsWith('\n') ? 0 : 1)) : t;
  first = first.replace(/[.]$/, '').trim();
  if (first.length > 120) first = `${first.slice(0, 117).trimEnd()}…`;
  const rest = t.replace(/[.]$/, '').trim();
  return { title: first, note: rest !== first ? t : '' };
}

/** Открыть карточку новой записи из идеи — человек поправит и сохранит */
export function ideaTo(kind: 'task' | 'wish' | 'watch', idea: Idea) {
  const { title, note } = split(idea.text);
  const item: DraftItem =
    kind === 'task'
      ? { key: uid(), type: 'task', data: { title, date: null, time: null, note } }
      : kind === 'wish'
        ? { key: uid(), type: 'wish', data: { title, note, link: '' } }
        : { key: uid(), type: 'watch', data: { title, kind: null, genres: [], origin: null, year: null } };
  useStore.getState().setCard({ source: 'manual', items: [item], editing: true });
}

/** Правка своей идеи: текст и тема */
export function editIdea(idea: Idea) {
  useStore.getState().setCard({
    source: 'edit',
    editing: true,
    items: [{ key: idea.id, id: idea.id, type: 'idea', data: { title: idea.text, topicId: idea.topicId, newTopic: null } }],
  });
}

/** Перенести идею: список моих тем, «Без темы» и новая тема */
export function moveIdea(idea: Idea) {
  const s = useStore.getState();
  const mine = sortTopics(
    s.topics.filter((t) => t.ownerId === s.me?.id && t.id !== idea.topicId),
    s.ideas,
  );
  const to = (topicId: ID | null) => s.saveItems([{ key: idea.id, id: idea.id, type: 'idea', data: { title: idea.text, topicId, newTopic: null } }]);
  openMenu({
    title: 'Перенести в тему',
    actions: [
      ...(idea.topicId ? [{ label: 'Без темы', onPress: () => to(null) }] : []),
      ...mine.map((t) => ({ label: t.title, onPress: () => to(t.id) })),
      {
        label: 'Новая тема',
        onPress: () =>
          s.setCard({
            source: 'edit',
            editing: true,
            items: [{ key: idea.id, id: idea.id, type: 'idea', data: { title: idea.text, topicId: null, newTopic: '' } }],
          }),
      },
    ],
  });
}

/** Меню идеи по долгому нажатию. Чужую идею (из открытой мне темы) можно только скопировать в свои списки */
export function ideaMenu(idea: Idea, own: boolean) {
  const s = useStore.getState();
  const preview = idea.text.length > 80 ? `${idea.text.slice(0, 80)}…` : idea.text;
  openMenu({
    title: preview,
    actions: [
      ...(own ? [{ label: 'Изменить', onPress: () => editIdea(idea) }, { label: 'Перенести в тему', onPress: () => setTimeout(() => moveIdea(idea), 250) }] : []),
      { label: 'Сделать делом', onPress: () => ideaTo('task', idea) },
      { label: 'В «Хочу»', onPress: () => ideaTo('wish', idea) },
      { label: 'В «Смотреть»', onPress: () => ideaTo('watch', idea) },
      ...(own ? [{ label: 'Удалить', danger: true, onPress: () => s.deleteIdea(idea.id) }] : []),
    ],
  });
}

/** Меню своей темы: переименовать, открыть группам, удалить */
export function topicMenu(t: Topic, onShare: () => void) {
  const s = useStore.getState();
  openMenu({
    title: t.title,
    actions: [
      { label: 'Переименовать', onPress: () => s.setCard({ source: 'edit', editing: true, items: [{ key: t.id, id: t.id, type: 'topic', data: { title: t.title } }] }) },
      { label: 'Открыть группам', onPress: () => setTimeout(onShare, 250) },
      {
        label: 'Удалить тему',
        danger: true,
        onPress: () => {
          s.deleteTopic(t.id);
          router.navigate('/ideas');
        },
      },
    ],
  });
}
