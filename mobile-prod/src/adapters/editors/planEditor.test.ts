import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { editPeriodFixture, editPlanFixture, editYearFixture } from '@/screens/fixtures/editors/plan';
import { draftFromTask, draftToItem, initialUi, reduceEditor, type EditorAction, type EditorState } from './draft';
import { CLOCK, TRIP, snapshot } from './fixture';
import { planEditorProps, type PlanEditorData } from './planEditor';

const s = snapshot();
const plan: EditorState = (() => {
  const draft = draftFromTask(TRIP, s);
  return { draft, ui: initialUi(draft, CLOCK.today) };
})();
const open = (...actions: EditorAction[]) => actions.reduce(reduceEditor, plan);
const props = (st: EditorState) => planEditorProps(st.draft, st.ui, s, CLOCK);
/** Без строки периода: в макетах C-EditPeriod / C-EditYear она без времени («СР 7 ОКТ → ПТ 9 ОКТ»), в C-EditPlan — со временем */
const noPeriod = ({ period: _period, ...rest }: PlanEditorData) => rest;

describe('planEditorProps — макеты окна плана', () => {
  test('C-EditPlan: описание и подзадачи, «Сувениры маме» вне дат плана', () => {
    assert.deepEqual(props(plan), editPlanFixture());
  });

  test('C-EditPeriod: раскрыт период, сводка «05 · 1 СДЕЛАНО» и плашка «ВНЕ ПЕРИОДА»', () => {
    const p = props(open({ type: 'toggle', field: 'period', today: CLOCK.today }));
    assert.deepEqual(noPeriod(p), noPeriod(editPeriodFixture()));
    assert.equal(p.period, 'СР 7 ОКТ 07:00 → ПТ 9 ОКТ 15:00');
  });

  test('C-EditYear: вид года — без сводки и плашки', () => {
    const p = props(open({ type: 'toggle', field: 'period', today: CLOCK.today }, { type: 'dateView' }));
    assert.deepEqual(noPeriod(p), noPeriod(editYearFixture()));
  });
});

describe('planEditorProps — период', () => {
  test('начало на день позже: конец едет следом, подзадачи на месте, «вне периода» — по новому периоду', () => {
    const st = open({ type: 'toggle', field: 'period', today: CLOCK.today }, { type: 'periodDay', edge: 'start', date: '2026-10-08' });
    assert.equal(st.draft.date, '2026-10-08');
    assert.equal(st.draft.endDate, '2026-10-10');
    assert.equal(st.draft.endTime, '15:00');
    // «КОНЕЦ» подсветился
    assert.equal(st.ui.endFlash, 1);
    const p = props(st);
    assert.equal(p.period, 'ЧТ 8 ОКТ 07:00 → СБ 10 ОКТ 15:00');
    assert.equal(p.periodPanel?.endFlash, 1);
    assert.deepEqual(p.periodPanel?.range, { start: '2026-10-08', end: '2026-10-10', color: 'pink' });
    assert.deepEqual(p.notice, { label: 'ВНЕ ПЕРИОДА', text: '«Поезд в Казань» · ср 7 окт', tone: 'warn' });

    // Список подзадач после сворачивания: «Поезд в Казань» вышел, «Сувениры маме» вошли; даты подзадач не менялись
    const list = props(reduceEditor(st, { type: 'collapse' })).subtasks ?? [];
    assert.deepEqual(
      list.map((i) => [i.id, i.meta, !!i.outside]),
      [
        ['s1', 'СР 7 ОКТ · ВНЕ ДАТ ПЛАНА', true],
        ['s2', 'ЧТ 8 ОКТ · 09:00–15:00', false],
        ['s3', 'ЧТ 8 ОКТ · 19:00', false],
        ['s4', 'ПТ 9 ОКТ · 13:00–15:00', false],
        ['s5', 'СБ 10 ОКТ', false],
      ],
    );
    // Сохраняется только сам план
    const item = draftToItem(st.draft);
    assert.equal(item.id, 'trip');
    assert.equal(item.data.date, '2026-10-08');
    assert.equal(item.data.endDate, '2026-10-10');
  });

  test('конец раньше начала не уходит; правка конца не подсвечивает его', () => {
    const st = open({ type: 'edge', edge: 'end', today: CLOCK.today }, { type: 'periodDay', edge: 'end', date: '2026-10-06' });
    assert.equal(st.draft.date, '2026-10-07');
    assert.equal(st.draft.endDate, null);
    assert.equal(st.ui.endFlash, undefined);
  });

  test('конец позже: «Сувениры маме» снова в периоде, плашки нет', () => {
    const st = open(
      { type: 'toggle', field: 'period', today: CLOCK.today },
      { type: 'edge', edge: 'end', today: CLOCK.today },
      { type: 'periodDay', edge: 'end', date: '2026-10-10' },
    );
    assert.equal(st.ui.edge, 'end');
    const p = props(st);
    assert.equal(p.periodPanel?.endLabel, 'СБ 10 ОКТ · 15:00');
    assert.equal(p.notice, undefined);
  });

  test('у плана повтора нет: «ПОВТОР» не раскрывается', () => {
    const p = props(open({ type: 'toggle', field: 'repeat', today: CLOCK.today }));
    assert.equal(p.expanded, null);
    assert.equal(p.repeat, null);
  });
});
