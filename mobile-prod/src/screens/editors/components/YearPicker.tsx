/**
 * Выбор месяца: год кнопкой со стрелкой вверх (свернуть обратно в месяц), ‹ › по годам,
 * 12 мини-месяцев 3×4 — дни квадратиками 7px, диапазон цветом человека, сегодня красным.
 */
import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { IsoDate } from '@/lib/calendarLayout';
import { size as S, tint, useTheme } from '@/ui';
import { CalendarHeader, type DateRange } from './MonthCalendar';
import { MONTHS_A11Y, MONTHS_SHORT, monthCells, within } from './calendarMath';
import { ET } from './text';

export type YearPickerProps = {
  year: number;
  /** Месяц, открытый в календаре (обведён) */
  month: number;
  today?: IsoDate | null;
  selected?: IsoDate | null;
  range?: DateRange | null;
  onSelectMonth?: (month: number) => void;
  onPrevYear?: () => void;
  onNextYear?: () => void;
  onCollapse?: () => void;
};

const QUARTERS = [0, 1, 2, 3];

export const YearPicker = memo(function YearPicker(props: YearPickerProps) {
  const { year, month, today, selected, range, onSelectMonth, onPrevYear, onNextYear, onCollapse } = props;
  const { c } = useTheme();
  const months = useMemo(() => MONTHS_SHORT.map((_, m) => monthCells(year, m, 6)), [year]);
  const empty = tint(c.text, 0.1);

  return (
    <>
      <CalendarHeader
        label={String(year)}
        chevron="up"
        labelA11y="Свернуть"
        prevA11y="Предыдущий год"
        nextA11y="Следующий год"
        onLabel={onCollapse}
        onPrev={onPrevYear}
        onNext={onNextYear}
      />
      <View style={styles.grid}>
        {QUARTERS.map((q) => (
          <View key={q} style={styles.row}>
            {[0, 1, 2].map((i) => {
              const m = q * 3 + i;
              const cur = m === month;
              const cells = months[m];
              return (
                <Pressable
                  key={m}
                  accessibilityRole="button"
                  accessibilityState={{ selected: cur }}
                  accessibilityLabel={`${MONTHS_A11Y[m]} ${year}`}
                  onPress={onSelectMonth ? () => onSelectMonth(m) : undefined}
                  style={[
                    styles.month,
                    cur ? styles.current : styles.other,
                    { borderColor: cur ? c.text : c.hair, backgroundColor: c.panel },
                  ]}
                >
                  <Text style={[cur ? ET.miniMonthStrong : ET.miniMonth, styles.name, { color: c.text }]}>{MONTHS_SHORT[m]}</Text>
                  <View style={styles.days}>
                    {Array.from({ length: cells.length / 7 }, (_, w) => (
                      <View key={w} style={styles.week}>
                        {cells.slice(w * 7, w * 7 + 7).map((cell) => {
                          let bg = 'transparent';
                          if (cell.inMonth) {
                            if (range && within(cell.iso, range.start, range.end)) bg = range.color;
                            else if (cell.iso === selected) bg = c.text;
                            else if (cell.iso === today) bg = c.red;
                            else bg = empty;
                          }
                          return <View key={cell.iso} style={[styles.cell, { backgroundColor: bg }]} />;
                        })}
                      </View>
                    ))}
                  </View>
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
  grid: { gap: 4 },
  row: { flexDirection: 'row', gap: 4 },
  month: { flex: 1, minWidth: 0, paddingTop: 5, paddingHorizontal: 5, paddingBottom: 6, gap: 4 },
  current: { borderWidth: S.border },
  other: { borderWidth: S.hairline },
  name: { textAlign: 'center' },
  days: { gap: 1 },
  week: { flexDirection: 'row', gap: 1 },
  cell: { flex: 1, minWidth: 0, height: 7 },
});
