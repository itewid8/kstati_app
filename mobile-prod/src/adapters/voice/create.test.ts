import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { RecognizedField } from '@/screens/voice/VoiceCreateSheet';
import { voiceCreateFixture } from '@/screens/fixtures/voice';
import { snapshot, task } from '../common/fixture';
import { createFields } from './create';
import { remindText } from './labels';

/** Люди без id (у фикстуры свои) */
const shape = (fields: readonly RecognizedField[]) =>
  fields.map((f) => (f.kind === 'people' ? { ...f, people: f.people.map((p) => [p.name, p.color]) } : f));

describe('createFields — C-Voice «В субботу в семь ужин у родителей»', () => {
  test('поля дела как в макете; «ЗА 2 Ч» — действующие напоминания по умолчанию', () => {
    const s = snapshot({ reminders: { enabled: true, timed: ['m120'], allDay: ['d1@20:00'] } });
    const fields = createFields(
      { key: '1', type: 'task', data: { title: 'Ужин у родителей', date: '2026-10-10', time: '19:00', people: ['s', 'k'] } },
      s,
    );
    assert.deepEqual(shape(fields), shape(voiceCreateFixture.fields));
  });

  test('повтор, план, свои напоминания; без людей — я', () => {
    const s = snapshot({ tasks: [task('trip', '2026-10-07', null, 'Командировка', ['k'], { groupId: 'g2' }), task('k1', '2026-10-07', null, 'Шаг', ['k'], { groupId: 'g2', parentId: 'trip' })] });
    const fields = createFields(
      {
        key: '1',
        type: 'task',
        data: { title: 'Йога', date: '2026-10-10', time: null, repeat: { freq: 'week', every: 1 }, parentId: 'trip', mine: ['d1@20:00', 'm30'] },
      },
      s,
    );
    assert.deepEqual(
      fields.map((f) => [f.label, f.kind === 'people' ? f.people.map((p) => p.name).join(',') : f.value]),
      [
        ['ТИП', 'ДЕЛО'],
        ['ЧТО', 'Йога'],
        ['КОГДА', 'СБ 10 ОКТ'],
        ['ПОВТОР', 'КАЖДУЮ НЕДЕЛЮ'],
        ['КТО', 'САНЯ'],
        ['ПЛАН', 'КОМАНДИРОВКА'],
        ['ГРУППА', 'ДРУЗЬЯ'],
        // «за 30 минут» у дела без времени не срабатывает
        ['НАПОМНИТЬ', 'НАКАНУНЕ 20:00'],
      ],
    );
  });

  test('хотелка, «Смотреть», идея — только свои поля', () => {
    const s = snapshot({ topics: [{ id: 't1', ownerId: 's', title: 'Отпуск', groupIds: [], createdAt: '2026-09-01T00:00:00.000Z' }] });
    const label = (fields: RecognizedField[]) => fields.map((f) => [f.label, f.kind === 'people' ? '' : f.value]);
    assert.deepEqual(label(createFields({ key: '1', type: 'wish', data: { title: 'Кеды', note: '', link: 'https://www.ozon.ru/x' } }, s)), [
      ['ТИП', 'ХОЧУ'],
      ['ЧТО', 'Кеды'],
      ['ССЫЛКА', 'OZON.RU'],
    ]);
    assert.deepEqual(
      label(createFields({ key: '1', type: 'watch', data: { title: 'Дюна', kind: 'movie', genres: [], origin: null, year: 2021 } }, s)),
      [
        ['ТИП', 'СМОТРЕТЬ'],
        ['ЧТО', 'Дюна'],
        ['ВИД', 'ФИЛЬМ · 2021'],
        ['ГРУППА', 'МЫ С КАРИНОЙ'],
      ],
    );
    assert.deepEqual(label(createFields({ key: '1', type: 'idea', data: { title: 'Байкал', topicId: 't1', newTopic: null } }, s)), [
      ['ТИП', 'ИДЕЯ'],
      ['ЧТО', 'Байкал'],
      ['ТЕМА', 'ОТПУСК'],
    ]);
  });
});

describe('remindText', () => {
  test('коротко и по порядку срабатывания', () => {
    assert.equal(remindText(['m60', 'd1@20:00'], '19:00'), 'НАКАНУНЕ 20:00 · ЗА 1 Ч');
    assert.equal(remindText(['m90', 'm0'], '10:00'), 'ЗА 1 Ч 30 МИН · В НАЧАЛЕ');
    assert.equal(remindText(['d2@18:00'], null), 'ЗА 2 ДНЯ 18:00');
    assert.equal(remindText([], '10:00'), 'НЕТ');
  });
});
