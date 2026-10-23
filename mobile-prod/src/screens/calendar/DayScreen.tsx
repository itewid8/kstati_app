/**
 * День (C-Day). Презентационный экран: дела дня, полосы и люди приходят пропсами, действия — колбэками.
 *
 * Раскладка как в макете: черта 1.5px (top 152), полосы на весь день по 22px с 160, волосяная линия на 6px ниже
 * и сетка часов на 4px ниже неё — до верха навигации. Сетка от x 44 шириной до поля вкладок (26 справа).
 * Видимые часы — hourRange (±1 ч от дел и «сейчас»); пересекающиеся дела стоят рядом в дорожках (layoutDayLanes),
 * короткое дело не ниже 34px.
 */
import { memo, useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  hourRange,
  layoutDayLanes,
  minuteToY,
  packAllDayBars,
  type DayMinute,
  type IsoDate,
  type LaneBlock,
} from '@/lib/calendarLayout';
import type { ID } from '@/lib/types';
import { size as S, useTheme, type LiftTarget } from '@/ui';
import { AllDayBar, DAY_BAR } from './components/AllDayBar';
import { CAL, CalendarScaffold, NO_INSETS, useScreenSize } from './components/CalendarScaffold';
import { DayEventBlock } from './components/DayEventBlock';
import { HourLines } from './components/HourLines';
import { useLongPressId } from './components/longPress';
import { NowMarker } from './components/NowMarker';
import { usePeopleColors, usePeopleMap } from './components/PeopleColor';
import { PeriodArrows, PeriodNote, PeriodTitle, PeriodWeekday, TodayButton } from './components/PeriodBar';
import { PERSON_TAB, PersonTabs } from './components/PersonTabs';
import { MONTHS_SHORT, WEEKDAYS, hhmm, namesOf, pad2, parts, peopleOf, timeRange, weekday } from './format';
import type { CalendarBar, CalendarChromeProps, CalendarPerson, PersonFilterProps, TimedEvent } from './types';

export type DayScreenProps = CalendarChromeProps &
  PersonFilterProps & {
    date: IsoDate;
    /** Сегодня: точка у дня недели, залитая «СЕГОДНЯ» и линия «сейчас» */
    today?: IsoDate;
    /** Текущее время, минуты от полуночи */
    now?: DayMinute;
    /** Полосы, которые задевают этот день */
    bars: readonly CalendarBar[];
    /** Дела со временем этого дня, по началу (при равном начале левее встаёт раньше идущее) */
    events: readonly TimedEvent[];

    onPrev?: () => void;
    onNext?: () => void;
    onToday?: () => void;
    onOpenEvent?: (id: ID) => void;
    onOpenBar?: (id: ID) => void;
    /** Удержание дела или полосы (быстрые действия): id и нажатый блок */
    onLongPressEvent?: (id: ID, lift: LiftTarget) => void;
    onLongPressBar?: (id: ID, lift: LiftTarget) => void;
  };

/** Вертикаль дня (px от верха экрана, без safe area) */
const D = {
  rule: 152,
  barsTop: 160,
  barPitch: 26,
  hairGap: 6,
  gridGap: 4,
  /** Короткое дело всё равно читается: не ниже 34px */
  minBlock: 34,
} as const;

/** « · ВЕСЬ ДЕНЬ · САНЯ», « · 8–10 ОКТ · САНЯ, КАРИНА» */
function barMeta(bar: CalendarBar, names: string): string {
  const a = parts(bar.startDate);
  const b = parts(bar.endDate);
  const span =
    bar.startDate === bar.endDate
      ? 'ВЕСЬ ДЕНЬ'
      : a.m === b.m
        ? `${a.d}–${b.d} ${MONTHS_SHORT[a.m - 1]}`
        : `${a.d} ${MONTHS_SHORT[a.m - 1]} – ${b.d} ${MONTHS_SHORT[b.m - 1]}`;
  return ` · ${span} · ${names.toUpperCase()}`;
}

type ItemProps = {
  byId: ReadonlyMap<ID, CalendarPerson>;
};

const DayEvent = memo(function DayEvent({
  event,
  lane,
  gridX,
  gridY,
  byId,
  onOpenEvent,
  onLongPressEvent,
}: ItemProps & {
  event: TimedEvent;
  lane: LaneBlock;
  gridX: number;
  gridY: number;
  onOpenEvent?: (id: ID) => void;
  onLongPressEvent?: (id: ID, lift: LiftTarget) => void;
}) {
  const colors = usePeopleColors(event.people, byId);
  const open = useCallback(() => onOpenEvent?.(event.id), [onOpenEvent, event.id]);
  const hold = useLongPressId(event.id, onLongPressEvent);
  const who = namesOf(peopleOf(event.people, byId)).toUpperCase() + (event.parentTitle ? ` · ${event.parentTitle.toUpperCase()}` : '');
  return (
    <DayEventBlock
      x={gridX + lane.x}
      y={gridY + lane.y}
      width={lane.w}
      height={lane.h}
      title={event.title}
      time={timeRange(event)}
      note={event.note}
      who={who}
      done={event.done}
      colors={colors}
      onPress={onOpenEvent ? open : undefined}
      onLongPress={hold}
    />
  );
});

const DayBar = memo(function DayBar({
  bar,
  y,
  x,
  width,
  byId,
  onOpenBar,
  onLongPressBar,
}: ItemProps & {
  bar: CalendarBar;
  x: number;
  y: number;
  width: number;
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
      size={DAY_BAR}
      title={bar.title}
      meta={barMeta(bar, namesOf(peopleOf(bar.people, byId)))}
      colors={colors}
      onPress={onOpenBar ? open : undefined}
      onLongPress={hold}
    />
  );
});

export const DayScreen = memo(function DayScreen(props: DayScreenProps) {
  const {
    date,
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

  const isToday = date === today;
  const nowShown = isToday && now !== undefined ? now : undefined;
  const gx = CAL.gridLeft;
  const gw = screen.width - CAL.gridLeft - CAL.gridRight;
  const top = insets.top;

  const barRows = useMemo(() => packAllDayBars(bars, date, 1), [bars, date]);
  const barById = useMemo(() => new Map(bars.map((b) => [b.id, b])), [bars]);
  const rows = barRows.rowCount;
  const hairY = rows ? top + D.barsTop + rows * D.barPitch - (D.barPitch - DAY_BAR.height) + D.hairGap : null;
  const gridY = hairY !== null ? hairY + D.gridGap : top + D.barsTop;
  const gridBottom = screen.height - insets.bottom - S.contentBottom;

  const range = useMemo(() => hourRange(events, nowShown), [events, nowShown]);
  const hourPx = Math.max(1, gridBottom - gridY) / (range.hEnd - range.h0);
  const lanes = useMemo(
    () => layoutDayLanes(events, { width: gw, hourPx, h0: range.h0, hEnd: range.hEnd, minHeight: D.minBlock }),
    [events, gw, hourPx, range],
  );
  const evById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

  const { y, m, d } = parts(date);
  const period = (
    <>
      <PeriodWeekday label={WEEKDAYS[weekday(date)]} today={isToday} />
      <PeriodTitle text={pad2(d)} />
      <PeriodNote lines={[MONTHS_SHORT[m - 1], String(y)]} style={styles.note} />
      <PeriodArrows prevLabel="Предыдущий день" nextLabel="Следующий день" onPrev={onPrev} onNext={onNext} />
      <TodayButton active={isToday} onPress={onToday} />
    </>
  );

  return (
    <CalendarScaffold view="day" period={period} onLayout={onLayout} insets={insets} {...chrome}>
      <View pointerEvents="none" style={[styles.rule, { top: top + D.rule, backgroundColor: c.border }]} />
      {barRows.bars.map((pb) => {
        const bar = barById.get(pb.id);
        return bar ? (
          <DayBar
            key={pb.id}
            bar={bar}
            x={gx}
            y={top + D.barsTop + pb.row * D.barPitch}
            width={gw}
            byId={byId}
            onOpenBar={onOpenBar}
            onLongPressBar={onLongPressBar}
          />
        ) : null;
      })}
      {hairY !== null ? <View pointerEvents="none" style={[styles.hair, { top: hairY, backgroundColor: c.hair }]} /> : null}

      <HourLines
        top={gridY}
        hourPx={hourPx}
        h0={range.h0}
        hEnd={range.hEnd}
        lineLeft={CAL.gridLeft}
        lineRight={CAL.gridRight}
        labelLeft={CAL.hourLabelLeft}
      />

      {lanes.map((lane) => {
        const ev = evById.get(lane.id);
        return ev ? (
          <DayEvent
            key={lane.id}
            event={ev}
            lane={lane}
            gridX={gx}
            gridY={gridY}
            byId={byId}
            onOpenEvent={onOpenEvent}
            onLongPressEvent={onLongPressEvent}
          />
        ) : null;
      })}

      {nowShown !== undefined ? (
        <NowMarker y={gridY + minuteToY(nowShown, { hourPx, h0: range.h0 })} left={gx} width={gw} label={hhmm(nowShown)} />
      ) : null}

      <PersonTabs people={people} hiddenPeople={hiddenPeople} onTogglePerson={onTogglePerson} top={gridY + PERSON_TAB.offset} />
    </CalendarScaffold>
  );
});

const styles = StyleSheet.create({
  note: { marginLeft: 2 },
  rule: { position: 'absolute', left: 0, right: 0, height: 1.5 },
  hair: { position: 'absolute', left: 0, right: 0, height: 1 },
});
