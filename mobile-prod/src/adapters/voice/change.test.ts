import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { ChangeDraft } from '@/lib/types';
import { askDeleteFixture, askMoveFixture } from '@/screens/fixtures/voice';
import { CLOCK, TASKS, snapshot, task } from '../common/fixture';
import { deleteChange, deleteSheetProps, editItem, editSeed, moveSheetProps, occOfChange, withoutOcc } from './change';

const change = (patch: Partial<ChangeDraft>): ChangeDraft => ({
  key: 'c1',
  action: 'update',
  type: 'task',
  candidates: [patch.chosen ?? 'x'],
  chosen: 'x',
  ...patch,
});

describe('deleteSheetProps — C-AskDelete «Удали йогу в субботу»', () => {
  // Йога Карины по субботам 10:00–11:30
  const s = snapshot({
    tasks: [...TASKS.filter((t) => t.id !== 'yoga'), task('yoga', '2026-09-05', '10:00', 'Йога', ['k'], { endTime: '11:30', repeat: { freq: 'week', every: 1 } })],
  });

  test('день назван (occ): карточка этого раза, «ТОЛЬКО 10 ОКТ», выбран «только этот раз»', () => {
    const del = change({ action: 'delete', chosen: 'yoga', occ: '2026-10-10' });
    const r = deleteSheetProps(del, s, CLOCK);
    assert.ok(r);
    assert.deepEqual({ ...r.task, colors: [...r.task.colors] }, { ...askDeleteFixture.task, colors: [...askDeleteFixture.task.colors] });
    assert.equal(r.onceLabel, askDeleteFixture.onceLabel);
    assert.equal(r.scope, 'one');
    assert.equal(r.occ, '2026-10-10');
    assert.deepEqual(deleteChange(del, 'one', r.occ), del);
    assert.equal(deleteChange(del, 'all', r.occ).occ, undefined);
  });

  test('день не назван: по умолчанию вся серия, «только этот раз» — ближайший', () => {
    const r = deleteSheetProps(change({ action: 'delete', chosen: 'yoga' }), s, CLOCK);
    assert.ok(r);
    assert.equal(r.scope, 'all');
    assert.equal(r.occ, '2026-10-10');
    assert.equal(r.onceLabel, 'ТОЛЬКО 10 ОКТ');
  });

  test('обычное дело: occ из фразы не используется, выбора нет', () => {
    const r = deleteSheetProps(change({ action: 'delete', chosen: 'dent', occ: '2026-10-05' }), s, CLOCK);
    assert.ok(r);
    assert.equal(r.onceLabel, undefined);
    assert.equal(r.occ, null);
    assert.equal(r.task.meta, 'ПН 05 ОКТ · 09:30–10:30 · САНЯ');
    assert.equal(r.task.tag, 'КЛИНИКА НА МИРА');
  });

  test('записи нет — null', () => {
    assert.equal(deleteSheetProps(change({ action: 'delete', chosen: 'gone' }), s, CLOCK), null);
  });

  test('withoutOcc убирает раз', () => {
    assert.equal('occ' in withoutOcc(change({ occ: '2026-10-10' })), false);
  });
});

describe('moveSheetProps — C-AskMove «Перенеси стоматолога на пятницу на два и добавь Карину»', () => {
  const s = snapshot({ tasks: [...TASKS, task('train2', '2026-10-09', '13:00', 'Поезд домой', ['k'], { endTime: '15:00' })] });
  const move = change({ chosen: 'dent', patch: { date: '2026-10-09', time: '14:00', people: ['s', 'k'] } });

  test('было → стало, занятость обоих в новое время', () => {
    const r = moveSheetProps(move, s, CLOCK);
    assert.ok(r);
    // id у фикстуры свой
    assert.deepEqual({ ...r.task, colors: [...r.task.colors] }, { ...askMoveFixture.task, id: 'dent', colors: [...askMoveFixture.task.colors] });
    assert.deepEqual(r.changes, askMoveFixture.changes);
    assert.deepEqual(
      r.conflicts.map((c) => [c.who, c.what]),
      (askMoveFixture.conflicts ?? []).map((c) => [c.who, c.what]),
    );
    assert.equal(r.confirmLabel, 'ПЕРЕНЕСТИ');
    assert.equal(r.badge, 'ПЕРЕНЕСТИ');
  });

  test('раз серии: «было» — этот раз, повтор не трогается', () => {
    const r = moveSheetProps(change({ chosen: 'yoga', occ: '2026-10-12', patch: { time: '20:00', repeat: null } }), s, CLOCK);
    assert.ok(r);
    assert.deepEqual(r.changes, [{ key: 'when', label: 'КОГДА', was: 'ПН 12 ОКТ · 19:00', now: 'ПН 12 ОКТ · 20:00' }]);
    assert.equal(r.task.tag, 'КАЖДУЮ НЕДЕЛЮ');
    assert.equal(r.task.meta, 'ПН 12 ОКТ · 19:00–20:00 · КАРИНА');
  });

  test('отметка: СТАТУС, «ОТМЕТИТЬ»; переименование — «СОХРАНИТЬ»', () => {
    const mark = moveSheetProps(change({ action: 'mark', chosen: 'gift' }), s, CLOCK);
    assert.ok(mark);
    assert.deepEqual(mark.changes, [{ key: 'status', label: 'СТАТУС', was: 'НЕ СДЕЛАНО', now: 'СДЕЛАНО' }]);
    assert.equal(mark.confirmLabel, 'ОТМЕТИТЬ');
    const rename = moveSheetProps(change({ chosen: 'gift', patch: { title: 'Подарок Лене на ДР' } }), s, CLOCK);
    assert.ok(rename);
    assert.deepEqual(rename.changes, [{ key: 'title', label: 'НАЗВАНИЕ', was: 'Подарок Лене', now: 'Подарок Лене на ДР' }]);
    assert.equal(rename.confirmLabel, 'СОХРАНИТЬ');
    assert.deepEqual(rename.conflicts, []);
  });

  test('правка без изменений — null (покажет старое окно)', () => {
    assert.equal(moveSheetProps(change({ chosen: 'dent', patch: { time: '09:30' } }), s, CLOCK), null);
  });

  test('конец едет вместе с началом: новая длительность в занятости та же', () => {
    const r = moveSheetProps(change({ chosen: 'dent', patch: { date: '2026-10-09', time: '16:30' } }), s, CLOCK);
    assert.ok(r);
    // 16:30–17:30 встык к обеду 14:00–16:30 — не пересекается
    assert.deepEqual(r.conflicts, []);
  });
});

describe('«Изменить»', () => {
  const s = snapshot({ overrides: { dent: ['m30'] } });

  test('черновик окна дела с применённой правкой', () => {
    const seed = editSeed(change({ chosen: 'dent', patch: { date: '2026-10-09', time: '14:00', people: ['s', 'k'] } }), s);
    assert.ok(seed);
    assert.equal(seed.id, 'dent');
    assert.deepEqual([seed.date, seed.time, seed.endTime, seed.people], ['2026-10-09', '14:00', '15:00', ['s', 'k']]);
    assert.deepEqual(seed.mine, ['m30']);
    assert.equal(seed.note, 'Клиника на Мира');
  });

  test('раз серии из фразы виден вызывающему', () => {
    assert.equal(occOfChange(change({ chosen: 'yoga', occ: '2026-10-12' }), s), '2026-10-12');
    assert.equal(occOfChange(change({ chosen: 'dent', occ: '2026-10-12' }), s), null);
  });

  test('хотелка с новым названием — для старого окна правки', () => {
    const st = snapshot({ wishes: [{ id: 'w', ownerId: 's', title: 'Кеды', note: '', link: '', receivedAt: null, createdAt: '2026-09-01T00:00:00.000Z' }] });
    assert.deepEqual(editItem(change({ type: 'wish', chosen: 'w', patch: { title: 'Белые кеды' } }), st), {
      key: 'c1',
      type: 'wish',
      id: 'w',
      data: { title: 'Белые кеды', note: '', link: '' },
    });
  });
});
