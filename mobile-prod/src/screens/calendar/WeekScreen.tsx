/**
 * Неделя (C-Week). Презентационный экран: дела недели, полосы и люди приходят пропсами, действия — колбэками.
 *
 * Раскладка как в макете: колонки дней от x 44 до правого поля 26 (вкладки людей), чётные/нечётные — фон alt;
 * шапка дней (top 152), черта 1.5px (202), полосы на весь день жадными строками по 22px (208…),
 * волосяная линия под ними и сетка часов до верха навигации. Видимые часы — hourRange (±1 ч от дел и «сейчас»),
 * высота часа вписывает их в экран без прокрутки. Пересечения в колонке — layoutDayColumn (основа/гость ступеньками).
 */
import { memo, useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  hourRange,
  layoutDayColumn,
  minuteToY,
  packAllDayBars,
  type ColumnBlock,
  type DayMinute,
  type IsoDate,
} from '@/lib/calendarLayout';
import type { ID } from '@/lib/types';
import { fonts, size as S, useTheme, type LiftTarget } from '@/ui';
import { AllDayBar, WEEK_BAR } from './components/AllDayBar';
import { CAL, CalendarScaffold, NO_INSETS, useScreenSize } from './components/CalendarScaffold';
import { HourLines } from './components/HourLines';
import { NowMarker } from './components/NowMarker';
import { usePeopleColors, usePeopleMap } from './components/PeopleColor';
import { PeriodArrows, PeriodNote, PeriodTitle, TodayButton } from './components/PeriodBar';
import { PersonTabs } from './components/PersonTabs';
import { useLongPressId } from './components/longPress';
import { WeekEventBlock } from './components/WeekEventBlock';
import { MONTHS_SHORT, WEEKDAYS, addDays, namesOf, pad2, parts, peopleOf, timeRange } from './format';
import type { CalendarBar, CalendarChromeProps, CalendarPerson, PersonFilterProps, TimedEvent } from './types';

export type WeekScreenProps = CalendarChromeProps &
  PersonFilterProps & {
    /** Понедельник недели */
    weekStart: IsoDate;
    /** Сегодня: красное число в шапке и линия «сейчас» в его колонке */
    today?: IsoDate;
    /** Текущее время, минуты от полуночи (вместе с today) */
    now?: DayMinute;
    bars: readonly CalendarBar[];
    /** Дела со временем по дням недели */
    events: Readonly<Record<IsoDate, readonly TimedEvent[]>>;

    onPrev?: () => void;
    onNext?: () => void;
    onToday?: () => void;
    onOpenDay?: (date: IsoDate) => void;
    onOpenEvent?: (id: ID) => void;
    onOpenBar?: (id: ID) => void;
    /** Удержание дела или полосы (быстрые действия): id и нажатый блок */
    onLongPressEvent?: (id: ID, lift: LiftTarget) => void;
    onLongPressBar?: (id: ID, lift: LiftTarget) => void;
  };

/** Вертикаль недели (px от верха экрана, без safe area) */
const W = {
  headTop: 152,
  headLabelTop: 156,
  rule: 202,
  barsTop: 208,
  barPitch: 22,
  /** Волосяная линия под полосами и начало сетки */
  barsHair: 4,
  gridGap: 8,
  dayNumber: { width: 26, height: 24 },
} as const;
const DAYS = 7;
const TODAY_INK = '#FFFFFF';
const NO_EVENTS: readonly TimedEvent[] = [];

type DayEventsProps = {
  colX: number;
  gridY: number;
  blocks: readonly ColumnBlock[];
  events: readonly TimedEvent[];
  byId: ReadonlyMap<ID, CalendarPerson>;
  onOpenEvent?: (id: ID) => void;
  onLongPressEvent?: (id: ID, lift: LiftTarget) => void;
};

const WeekEvent = memo(function WeekEvent({
  event,
  block,
  colX,
  gridY,
  byId,
  onOpenEvent,
  onLongPressEvent,
}: { event: TimedEvent; block: ColumnBlock } & Omit<DayEventsProps, 'blocks' | 'events'>) {
  const colors = usePeopleColors(event.people, byId);
  const who = namesOf(peopleOf(event.people, byId)) + (event.parentTitle ? ` · ${event.parentTitle}` : '');
  const open = useCallback(() => onOpenEvent?.(event.id), [onOpenEvent, event.id]);
  const hold = useLongPressId(event.id, onLongPressEvent);
  return (
    <WeekEventBlock
      colX={colX}
      gridY={gridY}
      block={block}
      title={event.title}
      time={timeRange(event)}
      who={who}
      done={event.done}
      repeat={event.repeat}
      kind={event.kind}
      hidden={event.hidden}
      colors={colors}
      onPress={onOpenEvent ? open : undefined}
      onLongPress={hold}
    />
  );
});

const WeekBar = memo(function WeekBar({
  bar,
  x,
  y,
  width,
  byId,
  onOpenBar,
  onLongPressBar,
}: {
  bar: CalendarBar;
  x: number;
  y: number;
  width: number;
  byId: ReadonlyMap<ID, CalendarPerson>;
  onOpenBar?: (id: ID) => void;
  onLongPressBar?: (id: ID, lift: LiftTarget) => void;
}) {
  const colors = usePeopleColors(bar.people, byId);
  const open = useCallback(() => onOpenBar?.(bar.id), [onOpenBar, bar.id]);
  const hold = useLongPressId(bar.id, onLongPressBar);
  return (
    <AllDayBar
      x={x}
      y={y}
      width={width}
      size={WEEK_BAR}
      title={bar.title}
      meta={bar.meta}
      colors={colors}
      hidden={bar.hidden}
      kind={bar.kind}
      done={bar.done}
      plan={bar.plan}
      repeat={bar.repeat}
      onPress={onOpenBar ? open : undefined}
      onLongPress={hold}
    />
  );
});

export const WeekScreen = memo(function WeekScreen(props: WeekScreenProps) {
  const {
    weekStart,
    today,
    now,
    bars,
    events,
    people,
    hiddenPeople,
    onTogglePerson,
    onPrev,
    onNext,
    onToday,
    onOpenDay,
    onOpenEvent,
    onOpenBar,
    onLongPressEvent,
    onLongPressBar,
    insets = NO_INSETS,
    ...chrome
  } = props;
  const { c } = useTheme();
  const [screen, onLayout] = useScreenSize();
  const byId = usePeopleMap(people);

  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const todayIdx = today ? days.indexOf(today) : -1;
  const nowShown = todayIdx >= 0 && now !== undefined ? now : undefined;

  const gx = CAL.gridLeft;
  const col = (screen.width - CAL.gridLeft - CAL.gridRight) / DAYS;
  const top = insets.top;

  const barRows = useMemo(() => packAllDayBars(bars, weekStart, DAYS), [bars, weekStart]);
  const barById = useMemo(() => new Map(bars.map((b) => [b.id, b])), [bars]);
  const barsBottom = top + W.barsTop + barRows.rowCount * W.barPitch;
  const gridY = barsBottom + W.gridGap;
  const gridBottom = screen.height - insets.bottom - S.contentBottom;

  const range = useMemo(() => hourRange(days.flatMap((d) => events[d] ?? NO_EVENTS), nowShown), [days, events, nowShown]);
  const hourPx = Math.max(1, gridBottom - gridY) / (range.hEnd - range.h0);
  const columns = useMemo(
    () => days.map((d) => layoutDayColumn(events[d] ?? NO_EVENTS, { colWidth: col, hourPx, h0: range.h0, hEnd: range.hEnd })),
    [days, events, col, hourPx, range],
  );

  const first = parts(days[0]);
  const last = parts(days[DAYS - 1]);
  const period = (
    <>
      <PeriodTitle text={`${pad2(first.d)}—${pad2(last.d)}`} />
      <PeriodNote
        lines={[first.m === last.m ? MONTHS_SHORT[first.m - 1] : `${MONTHS_SHORT[first.m - 1]}–${MONTHS_SHORT[last.m - 1]}`, String(last.y)]}
        style={styles.note}
      />
      <PeriodArrows prevLabel="Предыдущая неделя" nextLabel="Следующая неделя" onPrev={onPrev} onNext={onNext} />
      <TodayButton onPress={onToday} />
    </>
  );

  return (
    <CalendarScaffold
      view="week"
      period={period}
      overlay={<PersonTabs people={people} hiddenPeople={hiddenPeople} onTogglePerson={onTogglePerson} insetTop={top} />}
      onLayout={onLayout}
      insets={insets}
      {...chrome}
    >
      {days.map((d, i) => {
        const isToday = i === todayIdx;
        return (
          <View key={d} pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            <View
              pointerEvents="none"
              style={[
                styles.shade,
                { left: gx + i * col, width: col, top: top + W.headTop, height: gridBottom - top - W.headTop },
                i % 2 === 1 && { backgroundColor: c.alt },
              ]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${WEEKDAYS[i]} ${parts(d).d}`}
              onPress={onOpenDay ? () => onOpenDay(d) : undefined}
              style={[styles.head, { left: gx + i * col, width: col, top: top + W.headLabelTop }]}
            >
              <Text style={[styles.weekday, { color: c.muted }]}>{WEEKDAYS[i]}</Text>
              <View style={[styles.dayNumber, isToday && { backgroundColor: c.red }]}>
                <Text style={[styles.dayNumberText, { color: isToday ? TODAY_INK : c.text }]}>{pad2(parts(d).d)}</Text>
              </View>
            </Pressable>
          </View>
        );
      })}
      <View pointerEvents="none" style={[styles.rule, { top: top + W.rule, backgroundColor: c.border }]} />

      {barRows.bars.map((pb) => {
        const bar = barById.get(pb.id);
        if (!bar) return null;
        return (
          <WeekBar
            key={pb.id}
            bar={bar}
            x={gx + pb.d0 * col + 1}
            y={top + W.barsTop + pb.row * W.barPitch}
            width={(pb.d1 - pb.d0 + 1) * col - 2}
            byId={byId}
            onOpenBar={onOpenBar}
            onLongPressBar={onLongPressBar}
          />
        );
      })}
      <View pointerEvents="none" style={[styles.hair, { top: barsBottom + W.barsHair, backgroundColor: c.hair }]} />

      <HourLines
        top={gridY}
        hourPx={hourPx}
        h0={range.h0}
        hEnd={range.hEnd}
        lineLeft={CAL.gridLeft}
        lineRight={CAL.gridRight}
        labelLeft={CAL.hourLabelLeft}
      />

      {days.map((d, i) => {
        const list = events[d] ?? NO_EVENTS;
        const blocks = columns[i];
        const evById = new Map(list.map((e) => [e.id, e]));
        return blocks.map((b) => {
          const ev = evById.get(b.id);
          return ev ? (
            <WeekEvent
              key={`${d}:${b.id}`}
              event={ev}
              block={b}
              colX={gx + i * col}
              gridY={gridY}
              byId={byId}
              onOpenEvent={onOpenEvent}
              onLongPressEvent={onLongPressEvent}
            />
          ) : null;
        });
      })}

      {nowShown !== undefined ? (
        <NowMarker y={gridY + minuteToY(nowShown, { hourPx, h0: range.h0 })} left={gx + todayIdx * col} width={col} />
      ) : null}

    </CalendarScaffold>
  );
});

const styles = StyleSheet.create({
  note: { marginLeft: 4 },
  shade: { position: 'absolute' },
  head: { position: 'absolute', alignItems: 'center', gap: 2 },
  weekday: { fontFamily: fonts.mono400, fontSize: 9, letterSpacing: 0.54 },
  dayNumber: { width: W.dayNumber.width, height: W.dayNumber.height, alignItems: 'center', justifyContent: 'center' },
  dayNumberText: { fontFamily: fonts.mono600, fontSize: 15 },
  rule: { position: 'absolute', left: 0, right: 0, height: 1.5 },
  hair: { position: 'absolute', left: 0, right: 0, height: 1 },
});
