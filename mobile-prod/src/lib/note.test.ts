/** Заметки: разметка строк туда и обратно, номера, превью, переключение вида */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { isBlankNote, joinTitle, nextKind, notePreview, notePlain, numberOf, parseNote, serializeNote, splitTitle, toggleKind, type NoteBlock } from './note';

describe('note', () => {
  test('виды строк', () => {
    const blocks = parseNote('# Поездка\n- [ ] Билеты\n- [x] **Паспорт**\n1. Казань\n2. Москва\n- Термос\n**Важно**\nПросто текст');
    assert.deepEqual(blocks, [
      { kind: 'heading', text: 'Поездка' },
      { kind: 'check', checked: false, text: 'Билеты' },
      { kind: 'check', checked: true, text: 'Паспорт', bold: true },
      { kind: 'number', text: 'Казань' },
      { kind: 'number', text: 'Москва' },
      { kind: 'bullet', text: 'Термос' },
      { kind: 'text', text: 'Важно', bold: true },
      { kind: 'text', text: 'Просто текст' },
    ]);
  });

  test('старая идея без разметки — текст как есть', () => {
    assert.deepEqual(parseNote('В виджете показывать погоду'), [{ kind: 'text', text: 'В виджете показывать погоду' }]);
  });

  test('сохранение: номера по порядку в каждом списке, лишние пустые строки в конце уходят', () => {
    const blocks: NoteBlock[] = [
      { kind: 'number', text: 'Раз' },
      { kind: 'number', text: 'Два' },
      { kind: 'text', text: 'между' },
      { kind: 'number', text: 'Снова' },
      { kind: 'text', text: '' },
    ];
    assert.equal(serializeNote(blocks), '1. Раз\n2. Два\nмежду\n1. Снова');
    assert.equal(numberOf(blocks, 1), 2);
    assert.equal(numberOf(blocks, 3), 1);
  });

  test('туда и обратно', () => {
    const text = '# План\n- [x] **Купить**\n- [ ] Позвонить\n1. Первое\n2. Второе\n- пункт\nтекст';
    assert.equal(serializeNote(parseNote(text)), text);
  });

  test('пустая жирная строка не превращается в «****»', () => {
    assert.equal(serializeNote([{ kind: 'text', text: 'a' }, { kind: 'text', text: '', bold: true }, { kind: 'text', text: 'b' }]), 'a\n\nb');
  });

  test('превью: две первые строки и счёт чек-листа', () => {
    assert.deepEqual(notePreview('# Покупки\n\n- [x] Молоко\n- [ ] Хлеб\n- [ ] Яйца'), { title: 'Покупки', line: 'Молоко', checks: '1/3' });
    assert.deepEqual(notePreview('Одна строка'), { title: 'Одна строка', line: '', checks: null });
  });

  test('панель: та же кнопка возвращает в текст, жирность сохраняется; Enter после заголовка — текст', () => {
    const b: NoteBlock = { kind: 'text', text: 'x', bold: true };
    const c = toggleKind(b, 'check');
    assert.deepEqual(c, { kind: 'check', text: 'x', checked: false, bold: true });
    assert.deepEqual(toggleKind(c, 'check'), { kind: 'text', text: 'x', bold: true });
    assert.equal(nextKind('heading'), 'text');
    assert.equal(nextKind('number'), 'number');
  });

  test('пустая заметка', () => {
    assert.equal(isBlankNote(parseNote('\n  \n- [ ] ')), true);
    assert.equal(isBlankNote(parseNote('- [ ] a')), false);
  });

  test('название — первая строка-заголовок', () => {
    assert.deepEqual(splitTitle('# Покупки\n- [ ] Хлеб'), { title: 'Покупки', body: '- [ ] Хлеб' });
    assert.deepEqual(splitTitle('Просто текст'), { title: '', body: 'Просто текст' });
    assert.equal(joinTitle('Покупки', '- [ ] Хлеб'), '# Покупки\n- [ ] Хлеб');
    assert.equal(joinTitle('', 'текст'), 'текст');
    assert.equal(joinTitle('Только название', ''), '# Только название');
  });

  test('в буфер обмена — без разметки', () => {
    assert.equal(notePlain('# Покупки\n- [x] Хлеб\n- [ ] Сыр\n1. Раз\n- точка'), 'Покупки\n☑ Хлеб\n☐ Сыр\n1. Раз\n• точка');
  });
});
