import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { endLabel, orderSpecs, remindLabel, remindSummary, remindWhen, repeatText, subtaskMeta, untilLabel } from './labels';

describe('напоминания', () => {
  test('короткие подписи (C-EditRemind)', () => {
    assert.deepEqual(
      ['m15', 'm30', 'm60', 'm90', 'm0', 'd0@09:00', 'd0@14:00', 'd1@20:00', 'd2@18:00', 'd7@20:00', 'M1@20:00'].map(remindLabel),
      [
        'ЗА 15 МИН',
        'ЗА 30 МИН',
        'ЗА 1 Ч',
        'ЗА 1 Ч 30 МИН',
        'В НАЧАЛЕ',
        'УТРОМ В 9:00',
        'ДНЁМ В 14:00',
        'НАКАНУНЕ В 20:00',
        'ЗА 2 ДНЯ В 18:00',
        'ЗА НЕДЕЛЮ В 20:00',
        'ЗА МЕСЯЦ В 20:00',
      ],
    );
  });

  test('порядок — ближе к началу выше; сводка без неприменимых', () => {
    assert.deepEqual(orderSpecs(['d1@20:00', 'm120', 'm120']), ['m120', 'd1@20:00']);
    assert.equal(remindSummary(['d1@20:00', 'm120'], '19:00'), 'ЗА 2 Ч · НАКАНУНЕ В 20:00');
    assert.equal(remindSummary(['m60'], null), null);
    assert.equal(remindSummary([], '19:00'), null);
  });

  test('когда придёт', () => {
    assert.equal(remindWhen('m120', '2026-10-10', '19:00'), 'СБ 10 ОКТ, 17:00');
    assert.equal(remindWhen('d1@20:00', '2026-10-10', '19:00'), 'ПТ 9 ОКТ, 20:00');
    assert.equal(remindWhen('m60', '2026-10-10', null), '—');
    assert.equal(remindWhen('d1@20:00', null, null), '—');
  });
});

describe('повтор', () => {
  test('строка «ПОВТОР»', () => {
    assert.equal(repeatText({ freq: 'week', every: 1, weekdays: [6], until: '2026-12-31' }, '2026-10-10'), 'КАЖДУЮ НЕДЕЛЮ: СБ · ДО 31 ДЕК');
    assert.equal(repeatText({ freq: 'week', every: 1, weekdays: [6], until: '2027-03-01' }, '2026-10-10'), 'КАЖДУЮ НЕДЕЛЮ: СБ · ДО 1 МАР 2027');
    assert.equal(repeatText({ freq: 'day', every: 1, count: 3 }, '2026-10-10'), 'КАЖДЫЙ ДЕНЬ · 3 РАЗА');
    assert.equal(repeatText({ freq: 'week', every: 1, weekdays: [1, 2, 3, 4, 5] }, '2026-10-10'), 'ПО БУДНЯМ');
    assert.equal(untilLabel('2026-12-31'), '31 ДЕК 2026');
  });
});

describe('конец и подзадачи', () => {
  test('строка «КОНЕЦ»', () => {
    assert.equal(endLabel({ date: '2026-10-10', endDate: null, endTime: '11:30' }), '11:30');
    assert.equal(endLabel({ date: '2026-10-10', endDate: '2026-10-11', endTime: '01:00' }), 'ВС 11 ОКТ · 01:00');
    assert.equal(endLabel({ date: '2026-10-10', endDate: '2026-10-12', endTime: null }), 'ПН 12 ОКТ');
    assert.equal(endLabel({ date: '2026-10-10', endDate: null, endTime: null }), null);
  });

  test('подзадача', () => {
    assert.equal(subtaskMeta({ date: '2026-10-08', time: '09:00', endDate: null, endTime: '15:00' }, false), 'ЧТ 8 ОКТ · 09:00–15:00');
    assert.equal(subtaskMeta({ date: '2026-10-10', time: null, endDate: null, endTime: null }, true), 'СБ 10 ОКТ · ВНЕ ДАТ ПЛАНА');
    assert.equal(subtaskMeta({ date: null, time: null, endDate: null, endTime: null }, false), 'БЕЗ ДАТЫ');
  });
});
