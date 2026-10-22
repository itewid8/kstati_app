import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ID, PersonColor } from '@/lib/types';
import { Marquee, SectionBox, fonts, size as S, useTheme } from '@/ui';
import { PersonStrip } from './PersonStrip';

export type AgendaItem = {
  id: ID;
  /** «09:30», «ВЕСЬ» */
  time: string;
  title: string;
  /** «САНЯ, КАРИНА» */
  who: string;
  /** Цвета участников — полоса слева */
  colors: readonly PersonColor[];
  done?: boolean;
  /** Многодневное / на весь день — строка ниже (22) */
  multiDay?: boolean;
};

export type AgendaDay = {
  key: string;
  /** «ПН 05 · СЕГОДНЯ» */
  label: string;
  /** Справа: многодневное «КОМАНДИРОВКА → ПТ» */
  note?: string;
  today?: boolean;
  items: readonly AgendaItem[];
};

type Props = {
  /** Шапка: «05—11 ОКТ · МЫ С КАРИНОЙ» */
  title: string;
  /** «16 ДЕЛ» */
  count?: string;
  days: readonly AgendaDay[];
};

const AgendaRow = memo(function AgendaRow({ item }: { item: AgendaItem }) {
  const { c } = useTheme();
  const ink = item.done ? c.muted : c.text;
  return (
    <View style={[styles.row, item.multiDay && styles.rowMulti, { borderTopColor: c.hair }]}>
      <PersonStrip colors={item.colors} />
      <Text style={[styles.time, { color: ink }]}>{item.time}</Text>
      <Marquee style={[styles.title, { color: ink }, item.done && styles.struck]}>
        {item.title}
      </Marquee>
      <Text style={[styles.who, { color: c.muted }]}>{item.who}</Text>
    </View>
  );
});

/** Ответ списком: дела по дням в рамке с инвертированной шапкой */
export const AgendaList = memo(function AgendaList({ title, count, days }: Props) {
  const { c } = useTheme();
  return (
    <SectionBox title={title} count={count} style={{ backgroundColor: c.panel }}>
      {days.map((day) => (
        <View key={day.key}>
          <View style={[styles.day, { borderTopColor: c.hair, backgroundColor: c.bg }]}>
            <Text style={[styles.dayLabel, { color: day.today ? c.red : c.text }]}>{day.label}</Text>
            {day.note ? <Text style={[styles.dayNote, { color: c.muted }]}>{day.note}</Text> : null}
          </View>
          {day.items.map((item) => (
            <AgendaRow key={item.id} item={item} />
          ))}
        </View>
      ))}
    </SectionBox>
  );
});

const styles = StyleSheet.create({
  /** 18 + разделитель 1 */
  day: {
    height: 19,
    borderTopWidth: S.hairline,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayLabel: { fontFamily: fonts.mono600, fontSize: 8.5, letterSpacing: 0.68 },
  dayNote: { fontFamily: fonts.mono400, fontSize: 8.5, letterSpacing: 0.68 },
  /** 26 + разделитель 1 */
  row: {
    height: 27,
    borderTopWidth: S.hairline,
    paddingLeft: 10,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowMulti: { height: 23 },
  time: { width: 34, flexShrink: 0, fontFamily: fonts.mono600, fontSize: 10 },
  title: { flex: 1, minWidth: 0, fontFamily: fonts.sans500, fontSize: 12 },
  struck: { textDecorationLine: 'line-through' },
  who: { fontFamily: fonts.mono400, fontSize: 8.5, letterSpacing: 0.34 },
});
