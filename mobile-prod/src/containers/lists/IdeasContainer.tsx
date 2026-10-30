import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ALL_IDEAS, IDEAS_SECTIONS, ideasProps, type IdeasSnapshot } from '@/adapters/lists/ideas';
import { deleteTopicsAsk } from '@/lib/ideas';
import { DEMO, useStore } from '@/lib/store';
import type { ID } from '@/lib/types';
import { IdeasScreen, type IdeasSection } from '@/screens/lists/IdeasScreen';
import { NEW_NOTE, NO_ME, nav, signedInOnly, useChrome, useClock, useInsets, usePersonColors, type StoreState } from '../common';

/** Архив тем — только с сервером API 2 (старый молча срежет archivedAt) */
const archiveOn = (api: number | null) => DEMO || (api ?? 0) >= 2;

/** В архив и обратно — только свои темы; чужие и «Без темы» — без действия */
function toggleArchive(id: ID, archived: boolean) {
  const st = useStore.getState();
  const topic = st.topics.find((t) => t.id === id);
  if (topic && topic.ownerId === st.me?.id) st.archiveTopic(id, archived);
}

const openTopic = (id: ID) => router.push(nav.topic(id));
/** Новая тема — сразу экран темы: пишется название и текст, тема появляется с первым словом */
const addTopic = () => router.push(nav.topic(NEW_NOTE));
const toggleSection = (section: IdeasSection) => useStore.getState().toggleSection(IDEAS_SECTIONS[section]);

/** Только то, что нужно блокноту (и цветам людей): дела, хотелки и «Смотреть» экран не перерисовывают */
const pickIdeas = (s: StoreState): IdeasSnapshot => ({
  me: s.me ?? NO_ME,
  users: s.users,
  groups: s.groups,
  topics: s.topics,
  ideas: s.ideas,
  activity: s.activity,
  activitySeen: s.activitySeen,
});

/** C-Ideas: блокнот тем; вкладка человека — состояние экрана */
export const IdeasContainer = signedInOnly(function Ideas() {
  const s = useStore(useShallow(pickIdeas));
  const { today } = useClock();
  const insets = useInsets();
  const { onOpenFeed, onOpenSettings, onNavigate, onRec } = useChrome('ideas');
  const collapsed = useStore((st) => st.collapsedSections);
  const archive = useStore((st) => archiveOn(st.serverApi));
  const [personId, setPersonId] = useState<ID>(ALL_IDEAS);
  const colors = usePersonColors(s);
  // Выбор тем (удержание темы): только свои, «Без темы» не выбирается
  const [selected, setSelected] = useState<ID[] | null>(null);
  const canPick = useCallback((id: ID) => {
    const st = useStore.getState();
    return st.topics.some((t) => t.id === id && t.ownerId === st.me?.id);
  }, []);
  const longPress = useCallback((id: ID) => {
    if (canPick(id)) setSelected([id]);
  }, [canPick]);
  const toggleSelect = useCallback(
    (id: ID) => {
      if (!canPick(id)) return;
      setSelected((cur) => (cur ? (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]) : cur));
    },
    [canPick],
  );
  const cancelSelect = useCallback(() => setSelected(null), []);
  const deleteSelected = useCallback(() => {
    if (selected?.length) deleteTopicsAsk(selected, () => setSelected(null));
  }, [selected]);
  const data = useMemo(() => ideasProps(s, colors, { today }, { personId, collapsed }), [s, colors, today, personId, collapsed]);

  return (
    <IdeasScreen
      {...data}
      insets={insets}
      onSelectPerson={setPersonId}
      onToggleArchive={archive ? toggleArchive : undefined}
      onOpenTopic={openTopic}
      onLongPressTopic={longPress}
      selected={selected}
      onToggleSelect={toggleSelect}
      onCancelSelect={cancelSelect}
      onDeleteSelected={deleteSelected}
      onToggleSection={toggleSection}
      onAddTopic={addTopic}
      onOpenFeed={onOpenFeed}
      onOpenSettings={onOpenSettings}
      onNavigate={onNavigate}
      onRec={onRec}
    />
  );
});
