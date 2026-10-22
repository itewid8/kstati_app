import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStore } from '@/lib/store';
import type { ID } from '@/lib/types';
import { space } from '@/theme';
import { Sheet } from './Sheet';
import { Divider, T, Toggle } from './ui';

/** Каким группам открыта тема идей: участники видят её, но менять не могут */
export function TopicShareSheet({ topicId, onClose }: { topicId: ID | null; onClose: () => void }) {
  const topic = useStore((s) => s.topics.find((t) => t.id === topicId) ?? null);
  const groups = useStore((s) => s.groups);
  const updateTopic = useStore((s) => s.updateTopic);

  return (
    <Sheet visible={!!topic} onClose={onClose}>
      {topic && (
        <View>
          <T variant="caption" muted numberOfLines={2} style={styles.title}>
            {topic.title}
          </T>
          <Divider />
          {groups.length === 0 && (
            <T muted style={styles.row}>
              Групп пока нет
            </T>
          )}
          {groups.map((g, i) => {
            const on = topic.groupIds.includes(g.id);
            return (
              <View key={g.id}>
                {i > 0 && <Divider inset={space.side} />}
                <View style={styles.row}>
                  <T style={{ flex: 1 }} numberOfLines={1}>
                    {g.name}
                  </T>
                  <Toggle
                    value={on}
                    onValueChange={(v) => updateTopic(topic.id, { groupIds: v ? [...topic.groupIds, g.id] : topic.groupIds.filter((x) => x !== g.id) })}
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { paddingHorizontal: space.side, paddingTop: 4, paddingBottom: 12 },
  row: { minHeight: 56, paddingHorizontal: space.side, flexDirection: 'row', alignItems: 'center', gap: 12 },
});
