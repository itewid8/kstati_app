import { ChevronLeft, ChevronRight } from '@/components/icons';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View, type RefreshControlProps } from 'react-native';
// Прокрутка из gesture-handler: щипок слоёв может её перехватить
import { ScrollView } from 'react-native-gesture-handler';
import { tint, usePalette } from '@/lib/colors';
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
  WEEKDAYS_SHORT,
  weekTitle,
} from '@/lib/dates';
import { daysOf, fromMin, minutesOn, peopleOf } from '@/lib/span';
import { useStore } from '@/lib/store';
import type { ID, Task } from '@/lib/types';
import { font, ICON, space, useColors } from '@/theme';
import { uid } from '@/lib/ids';
import { CalendarLayers } from './CalendarLayers';
import { DayHeader, TimeGrid, type GridColumn } from './TimeGrid';
import { editTask, openPlan, TaskRow, taskMenu } from './TaskRow';
import { Button, Divider, T } from './ui';

export type Zoom = 'day' | 'week' | 'month' | 'year';
const MONTH_SHORT = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const isPast = (t: Task) => sectionFor(t.date, t.time) === 'past';
const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

/** Сдвиг выбранной даты на один период; число месяца сохраняется, если оно есть в новом месяце */
function shift(iso: string, zoom: Zoom, dir: 1 | -1): string {
  const d = fromISODate(iso);
  if (zoom === 'day') return toISODate(addDays(d, dir));
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
    // Многодневное дело — в каждом своём дне
    for (const t of tasks) for (const d of daysOf(t)) m.set(d, [...(m.get(d) ?? []), t]);
    m.forEach((list) => list.sort((a, b) => sortKey(a.date, a.time).localeCompare(sortKey(b.date, b.time))));
    return m;
  }, [tasks]);
}

/**
 * Календарь дел: день, неделя, месяц, год — и слои людей поверх любого из них.
 *   Неделя — семь колонок, раскрыт выбранный день, остальные свёрнуты в полоски; нажатие на свёрнутый — раскрыть,
 *   на заголовок раскрытого — открыть день целиком.
 *   Слои (CalendarLayers): общий лист или лист каждого человека; щипок склеивает и раскладывает.
 *   Свайп влево/вправо — соседний период.
 */
export function CalendarView({
  tasks,
  zoom,
  onZoom,
  selected,
  onSelect,
  onPinching,
  members = [],
  refreshControl,
}: {
  tasks: Task[];
  /** Обновление потягиванием — для общего листа */
  refreshControl?: React.ReactElement<RefreshControlProps>;
  /** Участники группы — у каждого свой лист */
  members?: ID[];
  zoom: Zoom;
  onZoom: (z: Zoom) => void;
  selected: string;
  onSelect: (iso: string) => void;
  onPinching?: (v: boolean) => void;
}) {
  const meId = useStore((s) => s.me?.id);
  const today = toISODate(new Date());
  const sel = fromISODate(selected);
  // Листы: я — первым, дальше по порядку вступления
  const key = members.join(',');
  const people = useMemo(
    () => (meId && members.includes(meId) ? [meId, ...members.filter((id) => id !== meId)] : members),
    [key, meId], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const perPerson = useMemo(() => new Map(people.map((id) => [id, tasks.filter((t) => peopleOf(t).includes(id))])), [tasks, people]);

  const go = (dir: 1 | -1) => onSelect(shift(selected, zoom, dir));
  const title =
    zoom === 'day'
      ? cap(shortDate(selected))
      : zoom === 'week'
        ? weekTitle(startOfWeek(sel))
        : zoom === 'month'
          ? monthTitle(sel)
          : String(sel.getFullYear());

  return (
    <View style={{ flex: 1 }}>
      <NavRow title={title} onPrev={() => go(-1)} onNext={() => go(1)} onToday={() => onSelect(today)} />
      <CalendarLayers
        members={people.length > 1 ? people : []}
        period={`${zoom}|${selected}`}
        onSwipe={go}
        onPinching={onPinching}
        render={(person, pinching) => (
          <CalendarBody
            tasks={person ? (perPerson.get(person) ?? []) : tasks}
            person={person}
            people={people}
            zoom={zoom}
            onZoom={onZoom}
            selected={selected}
            onSelect={onSelect}
            today={today}
            pinching={pinching}
            refreshControl={person ? undefined : refreshControl}
          />
        )}
      />
    </View>
  );
}

/** Один лист календаря: все дела (person = null) или дела одного человека */
const CalendarBody = React.memo(function CalendarBody({
  tasks,
  person,
  people,
  zoom,
  onZoom,
  selected,
  onSelect,
  today,
  pinching,
  refreshControl,
}: {
  tasks: Task[];
  person: ID | null;
  people: ID[];
  zoom: Zoom;
  onZoom: (z: Zoom) => void;
  selected: string;
  onSelect: (iso: string) => void;
  today: string;
  pinching: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
}) {
  const byDate = useByDate(tasks);
  const sel = fromISODate(selected);
  if (zoom === 'week') {
    return (
      <WeekAccordion byDate={byDate} selected={selected} person={person} onSelect={onSelect} onZoom={onZoom} pinching={pinching} refreshControl={refreshControl} />
    );
  }
  if (zoom === 'day') {
    return (
      <>
        <WeekStrip byDate={byDate} selected={selected} today={today} onSelect={onSelect} />
        <DayGrid byDate={byDate} day={selected} person={person} pinching={pinching} refreshControl={refreshControl} />
      </>
    );
  }
  return (
    <ScrollView scrollEnabled={!pinching} refreshControl={refreshControl} contentContainerStyle={{ paddingBottom: 8 }}>
      {zoom === 'month' ? (
        <>
          <MonthGrid byDate={byDate} selected={selected} today={today} onSelect={onSelect} lanes={person ? [person] : people} />
          <DayTasks byDate={byDate} day={selected} today={today} />
        </>
      ) : (
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
    </ScrollView>
  );
});

/* ---------------- Навигация: ‹ заголовок › · Сегодня ---------------- */

function NavRow({
  title,
  onPrev,
  onNext,
  onToday,
}: {
  title: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const c = useColors();
  const arrow = (dir: 'l' | 'r', fn: () => void) => (
    <Pressable onPress={fn} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }} style={({ pressed }) => [styles.arrow, { opacity: pressed ? 0.5 : 1 }]}>
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
      {/* Заголовок не нажимается: масштаб — переключателем сверху, иначе промах мимо стрелки уводил в месяц */}
      <T weight="medium" style={{ minWidth: 140, textAlign: 'center' }}>
        {title}
      </T>
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

/** Дело в сетке: план — открыть план, обычное — карточка */
const openTask = (t: Task) => (useStore.getState().tasks.some((x) => x.parentId === t.id) ? openPlan(t.id) : editTask(t.id));

/** Новое дело в пустом месте сетки: день и время, для колонки человека — он и занят */
function newAt(day: string, minutes: number, people?: ID[]) {
  useStore.getState().setCard({
    source: 'manual',
    editing: true,
    items: [{ key: uid(), type: 'task', data: { title: '', date: day, time: fromMin(minutes), endTime: fromMin(Math.min(minutes + 60, 23 * 60 + 59)), ...(people && { people }) } }],
  });
}

/**
 * Неделя сеткой: раскрыт выбранный день, остальные шесть — узкие колонки, где дела — полоски своего цвета.
 * Нажатие на узкую колонку раскрывает её, на заголовок раскрытой — день целиком
 */
function WeekAccordion({
  byDate,
  selected,
  person,
  onSelect,
  onZoom,
  pinching,
  refreshControl,
}: {
  byDate: Map<string, Task[]>;
  selected: string;
  person: ID | null;
  onSelect: (iso: string) => void;
  onZoom: (z: Zoom) => void;
  pinching: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
}) {
  const columns = useMemo<GridColumn[]>(() => {
    const start = startOfWeek(fromISODate(selected));
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i);
      const iso = toISODate(d);
      const compact = iso !== selected;
      return {
        key: iso,
        day: iso,
        compact,
        header: <DayHeader date={d} label={WEEKDAYS_SHORT[i]} compact={compact} />,
        onHeader: compact ? undefined : () => onZoom('day'),
        tasks: byDate.get(iso) ?? [],
      };
    });
  }, [byDate, selected, onZoom]);
  return (
    <TimeGrid
      columns={columns}
      scrollEnabled={!pinching}
      onTask={openTask}
      onLongTask={taskMenu}
      onColumn={(col) => onSelect(col.day)}
      onSlot={(col, m) => newAt(col.day, m, person ? [person] : undefined)}
      refreshControl={refreshControl}
    />
  );
}

/** День одной колонкой на всю ширину */
function DayGrid({
  byDate,
  day,
  person,
  pinching,
  refreshControl,
}: {
  byDate: Map<string, Task[]>;
  day: string;
  person: ID | null;
  pinching: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
}) {
  const columns = useMemo<GridColumn[]>(() => [{ key: day, day, header: null, tasks: byDate.get(day) ?? [] }], [byDate, day]);
  return (
    <TimeGrid
      columns={columns}
      scrollEnabled={!pinching}
      headless
      onTask={openTask}
      onLongTask={taskMenu}
      onSlot={(_, m) => newAt(day, m, person ? [person] : undefined)}
      refreshControl={refreshControl}
    />
  );
}

/* ---------------- Месяц ---------------- */

/** Мини-таймлайн клетки месяца: часы 6–24 сверху вниз, у каждого человека своя дорожка */
const TL_FROM = 6 * 60;
const TL_SPAN = 18 * 60;
const TL_TOP = 24;
const TL_H = 34;

function MonthGrid(p: GridProps & { lanes: ID[] }) {
  const all = useStore((s) => s.tasks);
  const planIds = useMemo(() => new Set(all.filter((t) => t.parentId).map((t) => t.parentId!)), [all]);
  const month = startOfMonth(fromISODate(p.selected));
  const days = monthGrid(month);
  const weeks = days[35].getMonth() === month.getMonth() ? 6 : 5;
  return (
    <View style={styles.grid}>
      <WeekdayHeader />
      {Array.from({ length: weeks }, (_, wi) => (
        <View key={wi} style={styles.week}>
          {days.slice(wi * 7, wi * 7 + 7).map((d) => (
            <MonthCell key={d.toISOString()} d={d} inPeriod={d.getMonth() === month.getMonth()} planIds={planIds} {...p} />
          ))}
        </View>
      ))}
    </View>
  );
}

/**
 * Клетка месяца: число и дела штрихами на своём времени — видно, кто когда занят.
 * Дело без времени — штрих сверху; план — лента цвета человека по верху клеток своих дней
 */
function MonthCell({
  d,
  inPeriod,
  byDate,
  selected,
  today,
  onSelect,
  lanes,
  planIds,
}: GridProps & { d: Date; inPeriod: boolean; lanes: ID[]; planIds: Set<ID> }) {
  const c = useColors();
  const pal = usePalette();
  const iso = toISODate(d);
  const isToday = iso === today;
  const isSel = iso === selected;
  const list = inPeriod ? (byDate.get(iso) ?? []) : [];
  const n = Math.max(1, lanes.length);
  const plan = list.find((t) => planIds.has(t.id));
  return (
    <Pressable onPress={() => onSelect(iso)} style={[styles.mCell, { borderColor: c.border }, isSel && { backgroundColor: c.surface }]}>
      {plan ? <View style={[styles.mPlan, { backgroundColor: pal.task(plan)[0] }]} /> : null}
      {plan ? <View style={[StyleSheet.absoluteFill, { backgroundColor: tint(pal.task(plan)[0], pal.bodyAlpha * 0.35) }]} /> : null}
      <View style={[styles.mNum, isToday && { backgroundColor: c.event }]}>
        <T
          style={{
            fontFamily: isToday || isSel ? font.semibold : font.mono,
            fontSize: 11,
            lineHeight: 14,
            color: isToday ? c.onEvent : inPeriod ? c.text : c.textMuted,
            opacity: inPeriod ? 1 : 0.5,
          }}
        >
          {d.getDate()}
        </T>
      </View>
      <View style={styles.mLanes} pointerEvents="none">
        {list.flatMap((t) => {
          if (t === plan) return [];
          const m = minutesOn(t, iso);
          const top = m ? TL_TOP + (Math.max(0, m[0] - TL_FROM) / TL_SPAN) * TL_H : TL_TOP - 4;
          const h = m ? Math.max(3, ((Math.min(m[1], TL_FROM + TL_SPAN) - Math.max(m[0], TL_FROM)) / TL_SPAN) * TL_H) : 2;
          const who = peopleOf(t);
          return lanes
            .map((id, k) => (who.includes(id) ? k : -1))
            .filter((k) => k >= 0)
            .map((k) => (
              <View
                key={`${t.id}@${t.occ ?? ''}-${k}`}
                style={[
                  styles.mBar,
                  {
                    top: Math.min(top, TL_TOP + TL_H - 3),
                    height: h,
                    left: `${(k * 100) / n}%`,
                    width: `${100 / n - (n > 1 ? 6 : 0)}%`,
                    backgroundColor: pal.of(lanes[k]),
                    opacity: t.doneAt ? 0.4 : 1,
                  },
                ]}
              />
            ));
        })}
      </View>
    </Pressable>
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
            <TaskRow task={t} past={isPast(t)} whenFormat="time" day={day} markDelay={0} />
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
  arrow: { width: 44, height: 40, alignItems: 'center', justifyContent: 'center' },
  grid: { paddingHorizontal: space.side - 4 },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', paddingVertical: 6 },
  cell: { flex: 1, height: 46, alignItems: 'center', justifyContent: 'center' },
  ring: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, padding: 2, alignItems: 'center', justifyContent: 'center' },
  num: { width: 31, height: 31, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  mCell: { flex: 1, height: 64, borderTopWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  mPlan: { position: 'absolute', left: 0, right: 0, top: 0, height: 3 },
  mNum: { position: 'absolute', left: 3, top: 3, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center' },
  mLanes: { position: 'absolute', left: 4, right: 4, top: 0, bottom: 0 },
  mBar: { position: 'absolute', borderRadius: 1.5 },
  dayLabel: { paddingHorizontal: space.side, paddingTop: 16, paddingBottom: 4 },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: space.side, paddingVertical: 10 },
  year: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: space.side - 8 },
  mini: { width: '33.333%', paddingHorizontal: 6, paddingVertical: 8, borderRadius: 8 },
  miniWeek: { flexDirection: 'row' },
  miniDay: { flex: 1, height: 16, alignItems: 'center', justifyContent: 'center' },
  miniNum: { width: 15, height: 15, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
