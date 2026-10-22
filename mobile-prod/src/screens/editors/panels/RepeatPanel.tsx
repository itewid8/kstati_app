/**
 * Раскрытая строка «ПОВТОР» (C-EditRepeat): пресеты 3×N, а в «НАСТРОИТЬ…» — «каждые N единиц»,
 * дни недели (для недель) и окончание (никогда / до даты / N раз).
 * Значения совпадают с lib/types Repeat: unit = freq, weekdays 1 = пн … 7 = вс, until / count.
 */
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Repeat } from '@/lib/types';
import { LinkButton, Stepper } from '../components/Buttons';
import { ChipGrid, type ChipItem } from '../components/ChipGrid';
import { PanelLabel } from '../components/FieldTable';
import { Segmented, type SegmentItem } from '../components/Segmented';

export type RepeatPreset = 'none' | 'day' | 'weekdays' | 'week' | 'month' | 'year' | 'custom';
export type RepeatUnit = Repeat['freq'];
export type RepeatEnd = 'never' | 'until' | 'count';

const PRESETS: ReadonlyArray<{ key: RepeatPreset; label: string }> = [
  { key: 'none', label: 'НЕ ПОВТОРЯТЬ' },
  { key: 'day', label: 'КАЖДЫЙ ДЕНЬ' },
  { key: 'weekdays', label: 'ПО БУДНЯМ' },
  { key: 'week', label: 'КАЖДУЮ НЕДЕЛЮ' },
  { key: 'month', label: 'КАЖДЫЙ МЕСЯЦ' },
  { key: 'year', label: 'КАЖДЫЙ ГОД' },
  { key: 'custom', label: 'НАСТРОИТЬ…' },
];

const UNITS: ReadonlyArray<SegmentItem<RepeatUnit>> = [
  { key: 'day', label: 'ДЕНЬ' },
  { key: 'week', label: 'НЕДЕЛЯ' },
  { key: 'month', label: 'МЕСЯЦ' },
  { key: 'year', label: 'ГОД' },
];

/** key — номер дня строкой: 1 = пн … 7 = вс */
const DAYS: ReadonlyArray<SegmentItem<string>> = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'].map((label, i) => ({
  key: String(i + 1),
  label,
}));

const ENDS: ReadonlyArray<SegmentItem<RepeatEnd>> = [
  { key: 'never', label: 'НИКОГДА' },
  { key: 'until', label: 'ДО ДАТЫ' },
  { key: 'count', label: 'N РАЗ' },
];

export type RepeatPanelProps = {
  preset: RepeatPreset;
  /** «Каждые N» */
  every: number;
  unit: RepeatUnit;
  /** 1 = пн … 7 = вс */
  weekdays: readonly number[];
  end: RepeatEnd;
  /** Дата окончания кнопкой: «31 ДЕК 2026» */
  untilLabel?: string | null;
  /** Сколько раз (для «N РАЗ») */
  count?: number | null;

  onPreset?: (preset: RepeatPreset) => void;
  onEvery?: (every: number) => void;
  onUnit?: (unit: RepeatUnit) => void;
  onToggleWeekday?: (weekday: number) => void;
  onEnd?: (end: RepeatEnd) => void;
  onPickUntil?: () => void;
  onCount?: (count: number) => void;
};

export const RepeatPanel = memo(function RepeatPanel(p: RepeatPanelProps) {
  const { preset, every, unit, weekdays, end, untilLabel, count, onEvery, onToggleWeekday, onCount } = p;
  const presets = useMemo<ChipItem<RepeatPreset>[]>(
    () => PRESETS.map((x) => ({ ...x, state: x.key === preset ? 'selected' : 'normal' })),
    [preset],
  );
  const selectedDays = useMemo(() => weekdays.map(String), [weekdays]);
  const custom = preset === 'custom';

  return (
    <>
      <ChipGrid items={presets} columns={3} onPress={p.onPreset} />
      {custom ? (
        <>
          <PanelLabel text="КАЖДЫЕ" />
          <View style={styles.every}>
            <Stepper
              value={every}
              onDecrement={onEvery && every > 1 ? () => onEvery(every - 1) : undefined}
              onIncrement={onEvery ? () => onEvery(every + 1) : undefined}
            />
            <Segmented items={UNITS} value={unit} onChange={p.onUnit} style={styles.flex} />
          </View>
          {unit === 'week' ? (
            <>
              <PanelLabel text="ПО ДНЯМ" />
              <Segmented
                items={DAYS}
                value={selectedDays}
                onChange={onToggleWeekday ? (key) => onToggleWeekday(Number(key)) : undefined}
              />
            </>
          ) : null}
          <PanelLabel text="ОКОНЧАНИЕ" />
          <Segmented items={ENDS} value={end} onChange={p.onEnd} />
          {end === 'until' ? <LinkButton label={untilLabel ?? '—'} onPress={p.onPickUntil} /> : null}
          {end === 'count' ? (
            <Stepper
              value={count ?? 1}
              onDecrement={onCount && (count ?? 1) > 1 ? () => onCount((count ?? 1) - 1) : undefined}
              onIncrement={onCount ? () => onCount((count ?? 1) + 1) : undefined}
            />
          ) : null}
        </>
      ) : null}
    </>
  );
});

const styles = StyleSheet.create({
  every: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flex: { flex: 1, minWidth: 0 },
});
