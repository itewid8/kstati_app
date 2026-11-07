/**
 * Редактор заметок (tiptap, prosemirror — около 650 КБ в вебе) отдельным куском: грузится при входе
 * в «Заметки» или при открытии заметки, а не при запуске. Без React.lazy: Suspense при повторной
 * приостановке снимает эффекты, и редактор tiptap уничтожается под ногами.
 */
import { useEffect, useState } from 'react';
import type { NoteContainer as NoteContainerType } from './NoteContainer';

type Note = typeof NoteContainerType;
let loaded: Note | null = null;
let loading: Promise<Note> | null = null;

/** Начать загрузку заранее (ничего не делает, если уже загружено) */
export const preloadNote = (): Promise<Note> =>
  (loading ??= import('./NoteContainer').then((m) => (loaded = m.NoteContainer)).catch((e: unknown) => {
    loading = null;
    throw e;
  }));

/** Компонент заметки, когда он загружен; до этого — null */
export function useNoteContainer(): Note | null {
  const [note, setNote] = useState<Note | null>(() => loaded);
  useEffect(() => {
    if (note) return;
    let live = true;
    preloadNote().then((c) => live && setNote(() => c), () => {});
    return () => {
      live = false;
    };
  }, [note]);
  return note;
}
