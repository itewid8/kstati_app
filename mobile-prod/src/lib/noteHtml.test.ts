import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { htmlToNote, inlineToHtml, listExit, noteToHtml, stripInline } from './noteHtml';

const NOTE = [
  '# Поход',
  'Взять с собой:',
  '- [ ] Палатка',
  '- [x] **Спальник**',
  '',
  '## Еда',
  '1. Гречка',
  '2. Тушёнка',
  '- Чай',
  '> Не забыть *спички*',
  '```',
  'const x = 1 < 2;',
  '```',
  'Ссылка [карта](https://yandex.ru/maps) и ++важно++, ~~лишнее~~, `код`',
].join('\n');

describe('заметка ⇄ HTML редактора', () => {
  test('текст → HTML: заголовки, чек-лист, списки, цитата, код, пустая строка', () => {
    const html = noteToHtml(NOTE);
    assert.ok(html.startsWith('<html><h1>Поход</h1><p>Взять с собой:</p><ul data-type="checkbox"><li>Палатка</li><li checked><b>Спальник</b></li></ul><br><h2>Еда</h2>'));
    assert.ok(html.includes('<ol><li>Гречка</li><li>Тушёнка</li></ol><ul><li>Чай</li></ul>'));
    assert.ok(html.includes('<blockquote><p>Не забыть <i>спички</i></p></blockquote>'));
    assert.ok(html.includes('<codeblock><p>const x = 1 &lt; 2;</p></codeblock>'));
    assert.ok(html.includes('<a href="https://yandex.ru/maps">карта</a> и <u>важно</u>, <s>лишнее</s>, <code>код</code>'));
  });

  test('туда и обратно — тот же текст', () => {
    assert.equal(htmlToNote(noteToHtml(NOTE)), NOTE);
  });

  test('HTML с телефона: переводы строк между тегами, <li checked>, <br> вместо пустой строки', () => {
    const html = '<html>\n<h1>Список</h1>\n<ul data-type="checkbox">\n<li checked>Молоко</li>\n<li>Хлеб</li>\n</ul>\n<br>\n<p>Ещё <b>текст</b></p>\n</html>';
    assert.equal(htmlToNote(html), '# Список\n- [x] Молоко\n- [ ] Хлеб\n\nЕщё **текст**');
  });

  test('HTML с web: <li><p>…</p></li>, data-checked, сущности', () => {
    const html = '<html><ul data-type="checkboxList"><li data-checked="true"><p>A &amp; B</p></li></ul><p>x&nbsp;y</p></html>';
    assert.equal(htmlToNote(html), '- [x] A & B\nx y');
  });

  test('ссылка, у которой текст — сам адрес, остаётся адресом', () => {
    assert.equal(htmlToNote('<html><p><a href="https://ozon.ru/1">https://ozon.ru/1</a></p></html>'), 'https://ozon.ru/1');
  });

  test('пустой заголовок новой заметки и пустые пары разметки', () => {
    assert.equal(htmlToNote('<html><h1></h1></html>'), '');
    assert.equal(htmlToNote('<html><p>a<b></b>b</p></html>'), 'ab');
  });

  test('старая разметка: жирная строка и «•»', () => {
    assert.equal(htmlToNote(noteToHtml('**Важно**\n• пункт')), '**Важно**\n- пункт');
  });

  test('звёздочки в обычном тексте — не курсив', () => {
    assert.equal(inlineToHtml('2 * 3 * 4'), '2 * 3 * 4');
    assert.equal(stripInline('**a** *b* ++c++ ~~d~~ `e` [f](https://g)'), 'a b c d e f');
  });
});

describe('Enter в пустом пункте — выход из списка', () => {
  test('второй пустой пункт подряд — пустой пункт становится строкой, курсор в ней', () => {
    const before = '# Поход\n- [ ] Палатка\n- [ ]';
    const after = '# Поход\n- [ ] Палатка\n- [ ] \n- [ ] ';
    assert.deepEqual(listExit(before, after), { text: '# Поход\n- [ ] Палатка\n', at: 5 + 1 + 7 + 1 });
  });
  test('обычный Enter в пункте с текстом — не выход', () => {
    assert.equal(listExit('- Чай', '- Чай\n- '), null);
  });
  test('пустой пункт в середине списка', () => {
    assert.deepEqual(listExit('1. А\n2. \n3. Б', '1. А\n2. \n3. \n4. Б'), { text: '1. А\n\n4. Б', at: 2 });
  });
});

describe('ссылки в заметках — только безопасные схемы', () => {
  test('javascript: и data: не становятся ссылкой ни в HTML, ни обратно', () => {
    assert.equal(inlineToHtml('[нажми](javascript:alert(1))'), 'нажми)');
    assert.equal(inlineToHtml('[x](data:text/html,1)'), 'x');
    assert.equal(htmlToNote('<html><p><a href="javascript:alert(1)">нажми</a></p></html>'), 'нажми');
    assert.equal(inlineToHtml('[карта](https://yandex.ru/maps)'), '<a href="https://yandex.ru/maps">карта</a>');
    assert.equal(inlineToHtml('[почта](mailto:a@b.ru)'), '<a href="mailto:a@b.ru">почта</a>');
  });
});
