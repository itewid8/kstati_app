/**
 * Выбор даты и времени внутри раскрытой строки «КОГДА» (C-EditDate) и «ПЕРИОД» (C-EditPeriod, C-EditYear):
 * месяц с колесом времени или год из 12 мини-месяцев (тогда без колеса).
 */
import { memo } from 'react';
import type { IsoDate } from '@/lib/calendarLayout';
import type { PersonColor } from '@/lib/types';
import { useTheme } from '@/ui';
import { MonthCalendar } from '../components/MonthCalendar';
import { TimeRow, type TimeValue } from '../components/TimeWheel';
import { YearPicker } from '../components/YearPicker';

export type DateView = 'month' | 'year';

export type DatePickerProps = {
  view: DateView;
  year: number;
  /** 0 — январь */
  month: number;
  today?: IsoDate | null;
  /** Один выбранный день (дело) */
  selected?: IsoDate | null;
  /** Диапазон (план): концы инвертированы, середина — цветом человека */
  range?: { start: IsoDate; end: IsoDate; color: PersonColor } | null;
  time: TimeValue;
  noTime: boolean;
  /** Шаг минут колеса, по умолчанию 5 */
  minuteStep?: number;

  onSelectDay?: (iso: IsoDate) => void;
  /** Листать месяц (в виде месяца) или год (в виде года): −1 / +1 */
  onShift?: (dir: -1 | 1) => void;
  /** Месяц ⇄ год: тап по «ОКТЯБРЬ 2026 ⌄» / «2026 ⌃» */
  onToggleView?: () => void;
  onSelectMonth?: (month: number) => void;
  onChangeTime?: (time: TimeValue) => void;
  onToggleNoTime?: () => void;
};

export const DatePicker = memo(function DatePicker(p: DatePickerProps) {
  const { person } = useTheme();
  const range = p.range ? { start: p.range.start, end: p.range.end, color: person(p.range.color) } : null;
  const prev = p.onShift ? () => p.onShift?.(-1) : undefined;
  const next = p.onShift ? () => p.onShift?.(1) : undefined;

  if (p.view === 'year') {
    return (
      <YearPicker
        year={p.year}
        month={p.month}
        today={p.today}
        selected={p.selected}
        range={range}
        onSelectMonth={p.onSelectMonth}
        onPrevYear={prev}
        onNextYear={next}
        onCollapse={p.onToggleView}
      />
    );
  }
  return (
    <>
      <MonthCalendar
        year={p.year}
        month={p.month}
        today={p.today}
        selected={p.selected}
        range={range}
        onSelectDay={p.onSelectDay}
        onPrevMonth={prev}
        onNextMonth={next}
        onOpenYear={p.onToggleView}
      />
      <TimeRow
        hour={p.time.hour}
        minute={p.time.minute}
        step={p.minuteStep}
        noTime={p.noTime}
        onChange={p.onChangeTime}
        onToggleNoTime={p.onToggleNoTime}
      />
    </>
  );
});
