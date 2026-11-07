/**
 * Заметка внутри темы (C-Note, src/screens/lists/NoteScreen) — как «Заметки» на iPhone: своя правится в одном поле,
 * первая строка — название; сохраняется сама — на ходу, по ГОТОВО и при уходе с экрана (назад, жест, вкладка), без вопросов.
 * Очистили и вышли — заметка удаляется; новая (id NEW_NOTE) появляется в теме topicId при первом сохранении.
 * Чужая — только читать. «Скопировать» — текст без разметки в буфер обмена, «⋯» — быстрые действия (в дела, удалить).
 */
import * as Clipboard from 'expo-clipboard';
import { router, useNavigation } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import { upper } from '@/adapters/common/ru';
import { uid } from '@/lib/ids';
import { isBlankNote, notePlain, parseNote } from '@/lib/note';
import { useStore } from '@/lib/store';
import type { ID } from '@/lib/types';
import { NoteScreen } from '@/screens/lists/NoteScreen';
import { NEW_NOTE, nav, signedInOnly, useInsets } from '../common';
import { holdIdea } from '../quick/quickStore';

const back = (topicId: ID | null) => (router.canGoBack() ? router.back() : router.navigate(topicId ? nav.topic(topicId) : nav.tab('ideas')));

const AUTOSAVE_MS = 1000;

/** Новая заметка начинается с названия */
const NEW_TEXT = '# ';

export const NoteContainer = signedInOnly(function Note({ id: routeId, topicId: routeTopic }: { id: ID; topicId: ID | null }) {
  // Новая заметка получает id сразу: при сохранении она уже в теме
  const [id] = useState(() => (routeId === NEW_NOTE ? uid() : routeId));
  const idea = useStore((s) => s.ideas.find((x) => x.id === id));
  const meId = useStore((s) => s.me?.id);
  const topicId = idea ? idea.topicId : routeTopic;
  const topicTitle = useStore((s) => (topicId ? s.topics.find((t) => t.id === topicId)?.title : undefined));
  const insets = useInsets();
  const editable = !idea || idea.ownerId === meId;
  const existed = useRef(!!idea);
  if (idea) existed.current = true;

  // Текст при открытии; дальше его хранит поле, сюда приходит каждая правка
  const [initial] = useState(() => idea?.text ?? NEW_TEXT);
  const current = useRef(initial);
  const saved = useRef(initial);
  /**
   * В хранилище (оттуда — на сервер): пустая новая не создаётся; очищенная удаляется при уходе (final),
   * а пока пишут — просто не сохраняется (иначе экран закрылся бы посреди правки)
   */
  const commit = useCallback(
    (final = true) => {
      if (!editable || current.current === saved.current) return;
      const st = useStore.getState();
      const text = current.current;
      if (isBlankNote(parseNote(text))) {
        if (!final) return;
        if (st.ideas.some((x) => x.id === id)) st.dropIdea(id);
      } else st.putNote(id, topicId, text);
      saved.current = text;
    },
    [editable, id, topicId],
  );

  // Сохраняется на ходу — через секунду после последней правки, как на iPhone
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChange = useCallback(
    (text: string) => {
      current.current = text;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => commit(false), AUTOSAVE_MS);
    },
    [commit],
  );

  // Уход с экрана любым способом — сохранить (на iPhone заметка сохраняется сама)
  const navigation = useNavigation();
  const commitRef = useRef(commit);
  commitRef.current = commit;
  useEffect(() => navigation.addListener('beforeRemove', () => commitRef.current()), [navigation]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      commitRef.current();
    },
    [],
  );

  const onCopy = useCallback(() => {
    const text = notePlain(current.current);
    if (!text) return;
    Clipboard.setStringAsync(text)
      .then(() => useStore.getState().notice('Скопировано'))
      .catch(() => useStore.getState().notice('Не скопировалось'));
  }, []);

  // Заметку удалили (быстрые действия, другой телефон) — уходим
  useEffect(() => {
    if (existed.current && !idea) back(topicId);
  }, [idea, topicId]);

  const onDone = useCallback(() => {
    Keyboard.dismiss();
    commit(false);
  }, [commit]);
  const onBack = useCallback(() => back(topicId), [topicId]);
  const onMore = useCallback(() => {
    Keyboard.dismiss();
    commit();
    if (useStore.getState().ideas.some((x) => x.id === id)) holdIdea(id);
  }, [id, commit]);

  const caption = useMemo(() => `ЗАМЕТКА · ${upper(topicTitle ?? 'Без темы')}`, [topicTitle]);

  return (
    <NoteScreen
      caption={caption}
      initial={initial}
      editable={editable}
      autoFocus={!idea}
      insets={insets}
      onChange={onChange}
      onBack={onBack}
      onMore={idea ? onMore : undefined}
      onCopy={onCopy}
      onDone={onDone}
    />
  );
});
