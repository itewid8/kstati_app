/**
 * Сетка времени, как в Outlook: часы сверху вниз, колонки — дни (неделя, план поездки) или люди (день по людям).
 * Дела со временем — блоки по своей длительности (без конца — 30 минут), пересекающиеся встают рядом.
 * Дела на весь день и многодневные без времени — полоской над сеткой.
 * Мои дела — сплошные, чужие — светлее, общие (со мной и другими) — светлые с рамкой; на блоке — инициалы.
 * Нажатие на пустое место — новое дело на это время.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type RefreshControlProps } from 'react-native';
import { toISODate } from '@/lib/dates';
import { fromMin, minutesOn, peopleOf, timeOn } from '@/lib/span';
import { useStore } from '@/lib/store';
import type { Task } from '@/lib/types';
import { font, useColors } from '@/theme';
import { T } from './ui';

export const HOUR_H = 44;
const LABEL_W = 38;

export type GridColumn = {
  key: string;
  /** День колонки (для дня по людям — у всех один) */
  day: string;
  header: React.ReactNode;
  onHeader?: () => void;
  /** Дела колонки: и со временем, и на весь день */
  tasks: Task[];
};

type Placed = { task: Task; start: number; end: number; lane: number; lanes: number };

/** Раскладка пересекающихся блоков по дорожкам: кластер пересечений делит ширину поровну */
function layout(tasks: Task[], day: string): { timed: Placed[]; allDay: Task[] } {
  const timed: Omit<Placed, 'lane' | 'lanes'>[] = [];
  const allDay: Task[] = [];
  for (const t of tasks) {
    const m = minutesOn(t, day);
    if (m) timed.push({ task: t, start: m[0], end: Math.max(m[1], m[0] + 20) });
    else allDay.push(t);
  }
  timed.sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Placed[] = [];
  let cluster: Placed[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((p) => p.lane + 1));
    cluster.forEach((p) => (p.lanes = lanes));
    out.push(...cluster);
    cluster = [];
  };
  for (const x of timed) {
    if (x.start >= clusterEnd && cluster.length) flush();
    const used = new Set(cluster.filter((p) => p.end > x.start).map((p) => p.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    cluster.push({ ...x, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, x.end);
  }
  if (cluster.length) flush();
  return { timed: out, allDay };
}

export function TimeGrid({
  columns,
  fromHour = 0,
  toHour = 24,
  scrollToHour = 8,
  minColumnWidth,
  onSlot,
  onTask,
  refreshControl,
}: {
  columns: GridColumn[];
  fromHour?: number;
  toHour?: number;
  scrollToHour?: number;
  /** Колонки уже этого — сетка листается вбок (длинный план) */
  minColumnWidth?: number;
  onSlot?: (col: GridColumn, minutes: number) => void;
  onTask: (t: Task) => void;
  refreshControl?: React.ReactElement<RefreshControlProps>;
}) {
  const c = useColors();
  const meId = useStore((s) => s.me?.id ?? '');
  const users = useStore((s) => s.users);
  const [width, setWidth] = useState(0);
  const scroll = useRef<ScrollView>(null);
  const hours = toHour - fromHour;
  const height = hours * HOUR_H;
  const today = toISODate(new Date());
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  // Открываем на 8 утра — ночь выше, листается вверх. Сетка появляется после замера ширины — ждём её
  useEffect(() => {
    if (!width) return;
    const y = Math.max(0, (scrollToHour - fromHour) * HOUR_H);
    const t = setTimeout(() => scroll.current?.scrollTo({ y, animated: false }), 0);
    return () => clearTimeout(t);
  }, [fromHour, scrollToHour, width > 0]);

  const fit = width ? (width - LABEL_W) / Math.max(1, columns.length) : 0;
  const colW = minColumnWidth && fit < minColumnWidth ? minColumnWidth : fit;
  const wide = colW * columns.length + LABEL_W > width + 1;
  const laid = useMemo(() => columns.map((col) => layout(col.tasks, col.day)), [columns]);
  const initials = (t: Task) =>
    peopleOf(t)
      .map((id) => users.find((u) => u.id === id)?.name?.[0]?.toUpperCase() ?? '·')
      .join('');
  const tone = (t: Task): 'mine' | 'other' | 'shared' => {
    const p = peopleOf(t);
    if (!p.includes(meId)) return 'other';
    return p.length > 1 ? 'shared' : 'mine';
  };
  const maxAllDay = Math.max(0, ...laid.map((l) => Math.min(l.allDay.length, 3)));

  const body = (
    <View>
      {/* Заголовки колонок */}
      <View style={[styles.row, { borderBottomColor: c.border }]}>
        <View style={{ width: LABEL_W }} />
        {columns.map((col) => (
          <Pressable key={col.key} disabled={!col.onHeader} onPress={col.onHeader} style={[styles.head, { width: colW }]}>
            {col.header}
          </Pressable>
        ))}
      </View>
      {/* Весь день и многодневные без времени */}
      {maxAllDay > 0 && (
        <View style={[styles.row, { borderBottomColor: c.border, paddingVertical: 3 }]}>
          <View style={{ width: LABEL_W }} />
          {columns.map((col, i) => {
            const list = laid[i].allDay;
            return (
              <View key={col.key} style={{ width: colW, paddingHorizontal: 1, gap: 2 }}>
                {list.slice(0, list.length > 3 ? 2 : 3).map((t) => (
                  <Pressable key={`${t.id}@${t.occ ?? ''}`} onPress={() => onTask(t)} style={[styles.pill, pillStyle(tone(t), c), t.doneAt ? { opacity: 0.45 } : null]}>
                    <T style={[styles.pillText, { color: tone(t) === 'mine' ? c.onPrimary : c.text }]} numberOfLines={1}>
                      {t.title}
                    </T>
                  </Pressable>
                ))}
                {list.length > 3 ? (
                  <Pressable onPress={col.onHeader ?? (() => onTask(list[2]))} hitSlop={4}>
                    <T style={[styles.pillText, { color: c.textMuted, paddingHorizontal: 4 }]}>+{list.length - 2}</T>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );

  const grid = (
    <View style={{ flexDirection: 'row', height }}>
      {/* Часы */}
      <View style={{ width: LABEL_W }}>
        {Array.from({ length: hours }, (_, i) => (
          <T key={i} style={[styles.hour, { top: i * HOUR_H - 7, color: c.textMuted }]}>
            {i === 0 ? '' : `${String(fromHour + i).padStart(2, '0')}:00`}
          </T>
        ))}
      </View>
      {columns.map((col, ci) => (
        <Pressable
          key={col.key}
          onPress={(e) => {
            if (!onSlot) return;
            const min = fromHour * 60 + Math.floor(e.nativeEvent.locationY / HOUR_H * 2) * 30;
            onSlot(col, Math.min(min, 23 * 60 + 30));
          }}
          style={{ width: colW, height, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: c.border }}
        >
          {Array.from({ length: hours }, (_, i) => (
            <View key={i} pointerEvents="none" style={[styles.line, { top: i * HOUR_H, backgroundColor: c.border }]} />
          ))}
          {laid[ci].timed.map((p) => {
            const top = ((p.start - fromHour * 60) / 60) * HOUR_H;
            const h = Math.max(18, ((p.end - p.start) / 60) * HOUR_H - 2);
            if (top + h < 0 || top > height) return null;
            const tn = tone(p.task);
            const ink = tn === 'mine' ? c.onPrimary : c.text;
            const w = colW / p.lanes;
            return (
              <Pressable
                key={`${p.task.id}@${p.task.occ ?? ''}`}
                onPress={() => onTask(p.task)}
                style={[
                  styles.block,
                  pillStyle(tn, c),
                  { top: Math.max(0, top) + 1, height: h, left: p.lane * w + 1, width: w - 2 },
                  p.task.doneAt ? { opacity: 0.45 } : null,
                ]}
              >
                <T style={[styles.blockTitle, { color: ink }, p.task.doneAt ? { textDecorationLine: 'line-through' } : null]} numberOfLines={h > 40 ? 2 : 1}>
                  {p.task.title}
                </T>
                {h > 34 && w > 44 ? (
                  <T style={[styles.blockSub, { color: ink }]} numberOfLines={1}>
                    {timeOn(p.task, col.day) || fromMin(p.start)}
                  </T>
                ) : null}
                {h > 50 ? (
                  <T style={[styles.blockSub, { color: ink, opacity: 0.8 }]} numberOfLines={1}>
                    {initials(p.task)}
                  </T>
                ) : null}
              </Pressable>
            );
          })}
          {col.day === today && now.getHours() >= fromHour && now.getHours() < toHour ? (
            <View
              pointerEvents="none"
              style={[styles.now, { top: ((now.getHours() - fromHour) * 60 + now.getMinutes()) / 60 * HOUR_H, backgroundColor: c.event }]}
            />
          ) : null}
        </Pressable>
      ))}
    </View>
  );

  const content = (
    <>
      {body}
      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 8, paddingBottom: 112 }} refreshControl={refreshControl} nestedScrollEnabled>
        {grid}
      </ScrollView>
    </>
  );

  return (
    <View style={{ flex: 1 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 &&
        (wide ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'column' }}>
            <View style={{ width: LABEL_W + colW * columns.length, flex: 1 }}>{content}</View>
          </ScrollView>
        ) : (
          content
        ))}
    </View>
  );
}

function pillStyle(tone: 'mine' | 'other' | 'shared', c: ReturnType<typeof useColors>) {
  if (tone === 'mine') return { backgroundColor: c.primary };
  if (tone === 'shared') return { backgroundColor: c.border, borderWidth: 1.5, borderColor: c.text };
  return { backgroundColor: c.border };
}

/** Заголовок колонки дня: «пн» и число, сегодня — выделено */
export function DayHeader({ date, label }: { date: Date; label: string }) {
  const c = useColors();
  const isToday = toISODate(date) === toISODate(new Date());
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <T variant="label" muted>
        {label}
      </T>
      <View style={[styles.num, isToday ? { backgroundColor: c.event } : null]}>
        <T variant="caption" weight={isToday ? 'semibold' : 'regular'} color={isToday ? c.onEvent : c.text}>
          {date.getDate()}
        </T>
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  row: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  head: { paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  hour: { position: 'absolute', right: 6, fontFamily: font.mono, fontSize: 10, lineHeight: 14 },
  line: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth },
  block: { position: 'absolute', borderRadius: 5, paddingHorizontal: 4, paddingVertical: 2, overflow: 'hidden' },
  blockTitle: { fontFamily: font.medium, fontSize: 11, lineHeight: 14 },
  blockSub: { fontFamily: font.mono, fontSize: 9, lineHeight: 12 },
  pill: { borderRadius: 4, paddingHorizontal: 4, height: 18, justifyContent: 'center' },
  pillText: { fontFamily: font.medium, fontSize: 10, lineHeight: 13 },
  now: { position: 'absolute', left: 0, right: 0, height: 2 },
  num: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});
