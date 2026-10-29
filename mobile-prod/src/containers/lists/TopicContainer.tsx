/**
 * Тема заметок (C-Topic, src/screens/sheets/TopicScreen). Тема — сама заметка: своя пишется сразу (название в заголовке,
 * текст — строками заметки, useNoteEditor), сохраняется сама. Новая тема (id NEW_NOTE) появляется с первым словом
 * названия или текста; нет названия — берётся первая строка текста. «+» — заметка внутри темы (C-Note),
 * своя тема — удалять заметки смахиванием, открывать группам, меню «⋯». Чужая открытая тема — только читать.
 * Пока экран открыт, голосовая заметка без названной темы ложится сюда. Потянуть вниз — обновить.
 */
import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { topicProps, type TopicSnapshot } from '@/adapters/lists/topic';
import { PullScreen, PullScrollView } from '@/components/PullRefresh';
import { TopicShareSheet } from '@/components/TopicShareSheet';
import { topicMenu } from '@/lib/ideas';
import { uid } from '@/lib/ids';
import { notePlain, parseNote, plainLine } from '@/lib/note';
import { useStore } from '@/lib/store';
import { INBOX, type ID } from '@/lib/types';
import { TopicScreen } from '@/screens/sheets';
import type { LiftTarget } from '@/ui';
import { NEW_NOTE, NO_ME, nav, signedInOnly, useChrome, useInsets, usePersonColors, type StoreState } from '../common';
import { holdIdea } from '../quick/quickStore';
import { useNoteEditor } from './useNoteEditor';

const pickTopic = (s: StoreState): TopicSnapshot & { groups: StoreState['groups'] } => ({
  me: s.me ?? NO_ME,
  users: s.users,
  groups: s.groups,
  topics: s.topics,
  ideas: s.ideas,
});

const back = () => (router.canGoBack() ? router.back() : router.navigate(nav.tab('ideas')));
const deleteIdea = (id: ID) => useStore.getState().deleteIdea(id);
const hold = (id: ID, lift: LiftTarget) => holdIdea(id, lift);

/** Название новой темы без названия — первая строка текста */
const titleOf = (title: string, body: string) => title.trim() || (parseNote(body).map((b) => plainLine(b.text)).find(Boolean) ?? '').slice(0, 80);

export const TopicContainer = signedInOnly(function Topic({ id: routeId }: { id: ID }) {
  const isNew = routeId === NEW_NOTE;
  // Новая тема получает id сразу: с первым словом она уже в списке
  const [id] = useState(() => (isNew ? uid() : routeId));
  const s = useStore(useShallow(pickTopic));
  const insets = useInsets();
  const { onNavigate, onRec } = useChrome('ideas');
  const colors = usePersonColors(s);
  const data = useMemo(() => topicProps(s, colors, id), [s, colors, id]);
  const topic = useMemo(() => s.topics.find((t) => t.id === id), [s.topics, id]);
  const [sharing, setSharing] = useState(false);
  const inbox = id === INBOX;
  // Новая — своя, даже пока её нет в хранилище
  const own = data.own || isNew;
  const exists = data.exists || isNew;
  const editable = own && !inbox;

  const [title, setTitle] = useState(() => topic?.title ?? '');
  const titleRef = useRef(title);
  const bodyRef = useRef(topic?.body ?? '');
  const saveTopic = useCallback(() => {
    if (!editable) return;
    const name = titleOf(titleRef.current, bodyRef.current);
    if (name) useStore.getState().putTopic(id, name, bodyRef.current);
  }, [editable, id]);
  const saveBody = useCallback(
    (text: string) => {
      bodyRef.current = text;
      saveTopic();
    },
    [saveTopic],
  );
  const ed = useNoteEditor(data.bodyText ?? '', saveBody);
  const onChangeTitle = useCallback(
    (t: string) => {
      const one = t.replace(/\s*\n\s*/g, ' ');
      titleRef.current = one;
      setTitle(one);
      saveTopic();
    },
    [saveTopic],
  );

  // Голос, начатый на этом экране, кладёт заметки в эту тему
  const voiceTopic = own && !inbox && topic ? topic.id : null;
  useFocusEffect(
    useCallback(() => {
      useStore.getState().setVoiceTopic(voiceTopic);
      return () => useStore.getState().setVoiceTopic(null);
    }, [voiceTopic]),
  );

  const share = useCallback(() => setSharing(true), []);
  const closeShare = useCallback(() => setSharing(false), []);
  // Заметка внутри: новой темы ещё может не быть — сохраняем (без названия — «Новая тема»)
  const add = useCallback(() => {
    if (inbox) return router.push(nav.note(NEW_NOTE, null));
    ed.flush();
    if (!useStore.getState().topics.some((t) => t.id === id)) {
      if (!titleRef.current.trim() && !titleOf('', bodyRef.current)) titleRef.current = 'Новая тема';
      saveTopic();
    }
    router.push(nav.note(NEW_NOTE, id));
  }, [inbox, id, ed, saveTopic]);
  const more = useCallback(() => {
    Keyboard.dismiss();
    if (topic) topicMenu(topic, share);
  }, [topic, share]);
  const open = useCallback((ideaId: ID) => router.push(nav.note(ideaId)), []);
  // Тема целиком: название, её текст и заметки внутри (в порядке списка), через пустую строку
  const copy = useCallback(() => {
    ed.flush();
    const name = titleOf(titleRef.current, bodyRef.current);
    const head = notePlain([name, bodyRef.current].filter((x) => x.trim()).join('\n'));
    const all = useStore.getState().ideas;
    const notes = data.ideas.flatMap((r) => {
      const idea = all.find((x) => x.id === r.id);
      const t = idea ? notePlain(idea.text) : '';
      return t ? [t] : [];
    });
    const text = [head, ...notes].filter(Boolean).join('\n\n');
    if (!text) return;
    Clipboard.setStringAsync(text)
      .then(() => useStore.getState().notice('Скопировано'))
      .catch(() => useStore.getState().notice('Не скопировалось'));
  }, [ed, data.ideas]);
  // Название показываем своё (правится), пока темы нет — пустое
  const shownTitle = editable ? title : data.title;

  return (
    <PullScreen>
      <View style={styles.fill}>
        <TopicScreen
          {...data}
          title={shownTitle}
          caption={isNew && !topic ? 'ТЕМА' : data.caption}
          onChangeTitle={editable ? onChangeTitle : undefined}
          focusTitle={isNew}
          body={
            data.bodyText !== null || isNew
              ? {
                  blocks: ed.blocks,
                  editable,
                  active: ed.active,
                  caret: ed.caret,
                  onChangeText: ed.onChangeText,
                  onBackspace: ed.onBackspace,
                  onToggleCheck: ed.onToggleCheck,
                  onFocus: ed.onFocus,
                  onTool: ed.onTool,
                  onStart: ed.focusEnd,
                }
              : undefined
          }
          insets={insets}
          Scroll={PullScrollView}
          onBack={back}
          onShare={own && topic ? share : undefined}
          onAdd={own && exists ? add : undefined}
          onMore={own && topic ? more : undefined}
          onCopy={data.bodyText !== null || isNew ? copy : undefined}
          onOpenIdea={open}
          onHoldIdea={hold}
          onDeleteIdea={own ? deleteIdea : undefined}
          onNavigate={onNavigate}
          onRec={onRec}
        />
        <TopicShareSheet topicId={sharing && topic ? topic.id : null} onClose={closeShare} />
      </View>
    </PullScreen>
  );
});

const styles = StyleSheet.create({ fill: { flex: 1 } });
