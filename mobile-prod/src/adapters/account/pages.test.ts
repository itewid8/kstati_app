import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { FRIENDS, SANYA, US, snapshot } from '../common/fixture';
import { autoColor, lookOf, lookPatch } from './avatar';
import { groupPickerRows } from './groupPicker';
import { remindersProps, sameRules, withRule, withoutRule } from './reminders';

describe('remindersProps (страница «Напоминания»)', () => {
  const saved = { timed: ['d1@20:00', 'm60'], allDay: ['d1@20:00', 'd0@09:00'] };

  test('правила ближе к началу — выше, добавленные варианты бледные, сохранять нечего', () => {
    const p = remindersProps(saved, saved);
    assert.deepEqual(
      p.timed.rules.map((r) => r.label),
      ['За 1 ч до начала', 'Накануне в 20:00'],
    );
    assert.deepEqual(
      p.timed.presets.filter((x) => x.used).map((x) => x.key),
      ['m60', 'd1@20:00'],
    );
    assert.equal(p.timed.presets.find((x) => x.key === 'm15')?.label, 'ЗА 15 МИН');
    assert.ok(p.allDay.presets.every((x) => !x.key.startsWith('m')));
    assert.equal(p.canSave, false);
  });

  test('добавили и убрали — СОХРАНИТЬ активна; вернули как было — снова нет', () => {
    const timed = withRule(saved.timed, 'm15');
    assert.deepEqual(timed, ['m15', 'm60', 'd1@20:00']);
    assert.equal(remindersProps({ ...saved, timed }, saved).canSave, true);
    assert.equal(remindersProps({ ...saved, timed: withoutRule(timed, 'm15') }, saved).canSave, false);
    assert.ok(sameRules(['m60', 'd1@20:00'], ['d1@20:00', 'm60']));
  });

  test('пять правил — больше не добавить: все варианты бледные, шестое не встаёт', () => {
    const five = ['m15', 'm30', 'm60', 'm120', 'd1@20:00'];
    const p = remindersProps({ ...saved, timed: five }, saved);
    assert.equal(p.timed.full, true);
    assert.ok(p.timed.presets.every((x) => x.used));
    assert.equal(withRule(five, 'd2@18:00').length, 5);
  });
});

describe('groupPickerRows (выбор группы)', () => {
  test('личный календарь первым; категория и число участников, текущая отмечена', () => {
    assert.deepEqual(groupPickerRows({ groups: [US, FRIENDS], currentGroupId: 'g2' }), [
      { id: '@me', name: 'Я', meta: 'ВСЕ МОИ ДЕЛА', current: false },
      { id: 'g1', name: 'Мы с Кариной', meta: 'ПАРА · 3', current: false },
      { id: 'g2', name: 'Друзья', meta: 'ДРУЗЬЯ · 3', current: true },
    ]);
  });
});

describe('avatar (страница «Иконка»)', () => {
  test('«АВТО» — первый свободный цвет, а не свой', () => {
    const s = snapshot({ me: { ...SANYA, color: 'pink' } });
    assert.equal(autoColor(s), 'blue');
  });

  test('в правке — только изменённое; пустой символ — снять свой', () => {
    const me = { ...SANYA, color: 'pink' as const, avatar: 'S' };
    assert.deepEqual(lookOf(me), { color: 'pink', symbol: 'S' });
    assert.deepEqual(lookPatch({ color: 'pink', symbol: 'S' }, me), {});
    assert.deepEqual(lookPatch({ color: null, symbol: ' ' }, me), { color: null, avatar: null });
    assert.deepEqual(lookPatch({ color: '#123456', symbol: 'S' }, me), { color: '#123456' });
  });
});
