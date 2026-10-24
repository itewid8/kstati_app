import { useCallback, useEffect, useMemo, useState } from 'react';
import { colorOf } from '@/adapters/common/people';
import { upper } from '@/adapters/common/ru';
import { usePersonColors } from '@/containers/common/usePersonColors';
import { NO_ME } from '@/containers/common/useSnapshot';
import { plural } from '@/lib/plans';
import { useStore } from '@/lib/store';
import type { ID } from '@/lib/types';
import { TopicShareView, type ShareGroup } from '@/screens/sheets';
import { Sheet } from './Sheet';

const sharedMeta = (n: number) => (n ? `ОТКРЫТА ${n} ${plural(n, 'ГРУППЕ', 'ГРУППАМ', 'ГРУППАМ')}` : 'ТОЛЬКО ВЫ');

/** Каким группам открыта тема идей: участники видят её, но менять не могут */
export const TopicShareSheet = ({ topicId, onClose }: { topicId: ID | null; onClose: () => void }) => {
  const live = useStore((s) => s.topics.find((t) => t.id === topicId) ?? null);
  const me = useStore((s) => s.me ?? NO_ME);
  const users = useStore((s) => s.users);
  const groups = useStore((s) => s.groups);
  const updateTopic = useStore((s) => s.updateTopic);
  const colors = usePersonColors({ me, users, groups });
  // Держим последнюю тему, чтобы окно не «пустело» во время закрытия
  const [topic, setTopic] = useState(live);
  useEffect(() => {
    if (live) setTopic(live);
  }, [live]);

  const list = useMemo<ShareGroup[]>(
    () =>
      groups.map((g) => {
        const n = g.memberIds.length;
        return { id: g.id, name: g.name, meta: `${n} ${upper(plural(n, 'участник', 'участника', 'участников'))}`, shared: !!topic?.groupIds.includes(g.id) };
      }),
    [groups, topic],
  );
  const toggle = useCallback(
    (groupId: string) => {
      if (!topic) return;
      const on = topic.groupIds.includes(groupId);
      updateTopic(topic.id, { groupIds: on ? topic.groupIds.filter((x) => x !== groupId) : [...topic.groupIds, groupId] });
    },
    [topic, updateTopic],
  );

  return (
    <Sheet visible={!!live && !!topicId} onClose={onClose} inset>
      {topic ? (
        <TopicShareView
          title={topic.title}
          meta={sharedMeta(topic.groupIds.length)}
          color={colorOf(colors, topic.ownerId)}
          groups={list}
          onToggle={toggle}
          onClose={onClose}
        />
      ) : null}
    </Sheet>
  );
};
