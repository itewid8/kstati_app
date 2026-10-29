/**
 * C-Voice: поля распознанной записи только для просмотра — ТИП, ЧТО, КОГДА, ПОВТОР, КТО, ГРУППА, НАПОМНИТЬ.
 * У каждого типа — только его поля.
 */
import { effectiveSpecs } from '@/lib/remind';
import { INBOX, KIND_LABEL, type DraftItem, type ID, type TaskDraft } from '@/lib/types';
import type { RecognizedField } from '@/screens/voice/VoiceCreateSheet';
import type { VoicePerson } from '@/screens/voice/types';
import type { Snapshot } from '../snapshot';
import { colorMap, voicePerson } from '../common/people';
import { upper } from '../common/ru';
import { clip, orderPeople, periodText, remindText, repeatTag } from './labels';

const TYPE_LABEL: Record<DraftItem['type'], string> = {
  task: 'ДЕЛО',
  wish: 'ХОЧУ',
  watch: 'СМОТРЕТЬ',
  idea: 'ЗАМЕТКА',
  topic: 'ТЕМА',
};

/** Пункты текста темы одной строкой: «МОЛОКО, ЯЙЦА, ХЛЕБ» */
const listLine = (body: string) =>
  body
    .split('\n')
    .map((l) => l.replace(/^(?:[-*] \[[ xX]\] ?|[-*•] |\d{1,3}[.)] |#+ )/, '').trim())
    .filter(Boolean)
    .join(', ');

const text = (key: string, label: string, value: string): RecognizedField => ({ key, label, kind: 'text', value });

/** Домен ссылки: «ozon.ru» */
function domainOf(link: string): string {
  const m = /^(?:[a-z]+:\/\/)?(?:www\.)?([^/?#\s]+)/i.exec(link.trim());
  return m?.[1] ?? link.trim();
}

function taskFields(data: TaskDraft, s: Snapshot): RecognizedField[] {
  const colors = colorMap(s);
  const ids = data.people?.length ? data.people : [s.me.id];
  const people = orderPeople(s, ids).flatMap((id): VoicePerson[] => {
    const p = voicePerson(s, colors, id);
    return p ? [p] : [];
  });
  // Подзадача ляжет в группу своего плана (saveItems), остальное — в текущую
  const parent = data.parentId ? s.tasks.find((t) => t.id === data.parentId && !t.parentId) : undefined;
  const groupId: ID | null = parent?.groupId ?? s.currentGroupId;
  const group = s.groups.find((g) => g.id === groupId);
  const timing = { date: data.date, time: data.time, endDate: data.endDate ?? null, endTime: data.endTime ?? null };
  const repeat = data.date ? repeatTag(data.repeat, data.date) : undefined;
  const out: RecognizedField[] = [
    { key: 'title', label: 'ЧТО', kind: 'title', value: data.title },
    text('when', 'КОГДА', periodText(timing)),
  ];
  if (repeat) out.push(text('repeat', 'ПОВТОР', repeat));
  if (people.length) out.push({ key: 'who', label: 'КТО', kind: 'people', people });
  if (parent) out.push(text('plan', 'ПЛАН', clip(upper(parent.title), 28)));
  if (group) out.push(text('group', 'ГРУППА', upper(group.name)));
  // Без даты напоминать не о чем
  if (data.date) {
    const { specs } = effectiveSpecs({ time: data.time, reminders: data.shared ?? null }, data.mine, s.reminders);
    out.push(text('remind', 'НАПОМНИТЬ', s.reminders.enabled ? remindText(specs, data.time) : 'НЕТ'));
  }
  return out;
}

/** Поля окна C-Voice для одной распознанной записи */
export function createFields(item: DraftItem, s: Snapshot): RecognizedField[] {
  const type: RecognizedField = { key: 'type', label: 'ТИП', kind: 'tag', value: TYPE_LABEL[item.type] };
  switch (item.type) {
    case 'task':
      return [type, ...taskFields(item.data, s)];
    case 'wish': {
      const out: RecognizedField[] = [type, { key: 'title', label: 'ЧТО', kind: 'title', value: item.data.title }];
      if (item.data.note.trim()) out.push(text('note', 'ЗАМЕТКА', clip(upper(item.data.note), 32)));
      if (item.data.link.trim()) out.push(text('link', 'ССЫЛКА', upper(domainOf(item.data.link))));
      return out;
    }
    case 'watch': {
      const out: RecognizedField[] = [type, { key: 'title', label: 'ЧТО', kind: 'title', value: item.data.title }];
      const kind = [item.data.kind ? upper(KIND_LABEL[item.data.kind]) : '', item.data.year ? String(item.data.year) : '']
        .filter(Boolean)
        .join(' · ');
      if (kind) out.push(text('kind', 'ВИД', kind));
      const group = s.groups.find((g) => g.id === s.currentGroupId);
      if (group) out.push(text('group', 'ГРУППА', upper(group.name)));
      return out;
    }
    case 'idea': {
      const { topicId, newTopic } = item.data;
      const topic = newTopic?.trim()
        ? newTopic.trim()
        : topicId && topicId !== INBOX
          ? (s.topics.find((t) => t.id === topicId)?.title ?? 'Без темы')
          : 'Без темы';
      return [
        type,
        { key: 'title', label: 'ЧТО', kind: 'title', value: clip(item.data.title, 80) },
        text('topic', 'ТЕМА', clip(upper(topic), 28)),
      ];
    }
    case 'topic': {
      const out: RecognizedField[] = [type, { key: 'title', label: 'ЧТО', kind: 'title', value: item.data.title }];
      const { body, changes } = item.data;
      if (changes?.length) out.push(text('changes', 'ИЗМЕНЕНИЯ', clip(upper(changes.join(' · ')), 60)));
      else if (body?.trim()) out.push(text('list', 'СПИСОК', clip(upper(listLine(body)), 60)));
      return out;
    }
  }
}
