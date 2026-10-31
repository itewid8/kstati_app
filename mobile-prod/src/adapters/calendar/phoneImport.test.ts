import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { eventHash, type PhoneEvent } from '@/lib/phoneCalendar';
import { task } from '../common/fixture';
import { importItems, importSections } from './phoneImport';

const ev = (p: Partial<PhoneEvent>): PhoneEvent => ({ id: 'e1', calendarId: 'c', title: 'Стоматолог', start: '2026-11-03T11:00:00.000Z', end: '2026-11-03T12:00:00.000Z', allDay: false, ...p });
const CALS = new Map([['c', { id: 'c', title: 'Работа', account: 'GOOGLE', color: '#000000', birthdays: false, holidays: false }]]);

describe('перенос списком', () => {
  test('серия — одной строкой в «ПОВТОРЯЮТСЯ», остальное по дням', () => {
    const weekly = { frequency: 'weekly' };
    const items = importItems(
      [
        ev({ id: 'w', title: 'Планёрка', start: '2026-11-02T07:00:00.000Z', end: '2026-11-02T08:00:00.000Z', rule: weekly }),
        ev({ id: 'w', title: 'Планёрка', start: '2026-11-09T07:00:00.000Z', end: '2026-11-09T08:00:00.000Z', rule: weekly }),
        ev({}),
      ],
      [],
      's',
    );
    const secs = importSections(items, new Set(['e1']), CALS);
    assert.deepEqual(secs.map((s) => s.title), ['ПОВТОРЯЮТСЯ', 'ВТ 03 НОЯ']);
    assert.equal(secs[0]!.rows[0]!.title, 'Планёрка · КАЖДЫЙ ПН');
    assert.equal(secs[0]!.rows[0]!.time, '10:00');
    assert.equal(secs[1]!.rows[0]!.checked, true);
    assert.equal(secs[1]!.rows[0]!.cal, 'РАБОТА');
  });

  test('перенесённое и изменённое', () => {
    const e = ev({});
    const done = task('t1', '2026-11-03', '14:00', 'Стоматолог', [], { createdBy: 's', ext: { cal: 'c', id: 'e1', h: eventHash(e) } });
    assert.equal(importItems([e], [done], 's')[0]!.state, 'done');
    const changed = task('t1', '2026-11-03', '14:00', 'Стоматолог', [], { createdBy: 's', ext: { cal: 'c', id: 'e1', h: 'old' } });
    const it = importItems([e], [changed], 's')[0]!;
    assert.equal(it.state, 'changed');
    assert.equal(it.taskId, 't1');
    assert.equal(importSections([it], new Set(['e1']), CALS)[0]!.rows[0]!.checked, false, 'перенесённое не выбирается');
  });
});
