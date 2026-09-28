import * as Haptics from 'expo-haptics';
import { ChevronLeft, ChevronRight } from '@/components/icons';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import {
  addDays,
  fromISODate,
  monthGrid,
  monthTitle,
  sectionFor,
  shortDate,
  sortKey,
  startOfMonth,
  startOfWeek,
  toISODate,
  weekDayShort,
  WEEKDAYS_SHORT,
  weekTitle,
} from '@/lib/dates';
import type { Task } from '@/lib/types';
import { font, ICON, space, useColors } from '@/theme';
import { TaskRow } from './TaskRow';
import { Button, Divider, T } from './ui';

export type Zoom = 'week' | 'month' | 'year';
const ZOOMS: Zoom[] = ['week', 'month', 'year'];
const MONTH_SHORT = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const isPast = (t: Task) => sectionFor(t.date, t.time) === 'past';
const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

/** Сдвиг выбранной даты на один период; число месяца сохраняется, если оно есть в новом месяце */
function shift(iso: string, zoom: Zoom, dir: 1 | -1): string {
  const d = fromISODate(iso);
  if (zoom === 'week') return toISODate(addDays(d, 7 * dir));
  const months = zoom === 'month' ? dir : 12 * dir;
  const y = d.getFullYear();
  const m = d.getMonth() + months;
  const target = new Date(y, m, 1);
  target.setDate(Math.min(d.getDate(), daysIn(target.getFullYear(), target.getMonth())));
  return toISODate(target);
}

function useByDate(tasks: Task[]) {
  return useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.date) continue;
      m.set(t.date, [...(m.get(t.date) ?? []), t]);
    }
    m.forEach((list) => list.sort((a, b) => sortKey(a.date, a.time).localeCompare(sortKey(b.date, b.time))));
    return m;
  }, [tasks]);
}

/**
 * Календарь дел с тремя масштабами.
 *   Свайп влево/вправо по сетке — следующий/предыдущий период.
 *   Щипок двумя пальцами в любом месте календаря: свести — крупнее период (неделя → месяц → год), развести — мельче.
 *   Пока на экране два пальца, прокрутка и свайп не срабатывают (onPinching сообщает об этом экрану).
 *   Тап по заголовку — на масштаб крупнее, тап по месяцу в годовом виде — открыть месяц.
 */
export function CalendarView({
  tasks,
  zoom,
  onZoom,
  selected,
  onSelect,
  onPinching,
}: {
  tasks: Task[];
  zoom: Zoom;
  onZoom: (z: Zoom) => void;
  selected: string;
  onSelect: (iso: string) => void;
  onPinching?: (v: boolean) => void;
}) {
  const { width } = useWindowDimensions();
  const byDate = useByDate(tasks);
  const today = toISODate(new Date());
  const sel = fromISODate(selected);

  const tx = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  /** В этом касании был второй палец — свайп игнорируем */
  const twoFingers = useSharedValue(false);
  /** Масштаб уже переключён в этом щипке — второй раз не переключаем */
  const fired = useSharedValue(false);

  const go = (dir: 1 | -1) => onSelect(shift(selected, zoom, dir));
  const zoomBy = (step: 1 | -1) => {
    const next = ZOOMS[ZOOMS.indexOf(zoom) + step];
    if (!next) return;
    Haptics.selectionAsync().catch(() => {});
    onZoom(next);
  };
  const setPinching = (v: boolean) => onPinching?.(v);

  const slide = Gesture.Pan()
    .maxPointers(1)
    .activeOffsetX([-20, 20])
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      if (twoFingers.value) return;
      tx.value = e.translationX * 0.5;
    })
    .onEnd((e) => {
      const dx = e.translationX;
      if (twoFingers.value || (Math.abs(dx) < 70 && Math.abs(e.velocityX) < 600)) {
        tx.value = withTiming(0, { duration: 150 });
        return;
      }
      const dir = dx < 0 ? 1 : -1;
      const off = width * 0.35;
      opacity.value = withTiming(0, { duration: 120 });
      tx.value = withTiming(-dir * off, { duration: 120 }, () => {
        runOnJS(go)(dir as 1 | -1);
        tx.value = dir * off;
        tx.value = withTiming(0, { duration: 160 });
        opacity.value = withTiming(1, { duration: 160 });
      });
    });

  // Масштаб переключается сразу, как только пальцы свели/развели на ~12%, а не по отпусканию
  const pinch = Gesture.Pinch()
    .onBegin(() => {
      twoFingers.value = false;
      fired.value = false;
    })
    .onTouchesDown((e) => {
      if (e.numberOfTouches >= 2 && !twoFingers.value) {
        twoFingers.value = true;
        tx.value = withTiming(0, { duration: 100 });
        runOnJS(setPinching)(true);
      }
    })
    .onUpdate((e) => {
      scale.value = Math.max(0.92, Math.min(1.08, 1 + (e.scale - 1) * 0.5));
      if (fired.value) return;
      if (e.scale < 0.88) {
        fired.value = true;
        runOnJS(zoomBy)(1);
      } else if (e.scale > 1.14) {
        fired.value = true;
        runOnJS(zoomBy)(-1);
      }
    })
    .onFinalize(() => {
      scale.value = withTiming(1, { duration: 150 });
      if (twoFingers.value) runOnJS(setPinching)(false);
    });

  const slideWithPinch = slide.simultaneousWithExternalGesture(pinch);
  const anim = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateX: tx.value }, { scale: scale.value }] }));

  const title =
    zoom === 'week' ? weekTitle(startOfWeek(sel)) : zoom === 'month' ? monthTitle(sel) : String(sel.getFullYear());

  return (
    <GestureDetector gesture={pinch}>
      <View collapsable={false}>
        <NavRow
          title={title}
          onTitle={zoom === 'year' ? undefined : () => zoomBy(1)}
          onPrev={() => go(-1)}
          onNext={() => go(1)}
          onToday={() => onSelect(today)}
        />
        <GestureDetector gesture={slideWithPinch}>
          <Animated.View style={[{ paddingBottom: 8 }, anim]}>
            {zoom === 'week' && <WeekStrip byDate={byDate} selected={selected} today={today} onSelect={onSelect} />}
            {zoom === 'month' && <MonthGrid byDate={byDate} selected={selected} today={today} onSelect={onSelect} />}
            {zoom === 'year' && (
              <YearGrid
                byDate={byDate}
                year={sel.getFullYear()}
                today={today}
                onPickMonth={(m) => {
                  const now = new Date();
                  const day = now.getFullYear() === sel.getFullYear() && now.getMonth() === m ? now.getDate() : 1;
                  onSelect(toISODate(new Date(sel.getFullYear(), m, day)));
                  onZoom('month');
                }}
              />
            )}
          </Animated.View>
        </GestureDetector>

        {zoom === 'month' && <DayTasks byDate={byDate} day={selected} today={today} />}
        {zoom === 'week' && <WeekAgenda byDate={byDate} selected={selected} today={today} onSelect={onSelect} />}
      </View>
    </GestureDetector>
  );
}

/* ---------------- Навигация: ‹ заголовок › · Сегодня ---------------- */

function NavRow({
  title,
  onTitle,
  onPrev,
  onNext,
  onToday,
}: {
  title: string;
  onTitle?: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const c = useColors();
  const arrow = (dir: 'l' | 'r', fn: () => void) => (
    <Pressable onPress={fn} hitSlop={10} style={({ pressed }) => [styles.arrow, { opacity: pressed ? 0.5 : 1 }]}>
      {dir === 'l' ? (
        <ChevronLeft size={ICON.size} strokeWidth={ICON.stroke} color={c.text} />
      ) : (
        <ChevronRight size={ICON.size} strokeWidth={ICON.stroke} color={c.text} />
      )}
    </Pressable>
  );
  return (
    <View style={styles.nav}>
      {arrow('l', onPrev)}
      <Pressable onPress={onTitle} disabled={!onTitle} hitSlop={6} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
        <T weight="medium" style={{ minWidth: 150, textAlign: 'center' }}>
          {title}
        </T>
      </Pressable>
      {arrow('r', onNext)}
      <View style={{ flex: 1 }} />
      <Button kind="text" title="Сегодня" color={c.textMuted} onPress={onToday} style={{ height: 32 }} />
    </View>
  );
}

type GridProps = { byDate: Map<string, Task[]>; selected: string; today: string; onSelect: (iso: string) => void };

/** Как отмечен день: есть невыполненные дела — красный круг, только выполненные — серый */
function dayMark(list: Task[]): 'open' | 'done' | null {
  if (!list.length) return null;
  return list.some((t) => !t.doneAt) ? 'open' : 'done';
}

function DayCell({ d, inPeriod, byDate, selected, today, onSelect }: GridProps & { d: Date; inPeriod: boolean }) {
  const c = useColors();
  const iso = toISODate(d);
  const isToday = iso === today;
  const isSel = iso === selected;
  const mark = dayMark(byDate.get(iso) ?? []);
  // Кольцо вокруг круга: сегодня — яркое, выбранный день — приглушённое
  const ring = isToday ? c.text : isSel ? c.textMuted : 'transparent';
  const fill = mark === 'open' ? c.event : mark === 'done' ? c.border : 'transparent';
  const color = mark === 'open' ? c.onEvent : inPeriod ? c.text : c.textMuted;
  return (
    <Pressable onPress={() => onSelect(iso)} style={styles.cell}>
      <View style={[styles.ring, { borderColor: ring, opacity: inPeriod ? 1 : 0.45 }]}>
        {/* key: при смене отметки круг пересоздаётся — иначе Android иногда теряет скругление и рисует квадрат */}
        <View key={mark ?? 'none'} style={[styles.num, { backgroundColor: fill }]}>
          <T variant="caption" mono={!mark && !isToday} weight={mark || isToday ? 'semibold' : 'regular'} color={color}>
            {d.getDate()}
          </T>
        </View>
      </View>
    </Pressable>
  );
}

function WeekdayHeader() {
  return (
    <View style={styles.week}>
      {WEEKDAYS_SHORT.map((w) => (
        <T key={w} variant="label" muted style={styles.weekday}>
          {w}
        </T>
      ))}
    </View>
  );
}

/* ---------------- Неделя: полоска из 7 дней ---------------- */

function WeekStrip(p: GridProps) {
  const start = startOfWeek(fromISODate(p.selected));
  return (
    <View style={styles.grid}>
      <WeekdayHeader />
      <View style={styles.week}>
        {Array.from({ length: 7 }, (_, i) => addDays(start, i)).map((d) => (
          <DayCell key={d.toISOString()} d={d} inPeriod {...p} />
        ))}
      </View>
    </View>
  );
}

/** Под полоской — дела всей недели по дням */
function WeekAgenda({ byDate, selected, today, onSelect }: GridProps) {
  const start = startOfWeek(fromISODate(selected));
  return (
    <View>
      {Array.from({ length: 7 }, (_, i) => addDays(start, i)).map((d) => {
        const iso = toISODate(d);
        const list = byDate.get(iso) ?? [];
        const isSel = iso === selected;
        return (
          <View key={iso}>
            <Divider />
            <Pressable onPress={() => onSelect(iso)} style={styles.dayHead}>
              <T variant="caption" weight={isSel ? 'medium' : 'regular'} muted={!isSel}>
                {cap(weekDayShort(d))}, {shortDate(iso).split(' ').slice(1).join(' ')}
                {iso === today ? ' · сегодня' : ''}
              </T>
              <View style={{ flex: 1 }} />
              {list.length === 0 && (
                <T variant="caption" muted>
                  —
                </T>
              )}
            </Pressable>
            {list.map((t) => (
              <TaskRow key={t.id} task={t} past={isPast(t)} whenFormat="time" markDelay={0} />
            ))}
          </View>
        );
      })}
      <Divider />
    </View>
  );
}

/* ---------------- Месяц ---------------- */

function MonthGrid(p: GridProps) {
  const month = startOfMonth(fromISODate(p.selected));
  const days = monthGrid(month);
  const weeks = days[35].getMonth() === month.getMonth() ? 6 : 5;
  return (
    <View style={styles.grid}>
      <WeekdayHeader />
      {Array.from({ length: weeks }, (_, wi) => (
        <View key={wi} style={styles.week}>
          {days.slice(wi * 7, wi * 7 + 7).map((d) => (
            <DayCell key={d.toISOString()} d={d} inPeriod={d.getMonth() === month.getMonth()} {...p} />
          ))}
        </View>
      ))}
    </View>
  );
}

function DayTasks({ byDate, day, today }: { byDate: Map<string, Task[]>; day: string; today: string }) {
  const list = byDate.get(day) ?? [];
  return (
    <View>
      <Divider />
      <T variant="caption" muted style={styles.dayLabel}>
        {cap(shortDate(day))}
        {day === today ? ' · сегодня' : ''}
      </T>
      {list.length === 0 ? (
        <T muted style={{ paddingHorizontal: space.side, paddingVertical: 12 }}>
          Нет дел
        </T>
      ) : (
        list.map((t, i) => (
          <View key={t.id}>
            {i > 0 && <Divider inset={space.side + 36} />}
            <TaskRow task={t} past={isPast(t)} whenFormat="time" markDelay={0} />
          </View>
        ))
      )}
    </View>
  );
}

/* ---------------- Год: 12 мини-месяцев ---------------- */

function YearGrid({
  byDate,
  year,
  today,
  onPickMonth,
}: {
  byDate: Map<string, Task[]>;
  year: number;
  today: string;
  onPickMonth: (m: number) => void;
}) {
  return (
    <View style={styles.year}>
      {Array.from({ length: 12 }, (_, m) => (
        <MiniMonth key={m} year={year} month={m} byDate={byDate} today={today} onPress={() => onPickMonth(m)} />
      ))}
    </View>
  );
}

function MiniMonth({
  year,
  month,
  byDate,
  today,
  onPress,
}: {
  year: number;
  month: number;
  byDate: Map<string, Task[]>;
  today: string;
  onPress: () => void;
}) {
  const c = useColors();
  const first = new Date(year, month, 1);
  const days = monthGrid(first);
  const weeks = days[35].getMonth() === month ? 6 : 5;
  const isCurrent = today.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.mini, { backgroundColor: pressed ? c.surface : 'transparent' }]}>
      <T variant="caption" weight={isCurrent ? 'semibold' : 'medium'} style={{ marginBottom: 4 }}>
        {MONTH_SHORT[month]}
      </T>
      {Array.from({ length: weeks }, (_, wi) => (
        <View key={wi} style={styles.miniWeek}>
          {days.slice(wi * 7, wi * 7 + 7).map((d) => {
            if (d.getMonth() !== month) return <View key={d.toISOString()} style={styles.miniDay} />;
            const iso = toISODate(d);
            const mark = dayMark(byDate.get(iso) ?? []);
            const isToday = iso === today;
            return (
              <View key={iso} style={styles.miniDay}>
                <View
                  key={`${mark ?? 'none'}-${isToday}`}
                  style={[
                    styles.miniNum,
                    mark === 'open' && { backgroundColor: c.event },
                    mark === 'done' && { backgroundColor: c.border },
                    isToday && { borderWidth: 1, borderColor: c.text },
                  ]}
                >
                  <T
                    style={{
                      fontFamily: mark || isToday ? font.semibold : font.mono,
                      fontSize: 9,
                      lineHeight: 12,
                      color: mark === 'open' ? c.onEvent : mark || isToday ? c.text : c.textMuted,
                    }}
                  >
                    {d.getDate()}
                  </T>
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.side - 6,
    paddingBottom: 4,
  },
  arrow: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  grid: { paddingHorizontal: space.side - 4 },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', paddingVertical: 6 },
  cell: { flex: 1, height: 46, alignItems: 'center', justifyContent: 'center' },
  ring: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, padding: 2, alignItems: 'center', justifyContent: 'center' },
  num: { width: 31, height: 31, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dayLabel: { paddingHorizontal: space.side, paddingTop: 16, paddingBottom: 4 },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: space.side, paddingVertical: 10 },
  year: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: space.side - 8 },
  mini: { width: '33.333%', paddingHorizontal: 6, paddingVertical: 8, borderRadius: 8 },
  miniWeek: { flexDirection: 'row' },
  miniDay: { flex: 1, height: 16, alignItems: 'center', justifyContent: 'center' },
  miniNum: { width: 15, height: 15, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
