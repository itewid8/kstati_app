/** Отмена (withUndo): только затронутые записи, чужие правки за время «ОТМЕНИТЬ» не откатываются */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TASKS, task } from '@/adapters/common/fixture';
import { skipOcc } from './edits';
import { captureList, isEmptyUndo, revertList } from './undo';
import type { Task } from './types';

const byId = (list: Task[], id: string) => list.find((t) => t.id === id);

describe('undo', () => {
  test('удаление: отмена возвращает дело на место и не трогает чужие правки, пришедшие с сервера', () => {
    const before = TASKS;
    const after = before.filter((t) => t.id !== 'gift');
    const u = captureList(before, after);
    // Пока висит «ОТМЕНИТЬ», синхронизация принесла правку Карины другого дела
    const synced = after.map((t) => (t.id === 'lunch' ? { ...t, title: 'Обед с Олегом и Димой' } : t));
    const restored = revertList(synced, u);
    assert.equal(byId(restored, 'lunch')?.title, 'Обед с Олегом и Димой');
    assert.equal(byId(restored, 'gift'), byId(before, 'gift'));
    assert.deepEqual(
      restored.map((t) => t.id),
      before.map((t) => t.id),
    );
    // Остальные записи — те же объекты: синхронизация не отправит устаревший task.put
    for (const t of restored) if (t.id !== 'gift') assert.equal(t, byId(synced, t.id));
  });

  test('отмена «удалить один раз» убирает только эту дату', () => {
    const yoga = task('yoga', '2026-09-07', '19:00', 'Йога', ['k'], { repeat: { freq: 'week', every: 1 }, skipDates: ['2026-09-14'] });
    const before = [yoga];
    const after = [skipOcc(yoga, '2026-10-05')];
    const u = captureList(before, after);
    // Карина за это время удалила другой раз и переименовала серию
    const synced = [{ ...after[0]!, title: 'Йога в зале', skipDates: ['2026-09-14', '2026-10-05', '2026-10-12'] }];
    const restored = revertList(synced, u);
    assert.deepEqual(restored[0]?.skipDates, ['2026-09-14', '2026-10-12']);
    assert.equal(restored[0]?.title, 'Йога в зале');
  });

  test('поле, которое с тех пор поменял другой, не откатывается; наше — откатывается', () => {
    const t0: Task = task('a', '2026-10-05', '10:00', 'Дело', ['s'], { repeat: { freq: 'day', every: 1 } });
    const ended: Task = { ...t0, repeat: { freq: 'day', every: 1, until: '2026-10-10', count: null } };
    const u = captureList([t0], [ended]);
    assert.deepEqual(revertList([ended], u)[0]?.repeat, t0.repeat);
    const changedByOther: Task = { ...ended, repeat: { freq: 'week', every: 1 } };
    assert.deepEqual(revertList([changedByOther], u)[0]?.repeat, changedByOther.repeat);
  });

  test('добавленное действием убирается, удалённое по пути план + подзадачи возвращается целиком', () => {
    const before = TASKS;
    const moved = task('moved', '2026-10-06', '19:00', 'Йога', ['k']);
    const after = [...before.filter((t) => t.id !== 'trip' && t.parentId !== 'trip'), moved];
    const u = captureList(before, after);
    const restored = revertList(after, u);
    assert.deepEqual(
      restored.map((t) => t.id).sort(),
      before.map((t) => t.id).sort(),
    );
  });

  test('ничего не поменялось — тот же список', () => {
    const u = captureList(TASKS, TASKS);
    assert.ok(isEmptyUndo(u));
    assert.equal(revertList(TASKS, u), TASKS);
  });

  test('запись уже вернули (пришла с сервера) — второй раз не добавляется', () => {
    const before = TASKS;
    const after = before.filter((t) => t.id !== 'gift');
    const u = captureList(before, after);
    const restored = revertList(before, u);
    assert.equal(restored.filter((t) => t.id === 'gift').length, 1);
  });
});
