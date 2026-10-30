/**
 * Идеи: порядок тем, правка идеи и меню темы. Действия с идеей (в дела, копия, в тему, удалить) — окно быстрых
 * действий по удержанию (src/containers/quick).
 */
import { openConfirm, openMenu } from '@/components/ActionMenu';
import { toTab } from '@/containers/common/go';
import { DEMO, useStore } from './store';
import { INBOX, type ID, type Idea, type Topic } from './types';

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

/** Правка своей идеи: текст и тема */
export function editIdea(idea: Idea) {
  useStore.getState().setCard({
    source: 'edit',
    editing: true,
    items: [{ key: idea.id, id: idea.id, type: 'idea', data: { title: idea.text, topicId: idea.topicId, newTopic: null } }],
  });
}

/**
 * Удалить темы. Внутри есть заметки — сначала вопрос: они удалятся тоже («ОТМЕНА» или «УДАЛИТЬ ВСЁ»).
 * onDone — после удаления (уйти с экрана темы, выйти из выбора)
 */
export function deleteTopicsAsk(ids: readonly ID[], onDone?: () => void) {
  const s = useStore.getState();
  const topics = s.topics.filter((t) => ids.includes(t.id));
  if (!topics.length) return;
  const inside = s.ideas.filter((i) => !!i.topicId && ids.includes(i.topicId)).length;
  const run = () => {
    useStore.getState().deleteTopics(topics.map((t) => t.id));
    onDone?.();
  };
  if (!inside) return run();
  const what = topics.length === 1 ? `тему «${topics[0]!.title}»` : `темы (${topics.length})`;
  // Окно меню только что закрылось — новое открываем следом
  setTimeout(() => openConfirm({ title: `Удалить ${what}? Заметки внутри тоже удалятся: ${inside}`, action: 'Удалить всё', onConfirm: run }), 250);
}

/** Меню своей темы (название правится прямо в заголовке темы): открыть группам, выбрать заметки, в архив (сервер API 2), удалить */
export function topicMenu(t: Topic, onShare: () => void, onSelect?: () => void) {
  const s = useStore.getState();
  const archive = DEMO || (s.serverApi ?? 0) >= 2;
  openMenu({
    title: t.title,
    actions: [
      { label: 'Открыть группам', onPress: () => setTimeout(onShare, 250) },
      ...(onSelect ? [{ label: 'Выбрать заметки', onPress: onSelect }] : []),
      ...(archive ? [{ label: t.archivedAt ? 'Вернуть из архива' : 'В архив', onPress: () => s.archiveTopic(t.id, !t.archivedAt) }] : []),
      {
        label: 'Удалить тему',
        danger: true,
        onPress: () => deleteTopicsAsk([t.id], () => toTab('ideas')),
      },
    ],
  });
}

