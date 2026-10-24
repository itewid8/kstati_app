import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { weekFixture } from '@/screens/fixtures/calendar/week';
import type { TimedEvent } from '@/screens/calendar/types';
import { colorMap } from '../common/people';
import { parseKey } from '../common/tasks';
import { CLOCK, FRIENDS, US } from '../common/fixture';
import { WEEK_TASKS, calendarSnapshot } from './mockup';
import { weekProps } from './week';

const s = calendarSnapshot(WEEK_TASKS);
const colors = colorMap(s);
const week = (date: string, hidden: string[] = []) => weekProps(s, CLOCK, colors, { date, hidden });

/**
 * Сравнение с фикстурой макета: у раза серии id «yoga@2026-10-05» (в макете «yoga»),
 * подпись плана у подзадач в макете сокращена: «Казань» вместо «Командировка в Казань»
 */
const asMockup = (e: TimedEvent): TimedEvent => ({
  ...e,
  id: parseKey(e.id).id,
  ...(e.parentTitle === 'Командировка в Казань' ? { parentTitle: 'Казань' } : {}),
});

describe('weekProps (C-Week)', () => {
  test('шапка: понедельник недели из любого её дня, сегодня, сейчас, вкладки людей группы', () => {
    const f = weekFixture();
    const w = week('2026-10-08');
    assert.equal(w.weekStart, f.weekStart);
    assert.equal(w.today, f.today);
    assert.equal(w.now, f.now);
    assert.deepEqual(w.people, f.people);
    assert.deepEqual(w.hiddenPeople, []);
    assert.equal(week('2026-10-11').weekStart, '2026-10-05');
    assert.equal(week('2026-10-12').weekStart, '2026-10-12');
  });

  test('полосы как в макете: весь день, план (только полосой) с « · 7 окт 07:00 → 9 окт 15:00», многодневное « · 8–10 окт», план в один день « 09–20»', () => {
    assert.deepEqual(week('2026-10-05').bars, weekFixture().bars);
  });

  test('дела по дням как в макете: id и порядок, подзадачи с названием плана, сделанное, планов в сетке нет', () => {
    const got = week('2026-10-05').events;
    const mock = Object.fromEntries(Object.entries(got).map(([d, list]) => [d, list.map(asMockup)]));
    assert.deepEqual(mock, weekFixture().events);
    assert.equal(got['2026-10-05']?.[1]?.id, 'yoga@2026-10-05');
    assert.equal(got['2026-10-07']?.[0]?.parentTitle, 'Командировка в Казань');
    const ids = Object.values(got).flatMap((l) => l.map((e) => e.id));
    assert.ok(!ids.includes('trip') && !ids.includes('dacha') && !ids.includes('mom') && !ids.includes('gift'));
  });

  test('скрытые люди: дело пропадает, только если скрыты все его люди', () => {
    const w = week('2026-10-05', ['k']);
    const ids = Object.values(w.events).flatMap((l) => l.map((e) => e.id));
    assert.ok(!ids.includes('yoga@2026-10-05') && !ids.includes('meet') && !ids.includes('bbq'));
    assert.ok(ids.includes('dinner') && ids.includes('cinema') && ids.includes('report'));
    assert.deepEqual(
      w.bars.map((b) => b.id),
      ['gift', 'mom', 'dacha'],
    );
    assert.deepEqual(w.hiddenPeople, ['k']);
  });

  test('ночное дело через полночь: «23:00 →» вечером и «→ 06:00» утром', () => {
    const night = { ...WEEK_TASKS[0]!, id: 'night', title: 'Ночной поезд', time: '23:00', endDate: '2026-10-06', endTime: '06:00', people: ['o'] };
    const w = weekProps(calendarSnapshot([night]), CLOCK, colors, { date: '2026-10-05', hidden: [] });
    assert.deepEqual(w.bars, []);
    assert.deepEqual(w.events['2026-10-05'], [{ id: 'night', title: 'Ночной поезд', start: 1380, end: 1440, people: ['o'], toNextDay: true }]);
    assert.deepEqual(w.events['2026-10-06'], [{ id: 'night', title: 'Ночной поезд', start: 0, end: 360, people: ['o'], fromPrevDay: true }]);
  });

  test('чужая группа: дела Карины не видны, мои скрытые от группы — видны мне заштрихованными, без даты — нет', () => {
    // В «Друзьях» мой режим — «Только выбранные»: группа моих дел не видит, а я вижу их со штриховкой
    const groups = [US, { ...FRIENDS, selectOnly: ['s'] }];
    const w = weekProps(calendarSnapshot(WEEK_TASKS, { currentGroupId: 'g2', groups }), CLOCK, colors, { date: '2026-10-05', hidden: [] });
    const all = [...w.bars, ...Object.values(w.events).flat()];
    assert.ok(all.length > 0);
    assert.ok(all.every((e) => e.hidden), 'всё — моё и скрытое');
    assert.ok(!all.some((e) => e.id.startsWith('yoga')), 'дело Карины «Друзьям» не видно');
    assert.ok(!all.some((e) => e.id === 'none'));
    assert.deepEqual(
      w.people.map((p) => p.tabLabel),
      ['Я', 'ДИМА', 'ЛЕНА'],
    );
  });

  test('режим «Все, кроме скрытых»: мои дела видны и другой группе; скрытое — заштриховано', () => {
    const tasks = WEEK_TASKS.map((t) => (t.id === 'gift' ? { ...t, share: { g2: false } } : t));
    const w = weekProps(calendarSnapshot(tasks, { currentGroupId: 'g2' }), CLOCK, colors, { date: '2026-10-05', hidden: [] });
    const all = [...w.bars, ...Object.values(w.events).flat()];
    assert.equal(all.find((e) => e.id === 'mom')?.hidden, undefined, 'видно группе');
    assert.equal(all.find((e) => e.id === 'gift')?.hidden, true, 'скрыто от «Друзей»');
    assert.ok(!all.some((e) => e.id.startsWith('yoga')), 'дело Карины «Друзьям» не видно');
  });

});
