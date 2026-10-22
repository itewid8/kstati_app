/**
 * Календарь месяца: шапка (месяц/год кнопкой со стрелкой → год, ‹ ›), дни недели, сетка 26px.
 * Один выбранный день или диапазон: концы инвертированы, середина — заливка цветом человека.
 * Сегодня — красным.
 */
import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { IsoDate } from '@/lib/calendarLayout';
import { Icon, size as S, tint, useTheme } from '@/ui';
import { MONTHS, WEEKDAYS, monthCells, within } from './calendarMath';
import { ET } from './text';

export type DateRange = {
  start: IsoDate;
  end: IsoDate;
  /** Цвет заливки середины (цвет человека под тему) */
  color: string;
};

type HeaderProps = {
  label: string;
  /** down — открыть год, up — свернуть обратно в месяц */
  chevron: 'down' | 'up';
  labelA11y: string;
  prevA11y: string;
  nextA11y: string;
  onLabel?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
};

export const CalendarHeader = memo(function CalendarHeader(p: HeaderProps) {
  const { c } = useTheme();
  const nav = [styles.nav, { borderColor: c.border, backgroundColor: c.panel }];
  return (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel={p.labelA11y} onPress={p.onLabel} style={styles.label}>
        <Text style={[ET.monthLabel, { color: c.text }]}>{p.label}</Text>
        <Icon name={p.chevron === 'down' ? 'chevronDown' : 'chevronUp'} size={10} color={c.text} strokeWidth={3} />
      </Pressable>
      <View style={styles.navs}>
        <Pressable accessibilityRole="button" accessibilityLabel={p.prevA11y} onPress={p.onPrev} style={nav}>
          <Icon name="back" size={12} color={c.text} strokeWidth={2.2} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={p.nextA11y} onPress={p.onNext} style={nav}>
          <Icon name="forward" size={12} color={c.text} strokeWidth={2.2} />
        </Pressable>
      </View>
    </View>
  );
});

export type MonthCalendarProps = {
  year: number;
  /** 0 — январь */
  month: number;
  today?: IsoDate | null;
  selected?: IsoDate | null;
  range?: DateRange | null;
  onSelectDay?: (iso: IsoDate) => void;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  /** Нажатие на «ОКТЯБРЬ 2026 ⌄» — выбор месяца и года */
  onOpenYear?: () => void;
};

export const MonthCalendar = memo(function MonthCalendar(props: MonthCalendarProps) {
  const { year, month, today, selected, range, onSelectDay, onPrevMonth, onNextMonth, onOpenYear } = props;
  const { c } = useTheme();
  const weeks = useMemo(() => {
    const cells = monthCells(year, month);
    return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
  }, [year, month]);
  const mid = range ? tint(range.color, c.tintAlpha) : null;

  return (
    <>
      <CalendarHeader
        label={`${MONTHS[month]} ${year}`}
        chevron="down"
        labelA11y="Выбрать месяц и год"
        prevA11y="Предыдущий месяц"
        nextA11y="Следующий месяц"
        onLabel={onOpenYear}
        onPrev={onPrevMonth}
        onNext={onNextMonth}
      />
      <View style={styles.week}>
        {WEEKDAYS.map((d) => (
          <Text key={d} style={[ET.weekday, styles.weekday, { color: c.muted }]}>
            {d}
          </Text>
        ))}
      </View>
      <View style={styles.days}>
        {weeks.map((week) => (
          <View key={week[0].iso} style={styles.week}>
            {week.map((cell) => {
              const isEnd =
                cell.inMonth && (cell.iso === selected || (!!range && (cell.iso === range.start || cell.iso === range.end)));
              const isMid = cell.inMonth && !isEnd && !!range && within(cell.iso, range.start, range.end);
              const isToday = cell.inMonth && cell.iso === today;
              const color = isEnd ? c.bg : !cell.inMonth ? c.faint : isToday ? c.red : c.text;
              return (
                <Pressable
                  key={cell.iso}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isEnd }}
                  accessibilityLabel={cell.iso}
                  onPress={onSelectDay ? () => onSelectDay(cell.iso) : undefined}
                  style={[styles.day, isEnd ? { backgroundColor: c.text } : isMid && mid ? { backgroundColor: mid } : null]}
                >
                  <Text style={[isEnd || isToday ? ET.dayStrong : ET.day, { color }]}>{cell.day}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </>
  );
});

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { height: 28, flexDirection: 'row', alignItems: 'center', gap: 6 },
  navs: { flexDirection: 'row', gap: 4 },
  nav: { width: 28, height: 28, borderWidth: S.border, alignItems: 'center', justifyContent: 'center' },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, minWidth: 0, textAlign: 'center' },
  /** Сетка дней поднята на 4px к строке дней недели */
  days: { marginTop: -4 },
  day: { flex: 1, minWidth: 0, height: 26, alignItems: 'center', justifyContent: 'center' },
});
