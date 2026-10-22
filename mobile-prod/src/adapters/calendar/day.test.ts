import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { dayFixture } from '@/screens/fixtures/calendar/day';
import { colorMap } from '../common/people';
import { CLOCK, FRIENDS } from '../common/fixture';
import { dayProps } from './day';
import { DAY_TASKS, PAIR, WEEK_TASKS, calendarSnapshot } from './mockup';

const s = calendarSnapshot(DAY_TASKS, { groups: [PAIR, FRIENDS] });
const colors = colorMap(s);

describe('dayProps (C-Day)', () => {
  test('данные макета: полоса «Подарок Лене», дела по началу с описаниями, раз серии — «yoga@2026-10-05»', () => {
    const f = dayFixture();
    const d = dayProps(s, CLOCK, colors, { date: '2026-10-05', hidden: [] });
    assert.equal(d.date, f.date);
    assert.equal(d.today, f.today);
    assert.equal(d.now, f.now);
    assert.deepEqual(d.people, f.people);
    assert.deepEqual(d.bars, f.bars);
    // При равном начале (13:00) левее — раньше записанное: «Созвон с Олегом», потом «Забрать посылку»
    assert.deepEqual(
      d.events.map((e) => (e.id === 'yoga@2026-10-05' ? { ...e, id: 'yoga' } : e)),
      f.events,
    );
  });

  test('не сегодня — без линии «сейчас»; соседний день — свои дела', () => {
    const d = dayProps(s, CLOCK, colors, { date: '2026-10-12', hidden: [] });
    assert.equal(d.now, undefined);
    assert.deepEqual(
      d.events.map((e) => e.id),
      ['yoga@2026-10-12'],
    );
    assert.deepEqual(d.bars, []);
  });

  test('скрытая Карина: её дела пропали, общее «Разделение» осталось', () => {
    const d = dayProps(s, CLOCK, colors, { date: '2026-10-05', hidden: ['k'] });
    assert.deepEqual(
      d.events.map((e) => e.id),
      ['dent', 'call', 'series'],
    );
  });

  test('день внутри плана: план полосой с подписью, подзадача в сетке с названием плана, многодневное без времени — полосой', () => {
    const d = dayProps(calendarSnapshot(WEEK_TASKS), CLOCK, colors, { date: '2026-10-08', hidden: [] });
    assert.deepEqual(
      d.bars.map((b) => b.id),
      ['trip', 'mom'],
    );
    assert.deepEqual(d.events.map((e) => [e.id, e.parentTitle ?? null]), [
      ['meet', 'Командировка в Казань'],
      ['gym', null],
      ['report', null],
    ]);
  });
});
