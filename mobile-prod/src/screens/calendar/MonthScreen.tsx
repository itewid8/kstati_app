/**
 * Месяц (C-Month). Презентационный экран: дела по дням, планы и дела выбранного дня приходят пропсами.
 *
 * Раскладка как в макете: строка дней недели (top 152), сетка 7×5 с 168 (черта 1.5px сверху, волосяные линии
 * между ячейками, строка 77px; при 6 неделях строки ниже, сетка не заходит на панель дня), панель выбранного дня
 * с 564 до верха навигации (на низком экране панель поднимается, строки ниже — monthLayout). В ячейке до 5 дел,
 * больше — 4 и «+N» (monthCellItems); в низкой ячейке — сколько влезает целыми строками (fitRows).
 * Дни планов — заливка цветом плана и полоса 3px сверху; дни соседних месяцев — фон панели и бледное число.
 */
import { memo, useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MONTH_GRID, dayNo, fitRows, monthCellItems, monthLayout, type IsoDate } from '@/lib/calendarLayout';
import type { ID, PersonColor } from '@/lib/types';
import { Hatch, Icon, LONG_PRESS_MS, Marquee, SectionBox, fonts, size as S, space, tint, useLift, useTheme, type LiftTarget } from '@/ui';
import { CalendarScaffold, NO_INSETS, frameOf, useScreenSize } from './components/CalendarScaffold';
import { PeopleFill, PeopleTip, usePeopleColors, usePeopleMap } from './components/PeopleColor';
import { useLongPressId } from './components/longPress';
import { PeriodArrows, PeriodTitle, TodayButton } from './components/PeriodBar';
import {
  MONTHS,
  MONTHS_GEN,
  WEEKDAYS,
  addDays,
  daysInMonth,
  isoDate,
  namesOf,
  pad2,
  parts,
  peopleOf,
  tasksWord,
  weekday,
} from './format';
import type { CalendarChromeProps, CalendarPerson, PhoneLayerProps } from './types';

/** Дело в ячейке месяца: короткое название */
export type MonthItem = {
  id: ID;
  title: string;
  people: readonly ID[];
  /** Моё дело, скрытое от этой группы, — заштриховано */
  hidden?: boolean;
  /** Событие календаря телефона — пунктир, серое */
  phone?: boolean;
};

/** План (дело с подзадачами) — подсветка его дней */
export type MonthPlan = {
  id: ID;
  startDate: IsoDate;
  endDate: IsoDate;
  color: PersonColor;
};

/** Строка панели выбранного дня */
export type AgendaRow = {
  id: ID;
  /** «09:30», «—» */
  time: string;
  title: string;
  people: readonly ID[];
  /** Событие календаря телефона: нажатие — шторка переноса */
  phone?: boolean;
};

export type MonthScreenProps = CalendarChromeProps &
  PhoneLayerProps & {
  people: readonly CalendarPerson[];
  year: number;
  /** 1…12 */
  month: number;
  today?: IsoDate;
  selectedDate?: IsoDate;
  /** Дела по дням месяца (порядок задаёт вызывающий: сначала на весь день, потом по времени) */
  items: Readonly<Record<IsoDate, readonly MonthItem[]>>;
  plans?: readonly MonthPlan[];
  /** Дела выбранного дня */
  agenda: readonly AgendaRow[];

  onPrev?: () => void;
  onNext?: () => void;
  /** «СЕГОДНЯ»: к сегодняшнему дню */
  onToday?: () => void;
  onSelectDate?: (date: IsoDate) => void;
  onOpenEvent?: (id: ID) => void;
  /** Удержание дела в ячейке или в панели дня (быстрые действия): id и нажатый элемент */
  onLongPressEvent?: (id: ID, lift: LiftTarget) => void;
  /** Нажатие на «Октябрь 2026» — к году */
  onOpenYear?: () => void;
  };

/** Вертикаль месяца — MONTH_GRID и monthLayout (общие со щипком) */
const M = { agendaRow: 31 } as const;
/** Дела в ячейке: с 20px, строки по 9 через 1, не больше 5; снизу рамка 1 */
const CELL_ITEMS = { top: 20, row: 9, gap: 1, max: 5, border: 1 } as const;
/** Заливка дней плана */
const PLAN_ALPHA = 0.08;
/** Ширина строки названия в ячейке — заведомо шире ячейки */
const TODAY_INK = '#FFFFFF';
const NO_ITEMS: readonly MonthItem[] = [];
const NO_PLANS: readonly MonthPlan[] = [];

type CellData = {
  date: IsoDate;
  n: number;
  inMonth: boolean;
};

type CellItemProps = {
  item: MonthItem;
  byId: ReadonlyMap<ID, CalendarPerson>;
  /** Нажатие — как по ячейке (выбрать день); удерживаемое дело перехватывает касание у ячейки */
  onPress?: () => void;
  onLongPressEvent?: (id: ID, lift: LiftTarget) => void;
};

const CellItem = memo(function CellItem({ item, byId, onPress, onLongPressEvent }: CellItemProps) {
  const { c } = useTheme();
  const colors = usePeopleColors(item.people, byId);
  const hold = useLongPressId(item.id, onLongPressEvent);
  const lift = useLift(hold, 'block', () => <CellItem item={item} byId={byId} />);
  if (item.phone) {
    return (
      <View style={[styles.item, styles.phoneItem, { borderColor: c.muted }]}>
        <Marquee ellipsis={false} style={[styles.itemText, { color: c.muted }]}>
          {item.title}
        </Marquee>
      </View>
    );
  }
  const body = (
    <>
      <PeopleFill colors={colors} alpha={c.tintAlpha} />
      {item.hidden ? <Hatch /> : null}
      <PeopleTip colors={colors} width={1} />
      <Marquee ellipsis={false} style={[styles.itemText, { color: c.text }]}>
        {item.title}
      </Marquee>
    </>
  );
  // Без удержания — простой блок, как в макете
  if (!lift.onLongPress) return <View style={styles.item}>{body}</View>;
  return (
    <Pressable
      ref={lift.ref}
      accessibilityRole="button"
      accessibilityLabel={item.title}
      onPress={onPress}
      onLongPress={lift.onLongPress}
      delayLongPress={LONG_PRESS_MS}
      style={styles.item}
    >
      {body}
    </Pressable>
  );
});

type CellProps = {
  cell: CellData;
  height: number;
  items: readonly MonthItem[];
  plan?: string;
  today: boolean;
  selected: boolean;
  byId: ReadonlyMap<ID, CalendarPerson>;
  onSelectDate?: (date: IsoDate) => void;
  onLongPressEvent?: (id: ID, lift: LiftTarget) => void;
};

const MonthCell = memo(function MonthCell({ cell, height, items, plan, today, selected, byId, onSelectDate, onLongPressEvent }: CellProps) {
  const { c } = useTheme();
  const cap = fitRows(height - CELL_ITEMS.top - CELL_ITEMS.border, CELL_ITEMS.row, CELL_ITEMS.gap, CELL_ITEMS.max);
  const { shown, more } = cap > 0 ? monthCellItems(items, cap) : { shown: NO_ITEMS, more: 0 };
  const { m } = parts(cell.date);
  const select = useCallback(() => onSelectDate?.(cell.date), [onSelectDate, cell.date]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${cell.n} ${MONTHS_GEN[m - 1]}`}
      onPress={onSelectDate ? select : undefined}
      style={[
        styles.cell,
        { height, borderColor: c.hair },
        !cell.inMonth ? { backgroundColor: c.panel } : plan ? { backgroundColor: tint(plan, PLAN_ALPHA) } : null,
      ]}
    >
      {selected ? <View pointerEvents="none" style={[styles.ring, { boxShadow: `inset 0 0 0 1.5px ${c.text}` }]} /> : null}
      {plan ? <View pointerEvents="none" style={[styles.planBar, { backgroundColor: plan }]} /> : null}
      <View style={[styles.number, today && { backgroundColor: c.red }]}>
        <Text style={[styles.numberText, { color: today ? TODAY_INK : cell.inMonth ? c.text : c.faint }]}>{cell.n}</Text>
      </View>
      <View style={styles.items}>
        {shown.map((it) => (
          <CellItem
            key={it.id}
            item={it}
            byId={byId}
            onPress={onSelectDate ? select : undefined}
            onLongPressEvent={onLongPressEvent}
          />
        ))}
        {more ? <Text style={[styles.more, { color: c.muted }]}>{`+${more}`}</Text> : null}
      </View>
    </Pressable>
  );
});

const AgendaItem = memo(function AgendaItem({
  row,
  byId,
  onOpenEvent,
  onLongPressEvent,
  onOpenPhone,
}: {
  onOpenPhone?: (key: ID) => void;
  row: AgendaRow;
  byId: ReadonlyMap<ID, CalendarPerson>;
  onOpenEvent?: (id: ID) => void;
  onLongPressEvent?: (id: ID, lift: LiftTarget) => void;
}) {
  const { c } = useTheme();
  const colors = usePeopleColors(row.people, byId);
  const open = useCallback(() => (row.phone ? onOpenPhone : onOpenEvent)?.(row.id), [onOpenEvent, onOpenPhone, row.id, row.phone]);
  const hold = useLongPressId(row.id, row.phone ? undefined : onLongPressEvent);
  const lift = useLift(hold, 'row', () => <AgendaItem row={row} byId={byId} />);
  if (row.phone) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Из телефона: ${row.time} ${row.title}`}
        onPress={onOpenPhone ? open : undefined}
        style={[styles.agenda, { backgroundColor: c.panel, borderTopColor: c.hair }]}
      >
        <Text style={[styles.agendaTime, { color: c.muted }]}>{row.time}</Text>
        <Marquee style={[styles.agendaTitle, { color: c.muted }]}>{row.title}</Marquee>
        <Icon name="phone" size={12} color={c.muted} />
      </Pressable>
    );
  }
  return (
    <Pressable
      ref={lift.ref}
      accessibilityRole="button"
      accessibilityLabel={`${row.time} ${row.title}`}
      onPress={onOpenEvent ? open : undefined}
      onLongPress={lift.onLongPress}
      delayLongPress={LONG_PRESS_MS}
      style={[styles.agenda, { backgroundColor: c.panel, borderTopColor: c.hair }]}
    >
      <PeopleTip colors={colors} width={S.strip} />
      <Text style={[styles.agendaTime, { color: c.text }]}>{row.time}</Text>
      <Marquee style={[styles.agendaTitle, { color: c.text }]}>
        {row.title}
      </Marquee>
      <Text style={[styles.agendaWho, { color: c.muted }]}>{namesOf(peopleOf(row.people, byId)).toUpperCase()}</Text>
    </Pressable>
  );
});

export const MonthScreen = memo(function MonthScreen(props: MonthScreenProps) {
  const {
    people,
    year,
    month,
    today,
    selectedDate,
    items,
    plans = NO_PLANS,
    agenda,
    onPrev,
    onNext,
    onToday,
    onSelectDate,
    onOpenEvent,
    onLongPressEvent,
    onOpenYear,
    onOpenPhone,
    insets = NO_INSETS,
    ...chrome
  } = props;
  const { c, person } = useTheme();
  const [screen, onLayout] = useScreenSize();
  const byId = usePeopleMap(people);
  const top = insets.top;

  const weeks = useMemo(() => {
    const first = isoDate(year, month, 1);
    const lead = weekday(first);
    const len = daysInMonth(year, month);
    const count = Math.ceil((lead + len) / 7);
    const start = addDays(first, -lead);
    return Array.from({ length: count }, (_, w) =>
      Array.from({ length: 7 }, (_, i): CellData => {
        const date = addDays(start, w * 7 + i);
        const p = parts(date);
        return { date, n: p.d, inMonth: p.m === month && p.y === year };
      }),
    );
  }, [year, month]);
  const layout = monthLayout(weeks.length, frameOf(screen, insets));
  const rowH = layout.rowH;

  /** Дата → цвет плана (первый план, который её покрывает) */
  const planColor = useMemo(() => {
    const map = new Map<IsoDate, string>();
    for (const p of plans) {
      const len = dayNo(p.endDate) - dayNo(p.startDate);
      for (let i = 0; i <= len; i++) {
        const iso = addDays(p.startDate, i);
        if (!map.has(iso)) map.set(iso, person(p.color));
      }
    }
    return map;
  }, [plans, person]);

  const sel = selectedDate ? parts(selectedDate) : null;
  const panelTitle = selectedDate && sel ? `${WEEKDAYS[weekday(selectedDate)]} ${pad2(sel.d)}${selectedDate === today ? ' · СЕГОДНЯ' : ''}` : '';

  const period = (
    <>
      <PeriodTitle text={MONTHS[month - 1]} onPress={onOpenYear} />
      <Text onPress={onOpenYear} style={[styles.year, { color: c.muted }]}>
        {year}
      </Text>
      <PeriodArrows prevLabel="Предыдущий месяц" nextLabel="Следующий месяц" onPrev={onPrev} onNext={onNext} />
      <TodayButton active={!!today && selectedDate === today} onPress={onToday} />
    </>
  );

  return (
    <CalendarScaffold view="month" period={period} onLayout={onLayout} insets={insets} {...chrome}>
      <View style={[styles.side, styles.weekdays, { top: top + MONTH_GRID.weekdaysTop }]}>
        {WEEKDAYS.map((w) => (
          <Text key={w} style={[styles.weekday, { color: c.muted }]}>
            {w}
          </Text>
        ))}
      </View>

      <View style={[styles.side, styles.grid, { top: layout.gridTop, borderTopColor: c.border, borderLeftColor: c.hair }]}>
        {weeks.map((week) => (
          <View key={week[0].date} style={styles.week}>
            {week.map((cell) => (
              <MonthCell
                key={cell.date}
                cell={cell}
                height={rowH}
                items={cell.inMonth ? (items[cell.date] ?? NO_ITEMS) : NO_ITEMS}
                plan={cell.inMonth ? planColor.get(cell.date) : undefined}
                today={cell.date === today}
                selected={cell.date === selectedDate}
                byId={byId}
                onSelectDate={onSelectDate}
                onLongPressEvent={onLongPressEvent}
              />
            ))}
          </View>
        ))}
      </View>

      {selectedDate ? (
        <SectionBox
          title={panelTitle}
          count={`${agenda.length} ${tasksWord(agenda.length)}`}
          scrollable
          style={[styles.side, styles.panel, { top: layout.panelTop, maxHeight: layout.panelMax }]}
        >
          {agenda.map((r) => (
            <AgendaItem key={r.id} row={r} byId={byId} onOpenEvent={onOpenEvent} onLongPressEvent={onLongPressEvent} onOpenPhone={onOpenPhone} />
          ))}
        </SectionBox>
      ) : null}
    </CalendarScaffold>
  );
});

const styles = StyleSheet.create({
  side: { position: 'absolute', left: space.side, right: space.side },
  year: {
    alignSelf: 'flex-end',
    marginLeft: 2,
    paddingBottom: 6,
    fontFamily: fonts.mono400,
    fontSize: 10,
    letterSpacing: 0.8,
  },
  weekdays: { flexDirection: 'row' },
  weekday: { flex: 1, paddingLeft: 4, fontFamily: fonts.mono400, fontSize: 9, letterSpacing: 0.72 },
  grid: { borderTopWidth: MONTH_GRID.rule, borderLeftWidth: 1 },
  week: { flexDirection: 'row' },
  cell: { flex: 1, minWidth: 0, borderRightWidth: 1, borderBottomWidth: 1, overflow: 'hidden' },
  /** Обводка выбранного дня — inset-тень, как в макете: рисуется под содержимым, полпикселя сглажены */
  ring: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  planBar: { position: 'absolute', left: 0, top: 0, right: 0, height: 3 },
  number: {
    position: 'absolute',
    left: 3,
    top: 4,
    minWidth: 16,
    height: 14,
    paddingHorizontal: 2,
    alignItems: 'center',
  },
  numberText: { fontFamily: fonts.mono600, fontSize: 9.5, lineHeight: 14 },
  items: { position: 'absolute', left: 2, right: 2, top: CELL_ITEMS.top, gap: CELL_ITEMS.gap },
  item: { height: CELL_ITEMS.row, paddingLeft: 3, overflow: 'hidden' },
  phoneItem: { borderWidth: 0.5, borderStyle: 'dashed', paddingLeft: 2 },
  /** Название обрезается краем ячейки без многоточия (как в макете), не влезает — бегущая строка */
  itemText: { fontFamily: fonts.sans600, fontSize: 6.5, lineHeight: 9, letterSpacing: -0.065 },
  more: { fontFamily: fonts.mono400, fontSize: 6.5, lineHeight: 8 },
  panel: { flexShrink: 0 },
  agenda: {
    height: M.agendaRow,
    borderTopWidth: 1,
    paddingLeft: 11,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  agendaTime: { width: 32, fontFamily: fonts.mono500, fontSize: 10 },
  agendaTitle: { flex: 1, fontFamily: fonts.sans500, fontSize: 12 },
  agendaWho: { fontFamily: fonts.mono400, fontSize: 8.5, letterSpacing: 0.34 },
});
