/**
 * Тема идей (макета нет; раскладка C-Ideas): назад + подпись, кнопки «открыть группам» / «+» / «⋯» (только своя тема),
 * заголовок темы, секция «ИДЕИ» с записями (новые сверху), нижняя навигация с REC.
 * Своя тема: нажатие — правка, смахнуть влево — удалить. Чужая — нажатие открывает быстрые действия.
 * Удержание — быстрые действия над поднятой строкой. Прокрутка подменяется (PullScrollView — обновление потягиванием).
 */
import { memo, useCallback, useMemo, type ComponentType } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewProps } from 'react-native';
import type { ID, PersonColor } from '@/lib/types';
import {
  BottomNav,
  LONG_PRESS_MS,
  Marquee,
  TopBar,
  pad2,
  size as S,
  space,
  type as T,
  useLift,
  useTheme,
  type LiftHandler,
  type LiftTarget,
  type NavTab,
  type TopBarAction,
} from '@/ui';
import { ET } from '../editors/components/text';
import { SwipeDelete } from './components/SwipeDelete';

export type TopicIdea = {
  id: ID;
  text: string;
  /** «28 СЕН» */
  date: string;
};

export type TopicScreenProps = {
  /** «ТЕМА · КАРИНА», «БЕЗ ТЕМЫ», «ТЕМЫ НЕТ» */
  caption: string;
  title: string;
  /** Цвет владельца — полоса строк; null — нейтральная */
  color: PersonColor | null;
  ideas: readonly TopicIdea[];
  /** Тема открыта группам; null — кнопки нет (чужая тема или «Без темы») */
  shared: boolean | null;
  insets?: { top: number; bottom: number };
  /** Прокрутка списка (по умолчанию ScrollView) */
  Scroll?: ComponentType<ScrollViewProps>;

  onBack?: () => void;
  onShare?: () => void;
  onAdd?: () => void;
  onMore?: () => void;
  onOpenIdea?: (id: ID) => void;
  onHoldIdea?: (id: ID, lift: LiftTarget) => void;
  onDeleteIdea?: (id: ID) => void;
  onNavigate?: (tab: NavTab) => void;
  onRec?: () => void;
};

const NO_INSETS = { top: 0, bottom: 0 };

type RowProps = {
  idea: TopicIdea;
  strip: string;
  onOpen?: (id: ID) => void;
  onHold?: (id: ID, lift: LiftTarget) => void;
};

const IdeaRow = memo(function IdeaRow(props: RowProps) {
  const { idea, strip, onOpen, onHold } = props;
  const { c } = useTheme();
  const hold = useCallback<LiftHandler>((lift) => onHold?.(idea.id, lift), [onHold, idea.id]);
  const lift = useLift(onHold ? hold : undefined, 'row', () => <IdeaRow idea={idea} strip={strip} />);
  return (
    <Pressable
      ref={lift.ref}
      accessibilityRole="button"
      accessibilityLabel={idea.text}
      onPress={onOpen ? () => onOpen(idea.id) : undefined}
      onLongPress={lift.onLongPress}
      delayLongPress={LONG_PRESS_MS}
      disabled={!onOpen && !lift.onLongPress}
      style={[styles.row, { backgroundColor: c.panel, borderTopColor: c.hair }]}
    >
      <View style={[styles.strip, { backgroundColor: strip }]} />
      <Text numberOfLines={8} style={[ET.description, { color: c.text }]}>
        {idea.text}
      </Text>
      <Text style={[T.rowMeta, { color: c.muted }]}>{idea.date}</Text>
    </Pressable>
  );
});

export const TopicScreen = memo(function TopicScreen(props: TopicScreenProps) {
  const {
    caption,
    title,
    color,
    ideas,
    shared,
    insets = NO_INSETS,
    Scroll = ScrollView,
    onBack,
    onShare,
    onAdd,
    onMore,
    onOpenIdea,
    onHoldIdea,
    onDeleteIdea,
    onNavigate,
    onRec,
  } = props;
  const { c, person } = useTheme();
  const strip = color ? person(color) : c.hairStrong;

  const actions = useMemo<TopBarAction[]>(() => {
    const out: TopBarAction[] = [];
    if (shared !== null && onShare) {
      out.push({
        key: 'share',
        icon: 'people',
        accessibilityLabel: 'Открыть группам',
        onPress: onShare,
        ...(shared ? { fill: c.text, ink: c.bg } : null),
      });
    }
    if (onAdd) out.push({ key: 'add', icon: 'plus', accessibilityLabel: 'Новая идея', onPress: onAdd });
    if (onMore) out.push({ key: 'more', icon: 'dots', accessibilityLabel: 'Ещё', onPress: onMore });
    return out;
  }, [shared, onShare, onAdd, onMore, c.text, c.bg]);

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <TopBar lead={{ kind: 'back', label: caption, onBack }} actions={actions} style={[styles.abs, { top: insets.top + S.topBarTop }]} />
      <View style={[styles.abs, styles.title, { top: insets.top + S.titleTop }]}>
        <Marquee accessibilityLabel={title} ellipsis={false} style={[T.h1, styles.titleText, { color: c.text }]}>
          {title}
        </Marquee>
      </View>

      <View style={[styles.abs, { top: insets.top + S.tabsTop, bottom: insets.bottom + S.contentBottom }]}>
        <View style={[styles.box, { borderColor: c.border }]}>
          <View style={[styles.header, { backgroundColor: c.text }]}>
            <Text style={[T.section, { color: c.bg }]}>ИДЕИ</Text>
            <Text style={[T.section, { color: c.bg }]}>{pad2(ideas.length)}</Text>
          </View>
          <Scroll style={[styles.scroll, { backgroundColor: c.bg }]} showsVerticalScrollIndicator={false}>
            {ideas.map((idea) => (
              <SwipeDelete key={idea.id} onDelete={onDeleteIdea ? () => onDeleteIdea(idea.id) : undefined}>
                <IdeaRow idea={idea} strip={strip} onOpen={onOpenIdea} onHold={onHoldIdea} />
              </SwipeDelete>
            ))}
          </Scroll>
        </View>
      </View>

      <BottomNav active="ideas" onSelect={onNavigate} onRec={onRec} style={[styles.abs, { bottom: insets.bottom + S.navBottom }]} />
    </View>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  abs: { position: 'absolute', left: space.side, right: space.side },
  title: { height: S.titleHeight, justifyContent: 'flex-end' },
  /** Хвост последней буквы при letterSpacing −2 не срезается */
  titleText: { paddingRight: 2 },
  box: { borderWidth: S.border, flexShrink: 1, minHeight: 0 },
  header: {
    height: S.sectionHeader,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scroll: { flexGrow: 0, flexShrink: 1 },
  row: { borderTopWidth: S.hairline, paddingVertical: 9, paddingLeft: 12, paddingRight: 10, gap: 4 },
  strip: { position: 'absolute', left: 0, top: 0, bottom: 0, width: S.strip },
});
