import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  draftFromSeed,
  draftFromTask,
  draftToItem,
  emptyDraft,
  initialUi,
  reduceDraft,
  reduceEditor,
  repeatPresetOf,
  type DraftAction,
  type EditorDraft,
  type EditorState,
} from './draft';
import { CLOCK, DINNER, YOGA, snapshot } from './fixture';

const s = snapshot();
const apply = (d: EditorDraft, ...actions: DraftAction[]) => actions.reduce(reduceDraft, d);
const withEnd = draftFromTask({ ...DINNER, endTime: '21:00' }, s);

describe('reduceDraft — время и конец', () => {
  test('конец едет за началом: время и день', () => {
    const d = apply(withEnd, { type: 'time', time: '20:00' });
    assert.equal(d.endTime, '22:00');
    assert.equal(d.endDate, null);
    const late = apply(withEnd, { type: 'time', time: '23:00' });
    assert.deepEqual([late.date, late.time, late.endDate, late.endTime], ['2026-10-10', '23:00', '2026-10-11', '01:00']);
    const moved = apply(withEnd, { type: 'day', date: '2026-10-11' });
    assert.deepEqual([moved.date, moved.time, moved.endDate, moved.endTime], ['2026-10-11', '19:00', null, '21:00']);
  });

  test('«БЕЗ ВРЕМЕНИ» и обратно — время колеса возвращается', () => {
    const off = apply(withEnd, { type: 'noTime' });
    assert.equal(off.time, null);
    assert.equal(off.endTime, null);
    const on = apply(off, { type: 'noTime' });
    assert.equal(on.time, '19:00');
  });

  test('время конца раньше начала — конец ночью; потом позже начала — снова в тот же день', () => {
    const night = apply(withEnd, { type: 'endTime', time: '01:00' });
    assert.deepEqual([night.endDate, night.endTime], ['2026-10-11', '01:00']);
    const back = apply(night, { type: 'endTime', time: '22:00' });
    assert.deepEqual([back.endDate, back.endTime], [null, '22:00']);
  });

  test('очистить конец', () => {
    const d = apply(withEnd, { type: 'clearEnd' });
    assert.deepEqual([d.endDate, d.endTime], [null, null]);
  });
});

describe('reduceDraft — повтор', () => {
  test('повтор без даты сбрасывается', () => {
    const d = apply(draftFromTask(DINNER, s), { type: 'repeat', repeat: { freq: 'day', every: 1 }, today: CLOCK.today }, { type: 'clearDate' });
    assert.equal(d.date, null);
    assert.equal(d.time, null);
    assert.equal(d.repeat, null);
  });

  test('повтор у дела без даты ставит дату на сегодня', () => {
    const d = apply(emptyDraft(s), { type: 'repeat', repeat: { freq: 'week', every: 1, weekdays: [1] }, today: CLOCK.today });
    assert.equal(d.date, CLOCK.today);
    assert.deepEqual(d.repeat, { freq: 'week', every: 1, weekdays: [1] });
  });

  test('перенос серии на другой день недели переносит и правило', () => {
    const d = apply(draftFromTask(YOGA, s, '2026-10-10'), { type: 'day', date: '2026-10-11' });
    assert.deepEqual(d.repeat?.weekdays, [7]);
  });

  test('пресеты и «НАСТРОИТЬ…»', () => {
    assert.equal(repeatPresetOf(null, '2026-10-10'), 'none');
    assert.equal(repeatPresetOf({ freq: 'week', every: 1 }, '2026-10-10'), 'week');
    assert.equal(repeatPresetOf({ freq: 'week', every: 1, weekdays: [1, 2, 3, 4, 5] }, '2026-10-10'), 'weekdays');
    assert.equal(repeatPresetOf({ freq: 'week', every: 1, weekdays: [6], until: '2026-12-31' }, '2026-10-10'), 'custom');
    assert.equal(repeatPresetOf({ freq: 'month', every: 2 }, '2026-10-10'), 'custom');
    const st: EditorState = { draft: draftFromTask(DINNER, s), ui: initialUi(draftFromTask(DINNER, s), CLOCK.today) };
    const custom = reduceEditor(st, { type: 'repeatPreset', preset: 'custom', today: CLOCK.today });
    assert.equal(custom.ui.repeatCustom, true);
    assert.deepEqual(custom.draft.repeat, { freq: 'week', every: 1, weekdays: [6] });
    const none = reduceEditor(custom, { type: 'repeatPreset', preset: 'none', today: CLOCK.today });
    assert.equal(none.draft.repeat, null);
    assert.equal(none.ui.repeatCustom, false);
  });

  test('правка правила: шаг, дни недели (хотя бы один), окончание', () => {
    const d = apply(
      draftFromTask(YOGA, s, '2026-10-10'),
      { type: 'repeatEdit', edit: { kind: 'weekday', weekday: 6 } },
      { type: 'repeatEdit', edit: { kind: 'weekday', weekday: 2 } },
      { type: 'repeatEdit', edit: { kind: 'every', every: 2 } },
      { type: 'repeatEdit', edit: { kind: 'end', end: 'count' } },
    );
    assert.deepEqual(d.repeat, { freq: 'week', every: 2, weekdays: [2, 6], until: null, count: 10 });
    const month = apply(d, { type: 'repeatEdit', edit: { kind: 'unit', unit: 'month' } });
    assert.deepEqual(month.repeat, { freq: 'month', every: 2, until: null, count: 10 });
  });
});

describe('reduceDraft — люди и напоминания', () => {
  test('последнего участника не снять', () => {
    const d = apply(emptyDraft(s), { type: 'togglePerson', id: 'sanya' });
    assert.deepEqual(d.people, ['sanya']);
  });

  test('«для меня» — личные, «для всех» — общие; пустые общие — снова у каждого свои', () => {
    const d = apply(draftFromTask(DINNER, s), { type: 'reminders', scope: 'all', specs: ['m30'] });
    assert.deepEqual(d.shared, ['m30']);
    assert.deepEqual(d.mine, ['m120', 'd1@20:00']);
    assert.equal(apply(d, { type: 'reminders', scope: 'all', specs: [] }).shared, null);
    assert.deepEqual(apply(d, { type: 'reminders', scope: 'me', specs: [] }).mine, []);
  });
});

describe('draftToItem', () => {
  test('черновик без правок сохраняет дело как было (и мои напоминания)', () => {
    const item = draftToItem(draftFromTask(DINNER, s));
    assert.deepEqual(item, {
      key: 'dinner',
      type: 'task',
      id: 'dinner',
      data: {
        title: 'Ужин у родителей',
        date: '2026-10-10',
        time: '19:00',
        note: 'Взять торт из «Север-Метрополь»',
        repeat: null,
        mine: ['m120', 'd1@20:00'],
        shared: null,
        endDate: null,
        endTime: null,
        people: ['sanya', 'karina'],
        parentId: null,
      },
    });
  });

  test('раз серии: правка меняет всю серию, сдвиг даты — от начала серии', () => {
    const open = draftFromTask(YOGA, s, '2026-10-10');
    assert.equal(open.date, '2026-10-10');
    assert.equal(draftToItem(open).data.date, '2026-09-05');
    const moved = draftToItem(apply(open, { type: 'day', date: '2026-10-11' }, { type: 'time', time: '11:00' }));
    assert.equal(moved.data.date, '2026-09-06');
    assert.equal(moved.data.time, '11:00');
    assert.equal(moved.data.endTime, '12:30');
    assert.deepEqual(moved.data.repeat?.weekdays, [7]);
    // Повтор сняли — дело остаётся на дате открытого раза
    const once = draftToItem(apply(open, { type: 'repeat', repeat: null, today: CLOCK.today }));
    assert.equal(once.data.date, '2026-10-10');
    assert.equal(once.data.repeat, null);
  });

  test('новое дело: без id, название без пробелов по краям', () => {
    const item = draftToItem(apply(emptyDraft(s, { date: '2026-10-06', time: '12:00' }), { type: 'title', title: '  Купить хлеб ' }));
    assert.equal(item.id, undefined);
    assert.equal(item.key, 'new');
    assert.equal(item.data.title, 'Купить хлеб');
    assert.deepEqual(item.data.people, ['sanya']);
  });
});

describe('draftFromSeed', () => {
  test('голос → новое дело', () => {
    const d = draftFromSeed({ title: 'Ужин у родителей', date: '2026-10-10', time: '19:00', people: ['sanya', 'karina'] }, s);
    assert.equal(d.id, null);
    assert.equal(d.groupId, 'g1');
    assert.deepEqual([d.date, d.time, d.lastTime], ['2026-10-10', '19:00', '19:00']);
    assert.deepEqual(d.people, ['sanya', 'karina']);
  });

  test('голос → правка существующего: поля seed поверх дела', () => {
    const d = draftFromSeed({ id: 'dinner', title: 'Ужин у родителей', date: '2026-10-09', time: '14:00' }, s);
    assert.equal(d.id, 'dinner');
    assert.equal(d.note, 'Взять торт из «Север-Метрополь»');
    assert.deepEqual([d.date, d.time], ['2026-10-09', '14:00']);
    assert.deepEqual(d.mine, ['m120', 'd1@20:00']);
  });
});

describe('reduceEditor — что раскрыто', () => {
  const base: EditorState = { draft: draftFromTask(DINNER, s), ui: initialUi(draftFromTask(DINNER, s), CLOCK.today) };

  test('раскрыта только одна строка; повторный тап сворачивает', () => {
    const a = reduceEditor(base, { type: 'toggle', field: 'when', today: CLOCK.today });
    const b = reduceEditor(a, { type: 'toggle', field: 'who', today: CLOCK.today });
    assert.equal(b.ui.expanded, 'who');
    assert.equal(reduceEditor(b, { type: 'toggle', field: 'who', today: CLOCK.today }).ui.expanded, null);
  });

  test('календарь листается и идёт за выбранным днём', () => {
    const a = reduceEditor(reduceEditor(base, { type: 'toggle', field: 'when', today: CLOCK.today }), { type: 'shift', dir: 1 });
    assert.deepEqual(a.ui.cursor, { year: 2026, month: 10 });
    const dec = reduceEditor(reduceEditor(a, { type: 'shift', dir: 1 }), { type: 'shift', dir: 1 });
    assert.deepEqual(dec.ui.cursor, { year: 2027, month: 0 });
    const picked = reduceEditor(dec, { type: 'day', date: '2026-12-31' });
    assert.deepEqual(picked.ui.cursor, { year: 2026, month: 11 });
    const year = reduceEditor(reduceEditor(picked, { type: 'dateView' }), { type: 'shift', dir: -1 });
    assert.deepEqual([year.ui.dateView, year.ui.cursor], ['year', { year: 2025, month: 11 }]);
    const month = reduceEditor(year, { type: 'pickMonth', month: 3 });
    assert.deepEqual([month.ui.dateView, month.ui.cursor], ['month', { year: 2025, month: 3 }]);
  });
});
