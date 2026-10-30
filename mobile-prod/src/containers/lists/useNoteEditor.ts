/**
 * Правка заметки по строкам (заметка C-Note и текст темы C-Topic): строки, строка с курсором, куда поставить курсор,
 * обработчики строк и панели. Сам ничего не сохраняет: text() — текущий текст, dirty() — правили ли с последнего
 * сохранения, markSaved() — сохранено (вызывающий сохраняет по ГОТОВО), revert() — вернуть сохранённое.
 * У строк — постоянные ключи: поле с курсором не пересоздаётся, и зажатый Backspace идёт по строкам дальше.
 */
import { useCallback, useRef, useState } from 'react';
import { uid } from '@/lib/ids';
import { parseNote, serializeNote, type NoteBlock } from '@/lib/note';
import { applyTool, backspaceAt, changeText, startBlocks, toggleCheck, type NoteCaret, type NoteTool } from '@/lib/noteEdit';

/** Пауза после того, как Backspace снял вид у пункта списка */
const LIST_PAUSE_MS = 600;

/** Ключи строк: правка той же длины наследует ключи по месту, недостающие и повторы — новые */
function keyed(prev: readonly NoteBlock[], next: readonly NoteBlock[]): NoteBlock[] {
  const seen = new Set<string>();
  return next.map((b, j) => {
    let key = b.key ?? (prev.length === next.length ? prev[j]?.key : undefined);
    if (!key || seen.has(key)) key = uid();
    seen.add(key);
    return b.key === key ? b : { ...b, key };
  });
}

const fromText = (text: string) => keyed([], startBlocks(text ? parseNote(text) : []));

export function useNoteEditor(initial: string, opts: { focusFirst?: boolean } = {}) {
  const [blocks, setBlocks] = useState<NoteBlock[]>(() => fromText(initial));
  const [active, setActive] = useState<number | null>(null);
  const [caret, setCaret] = useState<(NoteCaret & { nonce: number }) | null>(() => (opts.focusFirst ? { index: 0, at: 0, nonce: 1 } : null));
  const latest = useRef(blocks);
  latest.current = blocks;
  /** Последний сохранённый текст — с ним сравнивается «правили ли» и к нему возвращает revert */
  const saved = useRef(serializeNote(blocks));

  const edit = useCallback((next: NoteBlock[]) => {
    const k = keyed(latest.current, next);
    latest.current = k;
    setBlocks(k);
  }, []);

  const text = useCallback(() => serializeNote(latest.current), []);
  const dirty = useCallback(() => serializeNote(latest.current) !== saved.current, []);
  const markSaved = useCallback(() => {
    saved.current = serializeNote(latest.current);
  }, []);
  const revert = useCallback(() => {
    const back = fromText(saved.current);
    latest.current = back;
    setBlocks(back);
    setActive(null);
  }, []);

  const moveCaret = useCallback((c: NoteCaret | null) => {
    if (!c) return;
    setActive(c.index);
    setCaret((p) => ({ ...c, nonce: (p?.nonce ?? 0) + 1 }));
  }, []);

  const onChangeText = useCallback(
    (i: number, t: string) => {
      const r = changeText(latest.current, i, t);
      edit(r.blocks);
      moveCaret(r.caret);
    },
    [edit, moveCaret],
  );
  // Зажатый Backspace удаляет подряд; на пункте списка — пауза, чтобы успеть отпустить
  const listPause = useRef(0);
  const onBackspace = useCallback(
    (i: number) => {
      if (Date.now() < listPause.current) return;
      const r = backspaceAt(latest.current, i);
      if (r.list) listPause.current = Date.now() + LIST_PAUSE_MS;
      if (r.blocks.length === latest.current.length && r.blocks.every((b, j) => b === latest.current[j])) return;
      edit(r.blocks);
      moveCaret(r.caret);
    },
    [edit, moveCaret],
  );
  const onToggleCheck = useCallback((i: number) => edit(toggleCheck(latest.current, i)), [edit]);
  const onTool = useCallback(
    (tool: NoteTool) => {
      if (active !== null) edit(applyTool(latest.current, active, tool));
    },
    [active, edit],
  );

  /** Курсор в конец текста (из названия — клавишей «Далее») */
  const focusEnd = useCallback(() => moveCaret({ index: Math.max(0, latest.current.length - 1), at: 'end' }), [moveCaret]);

  return { blocks, active, caret, text, dirty, markSaved, revert, focusEnd, onChangeText, onBackspace, onToggleCheck, onTool, onFocus: setActive };
}
