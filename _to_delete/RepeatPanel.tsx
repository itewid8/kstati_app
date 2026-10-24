/**
 * Выбор повтора: готовые варианты одним нажатием + «Настроить» для всего остального
 * (каждые N дней/недель/месяцев/лет, дни недели, числа месяца, месяцы, окончание).
 * Так устроено в Google и Apple Календаре: частые случаи — сразу, сложные — в одном месте.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MONTH_SHORT, WEEKDAY_SHORT, weekdayOf } from '@/lib/recur';
import type { Repeat } from '@/lib/types';
import { useColors } from '@/theme';
import { DatePanel } from './pickers';
import { Chip, T } from './ui';

type Preset = { key: string; label: string; make: (start: string) => Repeat | null };

const PRESETS: Preset[] = [
  { key: 'none', label: 'Не повторять', make: () => null },
  { key: 'day', label: 'Каждый день', make: () => ({ freq: 'day', every: 1 }) },
  { key: 'workdays', label: 'По будням', make: () => ({ freq: 'week', every: 1, weekdays: [1, 2, 3, 4, 5] }) },
  { key: 'week', label: 'Каждую неделю', make: (s) => ({ freq: 'week', every: 1, weekdays: [weekdayOf(s)] }) },
  { key: 'month', label: 'Каждый месяц', make: (s) => ({ freq: 'month', every: 1, monthDays: [Number(s.slice(8))] }) },
  { key: 'year', label: 'Каждый год', make: (s) => ({ freq: 'year', every: 1, months: [Number(s.slice(5, 7))], monthDays: [Number(s.slice(8))] }) },
];

const same = (a: Repeat | null, b: Repeat | null) => JSON.stringify(a) === JSON.stringify(b);

export function RepeatPanel({ value, start, onChange }: { value: Repeat | null; start: string; onChange: (r: Repeat | null) => void }) {
  const c = useColors();
  const preset = PRESETS.find((p) => same(p.make(start), value))?.key;
  const [custom, setCustom] = useState(!!value && !preset);

  return (
    <View style={[styles.panel, { borderColor: c.border }]}>
      <View style={styles.wrap}>
        {PRESETS.map((p) => (
          <Chip
            key={p.key}
            label={p.label}
            selected={!custom && preset === p.key}
            onPress={() => {
              setCustom(false);
              onChange(p.make(start));
            }}
          />
        ))}
        <Chip
          label="Настроить…"
          selected={custom}
          onPress={() => {
            setCustom(true);
            if (!value) onChange(PRESETS[3].make(start));
          }}
        />
      </View>
      {custom && value ? <Custom value={value} start={start} onChange={onChange} /> : null}
    </View>
  );
}

const UNITS: { key: Repeat['freq']; label: string }[] = [
  { key: 'day', label: 'день' },
  { key: 'week', label: 'неделя' },
  { key: 'month', label: 'месяц' },
  { key: 'year', label: 'год' },
];

function Custom({ value, start, onChange }: { value: Repeat; start: string; onChange: (r: Repeat) => void }) {
  const set = (p: Partial<Repeat>) => onChange({ ...value, ...p });
  const toggle = (list: number[] | undefined, x: number, fallback: number) => {
    const cur = list?.length ? list : [fallback];
    const next = cur.includes(x) ? cur.filter((y) => y !== x) : [...cur, x];
    return next.length ? next.sort((a, b) => a - b) : cur; // хотя бы один день должен остаться
  };
  const sd = Number(start.slice(8));
  const sm = Number(start.slice(5, 7));
  const [endMode, setEndMode] = useState<'never' | 'until' | 'count'>(value.until ? 'until' : value.count ? 'count' : 'never');

  return (
    <View style={{ gap: 14 }}>
      <Row label="Каждые">
        <Stepper value={value.every} min={1} max={99} onChange={(every) => set({ every })} />
        {UNITS.map((u) => (
          <Chip
            key={u.key}
            label={u.label}
            selected={value.freq === u.key}
            onPress={() =>
              onChange({
                freq: u.key,
                every: value.every,
                ...(u.key === 'week' && { weekdays: [weekdayOf(start)] }),
                ...(u.key === 'month' && { monthDays: [sd] }),
                ...(u.key === 'year' && { months: [sm], monthDays: [sd] }),
                until: value.until ?? null,
                count: value.count ?? null,
              })
            }
          />
        ))}
      </Row>

      {value.freq === 'week' && (
        <Row label="По дням">
          {WEEKDAY_SHORT.map((w, i) => (
            <Chip key={w} label={w} selected={(value.weekdays?.length ? value.weekdays : [weekdayOf(start)]).includes(i + 1)} onPress={() => set({ weekdays: toggle(value.weekdays, i + 1, weekdayOf(start)) })} />
          ))}
        </Row>
      )}

      {value.freq === 'year' && (
        <Row label="В месяцы">
          {MONTH_SHORT.map((m, i) => (
            <Chip key={m} label={m} selected={(value.months?.length ? value.months : [sm]).includes(i + 1)} onPress={() => set({ months: toggle(value.months, i + 1, sm) })} />
          ))}
        </Row>
      )}

      {(value.freq === 'month' || value.freq === 'year') && (
        <View style={{ gap: 8 }}>
          <T variant="label" muted>
            Числа месяца
          </T>
          <DayGrid selected={value.monthDays?.length ? value.monthDays : [sd]} onToggle={(d) => set({ monthDays: toggle(value.monthDays, d, sd) })} />
        </View>
      )}

      <View style={{ gap: 8 }}>
        <Row label="Окончание">
          <Chip label="Никогда" selected={endMode === 'never'} onPress={() => (setEndMode('never'), set({ until: null, count: null }))} />
          <Chip label="До даты" selected={endMode === 'until'} onPress={() => (setEndMode('until'), set({ count: null }))} />
          <Chip label="Количество раз" selected={endMode === 'count'} onPress={() => (setEndMode('count'), set({ until: null, count: value.count ?? 10 }))} />
        </Row>
        {endMode === 'until' && <DatePanel value={value.until ?? null} onPick={(until) => set({ until: until < start ? start : until, count: null })} />}
        {endMode === 'count' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Stepper value={value.count ?? 10} min={1} max={999} onChange={(count) => set({ count })} />
            <T muted>раз</T>
          </View>
        )}
      </View>
    </View>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <T variant="label" muted>
        {label}
      </T>
      <View style={styles.wrap}>{children}</View>
    </View>
  );
}

/** − 2 + */
export function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (n: number) => void }) {
  const c = useColors();
  const btn = (label: string, d: number) => (
    <Pressable
      onPress={() => onChange(Math.min(max, Math.max(min, value + d)))}
      hitSlop={6}
      style={({ pressed }) => [styles.stepBtn, { borderColor: c.border, opacity: pressed ? 0.6 : 1 }]}
    >
      <T weight="medium">{label}</T>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {btn('−', -1)}
      <T mono style={{ minWidth: 28, textAlign: 'center' }}>
        {value}
      </T>
      {btn('+', 1)}
    </View>
  );
}

/** Сетка чисел 1…31 и «посл.» */
function DayGrid({ selected, onToggle }: { selected: number[]; onToggle: (d: number) => void }) {
  const c = useColors();
  const days = [...Array.from({ length: 31 }, (_, i) => i + 1), -1];
  return (
    <View style={styles.grid}>
      {days.map((d) => {
        const on = selected.includes(d);
        return (
          <Pressable key={d} onPress={() => onToggle(d)} style={styles.cell} hitSlop={2}>
            <View style={[styles.circle, { backgroundColor: on ? c.primary : 'transparent' }]}>
              <T variant="caption" mono color={on ? c.onPrimary : c.text}>
                {d === -1 ? 'посл.' : d}
              </T>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  stepBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, height: 38, alignItems: 'center', justifyContent: 'center' },
  circle: { minWidth: 32, height: 32, borderRadius: 16, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
});
