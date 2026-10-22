import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { PlanItem, TaskItem, TaskSection } from '@/screens/lists/TasksListScreen';
import { tasksListFixture } from '@/screens/fixtures/lists/tasks';
import { CLOCK, snapshot, task } from '../common/fixture';
import { colorMap } from '../common/people';
import { sectionOf, tasksListProps, tasksListSections } from './tasksList';

const DONE = '2026-10-05T07:00:00.000Z';

/** Дела макета C-List (сегодня пн 5 октября) */
const LIST = [
  task('dent', '2026-10-05', '09:30', 'Стоматолог', ['s'], { doneAt: DONE }),
  task('parcel', '2026-10-05', null, 'Забрать посылку', ['k'], { doneAt: DONE }),
  task('yoga', '2026-09-07', '19:00', 'Йога', ['k'], { repeat: { freq: 'week', every: 1 } }),
  task('gift', '2026-10-05', null, 'Подарок Лене', ['s']),
  task('bills', '2026-10-06', null, 'Оплатить коммуналку', ['s']),
  task('dinner', '2026-10-06', '19:00', 'Ужин с Леной', ['s', 'k']),
  task('trip', '2026-10-07', null, 'Командировка', ['k'], { endDate: '2026-10-09' }),
  task('there', '2026-10-07', '07:00', 'Из Москвы в Казань', ['k'], { parentId: 'trip', doneAt: DONE }),
  task('meet', '2026-10-08', '09:00', 'Встреча с заказчиком', ['k'], { parentId: 'trip' }),
  task('back', '2026-10-09', '18:00', 'Обратно в Москву', ['k'], { parentId: 'trip' }),
  task('banya', '2026-10-10', '15:00', 'Баня', ['s', 'k']),
  task('shop', '2026-10-11', null, 'Закупка на неделю', ['s', 'k']),
  // Другая группа — не в списке
  task('other', '2026-10-05', '12:00', 'Чужое', ['d'], { groupId: 'g2' }),
];

const s = snapshot({ tasks: LIST });
const colors = colorMap(s);
const byId = (secs: TaskSection[], id: string) => secs.find((x) => x.id === id);

describe('tasksListProps (C-List)', () => {
  const props = tasksListProps(s, colors, CLOCK);
  const fx = tasksListFixture();

  test('шапка и разделы как в макете: СЕГОДНЯ «ПН 05», ЗАВТРА «ВТ 06», НЕДЕЛЯ «07—11»', () => {
    assert.equal(props.groupLabel, fx.groupLabel);
    assert.deepEqual(props.me, fx.me);
    assert.deepEqual(
      props.sections.map((x) => [x.id, x.label, x.date]),
      fx.sections.map((x) => [x.id, x.label, x.date]),
    );
  });

  test('СЕГОДНЯ: сделанные зачёркнуты на месте, у серии — сегодняшний раз', () => {
    const today = byId(props.sections, 'today')?.items as TaskItem[];
    const want = new Map((byId(fx.sections, 'today')?.items as TaskItem[]).map((t) => [t.title, t]));
    // Макет ставит сделанные первыми; правило — по времени, без времени в начале дня (как в календаре)
    assert.deepEqual(today.map((t) => t.id), ['parcel', 'gift', 'dent', 'yoga@2026-10-05']);
    for (const t of today) {
      const w = want.get(t.title);
      assert.ok(w, t.title);
      assert.deepEqual([t.time, t.owners, t.done], [w.time, w.owners, w.done]);
    }
  });

  test('ЗАВТРА совпадает с макетом, кроме id', () => {
    const got = byId(props.sections, 'tomorrow')?.items.map((t) => ({ ...t, id: '' }));
    const want = byId(fx.sections, 'tomorrow')?.items.map((t) => ({ ...t, id: '' }));
    assert.deepEqual(got, want);
  });

  test('НЕДЕЛЯ: план «1/3», «7—9», шаги под ним; дни недели у дел', () => {
    const week = byId(props.sections, 'week')?.items ?? [];
    const plan = week[0] as PlanItem;
    const fxPlan = byId(fx.sections, 'week')?.items[0] as PlanItem;
    assert.deepEqual([plan.kind, plan.title, plan.progress, plan.range, plan.color], [fxPlan.kind, fxPlan.title, fxPlan.progress, fxPlan.range, fxPlan.color]);
    assert.deepEqual(
      plan.steps.map((x) => [x.title, x.done]),
      fxPlan.steps.map((x) => [x.title, x.done]),
    );
    // В макете дни шагов и дел недели не совпадают с датами (СР 06 при плане 7—9, СБ 15 при неделе 07—11) — проверяем правило
    assert.deepEqual(plan.steps.map((x) => x.when), ['СР 07', 'ЧТ 08', 'ПТ 09']);
    assert.deepEqual(
      week.slice(1).map((t) => (t.kind === 'task' ? [t.title, t.time, t.owners] : [])),
      [
        ['Баня', 'СБ 10', ['blue', 'pink']],
        ['Закупка на неделю', 'ВС 11', ['blue', 'pink']],
      ],
    );
  });

  test('подзадачи не повторяются отдельными строками, чужая группа не видна', () => {
    const ids = props.sections.flatMap((x) => x.items.map((t) => t.id));
    assert.ok(!ids.includes('meet') && !ids.includes('there') && !ids.includes('other'));
  });
});

describe('разделы списка', () => {
  test('sectionOf: прошло, сегодня (и идущее с прошлых дней), завтра, до воскресенья, позже, без даты', () => {
    const t = (date: string | null, endDate: string | null = null) => ({ date, time: null, endDate, endTime: null });
    assert.equal(sectionOf(t('2026-10-04'), CLOCK.today), 'past');
    assert.equal(sectionOf(t('2026-10-03', '2026-10-06'), CLOCK.today), 'today');
    assert.equal(sectionOf(t('2026-10-05'), CLOCK.today), 'today');
    assert.equal(sectionOf(t('2026-10-06'), CLOCK.today), 'tomorrow');
    assert.equal(sectionOf(t('2026-10-11'), CLOCK.today), 'week');
    assert.equal(sectionOf(t('2026-10-12'), CLOCK.today), 'later');
    assert.equal(sectionOf(t(null), CLOCK.today), 'none');
    // В субботу «неделя» кончается завтра
    assert.equal(sectionOf(t('2026-10-12'), '2026-10-10'), 'later');
  });

  test('ПРОШЛО: несделанное; сделанное — только отмеченное сегодня. БЕЗ ДАТЫ — новые сверху', () => {
    const secs = tasksListSections(
      snapshot({
        tasks: [
          task('late', '2026-10-01', null, 'Просрочено', ['s']),
          task('oldDone', '2026-10-01', null, 'Сделано давно', ['s'], { doneAt: '2026-10-02T09:00:00.000Z' }),
          task('justDone', '2026-10-02', null, 'Сделано сейчас', ['s'], { doneAt: DONE }),
          task('n1', null, null, 'Раньше', ['s'], { createdAt: '2026-09-01T09:00:00.000Z' }),
          task('n2', null, null, 'Позже', ['s'], { createdAt: '2026-09-20T09:00:00.000Z' }),
          task('later', '2026-10-20', null, 'Потом', ['o']),
        ],
      }),
      colors,
      CLOCK,
    );
    assert.deepEqual(
      secs.map((x) => [x.id, x.date, x.items.map((i) => [i.id, i.kind === 'task' ? i.time : ''])]),
      [
        ['past', '02', [['late', '1 ОКТ'], ['justDone', '2 ОКТ']]],
        ['none', '02', [['n2', '—'], ['n1', '—']]],
        ['later', '01', [['later', '20 ОКТ']]],
      ],
    );
  });
});
