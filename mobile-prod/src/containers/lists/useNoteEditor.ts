/**
 * Правка заметки по строкам (заметка C-Note и текст темы C-Topic): строки, строка с курсором, куда поставить курсор,
 * обработчики строк и панели. Сохранение — save(text) через полсекунды после правки и при уходе с экрана
 * (пустой текст тоже сохраняется: что делать с пустым — решает save).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { parseNote, serializeNote, type NoteBlock } from '@/lib/note';
import { applyTool, backspaceEmpty, changeText, startBlocks, toggleCheck, type NoteCaret, type NoteTool } from '@/lib/noteEdit';

const SAVE_MS = 500;

export function useNoteEditor(initial: string, save: (text: string) => void, opts: { focusFirst?: boolean } = {}) {
  const [blocks, setBlocks] = useState<NoteBlock[]>(() => startBlocks(initial ? parseNote(initial) : []));
  const [active, setActive] = useState<number | null>(null);
  const [caret, setCaret] = useState<(NoteCaret & { nonce: number }) | null>(() => (opts.focusFirst ? { index: 0, at: 0, nonce: 1 } : null));
  const latest = useRef(blocks);
  latest.current = blocks;
  const saveRef = useRef(save);
  saveRef.current = save;
  const dirty = useRef(false);

  const flush = useCallback(() => {
    if (!dirty.current) return;
    dirty.current = false;
    saveRef.current(serializeNote(latest.current));
  }, []);

  const edit = useCallback((next: NoteBlock[]) => {
    dirty.current = true;
    setBlocks(next);
  }, []);

  // Сохранение через полсекунды после правки и при уходе
  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(flush, SAVE_MS);
    return () => clearTimeout(t);
  }, [blocks, flush]);
  useEffect(() => flush, [flush]);

  const moveCaret = useCallback((c: NoteCaret | null) => {
    if (!c) return;
    setActive(c.index);
    setCaret((p) => ({ ...c, nonce: (p?.nonce ?? 0) + 1 }));
  }, []);

  const onChangeText = useCallback(
    (i: number, text: string) => {
      const r = changeText(latest.current, i, text);
      edit(r.blocks);
      moveCaret(r.caret);
    },
    [edit, moveCaret],
  );
  const onBackspace = useCallback(
    (i: number) => {
      const r = backspaceEmpty(latest.current, i);
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

  return { blocks, active, caret, flush, focusEnd, onChangeText, onBackspace, onToggleCheck, onTool, onFocus: setActive };
}
