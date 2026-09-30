/**
 * Список напоминаний с точным временем срабатывания.
 * Каждая строка: что («Накануне в 20:00») и когда именно придёт («пт 3 окт, 20:00»).
 * Нажатие на строку с временем — поменять время; «×» — убрать; «+ Добавить» — готовые варианты или своё.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { eventStart, moment, momentText, parse, presetChip, PRESETS_ALLDAY, PRESETS_TIMED, sortSpecs, specD, specLabel, specM, withTime } from '@/lib/remind';
import type { ReminderSpec } from '@/lib/types';
import { ICON, useColors } from '@/theme';
import { X } from './icons';
import { TimePanel } from './pickers';
import { Stepper } from './RepeatPanel';
import { Button, Chip, Divider, T } from './ui';

const MAX = 5;

export function ReminderEditor({
  value,
  onChange,
  timed,
  date,
  time,
}: {
  value: ReminderSpec[];
  onChange: (v: ReminderSpec[]) => void;
  /** У дела есть время: доступны «за N минут до начала» */
  timed: boolean;
  /** Для точного времени срабатывания; нет — показываем только правило */
  date?: string | null;
  time?: string | null;
}) {
  const c = useColors();
  const [editing, setEditing] = useState<ReminderSpec | null>(null);
  const [adding, setAdding] = useState(false);
  const [custom, setCustom] = useState<'before' | 'days' | null>(null);
  const list = sortSpecs(value);
  const presets = (timed ? PRESETS_TIMED : PRESETS_ALLDAY).filter((p) => !list.includes(p));

  const add = (s: ReminderSpec) => {
    onChange(sortSpecs([...list, s]).slice(0, MAX));
    setAdding(false);
    setCustom(null);
  };

  return (
    <View style={{ gap: 4 }}>
      {list.length === 0 && (
        <T variant="caption" muted style={{ paddingVertical: 6 }}>
          Без напоминаний
        </T>
      )}
      {list.map((s, i) => {
        const p = parse(s);
        const when = date ? moment(s, date, time ?? null) : null;
        const late = when && time && date ? when.getTime() > eventStart(date, time).getTime() : false;
        const na = p?.kind === 'm' && !timed;
        return (
          <View key={s}>
            {i > 0 && <Divider />}
            <Pressable
              disabled={p?.kind === 'm'}
              onPress={() => setEditing(editing === s ? null : s)}
              style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
            >
              <View style={{ flex: 1 }}>
                <T variant="caption" muted={na}>
                  {specLabel(s)}
                </T>
                {na ? (
                  <T variant="label" muted>
                    сработает, когда у дела будет время
                  </T>
                ) : when ? (
                  <T variant="label" mono muted={!late} danger={late}>
                    {late ? `${momentText(when)} — позже начала, не придёт` : momentText(when)}
                  </T>
                ) : null}
              </View>
              <Pressable onPress={() => onChange(list.filter((x) => x !== s))} hitSlop={10}>
                <X size={16} strokeWidth={ICON.stroke} color={c.textMuted} />
              </Pressable>
            </Pressable>
            {editing === s && p && p.kind !== 'm' && (
              <TimePanel
                value={p.at}
                onPick={(v, done) => {
                  const next = withTime(s, v);
                  onChange(sortSpecs(list.map((x) => (x === s ? next : x))));
                  setEditing(done ? null : next);
                }}
              />
            )}
          </View>
        );
      })}

      {list.length < MAX &&
        (!adding ? (
          <Button kind="text" title="+ Добавить напоминание" onPress={() => setAdding(true)} style={{ alignSelf: 'flex-start', height: 36 }} />
        ) : (
          <View style={{ gap: 10, paddingTop: 6 }}>
            <View style={styles.wrap}>
              {presets.map((p) => (
                <Chip key={p} label={presetChip(p)} onPress={() => add(p)} />
              ))}
              {timed && <Chip label="Своё: за … до начала" selected={custom === 'before'} onPress={() => setCustom(custom === 'before' ? null : 'before')} />}
              <Chip label="Своё: за … дней" selected={custom === 'days'} onPress={() => setCustom(custom === 'days' ? null : 'days')} />
            </View>
            {custom === 'before' && <CustomBefore onAdd={add} />}
            {custom === 'days' && <CustomDays onAdd={add} />}
            <Button kind="text" title="Отмена" color={c.textMuted} onPress={() => (setAdding(false), setCustom(null))} style={{ alignSelf: 'flex-start', height: 32 }} />
          </View>
        ))}
    </View>
  );
}

/** «За 1 ч 45 мин до начала»: часы и минуты на колёсах (до 23:59), нажатие в центр — добавить */
function CustomBefore({ onAdd }: { onAdd: (s: ReminderSpec) => void }) {
  const [v, setV] = useState('01:30');
  const [h, m] = v.split(':').map(Number);
  const min = h * 60 + m;
  return (
    <View style={{ gap: 8 }}>
      <T variant="label" muted>
        Часы : минуты до начала
      </T>
      <TimePanel
        value={v}
        onPick={(nv, done) => {
          setV(nv);
          const [nh, nm] = nv.split(':').map(Number);
          if (done && nh * 60 + nm > 0) onAdd(specM(nh * 60 + nm));
        }}
      />
      <Button title={min > 0 ? `Добавить: ${specLabel(specM(min)).toLowerCase()}` : 'Выберите время'} disabled={!min} onPress={() => onAdd(specM(min))} />
    </View>
  );
}

/** «За 10 дней в 18:00» */
function CustomDays({ onAdd }: { onAdd: (s: ReminderSpec) => void }) {
  const [days, setDays] = useState(5);
  const [at, setAt] = useState('20:00');
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <T variant="caption">За</T>
        <Stepper value={days} min={0} max={60} onChange={setDays} />
        <T variant="caption">{days === 0 ? 'дней (в день события)' : 'дней'}, в</T>
        <T variant="caption" mono>
          {at}
        </T>
      </View>
      <TimePanel value={at} onPick={(v) => setAt(v)} />
      <Button title={`Добавить: ${specLabel(specD(days, at)).toLowerCase()}`} onPress={() => onAdd(specD(days, at))} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
