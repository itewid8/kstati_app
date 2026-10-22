import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { DraftItem } from '@/lib/types';
import { CLOCK, snapshot } from '../common/fixture';
import { mmss, sheetHeader } from './header';
import { QUOTA_DETAIL, problemSheet, quotaText } from './problem';
import { voiceView, type VoiceCard } from './view';

const s = snapshot();
const item = (title: string, date: string | null = '2026-10-10'): DraftItem => ({ key: title, type: 'task', data: { title, date, time: null } });
const kind = (card: VoiceCard) => voiceView(card, s, CLOCK)?.kind ?? null;

describe('voiceView — что рисует VoiceHost, а что старый CardSheet', () => {
  test('одна запись — C-Voice; несколько, правка, ручное, дубликат — CardSheet', () => {
    assert.equal(kind({ source: 'voice', transcript: 'т', items: [item('Ужин')], editing: false }), 'create');
    assert.equal(kind({ source: 'voice', transcript: 'т', items: [item('Ужин'), item('Кино')], editing: false }), null);
    assert.equal(kind({ source: 'voice', transcript: 'т', items: [item('Ужин')], editing: true }), null);
    assert.equal(kind({ source: 'manual', items: [item('Ужин')], editing: false }), null);
    // «Подарок Лене» на пн 05 уже есть
    assert.equal(kind({ source: 'voice', transcript: 'т', items: [item('Подарок Лене', '2026-10-05')], editing: false }), null);
    assert.equal(kind({ source: 'voice', transcript: 'т', items: [{ ...item('Подарок Лене', '2026-10-05'), force: true }], editing: false }), 'create');
  });

  test('одна правка — удаление или перенос; пропавшая запись и несколько правок — CardSheet', () => {
    const base = { key: 'c', type: 'task' as const, candidates: ['dent'], chosen: 'dent' };
    assert.equal(kind({ source: 'voice', transcript: 'т', changes: [{ ...base, action: 'delete' }] }), 'delete');
    assert.equal(kind({ source: 'voice', transcript: 'т', changes: [{ ...base, action: 'update', patch: { time: '11:00' } }] }), 'move');
    assert.equal(kind({ source: 'voice', transcript: 'т', changes: [{ ...base, action: 'delete', chosen: 'gone' }] }), null);
    assert.equal(kind({ source: 'voice', transcript: 'т', changes: [{ ...base, action: 'delete' }, { ...base, key: 'd', action: 'mark' }] }), null);
  });

  test('ответ о планах и ошибки — всегда VoiceHost', () => {
    const plans = { title: 'т', groupNames: [], sections: [], from: '2026-10-05', to: '2026-10-05', singleDay: true };
    assert.equal(kind({ source: 'voice', transcript: 'т', plans }), 'agenda');
    assert.equal(kind({ source: 'voice', transcript: '', problem: 'silence' }), 'problem');
  });
});

describe('окно ошибки', () => {
  test('только причина; лимит — без «ещё раз»; микрофон — настройки', () => {
    assert.deepEqual(problemSheet({ transcript: '', problem: 'silence' }), { phrase: '', text: 'Не расслышал', action: 'retry' });
    assert.deepEqual(problemSheet({ transcript: 'позвони Маше', problem: 'unknownPerson', person: 'Маше' }), {
      phrase: 'позвони Маше',
      text: 'Не нашёл человека «Маше»',
      action: 'retry',
    });
    assert.equal(problemSheet({ transcript: '', problem: 'offline' }).text, 'Нет связи');
    assert.equal(problemSheet({ transcript: '', problem: 'micDenied' }).action, 'settings');
    const limit = problemSheet({ transcript: '', problem: 'info', query: quotaText({ limit: 30, used: 30 }), detail: QUOTA_DETAIL });
    assert.deepEqual(limit, { phrase: '', text: 'Лимит на сегодня: 30 из 30', action: null });
    assert.equal(quotaText(null, ''), 'Лимит на сегодня исчерпан');
  });

  test('не понял, не нашёл, нет связи — «ДОБАВИТЬ» со сказанным; лимит и тишина — без', () => {
    assert.deepEqual(problemSheet({ transcript: 'купить хлеб', problem: 'notUnderstood' }).add, { prompt: 'Добавить как…', title: 'Купить хлеб' });
    assert.deepEqual(problemSheet({ transcript: 'отметь молоко', problem: 'notFound', query: 'молоко' }).add, {
      prompt: 'Добавить вручную',
      title: 'Молоко',
    });
    assert.equal(problemSheet({ transcript: 'кино в субботу', problem: 'offline' }).add?.title, 'Кино в субботу');
    assert.equal(problemSheet({ transcript: '', problem: 'silence' }).add, undefined);
    assert.equal(problemSheet({ transcript: '', problem: 'info', query: 'Лимит', detail: QUOTA_DETAIL }).add, undefined);
  });
});

describe('шапка', () => {
  test('длительность и ярлык', () => {
    assert.equal(mmss(4200), '00:04');
    assert.equal(mmss(75_000), '01:15');
    assert.deepEqual(sheetHeader([1, 2], 3000, 'УДАЛИТЬ'), { duration: '00:03', levels: [1, 2], badge: 'УДАЛИТЬ' });
    assert.deepEqual(sheetHeader([], 0, undefined, true), { duration: '00:00', levels: [], live: true });
  });
});
