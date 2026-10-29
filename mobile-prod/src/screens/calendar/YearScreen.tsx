/**
 * Год (C-Year). Презентационный экран: занятость по дням, счётчики месяцев и легенда людей приходят пропсами.
 *
 * Раскладка как в макете: легенда (top 152), сетка 3×4 карточек месяцев с 174 (строка 138, зазор 6).
 * В карточке — название и число дел, под ним дни квадратами 12px по неделям (5 или 6 строк).
 * Декабрь не уходит под навигацию: на низком экране строки карточек и квадраты дней меньше (yearLayout),
 * а если и так не влезает — сетка прокручивается.
 * День с делами — цвет человека с насыщенностью level (несколько людей — диагональ 135°), без дел — «пустой»,
 * сегодня — красный со свечением. Текущий месяц — рамка 1.5px цветом текста.
 */
import { memo, useCallback, useMemo, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { YEAR_GRID, yearLayout, type IsoDate } from '@/lib/calendarLayout';
import type { ID } from '@/lib/types';
import { fonts, size as S, space, useTheme, type Scheme } from '@/ui';
import { CalendarScaffold, NO_INSETS, frameOf, useScreenSize } from './components/CalendarScaffold';
import { DiagonalFill, DiagonalSwatch, usePeopleColors, usePeopleMap } from './components/PeopleColor';
import { PeriodArrows, PeriodNote, PeriodTitle, TodayButton } from './components/PeriodBar';
import { MONTHS, MONTHS_SHORT, addDays, daysInMonth, isoDate, parts, tasksWord, weekday } from './format';
import type { CalendarChromeProps, CalendarPerson } from './types';

/** Занятость дня: кто занят и насколько (0…1 — прозрачность цвета) */
export type YearDay = {
  people: readonly ID[];
  level: number;
};

export type YearScreenProps = CalendarChromeProps & {
  /** Легенда: люди группы (и «ВМЕСТЕ», если их больше одного) */
  people: readonly CalendarPerson[];
  year: number;
  today?: IsoDate;
  /** Всего дел за год: «214 ДЕЛ» */
  total: number;
  /** Дни с делами */
  days: Readonly<Record<IsoDate, YearDay>>;
  /** Дел в каждом месяце (12 чисел); 0 — без подписи */
  monthCounts: readonly number[];

  onPrev?: () => void;
  /** «СЕГОДНЯ»: к текущему году */
  onToday?: () => void;
  onNext?: () => void;
  /** month — 1…12 */
  onOpenMonth?: (month: number) => void;
  /** Прокрутка сетки (только если она не влезла над навигацией) — после жеста */
  onScrollY?: (y: number) => void;
};

const Y = YEAR_GRID;

/**
 * День без дел. В палитре такого цвета нет (alt светлой темы близок, тёмной — нет): светлая #E2E1DB, тёмная #1E1E1E.
 * Кандидат в токены (palettes.*.empty) — общий src/ui этой задачей не меняется.
 */
const EMPTY_DAY: Record<Scheme, string> = { light: '#E2E1DB', dark: '#1E1E1E' };
const NO_IDS: readonly ID[] = [];
/** Месяцы 1…12 строками по три */
const QUARTERS = [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]] as const;

type DayCell = { date: IsoDate; inMonth: boolean };

/** Недели месяца с понедельника: 5 строк, если месяц в них помещается, иначе 6 */
function monthWeeks(year: number, month: number): DayCell[][] {
  const first = isoDate(year, month, 1);
  const lead = weekday(first);
  const rows = lead + daysInMonth(year, month) <= 35 ? 5 : 6;
  const start = addDays(first, -lead);
  return Array.from({ length: rows }, (_, w) =>
    Array.from({ length: 7 }, (_, i) => {
      const date = addDays(start, w * 7 + i);
      return { date, inMonth: parts(date).m === month };
    }),
  );
}

type DayProps = {
  cell: DayCell;
  day?: YearDay;
  today: boolean;
  height: number;
  byId: ReadonlyMap<ID, CalendarPerson>;
};

/** Квадрат дня: ширину делит строка недели (flex), высота 12 (на низком экране меньше) */
const YearDaySquare = memo(function YearDaySquare({ cell, day, today, height, byId }: DayProps) {
  const { c, scheme } = useTheme();
  const colors = usePeopleColors(day?.people ?? NO_IDS, byId);
  const size = height === Y.dayH ? styles.day : [styles.day, { height }];
  if (!cell.inMonth) return <View style={size} />;
  if (today) return <View style={[size, { backgroundColor: c.red, boxShadow: `0 0 6px ${c.glow}` }]} />;
  if (!day || !day.people.length) return <View style={[size, { backgroundColor: EMPTY_DAY[scheme] }]} />;
  return (
    <View style={size}>
      <DiagonalFill colors={colors} alpha={day.level} />
    </View>
  );
});

type MonthProps = {
  year: number;
  month: number;
  count: number;
  current: boolean;
  width: number;
  height: number;
  dayH: number;
  today?: IsoDate;
  days: Readonly<Record<IsoDate, YearDay>>;
  byId: ReadonlyMap<ID, CalendarPerson>;
  onOpenMonth?: (month: number) => void;
};

const MonthCard = memo(function MonthCard({ year, month, count, current, width, height, dayH, today, days, byId, onOpenMonth }: MonthProps) {
  const { c } = useTheme();
  const weeks = useMemo(() => monthWeeks(year, month), [year, month]);
  const border = current ? S.border : 1;
  const open = useCallback(() => onOpenMonth?.(month), [onOpenMonth, month]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${MONTHS[month - 1]}, ${count} ${tasksWord(count).toLowerCase()}`}
      onPress={onOpenMonth ? open : undefined}
      style={[styles.card, { width, height, borderWidth: border, borderColor: current ? c.text : c.hair, backgroundColor: c.panel }]}
    >
      <View style={styles.cardHead}>
        <Text style={[styles.cardName, { color: c.text }]}>{MONTHS_SHORT[month - 1]}</Text>
        {count ? <Text style={[styles.cardCount, { color: c.muted }]}>{count}</Text> : null}
      </View>
      <View style={styles.days}>
        {weeks.map((week) => (
          <View key={week[0].date} style={styles.week}>
            {week.map((cell) => (
              <YearDaySquare key={cell.date} cell={cell} day={days[cell.date]} today={cell.date === today} height={dayH} byId={byId} />
            ))}
          </View>
        ))}
      </View>
    </Pressable>
  );
});

const LegendItem = memo(function LegendItem({ label, ids, byId }: { label: string; ids: readonly ID[]; byId: ReadonlyMap<ID, CalendarPerson> }) {
  const { c } = useTheme();
  const colors = usePeopleColors(ids, byId);
  return (
    <View style={styles.legendItem}>
      <DiagonalSwatch colors={colors} width={9} height={9} />
      <Text style={[styles.legendText, { color: c.muted }]}>{label}</Text>
    </View>
  );
});

export const YearScreen = memo(function YearScreen(props: YearScreenProps) {
  const { people, year, today, total, days, monthCounts, onPrev, onNext, onToday, onOpenMonth, onScrollY, insets = NO_INSETS, ...chrome } = props;
  const [screen, onLayout] = useScreenSize();
  const frame = frameOf(screen, insets);
  const layout = yearLayout(frame);
  /** Низ области сетки: над навигацией с зазором 8 */
  const floor = frame.height - frame.bottom;
  const scrolls = layout.gridTop + layout.gridH > floor;
  const reportScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => onScrollY?.(e.nativeEvent.contentOffset.y),
    [onScrollY],
  );
  const byId = usePeopleMap(people);
  const top = insets.top;
  const allIds = useMemo(() => people.map((p) => p.id), [people]);
  const cardW = (screen.width - 2 * space.side - (Y.cols - 1) * Y.gap) / Y.cols;
  const t = today ? parts(today) : null;

  const period = (
    <>
      <PeriodTitle text={String(year)} />
      <PeriodNote lines={[String(total), tasksWord(total)]} style={styles.note} />
      <PeriodArrows prevLabel="Предыдущий год" nextLabel="Следующий год" onPrev={onPrev} onNext={onNext} />
      <TodayButton active={t?.y === year} onPress={onToday} />
    </>
  );

  return (
    <CalendarScaffold view="year" period={period} onLayout={onLayout} insets={insets} {...chrome}>
      <View style={[styles.side, styles.legend, { top: top + Y.legendTop }]}>
        {people.map((p) => (
          <LegendItem key={p.id} label={p.name.toUpperCase()} ids={[p.id]} byId={byId} />
        ))}
        {people.length > 1 ? <LegendItem label="ВМЕСТЕ" ids={allIds} byId={byId} /> : null}
      </View>

      <YearGridFrame scrolls={scrolls} top={layout.gridTop} bottom={screen.height - floor} onScrollEnd={onScrollY ? reportScroll : undefined}>
        {QUARTERS.map((row) => (
          <View key={row[0]} style={styles.gridRow}>
            {row.map((month) => (
              <MonthCard
                key={month}
                year={year}
                month={month}
                count={monthCounts[month - 1] ?? 0}
                current={!!t && t.y === year && t.m === month}
                width={cardW}
                height={layout.rowH}
                dayH={layout.dayH}
                today={today}
                days={days}
                byId={byId}
                onOpenMonth={onOpenMonth}
              />
            ))}
          </View>
        ))}
      </YearGridFrame>
    </CalendarScaffold>
  );
});

type GridFrameProps = {
  scrolls: boolean;
  top: number;
  /** Отступ низа области прокрутки от низа экрана: навигация, safe area и зазор */
  bottom: number;
  onScrollEnd?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  children: ReactNode;
};

/** Сетка карточек: влезает — как в макете, иначе — прокрутка до верха навигации */
const YearGridFrame = ({ scrolls, top, bottom, onScrollEnd, children }: GridFrameProps) => {
  if (!scrolls) return <View style={[styles.side, styles.grid, { top }]}>{children}</View>;
  return (
    <ScrollView
      style={[styles.scroll, { top, bottom }]}
      contentContainerStyle={[styles.grid, styles.scrollContent]}
      showsVerticalScrollIndicator={false}
      onScrollEndDrag={onScrollEnd}
      onMomentumScrollEnd={onScrollEnd}
    >
      {children}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  side: { position: 'absolute', left: space.side, right: space.side },
  note: { marginLeft: 4 },
  legend: { flexDirection: 'row', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendText: { fontFamily: fonts.mono400, fontSize: 9.5, letterSpacing: 0.57 },
  grid: { gap: Y.gap },
  scroll: { position: 'absolute', left: 0, right: 0 },
  scrollContent: { paddingHorizontal: space.side },
  gridRow: { flexDirection: 'row', gap: Y.gap },
  card: { paddingTop: Y.pad, paddingHorizontal: Y.pad, gap: Y.headGap },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between' },
  cardName: { fontFamily: fonts.mono600, fontSize: 10, letterSpacing: 0.8 },
  cardCount: { fontFamily: fonts.mono400, fontSize: 10, letterSpacing: 0.8 },
  days: { gap: Y.dayGap },
  week: { flexDirection: 'row', gap: Y.dayGap },
  day: { flex: 1, minWidth: 0, height: Y.dayH },
});
