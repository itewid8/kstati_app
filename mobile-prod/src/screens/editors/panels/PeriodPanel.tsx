/**
 * Раскрытая строка «ПЕРИОД» плана (C-EditPeriod, C-EditYear): какой край правим (НАЧАЛО / КОНЕЦ),
 * календарь с диапазоном и колесо времени — или год из мини-месяцев.
 * Начало сдвинули — конец едет на столько же (periodMath.moveStart), а сегмент «КОНЕЦ» коротко
 * подсвечивается: вызывающий увеличивает endFlash.
 */
import { memo, useMemo } from 'react';
import { useTheme } from '@/ui';
import { Segmented, type SegmentFlash, type SegmentItem } from '../components/Segmented';
import { DatePicker, type DatePickerProps } from './DatePanel';

export type PeriodEdge = 'start' | 'end';

export type PeriodPanelProps = DatePickerProps & {
  edge: PeriodEdge;
  /** «СР 7 ОКТ · 07:00» */
  startLabel: string;
  endLabel: string;
  /** Счётчик подсветки «КОНЕЦ» (см. выше); undefined — без подсветки */
  endFlash?: number;
  onEdge?: (edge: PeriodEdge) => void;
};

export const PeriodPanel = memo(function PeriodPanel({ edge, startLabel, endLabel, endFlash, onEdge, ...picker }: PeriodPanelProps) {
  const { person } = useTheme();
  const items = useMemo<SegmentItem<PeriodEdge>[]>(
    () => [
      { key: 'start', caption: 'НАЧАЛО', label: startLabel },
      { key: 'end', caption: 'КОНЕЦ', label: endLabel },
    ],
    [startLabel, endLabel],
  );
  const flashColor = picker.range ? person(picker.range.color) : null;
  const flash: SegmentFlash<PeriodEdge> | null =
    endFlash !== undefined && flashColor ? { key: 'end', token: endFlash, color: flashColor } : null;
  return (
    <>
      <Segmented items={items} value={edge} onChange={onEdge} flash={flash} />
      <DatePicker {...picker} />
    </>
  );
});
