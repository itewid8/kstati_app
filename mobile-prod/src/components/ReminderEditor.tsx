/**
 * Список напоминаний (настройки по умолчанию; блоки C-EditRemind): строки в рамке — правило и когда придёт, «×» — убрать;
 * нажатие на строку «накануне в 20:00» — время колесом; ниже пресеты плитками (уже добавленные — бледные) и свои правила.
 */
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { remindLabel } from '@/adapters/editors/labels';
import { timeText } from '@/adapters/editors/panels';
import { PRESETS_ALLDAY, PRESETS_TIMED, eventStart, moment, momentText, parse, sortSpecs, specD, specLabel, specM, withTime } from '@/lib/remind';
import type { ReminderSpec } from '@/lib/types';
import { Stepper } from '@/screens/editors/components/Buttons';
import { ChipGrid, type ChipItem, type ChipState } from '@/screens/editors/components/ChipGrid';
import { PanelLabel } from '@/screens/editors/components/FieldTable';
import { ET } from '@/screens/editors/components/text';
import { TimeWheel, type TimeValue } from '@/screens/editors/components/TimeWheel';
import { SheetButtons } from '@/screens/sheets';
import { Icon, Marquee, size as S, type as T, useTheme } from '@/ui';

const MAX = 5;
const MAX_DAYS = 60;
type Custom = 'before' | 'days';
const CUSTOM_BEFORE = 'custom:before';
const CUSTOM_DAYS = 'custom:days';

const chipState = (selected: boolean, used: boolean): ChipState => (selected ? 'selected' : used ? 'used' : 'normal');

const valueOf = (hhmm: string): TimeValue => {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  return { hour: h, minute: m };
};

type Props = {
  value: ReminderSpec[];
  onChange: (v: ReminderSpec[]) => void;
  /** У дела есть время: доступны «за N минут до начала» */
  timed: boolean;
  /** Для точного времени срабатывания; нет — показываем только правило */
  date?: string | null;
  time?: string | null;
};

export const ReminderEditor = ({ value, onChange, timed, date, time }: Props) => {
  const { c } = useTheme();
  const [editing, setEditing] = useState<ReminderSpec | null>(null);
  const [custom, setCustom] = useState<Custom | null>(null);
  const list = useMemo(() => sortSpecs(value), [value]);
  const full = list.length >= MAX;

  const add = useCallback(
    (spec: ReminderSpec) => {
      onChange(sortSpecs([...list.filter((x) => x !== spec), spec]).slice(0, MAX));
      setCustom(null);
    },
    [list, onChange],
  );

  const chips = useMemo<ChipItem<string>[]>(() => {
    const presets = (timed ? PRESETS_TIMED : PRESETS_ALLDAY).map(
      (p): ChipItem<string> => ({ key: p, label: remindLabel(p), state: chipState(false, full || list.includes(p)) }),
    );
    const before: ChipItem<string> = { key: CUSTOM_BEFORE, label: 'СВОЁ: ЗА … ДО НАЧАЛА', state: chipState(custom === 'before', full) };
    const own: ChipItem<string>[] = [
      ...(timed ? [before] : []),
      { key: CUSTOM_DAYS, label: 'СВОЁ: ЗА … ДНЕЙ', state: chipState(custom === 'days', full) },
    ];
    return [...presets, ...own];
  }, [timed, list, full, custom]);

  const pressChip = useCallback(
    (key: string) => {
      if (key === CUSTOM_BEFORE) return setCustom((v) => (v === 'before' ? null : 'before'));
      if (key === CUSTOM_DAYS) return setCustom((v) => (v === 'days' ? null : 'days'));
      add(key);
    },
    [add],
  );

  return (
    <View style={styles.wrap}>
      <View style={[styles.box, { borderColor: c.border }]}>
        {list.length === 0 ? (
          <View style={[styles.row, { backgroundColor: c.panel }]}>
            <Text style={[T.fieldValue, { color: c.muted }]}>БЕЗ НАПОМИНАНИЙ</Text>
          </View>
        ) : null}
        {list.map((s, i) => {
          const p = parse(s);
          const at = date ? moment(s, date, time ?? null) : null;
          const late = !!(at && time && date) && at.getTime() > eventStart(date, time).getTime();
          const na = p?.kind === 'm' && !timed;
          const clock = p && p.kind !== 'm' ? p.at : null;
          return (
            <View key={s} style={i > 0 ? [styles.divided, { borderTopColor: c.hair }] : undefined}>
              <View style={[styles.row, { backgroundColor: c.panel }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={specLabel(s)}
                  disabled={!clock}
                  onPress={() => setEditing(editing === s ? null : s)}
                  style={styles.text}
                >
                  <Marquee style={[ET.reminderRule, { color: na ? c.muted : c.text }]}>{specLabel(s)}</Marquee>
                  {at ? (
                    <Marquee style={[ET.reminderWhen, { color: late ? c.red : c.muted }]}>{momentText(at).toLocaleUpperCase('ru-RU')}</Marquee>
                  ) : null}
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Убрать: ${specLabel(s)}`}
                  hitSlop={8}
                  onPress={() => onChange(list.filter((x) => x !== s))}
                  style={styles.remove}
                >
                  <Icon name="close" size={12} color={c.muted} />
                </Pressable>
              </View>
              {editing === s && clock ? (
                <View style={[styles.panel, { backgroundColor: c.bg, borderTopColor: c.hair }]}>
                  <TimeWheel
                    {...valueOf(clock)}
                    onChange={(v) => {
                      const next = withTime(s, timeText(v));
                      onChange(sortSpecs(list.map((x) => (x === s ? next : x))));
                      setEditing(next);
                    }}
                  />
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
      <PanelLabel text="ДОБАВИТЬ" />
      <ChipGrid items={chips} columns={3} weight="medium" onPress={pressChip} />
      {custom === 'before' ? <CustomBefore onAdd={add} onCancel={() => setCustom(null)} /> : null}
      {custom === 'days' ? <CustomDays onAdd={add} onCancel={() => setCustom(null)} /> : null}
    </View>
  );
};

/** Что получится: «ЗА 1 Ч 30 МИН» */
const Value = ({ text }: { text: string }) => {
  const { c } = useTheme();
  return (
    <View style={[styles.value, { borderColor: c.border, backgroundColor: c.panel }]}>
      <Marquee style={[T.fieldValue, { color: c.text }]}>{text}</Marquee>
    </View>
  );
};

type CustomProps = { onAdd: (spec: ReminderSpec) => void; onCancel: () => void };

/** «За 1 ч 30 мин до начала»: часы и минуты колесом */
const CustomBefore = ({ onAdd, onCancel }: CustomProps) => {
  const [v, setV] = useState<TimeValue>({ hour: 1, minute: 30 });
  const min = v.hour * 60 + v.minute;
  return (
    <View style={styles.custom}>
      <Value text={remindLabel(specM(min))} />
      <TimeWheel hour={v.hour} minute={v.minute} onChange={setV} />
      <SheetButtons
        buttons={[
          { key: 'cancel', label: 'ОТМЕНА', onPress: onCancel },
          { key: 'add', label: 'ДОБАВИТЬ', tone: 'primary', disabled: min === 0, onPress: () => onAdd(specM(min)) },
        ]}
      />
    </View>
  );
};

/** «За 5 дней в 20:00»: дни и время */
const CustomDays = ({ onAdd, onCancel }: CustomProps) => {
  const [days, setDays] = useState(5);
  const [at, setAt] = useState<TimeValue>({ hour: 20, minute: 0 });
  const spec = specD(days, timeText(at));
  return (
    <View style={styles.custom}>
      <Value text={remindLabel(spec)} />
      <View style={styles.days}>
        <Stepper
          value={days}
          onDecrement={days > 0 ? () => setDays(days - 1) : undefined}
          onIncrement={days < MAX_DAYS ? () => setDays(days + 1) : undefined}
        />
        <View style={styles.flex}>
          <TimeWheel hour={at.hour} minute={at.minute} onChange={setAt} />
        </View>
      </View>
      <SheetButtons
        buttons={[
          { key: 'cancel', label: 'ОТМЕНА', onPress: onCancel },
          { key: 'add', label: 'ДОБАВИТЬ', tone: 'primary', onPress: () => onAdd(spec) },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  box: { borderWidth: S.border },
  row: { minHeight: S.row, flexDirection: 'row', alignItems: 'center', paddingLeft: 10 },
  divided: { borderTopWidth: S.hairline },
  text: { flex: 1, minWidth: 0, gap: 2, paddingVertical: 6 },
  remove: { width: 36, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  panel: { borderTopWidth: S.hairline, paddingVertical: 10, paddingHorizontal: 8 },
  custom: { gap: 8 },
  value: { height: 36, borderWidth: S.border, paddingHorizontal: 10, justifyContent: 'center' },
  days: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1, minWidth: 0 },
});
