/**
 * «Идеи» (C-Ideas): блокнот тем. Вкладки людей (ВСЕ / Я / КАРИНА), «Темы» прижаты к верху
 * (top 162), «Архив» — к низу (bottom 98); обе секции сворачиваются по шапке.
 * Строка темы: когда и последняя запись, число записей; у общей темы — значок «люди».
 */
import { memo, useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ID, PersonColor } from '@/lib/types';
import {
  BottomNav,
  DoneRow,
  SectionBox,
  Tabs,
  TopBar,
  pad2,
  size as S,
  space,
  type as T,
  useTheme,
  type NavTab,
  type TabItem,
  type TopBarAction,
} from '@/ui';
import { AccessoryListRow } from './components/AccessoryListRow';

export type IdeasPerson = {
  id: ID;
  /** «Я», «КАРИНА» */
  label: string;
  color: PersonColor;
};

export type IdeaTopic = {
  id: ID;
  title: string;
  /** «ВЧЕРА», «3 ДНЯ НАЗАД» */
  updated: string;
  /** Последняя запись */
  last: string;
  /** Записей в теме, уже отформатировано («12», «05») */
  count: string;
  /** Чья тема — полоса слева; null — «Без темы» (нейтральная полоса) */
  ownerColor: PersonColor | null;
  /** Тема открыта группе */
  shared: boolean;
};

export type ArchivedTopic = {
  id: ID;
  title: string;
  /** «СЕН» */
  month: string;
};

export type IdeasSection = 'topics' | 'archive';

/** Вкладка «ВСЕ» */
export const ALL_IDEAS = 'all';

export type IdeasScreenProps = {
  /** «БЛОКНОТ · 31 ЗАПИСЬ» */
  caption: string;
  me: { letter: string; color: PersonColor };
  /** Вкладки людей (без «ВСЕ» — она добавляется первой) */
  people: IdeasPerson[];
  selectedPersonId: ID;
  topics: IdeaTopic[];
  archive: ArchivedTopic[];
  topicsOpen: boolean;
  archiveOpen: boolean;
  /** Сколько тем в архиве всего (по умолчанию archive.length) */
  archiveCount?: number;
  hasNews?: boolean;
  insets?: { top: number; bottom: number };

  onSelectPerson?: (id: ID) => void;
  /** В архив (true) или вернуть из архива (false) */
  onToggleArchive?: (id: ID, archived: boolean) => void;
  onOpenTopic?: (id: ID) => void;
  /** Удержание темы — выбор нескольких (удалить разом) */
  onLongPressTopic?: (id: ID) => void;
  /** Выбор тем: выбранные id; null — выбора нет */
  selected?: readonly ID[] | null;
  onToggleSelect?: (id: ID) => void;
  onCancelSelect?: () => void;
  onDeleteSelected?: () => void;
  onToggleSection?: (section: IdeasSection) => void;
  onAddTopic?: () => void;
  onOpenFeed?: () => void;
  onOpenSettings?: () => void;
  onNavigate?: (tab: NavTab) => void;
  onRec?: () => void;
};

const NO_INSETS = { top: 0, bottom: 0 };

type TopicRowProps = {
  topic: IdeaTopic;
  /** Режим выбора: отмечена ли; undefined — выбора нет */
  selected?: boolean;
  onLongPress?: (id: ID) => void;
  onToggleSelect?: (id: ID) => void;
  onToggleArchive?: (id: ID, archived: boolean) => void;
  onOpenTopic?: (id: ID) => void;
};

const TopicRow = memo(function TopicRow({ topic, selected, onLongPress, onToggleSelect, onToggleArchive, onOpenTopic }: TopicRowProps) {
  const { c, person } = useTheme();
  if (selected !== undefined) {
    const toggle = onToggleSelect ? () => onToggleSelect(topic.id) : undefined;
    return (
      <AccessoryListRow
        title={topic.title}
        meta={`${topic.updated} · ${topic.last}`}
        strip={topic.ownerColor ? person(topic.ownerColor) : c.hairStrong}
        checked={selected}
        checkLabel="Выбрать"
        onToggle={toggle}
        onPress={toggle}
        right={<Text style={[T.rowValue, { color: c.text }]}>{topic.count}</Text>}
      />
    );
  }
  return (
    <AccessoryListRow
      title={topic.title}
      meta={`${topic.updated} · ${topic.last}`}
      strip={topic.ownerColor ? person(topic.ownerColor) : c.hairStrong}
      titleIcon={topic.shared ? 'people' : undefined}
      titleIconLabel="Общая тема"
      checkLabel="В архив"
      onToggle={onToggleArchive ? () => onToggleArchive(topic.id, true) : undefined}
      onPress={onOpenTopic ? () => onOpenTopic(topic.id) : undefined}
      onLongPress={onLongPress ? () => onLongPress(topic.id) : undefined}
      right={<Text style={[T.rowValue, { color: c.text }]}>{topic.count}</Text>}
    />
  );
});

export const IdeasScreen = memo(function IdeasScreen(props: IdeasScreenProps) {
  const {
    me,
    people,
    selectedPersonId,
    topics,
    archive,
    topicsOpen,
    archiveOpen,
    archiveCount = archive.length,
    hasNews,
    insets = NO_INSETS,
    onSelectPerson,
    onToggleArchive,
    onOpenTopic,
    onToggleSection,
    onAddTopic,
    onOpenFeed,
    onOpenSettings,
    onNavigate,
    onRec,
  } = props;
  const { c, person, personInk } = useTheme();
  const selecting = !!props.selected;
  const picked = useMemo(() => new Set(props.selected ?? []), [props.selected]);
  const { onDeleteSelected } = props;

  const actions = useMemo<TopBarAction[]>(
    () => selecting ? (picked.size && onDeleteSelected ? [{ key: 'delete', icon: 'trash', accessibilityLabel: 'Удалить выбранные', onPress: onDeleteSelected }] : []) : [
      { key: 'add', icon: 'plus', accessibilityLabel: 'Новая тема', onPress: onAddTopic },
      { key: 'feed', icon: 'bell', accessibilityLabel: 'Лента', onPress: onOpenFeed, badge: hasNews },
      {
        key: 'me',
        letter: me.letter,
        fill: person(me.color),
        ink: personInk(me.color),
        accessibilityLabel: 'Настройки',
        onPress: onOpenSettings,
      },
    ],
    [onAddTopic, onOpenFeed, onOpenSettings, hasNews, me.letter, me.color, person, personInk, selecting, picked, onDeleteSelected],
  );

  const tabs = useMemo<TabItem<ID>[]>(
    () => [{ key: ALL_IDEAS, label: 'ВСЕ' }, ...people.map((p) => ({ key: p.id, label: p.label, dot: person(p.color) }))],
    [people, person],
  );

  const toggleTopics = useCallback(() => onToggleSection?.('topics'), [onToggleSection]);
  const toggleArchive = useCallback(() => onToggleSection?.('archive'), [onToggleSection]);

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <TopBar
        lead={selecting ? { kind: 'back', label: `ВЫБРАНО ${pad2(picked.size)}`, onBack: props.onCancelSelect } : { kind: 'title', text: 'Заметки' }}
        actions={actions} style={[styles.abs, { top: insets.top + S.topBarTop }]} />
      <Tabs items={tabs} value={selectedPersonId} onChange={onSelectPerson} style={[styles.abs, { top: insets.top + S.tabsTopCompact }]} />

      <View style={[styles.abs, { top: insets.top + S.contentTopCompact, bottom: insets.bottom + S.contentBottom }]}>
        <SectionBox title="ТЕМЫ" count={pad2(topics.length)} collapsed={!topicsOpen} onToggle={toggleTopics} scrollable>
          {topics.map((t) => (
            <TopicRow
              key={t.id}
              topic={t}
              selected={selecting ? picked.has(t.id) : undefined}
              onToggleSelect={props.onToggleSelect}
              onLongPress={props.onLongPressTopic}
              onToggleArchive={onToggleArchive}
              onOpenTopic={onOpenTopic}
            />
          ))}
        </SectionBox>
        <View style={styles.spacer} />
        <SectionBox
          title="АРХИВ"
          variant="muted"
          count={pad2(archiveCount)}
          collapsed={!archiveOpen}
          onToggle={toggleArchive}
          scrollable
          style={styles.archive}
        >
          {archive.map((a) => (
            <DoneRow
              key={a.id}
              title={a.title}
              meta={a.month}
              checkLabel="Вернуть из архива"
              onToggle={onToggleArchive ? () => onToggleArchive(a.id, false) : undefined}
            />
          ))}
        </SectionBox>
      </View>

      <BottomNav active="ideas" onSelect={onNavigate} onRec={onRec} style={[styles.abs, { bottom: insets.bottom + S.navBottom }]} />
    </View>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  abs: { position: 'absolute', left: space.side, right: space.side },
  spacer: { flexGrow: 1, minHeight: 10 },
  /** «Архив» не выше ~5 строк, дальше прокрутка */
  archive: { flexShrink: 0, maxHeight: S.border * 2 + S.sectionHeader + S.doneRow * 5 },
});
