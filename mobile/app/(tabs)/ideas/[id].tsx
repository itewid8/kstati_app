import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomSpace } from '@/components/BottomBar';
import { ChevronLeft, Ellipsis, Plus, Users } from '@/components/icons';
import { LayoutAnimationConfig, ListItem } from '@/components/ListItem';
import { PullScreen, PullScrollView } from '@/components/PullRefresh';
import { SwipeRow } from '@/components/SwipeRow';
import { TopicShareSheet } from '@/components/TopicShareSheet';
import { Divider, T } from '@/components/ui';
import { shortDate, toISODate } from '@/lib/dates';
import { editIdea, ideaMenu, ideasOf, topicMenu } from '@/lib/ideas';
import { uid } from '@/lib/ids';
import { useStore } from '@/lib/store';
import { INBOX, type Idea } from '@/lib/types';
import { ICON, space, useColors } from '@/theme';

/**
 * Тема идей: новые сверху. Своя — можно добавлять, править, переносить, открывать группам.
 * Открытая мне чужая — только читать и копировать идеи в свои дела, хотелки и «Смотреть».
 * Пока экран открыт, голосовая идея без названной темы ложится сюда.
 */
export default function TopicScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useStore((s) => s.me)!;
  const topic = useStore((s) => s.topics.find((t) => t.id === id) ?? null);
  const ideas = useStore((s) => s.ideas);
  const users = useStore((s) => s.users);
  const { setCard, setVoiceTopic, deleteIdea } = useStore.getState();
  const bottom = useBottomSpace();
  const [sharing, setSharing] = useState(false);

  const inbox = id === INBOX;
  const own = inbox || topic?.ownerId === me.id;
  const list = useMemo(() => ideasOf(ideas, id ?? INBOX, me.id), [ideas, id, me.id]);
  const owner = topic && !own ? users.find((u) => u.id === topic.ownerId)?.name : null;

  // Голос, начатый на этом экране, кладёт идеи в эту тему
  useFocusEffect(
    useCallback(() => {
      setVoiceTopic(own && !inbox && topic ? topic.id : null);
      return () => setVoiceTopic(null);
    }, [own, inbox, topic?.id]),
  );

  const add = () =>
    setCard({ source: 'manual', editing: true, items: [{ key: uid(), type: 'idea', data: { title: '', topicId: inbox ? null : (topic?.id ?? null), newTopic: null } }] });

  const title = inbox ? 'Без темы' : (topic?.title ?? 'Тема');

  return (
    <PullScreen>
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.navigate('/ideas'))} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, marginLeft: -4 })}>
            <ChevronLeft size={22} strokeWidth={ICON.stroke} color={c.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <T variant="title" numberOfLines={1}>
              {title}
            </T>
            {owner ? (
              <T variant="caption" muted numberOfLines={1}>
                {owner}
              </T>
            ) : null}
          </View>
          {own && topic ? (
            <Pressable onPress={() => setSharing(true)} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
              <Users size={21} strokeWidth={ICON.stroke} color={topic.groupIds.length ? c.text : c.textMuted} />
            </Pressable>
          ) : null}
          {own && (inbox || topic) ? (
            <Pressable onPress={add} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
              <Plus size={22} strokeWidth={ICON.stroke} color={c.text} />
            </Pressable>
          ) : null}
          {own && topic ? (
            <Pressable onPress={() => topicMenu(topic, () => setSharing(true))} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
              <Ellipsis size={22} strokeWidth={ICON.stroke} color={c.text} />
            </Pressable>
          ) : null}
        </View>

        <PullScrollView contentContainerStyle={{ paddingBottom: bottom }}>
          {!inbox && !topic ? (
            <T muted style={{ padding: space.side, paddingTop: 24 }}>
              Темы больше нет
            </T>
          ) : list.length === 0 ? (
            <T muted style={{ padding: space.side, paddingTop: 24 }}>
              Пока пусто
            </T>
          ) : null}
          <LayoutAnimationConfig skipEntering>
            {list.map((idea, i) => (
              <ListItem key={idea.id}>
                {i > 0 && <Divider inset={space.side} />}
                {own ? (
                  <SwipeRow onSwipeLeft={() => deleteIdea(idea.id)}>
                    <IdeaRow idea={idea} own />
                  </SwipeRow>
                ) : (
                  <IdeaRow idea={idea} own={false} />
                )}
              </ListItem>
            ))}
          </LayoutAnimationConfig>
        </PullScrollView>
        <TopicShareSheet topicId={sharing && topic ? topic.id : null} onClose={() => setSharing(false)} />
      </View>
    </PullScreen>
  );
}

function IdeaRow({ idea, own }: { idea: Idea; own: boolean }) {
  const c = useColors();
  return (
    <Pressable
      onPress={() => (own ? editIdea(idea) : ideaMenu(idea, false))}
      onLongPress={() => ideaMenu(idea, own)}
      delayLongPress={350}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.surface : c.background }]}
    >
      <T numberOfLines={8}>{idea.text}</T>
      <T variant="label" mono muted>
        {shortDate(toISODate(new Date(idea.createdAt)))}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.side, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 16 },
  row: { paddingHorizontal: space.side, paddingVertical: 12, gap: 4 },
});
