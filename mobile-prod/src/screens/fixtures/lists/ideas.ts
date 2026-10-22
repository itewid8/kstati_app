/**
 * Данные макета C-Ideas (design/mockups/C-Ideas.dc.html).
 * Светлый макет: обе секции открыты; тёмный: «Архив» свёрнут.
 */
import type { Scheme } from '@/ui';
import type { ArchivedTopic, IdeaTopic, IdeasPerson, IdeasScreenProps } from '../../lists/IdeasScreen';

export const ideasPeople: IdeasPerson[] = [
  { id: 'me', label: 'Я', color: 'blue' },
  { id: 'karina', label: 'КАРИНА', color: 'pink' },
];

export const ideaTopics: IdeaTopic[] = [
  {
    id: 'i1',
    title: 'Идеи для приложения',
    updated: 'ВЧЕРА',
    last: 'В виджете показывать погоду на выходные',
    count: '12',
    ownerColor: 'blue',
    shared: true,
  },
  {
    id: 'i2',
    title: 'Подарки',
    updated: '3 ДНЯ НАЗАД',
    last: 'Лене — сертификат на мастер-класс по керамике',
    count: '05',
    ownerColor: 'blue',
    shared: false,
  },
  {
    id: 'i3',
    title: 'Поздравления',
    updated: 'НЕДЕЛЮ НАЗАД',
    last: 'Маме: стих про осень и дачу',
    count: '04',
    ownerColor: 'blue',
    shared: false,
  },
  {
    id: 'i4',
    title: 'Без темы',
    updated: 'СЕГОДНЯ',
    last: 'Позвонить в автосервис насчёт резины',
    count: '03',
    ownerColor: null,
    shared: false,
  },
  {
    id: 'i5',
    title: 'Куда поехать летом',
    updated: '2 ДНЯ НАЗАД',
    last: 'Алтай, Чуйский тракт — 10 дней на машине',
    count: '07',
    ownerColor: 'pink',
    shared: true,
  },
];

export const archivedTopics: ArchivedTopic[] = [
  { id: 'a1', title: 'Свадьба Ани: что подарить', month: 'СЕН' },
  { id: 'a2', title: 'Ремонт в ванной', month: 'АВГ' },
  { id: 'a3', title: 'Отпуск в Грузии', month: 'ИЮЛ' },
];

export function ideasFixture(scheme: Scheme): IdeasScreenProps {
  return {
    caption: 'БЛОКНОТ · 31 ЗАПИСЬ',
    me: { letter: 'С', color: 'blue' },
    people: ideasPeople,
    selectedPersonId: 'all',
    topics: ideaTopics,
    archive: archivedTopics,
    topicsOpen: true,
    archiveOpen: scheme === 'light',
  };
}
