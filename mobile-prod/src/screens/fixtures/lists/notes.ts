/** Данные макетов C-Topic (тема заметок) и C-Note (заметка, курсор в «Аптечке») */
import { parseNote } from '@/lib/note';
import type { TopicScreenProps } from '../../sheets/TopicScreen';
import type { NoteScreenProps } from '../../lists/NoteScreen';

export const topicFixture = (): TopicScreenProps => ({
  caption: 'ТЕМА',
  title: 'Поездки',
  color: 'blue',
  shared: true,
  body: {
    blocks: parseNote('Куда хотим этим летом:\n- [x] Алтай\n- [ ] Карелия\n- [ ] Байкал\nБюджет — до 150 тыс. на двоих.'),
    editable: true,
    active: null,
  },
  ideas: [
    { id: 'n1', title: 'Алтай', line: 'Чуйский тракт — 10 дней на машине, в конце июля.', checks: '2/4', date: '28 СЕН' },
    { id: 'n2', title: 'Карелия', line: 'Сплав по Шуе, 4 дня', checks: null, date: '15 СЕН' },
    { id: 'n3', title: 'Что взять на Байкал', line: 'Термобельё', checks: '0/6', date: '2 СЕН' },
  ],
  onShare: () => {},
  onAdd: () => {},
  onMore: () => {},
});

export const ALTAI = [
  '# Алтай',
  'Чуйский тракт — 10 дней на машине, в конце июля.',
  '**Взять с собой**',
  '- [x] Палатка',
  '- [x] Спальники',
  '- [ ] Термос и горелка',
  '- [ ] Аптечка',
  '1. Бийск — ночёвка',
  '2. Чемал',
  '3. Акташ, Гейзеровое озеро',
  '- Узнать про пропуск в погранзону',
  '- Заправки после Акташа',
].join('\n');

export const noteFixture = (): NoteScreenProps => ({
  caption: 'ЗАМЕТКА · ПОЕЗДКИ',
  title: 'Алтай',
  blocks: parseNote(ALTAI.split('\n').slice(1).join('\n')),
  editable: true,
  active: 5,
  onMore: () => {},
});
