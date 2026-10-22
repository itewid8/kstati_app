import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Task } from '@/lib/types';
import { monthAgenda, monthFixture, monthItems } from '@/screens/fixtures/calendar/month';
import { colorMap } from '../common/people';
import { CLOCK, FRIENDS, task } from '../common/fixture';
import { PAIR, WEEK_TASKS, calendarSnapshot } from './mockup';
import { monthProps } from './month';

/**
 * Октябрь из макета C-Month: в ячейках названия сокращены, времени нет — дела ставятся по порядку ячейки
 * (09:00, 10:00, …). Понедельник 5-е — дела панели дня с их временем и полными названиями.
 * Дни 7–9 — план Карины «Командировка», его подзадачи «Встреча» (8-е) и «Поезд домой» (9-е) — обычные строки.
 */
function octoberTasks(): Task[] {
  const out: Task[] = [task('trip', '2026-10-07', null, 'Командировка', ['k'], { endDate: '2026-10-09' })];
  for (const [date, list] of Object.entries(monthItems)) {
    if (date === '2026-10-05') continue;
    list.forEach((it, i) => {
      const kid = it.title === 'Встреча' || it.title === 'Поезд домой';
      out.push(task(it.id, date, `${String(9 + i).padStart(2, '0')}:00`, it.title, [...it.people], kid ? { parentId: 'trip' } : {}));
    });
  }
  for (const r of monthAgenda) out.push(task(r.id, '2026-10-05', r.time, r.title, [...r.people], { endTime: `${r.time.slice(0, 2)}:30` }));
  return out;
}

const s = calendarSnapshot(octoberTasks(), { groups: [PAIR, FRIENDS] });
const colors = colorMap(s);

describe('monthProps (C-Month)', () => {
  test('данные макета: месяц, выбранный день, планы цветом первого человека, панель дня', () => {
    const f = monthFixture();
    const m = monthProps(s, CLOCK, colors, { date: '2026-10-05' });
    assert.equal(m.year, f.year);
    assert.equal(m.month, f.month);
    assert.equal(m.today, f.today);
    assert.equal(m.selectedDate, f.selectedDate);
    assert.deepEqual(m.people, f.people);
    assert.deepEqual(m.plans, f.plans);
    assert.deepEqual(m.agenda, f.agenda);
  });

  test('ячейки как в макете: порядок по времени, подзадачи строками, плана в ячейках нет', () => {
    const m = monthProps(s, CLOCK, colors, { date: '2026-10-05' });
    // 5-е: в ячейке макета названия сокращены («Созвон», «Посылка», «Сериал») — сверяем без названий
    const strip = (list: readonly { title: string; people: readonly string[] }[], titles: boolean) =>
      list.map((it) => (titles ? { title: it.title, people: it.people } : { people: it.people }));
    for (const [date, list] of Object.entries(monthItems)) {
      assert.deepEqual(strip(m.items[date] ?? [], date !== '2026-10-05'), strip(list, date !== '2026-10-05'), date);
    }
    assert.deepEqual(Object.keys(m.items).sort(), Object.keys(monthItems).sort());
  });

  test('без времени — раньше дел со временем; многодневное — в каждом своём дне; повтор — в каждом разе; план — только подсветкой', () => {
    const m = monthProps(calendarSnapshot(WEEK_TASKS), CLOCK, colors, { date: '2026-10-08' });
    assert.deepEqual(
      m.items['2026-10-08']?.map((it) => it.id),
      ['mom', 'meet', 'gym', 'report'],
    );
    assert.deepEqual(
      m.items['2026-10-10']?.map((it) => it.id),
      ['mom', 'water', 'bbq', 'call', 'mom-call'],
    );
    assert.deepEqual(
      Object.entries(m.items).flatMap(([d, l]) => l.filter((it) => it.id.startsWith('yoga')).map(() => d)),
      ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'],
    );
    assert.deepEqual(m.plans, [
      { id: 'trip', startDate: '2026-10-07', endDate: '2026-10-09', color: 'pink' },
      { id: 'dacha', startDate: '2026-10-10', endDate: '2026-10-10', color: 'blue' },
    ]);
    // Панель дня: сначала план, который его покрывает, потом дела; продолжение многодневного — «—»
    assert.deepEqual(m.agenda.map((r) => [r.id, r.time]), [
      ['trip', '—'],
      ['mom', '—'],
      ['meet', '09:00'],
      ['gym', '10:15'],
      ['report', '11:15'],
    ]);
  });

  test('другой месяц: дела только своего месяца', () => {
    const m = monthProps(calendarSnapshot(WEEK_TASKS), CLOCK, colors, { date: '2026-11-15' });
    assert.equal(m.month, 11);
    assert.equal(m.selectedDate, '2026-11-15');
    assert.deepEqual(m.plans, []);
    assert.ok(Object.keys(m.items).every((d) => d.startsWith('2026-11-')));
    assert.deepEqual(m.agenda, []);
  });
});
