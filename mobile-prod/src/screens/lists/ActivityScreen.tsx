/**
 * «Лента» (C-Activity): что сделали другие во всех группах, по дням. Без нижней навигации,
 * назад — кнопкой в верхней панели. Дни идут от top 122 и прокручиваются до низа экрана.
 */
import { memo, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ID, PersonColor } from '@/lib/types';
import { IconButton, Marquee, ScreenTitle, SectionBox, size as S, space, type as T, useTheme } from '@/ui';
import { FeedRow, NewDot } from './components/FeedRow';

export type FeedPerson = {
  /** «Карина» */
  name: string;
  /** «К» */
  letter: string;
  color: PersonColor;
};

export type FeedEvent = {
  id: ID;
  person: FeedPerson;
  /** Действие после имени: «добавила дело «Баня» на сб 10 окт · 15:00» */
  text: string;
  /** «17:40» */
  time: string;
  /** «МЫ С КАРИНОЙ» */
  group: string;
  /** Ещё не просмотрено */
  fresh?: boolean;
};

export type FeedDay = {
  id: ID;
  /** «СЕГОДНЯ», «ВЧЕРА», «СУББОТА» */
  label: string;
  /** «ПН 05» */
  date: string;
  events: FeedEvent[];
};

export type ActivityScreenProps = {
  /** «ВСЕ ГРУППЫ · 30 ДНЕЙ» */
  caption: string;
  days: FeedDay[];
  /** Число новых событий (по умолчанию — fresh в days); 0 — без отметки */
  newCount?: number;
  insets?: { top: number; bottom: number };

  onBack?: () => void;
  onOpenEvent?: (id: ID) => void;
};

const NO_INSETS = { top: 0, bottom: 0 };
/** Дни начинаются сразу под заголовком */
const DAYS_TOP = 122;

/** «1 НОВОЕ», «3 НОВЫХ» */
const newLabel = (n: number) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'НОВОЕ' : 'НОВЫХ'}`;

type EventRowProps = { event: FeedEvent; onOpenEvent?: (id: ID) => void };

const EventRow = memo(function EventRow({ event, onOpenEvent }: EventRowProps) {
  const { person, personInk } = useTheme();
  return (
    <FeedRow
      letter={event.person.letter}
      color={person(event.person.color)}
      ink={personInk(event.person.color)}
      name={event.person.name}
      text={event.text}
      meta={`${event.time} · ${event.group}`}
      fresh={event.fresh}
      onPress={onOpenEvent ? () => onOpenEvent(event.id) : undefined}
    />
  );
});

export const ActivityScreen = memo(function ActivityScreen({
  caption,
  days,
  newCount,
  insets = NO_INSETS,
  onBack,
  onOpenEvent,
}: ActivityScreenProps) {
  const { c } = useTheme();
  const fresh = useMemo(
    () => newCount ?? days.reduce((n, d) => n + d.events.filter((e) => e.fresh).length, 0),
    [newCount, days],
  );
  const badge = useMemo(
    () =>
      fresh > 0 ? (
        <View style={styles.news}>
          <NewDot />
          <Text style={[styles.newsText, { color: c.text }]}>{newLabel(fresh)}</Text>
        </View>
      ) : null,
    [fresh, c.text],
  );

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <View style={[styles.abs, styles.bar, { top: insets.top + S.topBarTop }]}>
        <IconButton icon="back" accessibilityLabel="Назад" onPress={onBack} iconSize={S.iconSmall} />
        <Marquee style={[T.caption, styles.caption, { color: c.muted }]}>
          {caption}
        </Marquee>
      </View>
      <ScreenTitle title="Лента" right={badge} style={[styles.abs, { top: insets.top + S.titleTop }]} />

      <ScrollView
        // Непрозрачный фон: на web прозрачный слой прокрутки выключает субпиксельное сглаживание текста
        style={[styles.abs, { top: insets.top + DAYS_TOP, bottom: 0, backgroundColor: c.bg }]}
        contentContainerStyle={[styles.days, { paddingBottom: insets.bottom + space.side }]}
        showsVerticalScrollIndicator={false}
      >
        {days.map((d) => (
          <SectionBox key={d.id} title={d.label} count={d.date} style={styles.day}>
            {d.events.map((e) => (
              <EventRow key={e.id} event={e} onOpenEvent={onOpenEvent} />
            ))}
          </SectionBox>
        ))}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  abs: { position: 'absolute', left: space.side, right: space.side },
  bar: { height: S.topBarHeight, flexDirection: 'row', alignItems: 'center', gap: space.barGap },
  caption: { flex: 1 },
  news: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 8 },
  newsText: { ...T.tabActive, letterSpacing: 0.76 },
  days: { gap: 10 },
  day: { flexShrink: 0 },
});
