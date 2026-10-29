/** Правка заметки: Enter, вставка, Backspace, панель */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { NoteBlock } from './note';
import { applyTool, backspaceEmpty, changeText, startBlocks, toggleCheck } from './noteEdit';

const B = (kind: NoteBlock['kind'], text: string, extra: Partial<NoteBlock> = {}): NoteBlock => ({ kind, text, ...extra });

describe('noteEdit', () => {
  test('Enter в пункте чек-листа — новый пустой пункт, курсор в нём', () => {
    const r = changeText([B('check', 'Хлеб', { checked: true })], 0, 'Хлеб\n');
    assert.deepEqual(r.blocks, [B('check', 'Хлеб', { checked: true }), B('check', '', { checked: false })]);
    assert.deepEqual(r.caret, { index: 1, at: 0 });
  });

  test('Enter посреди строки — хвост уходит в новую строку того же вида', () => {
    const r = changeText([B('number', 'Раз'), B('text', 'x')], 0, 'Ра\nз');
    assert.deepEqual(r.blocks, [B('number', 'Ра'), B('number', 'з'), B('text', 'x')]);
  });

  test('Enter после заголовка — обычный текст', () => {
    const r = changeText([B('heading', 'План')], 0, 'План\n');
    assert.deepEqual(r.blocks, [B('heading', 'План'), B('text', '')]);
  });

  test('Enter в пустом пункте — выход из списка', () => {
    const r = changeText([B('bullet', 'а'), B('bullet', '')], 1, '\n');
    assert.deepEqual(r.blocks, [B('bullet', 'а'), B('text', '')]);
    assert.deepEqual(r.caret, { index: 1, at: 0 });
  });

  test('вставка нескольких строк с разметкой разбирается', () => {
    const r = changeText([B('text', '')], 0, 'Покупки\n- [ ] Молоко\n- [x] Хлеб');
    assert.deepEqual(r.blocks, [B('text', 'Покупки'), B('check', 'Молоко', { checked: false }), B('check', 'Хлеб', { checked: true })]);
    assert.deepEqual(r.caret, { index: 2, at: 4 });
  });

  test('Backspace: пустой пункт → текст; пустой текст → строка уходит, курсор в конец предыдущей', () => {
    assert.deepEqual(backspaceEmpty([B('text', 'а'), B('check', '', { checked: false })], 1).blocks, [B('text', 'а'), B('text', '')]);
    const r = backspaceEmpty([B('text', 'а'), B('text', '')], 1);
    assert.deepEqual(r.blocks, [B('text', 'а')]);
    assert.deepEqual(r.caret, { index: 0, at: 'end' });
    assert.equal(backspaceEmpty([B('text', '')], 0).caret, null);
  });

  test('галочка и панель', () => {
    assert.deepEqual(toggleCheck([B('check', 'a', { checked: false })], 0), [B('check', 'a', { checked: true })]);
    assert.deepEqual(applyTool([B('text', 'a')], 0, 'number'), [B('number', 'a')]);
    assert.deepEqual(applyTool([B('text', 'a')], 0, 'bold'), [B('text', 'a', { bold: true })]);
    assert.deepEqual(applyTool([B('text', 'a', { bold: true })], 0, 'bold'), [B('text', 'a')]);
    assert.deepEqual(applyTool([B('heading', 'a')], 0, 'bold'), [B('heading', 'a')]);
    assert.deepEqual(startBlocks([]), [B('text', '')]);
  });
});
