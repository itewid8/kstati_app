/**
 * Правка заметки по строкам (экран C-Note). Чистые функции: строки до → строки после и куда поставить курсор.
 *  - Enter (перевод строки в поле) делит строку: пункт списка продолжает список, после заголовка — текст;
 *    Enter в пустом пункте выходит из списка (пункт становится текстом);
 *  - вставка нескольких строк разбирается по разметке («- [ ] …», «1. …»);
 *  - Backspace в пустой строке: пункт — в текст, текст — строка удаляется, курсор в конец предыдущей;
 *  - кнопки панели: вид строки (та же кнопка — обратно в текст) и жирный.
 */
import { nextKind, parseLine, toggleKind, type NoteBlock, type NoteKind } from './note';

/** Курсор: строка и место в ней (end — в конце) */
export type NoteCaret = { index: number; at: number | 'end' };
export type NoteEdit = { blocks: NoteBlock[]; caret: NoteCaret | null };

export type NoteTool = NoteKind | 'bold';

const fresh = (kind: NoteKind, text = ''): NoteBlock => (kind === 'check' ? { kind, text, checked: false } : { kind, text });

/** Новый текст строки i из поля ввода */
export function changeText(blocks: readonly NoteBlock[], i: number, text: string): NoteEdit {
  const b = blocks[i];
  if (!b) return { blocks: [...blocks], caret: null };
  if (!text.includes('\n')) return { blocks: blocks.map((x, j) => (j === i ? { ...x, text } : x)), caret: null };
  const [head = '', ...rest] = text.replace(/\r\n?/g, '\n').split('\n');
  // Enter в пустом пункте списка — выход из списка
  if (!head && rest.length === 1 && !rest[0] && b.kind !== 'text' && b.kind !== 'heading' && !b.text) {
    return { blocks: blocks.map((x, j) => (j === i ? { kind: 'text', text: '', ...(b.key && { key: b.key }) } : x)), caret: { index: i, at: 0 } };
  }
  const added = rest.map((line, k): NoteBlock => {
    // Первая новая строка — продолжение текущей (её хвост после курсора); вставленные с разметкой — по разметке
    const parsed = parseLine(line);
    if (parsed.kind !== 'text' || parsed.bold) return parsed;
    return fresh(k === 0 || b.kind !== 'heading' ? nextKind(b.kind) : 'text', line);
  });
  const next = [...blocks.slice(0, i), { ...b, text: head }, ...added, ...blocks.slice(i + 1)];
  const last = added[added.length - 1];
  // Курсор — в начало первой новой строки (Enter) или в конец последней вставленной
  const caret: NoteCaret = rest.length === 1 ? { index: i + 1, at: 0 } : { index: i + added.length, at: last ? last.text.length : 0 };
  return { blocks: next, caret };
}

/** Backspace в пустой строке i */
export function backspaceEmpty(blocks: readonly NoteBlock[], i: number): NoteEdit {
  const b = blocks[i];
  if (!b || b.text) return { blocks: [...blocks], caret: null };
  if (b.kind !== 'text') return { blocks: blocks.map((x, j) => (j === i ? { kind: 'text', text: '' } : x)), caret: { index: i, at: 0 } };
  if (i === 0 || blocks.length === 1) return { blocks: [...blocks], caret: null };
  return { blocks: blocks.filter((_, j) => j !== i), caret: { index: i - 1, at: 'end' } };
}

/**
 * Backspace в начале строки i (курсор на 0):
 *  пункт списка или заголовок — сначала становится обычной строкой (list: true — у вызывающего пауза, чтобы успеть отпустить);
 *  обычная строка — склеивается с предыдущей (пустая предыдущая просто исчезает); первая пустая при других строках — удаляется.
 */
export function backspaceAt(blocks: readonly NoteBlock[], i: number): NoteEdit & { list: boolean } {
  const b = blocks[i];
  const same = { blocks: [...blocks], caret: null, list: false };
  if (!b) return same;
  // Пустая строка выше — уходит она, строка (с её видом) поднимается на её место
  const above = i > 0 ? blocks[i - 1] : undefined;
  // (поле с курсором остаётся тем же — строка с её ключом просто поднимается)
  if (above && !above.text && above.kind === 'text') return { blocks: blocks.filter((_, j) => j !== i - 1), caret: { index: i - 1, at: 0 }, list: false };
  if (b.kind !== 'text') {
    // Курсор не трогаем: он и так в начале строки, а повторная установка обрывает зажатую клавишу
    const line: NoteBlock = { kind: 'text', text: b.text, ...(b.bold && { bold: true }), ...(b.key && { key: b.key }) };
    return { blocks: blocks.map((x, j) => (j === i ? line : x)), caret: null, list: true };
  }
  if (i === 0) {
    if (b.text || blocks.length === 1) return same;
    return { blocks: blocks.slice(1), caret: { index: 0, at: 0 }, list: false };
  }
  const prev = blocks[i - 1]!;
  // Склеенная строка берёт ключ текущей: поле с курсором не пересоздаётся и зажатый Backspace удаляет дальше
  const { key: _k, ...rest } = prev;
  const merged: NoteBlock = { ...rest, text: prev.text + b.text, ...(b.key && { key: b.key }) };
  return {
    blocks: blocks.flatMap((x, j) => (j === i ? [] : j === i - 1 ? [merged] : [x])),
    caret: { index: i - 1, at: prev.text.length },
    list: false,
  };
}

export function toggleCheck(blocks: readonly NoteBlock[], i: number): NoteBlock[] {
  return blocks.map((x, j) => (j === i && x.kind === 'check' ? { ...x, checked: !x.checked } : x));
}

/** Кнопка панели над строкой i */
export function applyTool(blocks: readonly NoteBlock[], i: number, tool: NoteTool): NoteBlock[] {
  return blocks.map((x, j) => {
    if (j !== i) return x;
    if (tool !== 'bold') return toggleKind(x, tool);
    if (x.kind === 'heading') return x;
    if (x.bold) {
      const { bold: _bold, ...rest } = x;
      return rest;
    }
    return { ...x, bold: true };
  });
}

/** Заметка пустая — начинаем с одной пустой строки */
export const startBlocks = (blocks: readonly NoteBlock[]): NoteBlock[] => (blocks.length ? [...blocks] : [fresh('text')]);
