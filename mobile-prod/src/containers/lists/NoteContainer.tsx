/**
 * Заметка внутри темы (C-Note, src/screens/lists/NoteScreen). Своя — название и строки правятся (useNoteEditor),
 * сохраняется сама; очистили и вышли — заметка удаляется. Новая (id NEW_NOTE) появляется в теме topicId с первым словом.
 * Чужая — только читать. «Скопировать» — текст без разметки в буфер обмена, «В тему» — перенос (своя),
 * «⋯» — быстрые действия (в дела, копия, удалить).
 */
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import { upper } from '@/adapters/common/ru';
import { uid } from '@/lib/ids';
import { moveNoteMenu } from '@/lib/ideas';
import { isBlankNote, joinTitle, notePlain, parseNote, splitTitle } from '@/lib/note';
import { useStore } from '@/lib/store';
import type { ID } from '@/lib/types';
import { NoteScreen } from '@/screens/lists/NoteScreen';
import { NEW_NOTE, nav, signedInOnly, useInsets } from '../common';
import { holdIdea } from '../quick/quickStore';
import { useNoteEditor } from './useNoteEditor';

const back = (topicId: ID | null) => (router.canGoBack() ? router.back() : router.navigate(topicId ? nav.topic(topicId) : nav.tab('ideas')));

export const NoteContainer = signedInOnly(function Note({ id: routeId, topicId: routeTopic }: { id: ID; topicId: ID | null }) {
  // Новая заметка получает id сразу: с первым словом она уже в теме
  const [id] = useState(() => (routeId === NEW_NOTE ? uid() : routeId));
  const idea = useStore((s) => s.ideas.find((x) => x.id === id));
  const meId = useStore((s) => s.me?.id);
  const topicId = idea ? idea.topicId : routeTopic;
  const topicTitle = useStore((s) => (topicId ? s.topics.find((t) => t.id === topicId)?.title : undefined));
  const insets = useInsets();
  const editable = !idea || idea.ownerId === meId;
  const existed = useRef(!!idea);
  if (idea) existed.current = true;

  // Название — первая строка-заголовок текста
  const [parts] = useState(() => splitTitle(idea?.text ?? ''));
  const [title, setTitle] = useState(parts.title);
  const titleRef = useRef(title);
  const bodyRef = useRef(parts.body);

  /** В хранилище (оттуда — на сервер): пустая новая не создаётся, очищенная удаляется */
  const store = useCallback(() => {
    if (!editable) return;
    const st = useStore.getState();
    const text = joinTitle(titleRef.current, bodyRef.current);
    if (isBlankNote(parseNote(text))) {
      if (st.ideas.some((x) => x.id === id)) st.dropIdea(id);
      return;
    }
    st.putNote(id, topicId, text);
  }, [editable, id, topicId]);
  const save = useCallback(
    (body: string) => {
      bodyRef.current = body;
      store();
    },
    [store],
  );
  const ed = useNoteEditor(parts.body, save);
  const onChangeTitle = useCallback(
    (t: string) => {
      titleRef.current = t;
      setTitle(t);
      store();
    },
    [store],
  );
  const onCopy = useCallback(() => {
    ed.flush();
    const text = notePlain(joinTitle(titleRef.current, bodyRef.current));
    if (!text) return;
    Clipboard.setStringAsync(text)
      .then(() => useStore.getState().notice('Скопировано'))
      .catch(() => useStore.getState().notice('Не скопировалось'));
  }, [ed]);
  const onMove = useCallback(() => {
    Keyboard.dismiss();
    ed.flush();
    const cur = useStore.getState().ideas.find((x) => x.id === id);
    if (cur) moveNoteMenu(cur);
  }, [id, ed]);

  // Заметку удалили (быстрые действия, другой телефон) — уходим
  useEffect(() => {
    if (existed.current && !idea) back(topicId);
  }, [idea, topicId]);

  const onDone = useCallback(() => {
    Keyboard.dismiss();
    back(topicId);
  }, [topicId]);
  const onMore = useCallback(() => {
    Keyboard.dismiss();
    ed.flush();
    if (useStore.getState().ideas.some((x) => x.id === id)) holdIdea(id);
  }, [id, ed]);

  const caption = useMemo(() => `ЗАМЕТКА · ${upper(topicTitle ?? 'Без темы')}`, [topicTitle]);

  return (
    <NoteScreen
      caption={caption}
      title={title}
      onChangeTitle={editable ? onChangeTitle : undefined}
      focusTitle={!idea}
      blocks={ed.blocks}
      editable={editable}
      active={ed.active}
      caret={ed.caret}
      insets={insets}
      onBack={onDone}
      onMore={idea ? onMore : undefined}
      onCopy={onCopy}
      onMove={idea && editable ? onMove : undefined}
      onChangeText={ed.onChangeText}
      onBackspace={ed.onBackspace}
      onToggleCheck={ed.onToggleCheck}
      onFocus={ed.onFocus}
      onTool={ed.onTool}
      onDone={onDone}
    />
  );
});
