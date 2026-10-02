import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useBottomSpace } from '@/components/BottomBar';
import { emptyDraft } from '@/components/CardSheet';
import { Header } from '@/components/Header';
import { Users } from '@/components/icons';
import { LayoutAnimationConfig, ListItem } from '@/components/ListItem';
import { usePullRefresh } from '@/components/PullRefresh';
import { TopicShareSheet } from '@/components/TopicShareSheet';
import { Divider, SectionLabel, T } from '@/components/ui';
import { ideasOf, sortTopics, topicMenu } from '@/lib/ideas';
import { useStore } from '@/lib/store';
import { INBOX, type ID, type Idea, type Topic } from '@/lib/types';
import { ICON, space, useColors } from '@/theme';

/** Темы идей: мои (свежие сверху), «Без темы» и темы, которые мне открыли другие */
export default function Ideas() {
  const c = useColors();
  const me = useStore((s) => s.me)!;
  const topics = useStore((s) => s.topics);
  const ideas = useStore((s) => s.ideas);
  const users = useStore((s) => s.users);
  const setCard = useStore((s) => s.setCard);
  const bottom = useBottomSpace();
  const refreshControl = usePullRefresh();
  const [sharing, setSharing] = useState<ID | null>(null);

  const mine = useMemo(() => sortTopics(topics.filter((t) => t.ownerId === me.id), ideas), [topics, ideas, me.id]);
  const shared = useMemo(() => sortTopics(topics.filter((t) => t.ownerId !== me.id), ideas), [topics, ideas, me.id]);
  const inbox = useMemo(() => ideasOf(ideas, INBOX, me.id), [ideas, me.id]);
  const empty = !mine.length && !shared.length && !inbox.length;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Header title="Идеи" onPlus={() => setCard({ source: 'manual', items: [emptyDraft('topic')], editing: true })} />
      <ScrollView contentContainerStyle={{ paddingBottom: bottom }} refreshControl={refreshControl}>
        <LayoutAnimationConfig skipEntering>
          {empty && (
            <T muted style={{ padding: space.side, paddingTop: 24 }}>
              Идей пока нет
            </T>
          )}
          {inbox.length > 0 && (
            <ListItem>
              <TopicRow id={INBOX} title="Без темы" list={inbox} />
            </ListItem>
          )}
          {mine.map((t, i) => (
            <ListItem key={t.id}>
              {(i > 0 || inbox.length > 0) && <Divider inset={space.side} />}
              <TopicRow id={t.id} title={t.title} list={ideasOf(ideas, t.id, me.id)} shared={t.groupIds.length > 0} onLong={() => topicMenu(t, () => setSharing(t.id))} />
            </ListItem>
          ))}
          {shared.length > 0 && (
            <ListItem>
              <SectionLabel>Открыли мне</SectionLabel>
              <Divider />
            </ListItem>
          )}
          {shared.map((t: Topic, i) => (
            <ListItem key={t.id}>
              {i > 0 && <Divider inset={space.side} />}
              <TopicRow id={t.id} title={t.title} owner={users.find((u) => u.id === t.ownerId)?.name} list={ideasOf(ideas, t.id, me.id)} />
            </ListItem>
          ))}
        </LayoutAnimationConfig>
      </ScrollView>
      <TopicShareSheet topicId={sharing} onClose={() => setSharing(null)} />
    </View>
  );
}

function TopicRow({
  id,
  title,
  list,
  owner,
  shared,
  onLong,
}: {
  id: ID;
  title: string;
  list: Idea[];
  owner?: string;
  shared?: boolean;
  onLong?: () => void;
}) {
  const c = useColors();
  const last = list[0]?.text;
  const sub = [owner, last].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={() => router.push(`/ideas/${id}`)}
      onLongPress={onLong}
      delayLongPress={350}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.surface : c.background }]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <T weight="medium" numberOfLines={1}>
          {title}
        </T>
        {sub ? (
          <T variant="caption" muted numberOfLines={1}>
            {sub}
          </T>
        ) : null}
      </View>
      {shared && <Users size={16} strokeWidth={ICON.stroke} color={c.textMuted} />}
      <T variant="caption" mono muted>
        {list.length}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: space.rowMin + 8,
    paddingHorizontal: space.side,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
