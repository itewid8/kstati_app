import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { editDateFixture, editRemindFixture, editRepeatFixture, editWhoFixture } from '@/screens/fixtures/editors/task';
import { draftFromTask, emptyDraft, initialUi, reduceEditor, type EditorAction, type EditorState } from './draft';
import { CLOCK, DINNER, TRIP, YOGA, snapshot } from './fixture';
import { taskEditorProps } from './taskEditor';

const s = snapshot();
const open = (state: EditorState, ...actions: EditorAction[]) => actions.reduce(reduceEditor, state);
const stateOf = (draft: EditorState['draft']): EditorState => ({ draft, ui: initialUi(draft, CLOCK.today) });
const dinner = stateOf(draftFromTask(DINNER, s));

describe('taskEditorProps — макеты окна дела', () => {
  test('C-EditDate: раскрыта «КОГДА», пересечение с йогой Карины', () => {
    const st = open(dinner, { type: 'toggle', field: 'when', today: CLOCK.today });
    assert.deepEqual(taskEditorProps(st.draft, st.ui, s, CLOCK), editDateFixture());
  });

  test('C-EditRemind: для меня — «За 2 ч» над «Накануне», пресет «накануне» уже в списке', () => {
    const st = open(dinner, { type: 'toggle', field: 'remind', today: CLOCK.today });
    const p = taskEditorProps(st.draft, st.ui, s, CLOCK);
    const want = editRemindFixture();
    assert.equal(p.remind, want.remind);
    assert.equal(p.expanded, 'remind');
    assert.ok(p.remindPanel && want.remindPanel);
    assert.equal(p.remindPanel.scope, want.remindPanel.scope);
    assert.deepEqual(p.remindPanel.presets, want.remindPanel.presets);
    // id в макете — r1, r2; у нас id = правило
    assert.deepEqual(
      p.remindPanel.reminders.map(({ rule, when }) => ({ rule, when })),
      want.remindPanel.reminders.map(({ rule, when }) => ({ rule, when })),
    );
    assert.deepEqual(
      p.remindPanel.reminders.map((r) => r.id),
      ['m120', 'd1@20:00'],
    );
    // В макете C-EditRemind нет строки подзадач и плашки — это вариант макета, правило то же, что в C-EditDate
    assert.equal(p.subtasks, null);
  });

  test('C-EditWho: Саня свободен, Карина занята 19:00–20:00 · ЙОГА', () => {
    const st = open(dinner, { type: 'toggle', field: 'who', today: CLOCK.today });
    assert.deepEqual(taskEditorProps(st.draft, st.ui, s, CLOCK), editWhoFixture());
  });

  test('C-EditRepeat: открыт раз серии 10 окт, «КАЖДУЮ НЕДЕЛЮ: СБ · ДО 31 ДЕК», «НАСТРОИТЬ…»', () => {
    const st = open(stateOf(draftFromTask(YOGA, s, '2026-10-10')), { type: 'toggle', field: 'repeat', today: CLOCK.today });
    const p = taskEditorProps(st.draft, st.ui, s, CLOCK);
    const want = editRepeatFixture();
    const pick = ({ caption, title, colors, when, end, repeat, people, remind, note, expanded, repeatPanel }: typeof p) => ({
      caption,
      title,
      colors,
      when,
      end,
      repeat,
      people,
      remind,
      note,
      expanded,
      repeatPanel,
    });
    assert.deepEqual(pick(p), pick({ ...want, subtasks: undefined, notice: null }));
    // У серии строки подзадач нет; с йогой вечером она не пересекается
    assert.equal(p.subtasks, undefined);
    assert.equal(p.notice, null);
  });
});

describe('taskEditorProps — правила', () => {
  test('новое дело из «+»: без даты, я в «КТО», напоминания по умолчанию для дел без времени', () => {
    const d = emptyDraft(s);
    const p = taskEditorProps(d, initialUi(d, CLOCK.today), s, CLOCK);
    assert.equal(p.when, 'БЕЗ ДАТЫ');
    assert.deepEqual(p.people, [{ id: 'sanya', name: 'САНЯ', color: 'blue' }]);
    assert.equal(p.remind, 'НАКАНУНЕ В 20:00');
    assert.equal(p.subtasks, null);
    assert.equal(p.notice, null);
    // Чистый шаблон: название пустое, «СОХРАНИТЬ» недоступна, пока его нет
    assert.equal(p.title, '');
    assert.equal(p.saveDisabled, true);
    const named = reduceEditor({ draft: d, ui: initialUi(d, CLOCK.today) }, { type: 'title', title: 'Купить хлеб' });
    assert.equal(taskEditorProps(named.draft, named.ui, s, CLOCK).saveDisabled, false);
  });

  test('подзадача плана: группа плана, строки подзадач нет', () => {
    const d = emptyDraft(snapshot({ currentGroupId: null }), { parentId: 'trip', date: '2026-10-07' });
    assert.equal(d.groupId, 'g1');
    assert.equal(d.parentId, 'trip');
    assert.equal(taskEditorProps(d, initialUi(d, CLOCK.today), s, CLOCK).subtasks, undefined);
  });

  test('у плана в окне дела — сводка подзадач', () => {
    const st = stateOf(draftFromTask(TRIP, s));
    const p = taskEditorProps(st.draft, st.ui, s, CLOCK);
    assert.equal(p.subtasks, '05 · 1 СДЕЛАНО');
  });

  test('перенос на время без пересечений убирает плашку; «ВСЕ В ГРУППЕ» — снимок участников', () => {
    const st = open(dinner, { type: 'time', time: '21:00' }, { type: 'togglePerson', id: 'karina' });
    const p = taskEditorProps(st.draft, st.ui, s, CLOCK);
    assert.equal(p.notice, null);
    assert.deepEqual(p.colors, ['blue']);
    const all = open(st, { type: 'whoMode', mode: 'all', members: ['sanya', 'karina'] });
    assert.deepEqual(all.draft.people, ['sanya', 'karina']);
    assert.equal(all.ui.whoMode, 'all');
  });

  test('конец: «+ КОНЕЦ» → час после начала, многодневный конец — днём', () => {
    const st = open(dinner, { type: 'initEnd' });
    assert.equal(taskEditorProps(st.draft, st.ui, s, CLOCK).end, '20:00');
    const next = open(st, { type: 'endDay', date: '2026-10-11' });
    assert.equal(taskEditorProps(next.draft, next.ui, s, CLOCK).end, 'ВС 11 ОКТ · 20:00');
  });
});
