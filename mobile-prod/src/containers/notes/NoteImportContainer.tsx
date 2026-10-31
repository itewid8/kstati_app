import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { openMenu } from '@/components/ActionMenu';
import { useMyTopics } from '@/components/NoteShareSheet';
import { logError } from '@/lib/diag';
import { pickNoteFiles, noteFilesAvailable } from '@/lib/noteFilesNative';
import { checkCount, displayTitle, groupNotes, noteText, targetOf, type IncomingNote, type NoteDest } from '@/lib/noteImport';
import { useStore } from '@/lib/store';
import { MONTHS_SHORT } from '@/screens/calendar/format';
import { NoteImportScreen, type NoteGroup } from '@/screens/notes/NoteImportScreen';
import { useInsets } from '../common';

type Source = { title: string; kind: 'keep' | 'files' | 'share'; from: string | null; notes: IncomingNote[] };

const back = () => (router.canGoBack() ? router.back() : router.replace('/ideas'));
const word = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? 'ЗАМЕТКА' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'ЗАМЕТКИ' : 'ЗАМЕТОК');
const dateOf = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
};

/** Перенести заметки: из файлов (Takeout, json, txt, md) или несколько сразу через «Поделиться» */
export function NoteImportContainer() {
  const insets = useInsets();
  const inbox = useStore((s) => s.noteInbox);
  const st = useStore(useShallow((s) => ({ ideas: s.ideas, meId: s.me?.id })));
  const { mine } = useMyTopics();
  const [source, setSource] = useState<Source | null>(() =>
    inbox && inbox.notes.length > 1 ? { title: `ИЗ ${inbox.from ?? 'ДРУГОГО ПРИЛОЖЕНИЯ'}`, kind: 'share', from: inbox.from, notes: inbox.notes } : null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(() =>
    noteFilesAvailable() || (inbox && inbox.notes.length > 1) ? undefined : 'Выбор файлов появится в новой сборке приложения',
  );
  const hasLabels = !!source?.notes.some((n) => n.labels.length);
  const [destRaw, setDest] = useState<NoteDest | null>(null);
  const dest: NoteDest = destRaw ?? (hasLabels ? 'labels' : 'none');
  const [selected, setSelected] = useState<ReadonlySet<string> | null>(null);

  const existing = useMemo(() => new Set(st.ideas.filter((i) => i.ownerId === st.meId).map((i) => i.text)), [st.ideas, st.meId]);
  const notes = source?.notes ?? [];
  const isDone = useCallback((n: IncomingNote) => existing.has(noteText(n)), [existing]);
  const free = useMemo(() => notes.filter((n) => !isDone(n)).map((n) => n.key), [notes, isDone]);
  // По умолчанию отмечено всё, кроме уже перенесённого
  const chosen = selected ?? new Set(free);
  const count = free.filter((k) => chosen.has(k)).length;
  const newTitle = source?.kind === 'keep' ? 'Из Keep' : source?.from ? `Из ${source.from.charAt(0)}${source.from.slice(1).toLowerCase()}` : 'Из файлов';

  const topicTitle = useCallback(
    (label: string | null) => {
      if (dest === 'none') return 'БЕЗ ТЕМЫ';
      if (dest === 'new') return `НОВАЯ «${newTitle.toUpperCase()}»`;
      if (dest === 'labels') return label ? (mine.find((t) => t.title.trim().toLowerCase() === label.toLowerCase())?.title ?? label).toUpperCase() : 'БЕЗ ТЕМЫ';
      return (mine.find((t) => `t:${t.id}` === dest)?.title ?? '').toUpperCase();
    },
    [dest, newTitle, mine],
  );
  const groups = useMemo<NoteGroup[]>(
    () =>
      groupNotes(notes, dest === 'labels').map((g) => ({
        key: g.key,
        title: dest === 'labels' ? `${g.label ? g.label.toUpperCase() : 'БЕЗ ЯРЛЫКА'} → ${topicTitle(g.label)}` : `ЗАМЕТКИ → ${topicTitle(null)}`,
        rows: g.notes.map((n) => {
          const checks = checkCount(n.body);
          const first = n.body.split('\n').find((l) => l.trim() && !l.startsWith('- [')) ?? '';
          return {
            key: n.key,
            title: displayTitle(n),
            meta: [dateOf(n.at), checks ? `${checks} ПУНКТ.` : first.slice(0, 60)].filter(Boolean).join(' · '),
            state: isDone(n) ? ('done' as const) : ('new' as const),
            checked: !isDone(n) && chosen.has(n.key),
          };
        }),
      })),
    [notes, dest, topicTitle, isDone, chosen],
  );

  const toggle = (keys: readonly string[]) => {
    const next = new Set(chosen);
    const all = keys.every((k) => next.has(k));
    keys.forEach((k) => (all ? next.delete(k) : next.add(k)));
    setSelected(next);
  };
  const onPick = async () => {
    setError(undefined);
    setLoading(true);
    try {
      const got = await pickNoteFiles();
      if (got) {
        setSource({ title: got.label, kind: got.source, from: null, notes: got.notes });
        setSelected(null);
        setDest(null);
      }
    } catch (e) {
      logError(e);
      setError(noteFilesAvailable() ? 'Не получилось прочитать файл' : 'Выбор файлов появится в новой сборке приложения');
    } finally {
      setLoading(false);
    }
  };
  const destOptions: { key: NoteDest; label: string }[] = [
    ...(hasLabels ? [{ key: 'labels' as const, label: 'ПО ЯРЛЫКАМ KEEP' }] : []),
    { key: 'none', label: 'БЕЗ ТЕМЫ' },
    { key: 'new', label: `НОВАЯ «${newTitle.toUpperCase()}»` },
    ...mine.map((t) => ({ key: `t:${t.id}` as NoteDest, label: t.title.toUpperCase() })),
  ];
  const onTransfer = () => {
    const list = notes.filter((n) => chosen.has(n.key) && !isDone(n)).map((n) => ({ text: noteText(n), topic: targetOf(n, dest, newTitle) }));
    useStore.getState().importNotes(list);
    setSelected(new Set());
    if (source?.kind === 'share') useStore.getState().setNoteInbox(null);
  };
  const doneCount = notes.length - free.length;

  return (
    <NoteImportScreen
      phase={loading ? 'loading' : source ? 'ready' : 'empty'}
      sourceTitle={source?.title}
      sourceMeta={[
        source?.kind === 'keep' ? 'GOOGLE KEEP' : source?.kind === 'share' ? 'ПОДЕЛИЛИСЬ' : 'ФАЙЛЫ',
        `${notes.length} ${word(notes.length)}`,
        doneCount ? `${doneCount} УЖЕ ЕСТЬ` : '',
      ]
        .filter(Boolean)
        .join(' · ')}
      groups={groups}
      destLabel={destOptions.find((d) => d.key === dest)?.label ?? 'БЕЗ ТЕМЫ'}
      selected={count}
      allChecked={!!free.length && count === free.length}
      error={error}
      insets={insets}
      onBack={() => {
        if (source?.kind === 'share') useStore.getState().setNoteInbox(null);
        back();
      }}
      onPick={source?.kind === 'share' ? undefined : () => void onPick()}
      onToggleRow={(k) => toggle([k])}
      onToggleGroup={(key) => {
        const g = groups.find((x) => x.key === key);
        if (g) toggle(g.rows.filter((r) => r.state === 'new').map((r) => r.key));
      }}
      onToggleAll={() => setSelected(count === free.length ? new Set() : new Set(free))}
      onPickDest={() => openMenu({ title: 'В какие темы', actions: destOptions.map((d) => ({ label: d.label, onPress: () => setDest(d.key) })) })}
      onTransfer={onTransfer}
    />
  );
}
