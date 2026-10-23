/**
 * «Хочу» — вишлисты людей из групп. Чисто презентационный экран: данные и состояние секций
 * приходят пропсами, действия уходят колбэками. Раскладка как в C-Wishes: «Хочу» прижата к верху
 * (top 162), «Подарено» — к низу (bottom 98, над навигацией). Длинный список прокручивается
 * внутри своей рамки, шапка секции остаётся на месте.
 */
import { memo, useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ID, PersonColor } from '@/lib/types';
import {
  BottomNav,
  DoneRow,
  ListRow,
  RowLinkButton,
  ScreenTitle,
  SectionBox,
  Tabs,
  TopBar,
  pad2,
  size as S,
  space,
  useTheme,
  type LiftTarget,
  type NavTab,
  type TabItem,
  type TopBarAction,
} from '@/ui';

export type WishPerson = {
  id: ID;
  /** Подпись вкладки: «Я», «КАРИНА» */
  label: string;
  color: PersonColor;
};

export type WishRow = {
  id: ID;
  title: string;
  /** Подпись под названием: заметка и домен ссылки, «SONY WH-1000XM5 · OZON.RU» */
  note: string;
  link?: string | null;
  /** Цвет владельца — полоса слева */
  ownerColor: PersonColor;
};

export type GiftedRow = {
  id: ID;
  title: string;
  /** «ОТ КАРИНЫ» */
  from: string;
};

export type WishSection = 'wishes' | 'gifted';

/** Вкладка «ВСЕ» */
export const ALL_PEOPLE = 'all';

export type WishesScreenProps = {
  /** «ВИШЛИСТЫ · 4 ЧЕЛОВЕКА» */
  caption: string;
  /** Кнопка профиля: буква и свой цвет */
  me: { letter: string; color: PersonColor };
  /** Вкладки людей (без «ВСЕ» — она добавляется первой) */
  people: WishPerson[];
  /** id выбранного человека или ALL_PEOPLE */
  selectedPersonId: ID;
  wishes: WishRow[];
  gifted: GiftedRow[];
  wishesOpen: boolean;
  giftedOpen: boolean;
  /** Сколько подарено всего (по умолчанию gifted.length) */
  giftedCount?: number;
  hasNews?: boolean;
  /** Отступы safe area (на телефоне — useSafeAreaInsets) */
  insets?: { top: number; bottom: number };

  onSelectPerson?: (id: ID) => void;
  /** Отметить подарено (gifted = true) или вернуть в список (false) */
  onToggleGift?: (id: ID, gifted: boolean) => void;
  onOpenLink?: (wish: WishRow) => void;
  onOpenWish?: (id: ID) => void;
  /** Удержание хотелки (быстрые действия): id и нажатая строка */
  onLongPressWish?: (id: ID, lift: LiftTarget) => void;
  onToggleSection?: (section: WishSection) => void;
  onAdd?: () => void;
  onOpenFeed?: () => void;
  onOpenSettings?: () => void;
  onNavigate?: (tab: NavTab) => void;
  onRec?: () => void;
};

const NO_INSETS = { top: 0, bottom: 0 };

type WishItemProps = {
  wish: WishRow;
  onToggleGift?: (id: ID, gifted: boolean) => void;
  onOpenLink?: (wish: WishRow) => void;
  onOpenWish?: (id: ID) => void;
  onLongPressWish?: (id: ID, lift: LiftTarget) => void;
};

const WishItem = memo(function WishItem({ wish, onToggleGift, onOpenLink, onOpenWish, onLongPressWish }: WishItemProps) {
  const { person } = useTheme();
  return (
    <ListRow
      title={wish.title}
      meta={wish.note}
      strip={person(wish.ownerColor)}
      checkLabel="Подарено"
      onToggle={onToggleGift ? () => onToggleGift(wish.id, true) : undefined}
      onPress={onOpenWish ? () => onOpenWish(wish.id) : undefined}
      onLongPress={onLongPressWish ? (lift) => onLongPressWish(wish.id, lift) : undefined}
      rightInset={6}
      right={wish.link ? <RowLinkButton onPress={onOpenLink ? () => onOpenLink(wish) : undefined} /> : null}
    />
  );
});

export const WishesScreen = memo(function WishesScreen(props: WishesScreenProps) {
  const {
    caption,
    me,
    people,
    selectedPersonId,
    wishes,
    gifted,
    wishesOpen,
    giftedOpen,
    giftedCount = gifted.length,
    hasNews,
    insets = NO_INSETS,
    onSelectPerson,
    onToggleGift,
    onOpenLink,
    onOpenWish,
    onLongPressWish,
    onToggleSection,
    onAdd,
    onOpenFeed,
    onOpenSettings,
    onNavigate,
    onRec,
  } = props;
  const { c, person, personInk } = useTheme();

  const actions = useMemo<TopBarAction[]>(
    () => [
      { key: 'add', icon: 'plus', accessibilityLabel: 'Добавить', onPress: onAdd },
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
    [onAdd, onOpenFeed, onOpenSettings, hasNews, me.letter, me.color, person, personInk],
  );

  const tabs = useMemo<TabItem<ID>[]>(
    () => [{ key: ALL_PEOPLE, label: 'ВСЕ' }, ...people.map((p) => ({ key: p.id, label: p.label, dot: person(p.color) }))],
    [people, person],
  );

  const toggleWishes = useCallback(() => onToggleSection?.('wishes'), [onToggleSection]);
  const toggleGifted = useCallback(() => onToggleSection?.('gifted'), [onToggleSection]);

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <TopBar lead={{ kind: 'caption', text: caption }} actions={actions} style={[styles.top, { top: insets.top + S.topBarTop }]} />
      <ScreenTitle title="Хочу" style={[styles.title, { top: insets.top + S.titleTop }]} />
      <Tabs items={tabs} value={selectedPersonId} onChange={onSelectPerson} style={[styles.tabs, { top: insets.top + S.tabsTop }]} />

      <View style={[styles.content, { top: insets.top + S.contentTop, bottom: insets.bottom + S.contentBottom }]}>
        <SectionBox
          title="ХОЧУ"
          count={pad2(wishes.length)}
          collapsed={!wishesOpen}
          onToggle={toggleWishes}
          scrollable
        >
          {wishes.map((w) => (
            <WishItem
              key={w.id}
              wish={w}
              onToggleGift={onToggleGift}
              onOpenLink={onOpenLink}
              onOpenWish={onOpenWish}
              onLongPressWish={onLongPressWish}
            />
          ))}
        </SectionBox>
        <View style={styles.spacer} />
        <SectionBox
          title="ПОДАРЕНО"
          variant="muted"
          count={pad2(giftedCount)}
          collapsed={!giftedOpen}
          onToggle={toggleGifted}
          scrollable
          style={styles.gifted}
        >
          {gifted.map((g) => (
            <DoneRow
              key={g.id}
              title={g.title}
              meta={g.from}
              checkLabel="Вернуть в список"
              onToggle={onToggleGift ? () => onToggleGift(g.id, false) : undefined}
            />
          ))}
        </SectionBox>
      </View>

      <BottomNav active="wishes" onSelect={onNavigate} onRec={onRec} style={[styles.nav, { bottom: insets.bottom + S.navBottom }]} />
    </View>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { position: 'absolute', left: space.side, right: space.side },
  title: { position: 'absolute', left: space.side, right: space.side },
  tabs: { position: 'absolute', left: space.side, right: space.side },
  content: { position: 'absolute', left: space.side, right: space.side },
  /** Не меньше 10px между секциями, когда «Хочу» длинный */
  spacer: { flexGrow: 1, minHeight: 10 },
  /** «Подарено» не выше ~5 строк, дальше прокрутка */
  gifted: { flexShrink: 0, maxHeight: S.border * 2 + S.sectionHeader + S.doneRow * 5 },
  nav: { position: 'absolute', left: space.side, right: space.side },
});
