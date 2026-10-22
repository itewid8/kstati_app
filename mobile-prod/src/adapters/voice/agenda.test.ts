import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { answerPlans, type PlansAnswer } from '@/lib/plans';
import type { PlansQuery } from '@/lib/types';
import type { AgendaDay } from '@/screens/voice/components/AgendaList';
import { askWeekFixture, askWeekendFixture } from '@/screens/fixtures/voice';
import type { Snapshot } from '../snapshot';
import { CLOCK, snapshot, task } from '../common/fixture';
import { agendaSheetProps } from './agenda';
import { WEEK_TASKS } from './mockup';

const s = snapshot({ tasks: WEEK_TASKS });

function answer(q: PlansQuery, st: Snapshot = s): PlansAnswer {
  const r = answerPlans(q, st);
  assert.ok(r.ok);
  return r.answer;
}

/** Дни без id строк (у фикстуры свои), без пустых необязательных полей */
const shape = (days: readonly AgendaDay[]) =>
  days.map((d) => ({
    label: d.label,
    note: d.note ?? '',
    today: !!d.today,
    items: d.items.map((i) => ({ time: i.time, title: i.title, who: i.who, colors: [...i.colors], done: !!i.done, multiDay: !!i.multiDay })),
  }));

describe('agendaSheetProps — C-AskWeek «Что у нас на этой неделе?»', () => {
  const week = agendaSheetProps(answer({ scope: { kind: 'us' }, from: '2026-10-05', to: '2026-10-11', query: '' }), s, CLOCK);

  test('дни, строки и заметки — как в макете', () => {
    assert.deepEqual(shape(week.days), shape(askWeekFixture.days));
  });

  test('шапка «05—11 ОКТ · МЫ С КАРИНОЙ», «16 ДЕЛ»: план заметкой не считается, многодневное — считается', () => {
    assert.equal(week.title, askWeekFixture.title);
    assert.equal(week.count, askWeekFixture.count);
    assert.equal(week.openLabel, 'ОТКРЫТЬ НЕДЕЛЮ');
    assert.equal(week.view, 'week');
    assert.equal(week.free, undefined);
    assert.equal(week.groupId, null);
  });

  test('места мало — последние строки уходят в «ЕЩЁ N»', () => {
    const cut = agendaSheetProps(answer({ scope: { kind: 'us' }, from: '2026-10-05', to: '2026-10-11', query: '' }), s, CLOCK, {
      maxHeight: 19 * 2 + 27 * 4,
    });
    assert.deepEqual(
      cut.days.map((d) => [d.label, d.items.length]),
      [
        ['ПН 05 · СЕГОДНЯ', 2],
        ['ВТ 06', 2],
        ['ЕЩЁ 11', 0],
      ],
    );
    assert.equal(cut.count, '16 ДЕЛ');
  });
});

describe('agendaSheetProps — C-AskWeekend «Что я делаю на выходных?»', () => {
  const q: PlansQuery = { scope: { kind: 'me' }, from: '2026-10-10', to: '2026-10-11', query: '', who: ['s'] };
  const weekend = agendaSheetProps(answer(q), s, CLOCK);

  test('строки «ВЕСЬ» для плана и многодневного, начатого до периода; только мои дела', () => {
    assert.deepEqual(shape(weekend.days), shape(askWeekendFixture.days));
    assert.equal(weekend.title, askWeekendFixture.title);
    assert.equal(weekend.count, askWeekendFixture.count);
    assert.equal(weekend.openLabel, 'ОТКРЫТЬ ДЕНЬ');
    assert.equal(weekend.view, 'day');
  });

  test('«Свободно»: окна от 1 ч в 09:00–22:00 (правило DECISIONS, не строка макета — AUDIT-2 §4.7)', () => {
    // Занят: сб 09:00–09:30 (нет конца — 30 мин), сб 17:00–17:30, вс 11:00–11:30. Дача и Мама в гостях — весь день, не занимают
    assert.equal(weekend.free, 'СБ 09:30–17:00 · СБ 17:30 → · ВС ДО 11:00 · ВС 11:30 →');
  });

  test('окно короче часа не показывается, ровно час — показывается', () => {
    const tight = snapshot({
      tasks: [
        task('a', '2026-10-10', '09:00', 'А', ['s'], { endTime: '12:00' }),
        task('b', '2026-10-10', '12:59', 'Б', ['s'], { endTime: '20:00' }),
        task('c', '2026-10-10', '21:00', 'В', ['s'], { endTime: '23:00' }),
        task('d', '2026-10-11', '08:00', 'Г', ['s'], { endTime: '10:00' }),
        task('e', '2026-10-11', '11:00', 'Д', ['s'], { endTime: '21:30' }),
      ],
    });
    const r = agendaSheetProps(answer(q, tight), tight, CLOCK);
    // сб 12:00–12:59 — 59 мин, сб 20:00–21:00 — ровно час; вс 10:00–11:00 — час, вс 21:30–22:00 — полчаса
    assert.equal(r.free, 'СБ 20:00–21:00 · ВС 10:00–11:00');
  });

  test('сегодня — только окна после «сейчас»; не один человек или дольше 3 дней — без «Свободно»', () => {
    const today = agendaSheetProps(answer({ ...q, from: '2026-10-05', to: '2026-10-05' }), s, CLOCK);
    // 17:52, дальше в 19:00 Йога у Карины — у Сани свободно до конца дня
    assert.equal(today.free, 'ПН 17:52 →');
    assert.equal(today.title, 'ПН 05 ОКТ · САНЯ');
    const both = agendaSheetProps(answer({ scope: { kind: 'us' }, from: '2026-10-10', to: '2026-10-11', query: '' }), s, CLOCK);
    assert.equal(both.free, undefined);
    const long = agendaSheetProps(answer({ ...q, from: '2026-10-05', to: '2026-10-08' }), s, CLOCK);
    assert.equal(long.free, undefined);
  });
});

describe('agendaSheetProps — прочее', () => {
  test('многодневное, начатое до периода, попадает в ответ: заметкой первого дня периода', () => {
    const r = agendaSheetProps(answer({ scope: { kind: 'us' }, from: '2026-10-09', to: '2026-10-11', query: '' }), s, CLOCK);
    assert.equal(r.days[0]?.note, 'КОМАНДИРОВКА · МАМА В ГОСТЯХ → СБ');
    assert.equal(r.days[1]?.note, 'ДАЧА');
  });

  test('поиск по названию: шапка «ДАЧА», дела без даты — днём «БЕЗ ДАТЫ»', () => {
    const st = snapshot({ tasks: [...WEEK_TASKS, task('seed', null, null, 'Семена для дачи', ['s'])] });
    const r = agendaSheetProps(answer({ scope: { kind: 'us' }, from: '2026-10-01', to: '2026-10-31', query: 'дача' }, st), st, CLOCK);
    assert.ok(r.title.startsWith('ДАЧА · '));
    assert.deepEqual(
      r.days.map((d) => [d.label, d.note ?? '', d.items.map((i) => i.title)]),
      [
        ['СБ 10', 'ДАЧА', []],
        ['БЕЗ ДАТЫ', '', ['Семена для дачи']],
      ],
    );
  });

  test('ответ про одну другую группу — её надо выбрать', () => {
    const st = snapshot({ tasks: [task('ball', '2026-10-06', '20:00', 'Футбол', ['d'], { groupId: 'g2' })] });
    const r = agendaSheetProps(answer({ scope: { kind: 'groups', names: ['Друзья'] }, from: '2026-10-05', to: '2026-10-11', query: '' }, st), st, CLOCK);
    assert.equal(r.groupId, 'g2');
    assert.equal(r.title, '05—11 ОКТ · ДРУЗЬЯ');
    assert.equal(r.count, '1 ДЕЛО');
  });
});
