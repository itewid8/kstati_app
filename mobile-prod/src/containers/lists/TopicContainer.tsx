/**
 * Тема заметок (C-Topic, src/screens/sheets/TopicScreen). Тема — сама заметка: своя пишется сразу (название в заголовке,
 * текст — строками заметки, useNoteEditor), сохраняется по ГОТОВО (уйти с правками — «Сохранить изменения?»).
 * Новая тема (id NEW_NOTE) появляется при сохранении; нет названия — берётся первая строка текста. «+» — заметка внутри темы (C-Note),
 * своя тема — удалять заметки смахиванием, открывать группам, меню «⋯». Чужая открытая тема — только читать.
 * Пока экран открыт, голосовая заметка без названной темы ложится сюда. Потянуть вниз — обновить.
 */
import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Keyboard, StyleSheet, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { topicProps, type TopicSnapshot } from '@/adapters/lists/topic';
import { PullScreen, PullScrollView } from '@/components/PullRefresh';
import { TopicShareSheet } from '@/components/TopicShareSheet';
import { openMenu } from '@/components/ActionMenu';
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
import { useUnsavedGuard } from './useUnsavedGuard';

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
  const savedTitle = useRef(title);
  const ed = useNoteEditor(data.bodyText ?? '');
  const onChangeTitle = useCallback((t: string) => {
    const one = t.replace(/\s*\n\s*/g, ' ');
    titleRef.current = one;
    setTitle(one);
  }, []);
  const dirty = useCallback(() => editable && (ed.dirty() || titleRef.current !== savedTitle.current), [editable, ed]);
  /** Сохранить тему — по ГОТОВО (и перед заметкой внутри): без названия — первая строка текста; пустая не создаётся */
  const commit = useCallback(() => {
    if (!dirty()) return;
    const body = ed.text();
    const name = titleOf(titleRef.current, body);
    if (name) useStore.getState().putTopic(id, name, body);
    ed.markSaved();
    savedTitle.current = titleRef.current;
  }, [dirty, ed, id]);
  const discard = useCallback(() => {
    ed.revert();
    titleRef.current = savedTitle.current;
    setTitle(savedTitle.current);
  }, [ed]);
  useUnsavedGuard(dirty, commit, discard);
  const done = useCallback(() => {
    Keyboard.dismiss();
    commit();
  }, [commit]);

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
    if (!useStore.getState().topics.some((t) => t.id === id) && !titleOf(titleRef.current, ed.text())) {
      titleRef.current = 'Новая тема';
      setTitle('Новая тема');
    }
    // Заметка внутри — тема должна быть: сохраняем
    if (dirty() || !useStore.getState().topics.some((t) => t.id === id)) {
      const body = ed.text();
      useStore.getState().putTopic(id, titleOf(titleRef.current, body), body);
      ed.markSaved();
      savedTitle.current = titleRef.current;
    }
    router.push(nav.note(NEW_NOTE, id));
  }, [inbox, id, ed, dirty]);
  // Выбор заметок — удалить несколько разом
  const [selected, setSelected] = useState<ID[] | null>(null);
  const startSelect = useCallback(() => setSelected([]), []);
  const cancelSelect = useCallback(() => setSelected(null), []);
  const toggleSelect = useCallback((ideaId: ID) => setSelected((cur) => (cur ? (cur.includes(ideaId) ? cur.filter((x) => x !== ideaId) : [...cur, ideaId]) : cur)), []);
  const deleteSelected = useCallback(() => {
    if (selected?.length) useStore.getState().deleteIdeas(selected);
    setSelected(null);
  }, [selected]);
  const hasIdeas = data.ideas.length > 0;
  const allIds = useMemo(() => data.ideas.map((x) => x.id), [data.ideas]);
  const allSelected = !!selected && !!allIds.length && allIds.every((x) => selected.includes(x));
  const selectAll = useCallback(() => setSelected(allSelected ? [] : allIds), [allSelected, allIds]);
  // «Назад» Android в режиме выбора — выйти из выбора
  useEffect(() => {
    if (!selected) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelected(null);
      return true;
    });
    return () => sub.remove();
  }, [selected]);
  const more = useCallback(() => {
    Keyboard.dismiss();
    if (topic) topicMenu(topic, share, hasIdeas ? startSelect : undefined);
    else if (inbox && hasIdeas) openMenu({ title: 'Без темы', actions: [{ label: 'Выбрать заметки', onPress: startSelect }] });
  }, [topic, share, hasIdeas, startSelect, inbox]);
  const open = useCallback((ideaId: ID) => router.push(nav.note(ideaId)), []);
  // Тема целиком: название, её текст и заметки внутри (в порядке списка), через пустую строку
  const copy = useCallback(() => {
    const body = ed.text();
    const name = titleOf(titleRef.current, body);
    const head = notePlain([name, body].filter((x) => x.trim()).join('\n'));
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
          onMore={(own && topic) || (inbox && hasIdeas) ? more : undefined}
          selected={selected}
          onToggleSelect={toggleSelect}
          onCancelSelect={cancelSelect}
          onDeleteSelected={deleteSelected}
          onStartSelect={((own && topic) || inbox) && hasIdeas ? startSelect : undefined}
          onSelectAll={selectAll}
          allSelected={allSelected}
          onDone={editable ? done : undefined}
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
