import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { KARINA as KARINA_TAB, OLEG as OLEG_TAB, SANYA as SANYA_TAB, chrome } from '@/screens/fixtures/calendar/people';
import { KARINA, SANYA, snapshot } from './fixture';
import { colorMap, colorOf, editorPerson, groupPeople, letterOf, meBadge, peopleIds, voicePerson, wishOwnerOf } from './people';

describe('colorMap', () => {
  test('без своих цветов — по палитре: я, затем участники групп по порядку', () => {
    const s = snapshot();
    assert.deepEqual(peopleIds(s), ['s', 'k', 'o', 'd', 'l']);
    assert.deepEqual([...colorMap(s)], [['s', 'blue'], ['k', 'pink'], ['o', 'green'], ['d', 'yellow'], ['l', 'orange']]);
  });

  test('один цвет человека во всех группах; занятый раньше стоящим — первый свободный', () => {
    const s = snapshot({
      me: { ...SANYA, color: 'pink' },
      users: [SANYA, { ...KARINA, color: 'pink' }, { id: 'o', name: 'Олег', color: '#123456' }],
    });
    const colors = colorMap(s);
    assert.equal(colors.get('s'), 'pink');
    assert.equal(colors.get('k'), 'blue');
    assert.equal(colors.get('o'), '#123456');
    assert.equal(colorOf(colors, 'nobody'), '#8B8B8B');
  });
});

describe('люди на экранах', () => {
  const s = snapshot();
  const colors = colorMap(s);

  test('groupPeople = вкладки макетов календаря', () => {
    assert.deepEqual(groupPeople(s, colors, 'g1'), [SANYA_TAB, KARINA_TAB, OLEG_TAB]);
    assert.deepEqual(groupPeople(s, colors, null), [SANYA_TAB]);
  });

  test('meBadge = кнопка профиля макетов', () => {
    assert.deepEqual(meBadge(s, colors), chrome.me);
  });

  test('letterOf: свой символ или первая буква заглавной', () => {
    assert.equal(letterOf({ name: 'ёжик' }), 'Ё');
    assert.equal(letterOf({ name: 'Карина', avatar: '🦊' }), '🦊');
    assert.equal(letterOf({ name: '  ', avatar: ' ' }), '?');
  });

  test('voicePerson, editorPerson', () => {
    assert.deepEqual(voicePerson(s, colors, 'k'), { id: 'k', name: 'КАРИНА', color: 'pink' });
    assert.deepEqual(editorPerson(s, colors, 's'), { id: 's', name: 'САНЯ', color: 'blue' });
    assert.equal(voicePerson(s, colors, 'nobody'), null);
  });
});

describe('wishOwnerOf', () => {
  const wishes = [{ id: 'w1', ownerId: 'k' }];
  test('подарок (API 2): автор — даритель, владелец — в scope', () => {
    assert.equal(wishOwnerOf({ scope: 'u:k', actor: 'd', itemId: 'w1' }, wishes), 'k');
  });
  test('нет владельца в событии — по хотелке в хранилище, иначе автор', () => {
    assert.equal(wishOwnerOf({ scope: 'g1', actor: 'd', itemId: 'w1' }, wishes), 'k');
    assert.equal(wishOwnerOf({ scope: 'g1', actor: 'd', itemId: 'w9' }, wishes), 'd');
  });
});
