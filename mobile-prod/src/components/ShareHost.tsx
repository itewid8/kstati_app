/**
 * Приём «Поделиться → Кстати» в корне приложения: при запуске, когда поделились при открытом приложении,
 * и при возврате в приложение. Одна заметка — шторка (NoteShareSheet), несколько — экран «Перенести заметки».
 * Не вошли — ждём входа, текст не теряется.
 */
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { fromShare, fromTextFile, sourceLabel, type IncomingNote } from '@/lib/noteImport';
import { useStore } from '@/lib/store';
import { onShared, takeShared } from '../../modules/kstati-share';
import { NoteShareSheet } from './NoteShareSheet';

export const noteImportRoute = '/notes-import' as const;
/** Навигация после того, как корневой стек смонтирован (при холодном запуске push сразу падает) */
const openImport = () => setTimeout(() => router.push(noteImportRoute), 300);

type Inbox = { notes: IncomingNote[]; from: string | null; skipped: number };

function read(): Inbox | null {
  const p = takeShared();
  if (!p) return null;
  const notes = [
    ...fromShare({ subject: p.subject, texts: p.texts }),
    ...p.files.map((f, i) => fromTextFile(f.name, f.text, `f${i}`)).filter((n): n is IncomingNote => !!n),
  ];
  return { notes, from: sourceLabel(p.from), skipped: p.skipped };
}

export function ShareHost() {
  const signedIn = useStore((s) => !!s.session);
  const held = useRef<Inbox | null>(null);

  useEffect(() => {
    const deliver = (box: Inbox) => {
      const s = useStore.getState();
      if (!s.session) {
        held.current = box;
        return;
      }
      if (!box.notes.length) {
        if (box.skipped) s.notice('Картинки и файлы не переносятся');
        return;
      }
      s.setNoteInbox(box);
      if (box.notes.length > 1) openImport();
    };
    const check = () => {
      const box = read();
      if (box) deliver(box);
    };
    check();
    const off = onShared(check);
    const sub = AppState.addEventListener('change', (st) => st === 'active' && check());
    return () => {
      off();
      sub.remove();
    };
  }, []);

  // Вошли — отдать отложенное
  useEffect(() => {
    if (!signedIn || !held.current) return;
    const box = held.current;
    held.current = null;
    const s = useStore.getState();
    if (!box.notes.length) return;
    s.setNoteInbox(box);
    if (box.notes.length > 1) openImport();
  }, [signedIn]);

  return <NoteShareSheet />;
}
