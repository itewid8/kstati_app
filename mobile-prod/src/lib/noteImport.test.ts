import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCount, displayTitle, fromKeepJson, fromShare, fromTextFile, noteText, sourceLabel, toMarkup } from './noteImport';

describe('заметки из других приложений', () => {
  test('списки ☐/☑ → чек-лист, остальное как есть', () => {
    assert.equal(toMarkup('Купить\n☐ Хлеб\n☑ Молоко\n□ Сыр\n[x] Чай\n- [ ] Кофе'), 'Купить\n- [ ] Хлеб\n- [x] Молоко\n- [ ] Сыр\n- [x] Чай\n- [ ] Кофе');
  });

  test('«Поделиться»: тема — название, иначе короткая первая строка', () => {
    const [a] = fromShare({ subject: 'Дача', texts: ['Дача\n☐ Угли\n☐ Мясо'] });
    assert.equal(a!.title, 'Дача');
    assert.equal(a!.body, '- [ ] Угли\n- [ ] Мясо');
    assert.equal(checkCount(a!.body), 2);
    const [b] = fromShare({ texts: ['Фразочки\nНу ты даёшь'] });
    assert.deepEqual([b!.title, b!.body], ['Фразочки', 'Ну ты даёшь']);
    const [c] = fromShare({ texts: ['Одна строка без названия'] });
    assert.deepEqual([c!.title, c!.body], ['', 'Одна строка без названия']);
    assert.equal(fromShare({ texts: ['  '] }).length, 0);
    assert.equal(fromShare({ texts: ['a', 'b'] }).length, 2);
  });

  test('текст заметки — с названием-заголовком', () => {
    assert.equal(noteText({ title: 'Дача', body: '- [ ] Угли' }), '# Дача\n- [ ] Угли');
    assert.equal(noteText({ title: '', body: 'Просто текст' }), 'Просто текст');
  });

  test('Google Keep из Takeout: список, ярлыки, корзина, дата', () => {
    const n = fromKeepJson(
      {
        title: 'Покупки',
        listContent: [
          { text: 'Хлеб', isChecked: false },
          { text: 'Молоко', isChecked: true },
          { text: '' },
        ],
        labels: [{ name: 'Дом' }],
        isTrashed: false,
        userEditedTimestampUsec: 1760000000000000,
      },
      'k1',
    )!;
    assert.equal(n.body, '- [ ] Хлеб\n- [x] Молоко');
    assert.deepEqual(n.labels, ['Дом']);
    assert.equal(n.at, new Date(1760000000000).toISOString());
    assert.equal(fromKeepJson({ title: 'x', textContent: 'y', isTrashed: true }, 'k2')!.trashed, true);
    assert.equal(fromKeepJson({ title: '', textContent: '' }, 'k3'), null);
    assert.equal(fromKeepJson('мусор', 'k4'), null);
  });

  test('txt/md: заголовок или имя файла', () => {
    assert.deepEqual(fromTextFile('рецепт плова.txt', 'Рис 500 г', 'f1'), { key: 'f1', title: 'рецепт плова', body: 'Рис 500 г', labels: [] });
    assert.equal(fromTextFile('x.md', '# Идеи\n- пункт', 'f2')!.title, 'Идеи');
    assert.equal(fromTextFile('пусто.txt', '﻿  ', 'f3'), null);
  });

  test('название для списка и источник', () => {
    assert.equal(displayTitle({ title: '', body: '- [ ] Позвонить в автосервис' }), 'Позвонить в автосервис');
    assert.equal(sourceLabel('com.google.android.keep'), 'GOOGLE KEEP');
    assert.equal(sourceLabel('com.unknown'), null);
  });
});

describe('куда переносить заметки', () => {
  test('тема по выбору и группы по ярлыкам', async () => {
    const { groupNotes, targetOf } = await import('./noteImport');
    const a = { labels: ['Дача'] };
    const b = { labels: [] as string[] };
    assert.deepEqual(targetOf(a, 'labels', 'Из Keep'), { title: 'Дача' });
    assert.equal(targetOf(b, 'labels', 'Из Keep'), null);
    assert.deepEqual(targetOf(b, 'new', 'Из Keep'), { title: 'Из Keep' });
    assert.deepEqual(targetOf(a, 't:42', 'x'), { id: '42' });
    assert.deepEqual(groupNotes([b, a], true).map((g) => g.label), ['Дача', null]);
    assert.equal(groupNotes([a, b], false).length, 1);
  });
});
