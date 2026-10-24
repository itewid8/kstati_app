/**
 * Тема идей (src/screens/sheets/TopicScreen). Своя — добавлять, править, удалять смахиванием, открывать группам, меню «⋯»;
 * чужая открытая — только читать (нажатие и удержание — быстрые действия: в дела, копия к себе).
 * Пока экран открыт, голосовая идея без названной темы ложится сюда. Потянуть вниз — обновить.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { topicProps, type TopicSnapshot } from '@/adapters/lists/topic';
import { PullScreen, PullScrollView } from '@/components/PullRefresh';
import { TopicShareSheet } from '@/components/TopicShareSheet';
import { editIdea, topicMenu } from '@/lib/ideas';
import { uid } from '@/lib/ids';
import { useStore } from '@/lib/store';
import { INBOX, type ID } from '@/lib/types';
import { TopicScreen } from '@/screens/sheets';
import type { LiftTarget } from '@/ui';
import { NO_ME, nav, signedInOnly, useChrome, useInsets, usePersonColors, type StoreState } from '../common';
import { holdIdea } from '../quick/quickStore';

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

export const TopicContainer = signedInOnly(function Topic({ id }: { id: ID }) {
  const s = useStore(useShallow(pickTopic));
  const insets = useInsets();
  const { onNavigate, onRec } = useChrome('ideas');
  const colors = usePersonColors(s);
  const data = useMemo(() => topicProps(s, colors, id), [s, colors, id]);
  const topic = useMemo(() => s.topics.find((t) => t.id === id), [s.topics, id]);
  const [sharing, setSharing] = useState(false);
  const inbox = id === INBOX;
  const { own, exists } = data;

  // Голос, начатый на этом экране, кладёт идеи в эту тему
  const voiceTopic = own && !inbox && topic ? topic.id : null;
  useFocusEffect(
    useCallback(() => {
      useStore.getState().setVoiceTopic(voiceTopic);
      return () => useStore.getState().setVoiceTopic(null);
    }, [voiceTopic]),
  );

  const share = useCallback(() => setSharing(true), []);
  const closeShare = useCallback(() => setSharing(false), []);
  const add = useCallback(
    () =>
      useStore.getState().setCard({
        source: 'manual',
        editing: true,
        items: [{ key: uid(), type: 'idea', data: { title: '', topicId: inbox ? null : (topic?.id ?? null), newTopic: null } }],
      }),
    [inbox, topic?.id],
  );
  const more = useCallback(() => {
    if (topic) topicMenu(topic, share);
  }, [topic, share]);
  // Своя — правка; чужая — быстрые действия (в дела, копия к себе)
  const open = useCallback(
    (ideaId: ID) => {
      const idea = useStore.getState().ideas.find((x) => x.id === ideaId);
      if (!idea) return;
      if (own) editIdea(idea);
      else holdIdea(idea.id);
    },
    [own],
  );

  return (
    <PullScreen>
      <View style={styles.fill}>
        <TopicScreen
          {...data}
          insets={insets}
          Scroll={PullScrollView}
          onBack={back}
          onShare={own && topic ? share : undefined}
          onAdd={own && exists ? add : undefined}
          onMore={own && topic ? more : undefined}
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
