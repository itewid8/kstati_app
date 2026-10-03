/**
 * Сетка времени, как в Outlook: часы сверху вниз, колонки — дни (неделя, план) или один день.
 * Вся сетка помещается на экран: часы — от 7 до 22 (шире, если дела раньше или позже), высота часа — по месту.
 *   Дело — ярлык цвета своего человека: цветной кончик слева и полупрозрачное тело с описанием
 *   (название, от и до, чьё, описание — сколько влезет). У общего дела — цвета всех его людей.
 *   Узкая колонка (свёрнутый день недели): ярлыки сужаются в цветные полоски на своём времени.
 *   Ширина колонок меняется плавно: раскрытый день растёт, остальные сжимаются.
 *   Дела без времени и многодневные без времени — полосами над сеткой. План — там же полосой с названием
 *   и «от – до», а в сетке — подложкой своего цвета на своё время (начало и конец отчёркнуты), подзадачи — внутри.
 * Нажатие на пустое место раскрытой колонки — новое дело на это время, на узкую — раскрыть её;
 * долгое нажатие на дело — его меню.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, type RefreshControlProps } from 'react-native';
// Прокрутка из gesture-handler: щипок слоёв календаря может её перехватить
import { ScrollView } from 'react-native-gesture-handler';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { tint, usePalette } from '@/lib/colors';
import { toISODate } from '@/lib/dates';
import { isMulti, minutesOn, peopleOf, spanLabel, spanParts } from '@/lib/span';
import { useStore } from '@/lib/store';
import type { Task } from '@/lib/types';
import { font, useColors } from '@/theme';
import { T } from './ui';

const LABEL_W = 34;
/** Меньше этого час не сжимаем — иначе сетка листается */
const MIN_HOUR_H = 16;
const HEAD_H = 48;
const BAR_H = 18;
const MAX_ROWS = 3;
/** Свёрнутая колонка: в ней только цветные полоски */
export const COMPACT_W = 22;
const STRIP_W = 5;
const TIP_W = 3;

export type GridColumn = {
  key: string;
  /** День колонки */
  day: string;
  header: React.ReactNode;
  onHeader?: () => void;
  tasks: Task[];
  /** Свёрнута: дела — полосками, нажатие раскрывает (onColumn) */
  compact?: boolean;
};

type Kind = 'block' | 'band' | 'strip';
type Placed = { task: Task; start: number; end: number; lane: number; lanes: number };
type Seg = { task: Task; c0: number; c1: number; row: number; label: string };

const keyOf = (t: Task) => `${t.id}@${t.occ ?? ''}`;

/** Пересекающиеся блоки — на дорожки: кластер пересечений делит ширину колонки поровну */
function lanes(items: { task: Task; start: number; end: number }[]): Placed[] {
  const timed = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Placed[] = [];
  let cluster: Placed[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const n = Math.max(1, ...cluster.map((p) => p.lane + 1));
    cluster.forEach((p) => (p.lanes = n));
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
  return out;
}

/** Кончик ярлыка: цвета людей дела стопкой сверху вниз */
function Tip({ colors, width = TIP_W }: { colors: string[]; width?: number }) {
  return (
    <View style={[styles.tip, { width }]}>
      {colors.map((col, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: col }} />
      ))}
    </View>
  );
}

/** Тело ярлыка: полупрозрачный цвет; у общего — полосами цветов слева направо */
function Body({ colors, alpha }: { colors: string[]; alpha: number }) {
  return (
    <View style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}>
      {colors.map((col, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: tint(col, alpha) }} />
      ))}
    </View>
  );
}

export function TimeGrid({
  columns,
  fromHour: fixedFrom,
  toHour: fixedTo,
  minColumnWidth,
  headless,
  scrollEnabled = true,
  onSlot,
  onColumn,
  onTask,
  onLongTask,
  refreshControl,
}: {
  columns: GridColumn[];
  /** Часы сетки; не заданы — по делам (не уже 7–22) */
  fromHour?: number;
  toHour?: number;
  /** Колонки уже этого — сетка листается вбок (длинный план) */
  minColumnWidth?: number;
  /** Без строки заголовков (одна колонка дня) */
  headless?: boolean;
  /** Прокрутку часов выключают на время щипка */
  scrollEnabled?: boolean;
  onSlot?: (col: GridColumn, minutes: number) => void;
  /** Нажатие на свёрнутую колонку */
  onColumn?: (col: GridColumn) => void;
  onTask: (t: Task) => void;
  onLongTask?: (t: Task) => void;
  refreshControl?: React.ReactElement<RefreshControlProps>;
}) {
  const c = useColors();
  const pal = usePalette();
  const reduced = useReducedMotion();
  const users = useStore((s) => s.users);
  const all = useStore((s) => s.tasks);
  const [width, setWidth] = useState(0);
  const [gridH, setGridH] = useState(0);
  const today = toISODate(new Date());
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const parents = useMemo(() => new Set(all.filter((t) => t.parentId).map((t) => t.parentId!)), [all]);

  // Что где рисуется: ярлык, подложка плана или полоса сверху
  const laid = useMemo(() => {
    const kind = (t: Task, day: string): Kind => {
      const m = minutesOn(t, day);
      if (parents.has(t.id) && m) return 'band';
      // Дело со временем, в том числе многодневное («пт 15:00 – сб 12:00»), — ярлыком на своё время в каждом дне
      if (m) return 'block';
      return 'strip';
    };
    return columns.map((col) => {
      const blocks: { task: Task; start: number; end: number }[] = [];
      const bands: { task: Task; start: number; end: number }[] = [];
      const strip: Task[] = [];
      for (const t of col.tasks) {
        const k = kind(t, col.day);
        const m = minutesOn(t, col.day);
        if (k === 'block' && m) blocks.push({ task: t, start: m[0], end: Math.max(m[1], m[0] + 15) });
        else if (k === 'band' && m) {
          bands.push({ task: t, start: m[0], end: m[1] });
          // Название плана — полосой сверху, там оно читается целиком
          strip.push(t);
        } else strip.push(t);
      }
      return { blocks: lanes(blocks), bands, strip };
    });
  }, [columns, parents]);

  // Часы: по делам и планам, но не уже 7–22.
  // У многодневных в счёт идут только настоящие начало и конец, середина (весь день) упирается в края сетки
  const spans = laid.flatMap((l) => [...l.blocks, ...l.bands]);
  const starts = spans.filter((b) => b.start > 0 || !isMulti(b.task)).map((b) => b.start);
  const ends = spans.filter((b) => b.end < 1440 || !isMulti(b.task)).map((b) => b.end);
  const fromHour = fixedFrom ?? Math.max(0, Math.min(7, ...starts.map((m) => Math.floor(m / 60))));
  const toHour = fixedTo ?? Math.min(24, Math.max(22, ...ends.map((m) => Math.ceil(m / 60))));
  const hours = toHour - fromHour;
  const hourH = gridH ? Math.max(MIN_HOUR_H, (gridH - 8) / hours) : MIN_HOUR_H;
  const height = hours * hourH;

  // Ширины: свёрнутые — узкие, раскрытые делят остальное поровну
  const avail = Math.max(0, width - LABEL_W);
  const compactN = columns.filter((col) => col.compact).length;
  const openN = columns.length - compactN;
  const openW = openN ? Math.max(minColumnWidth ?? 0, (avail - compactN * COMPACT_W) / openN) : 0;
  const widths = columns.map((col) => (col.compact ? COMPACT_W : openW));
  const lefts: number[] = [];
  const total = widths.reduce((acc, w) => {
    lefts.push(acc);
    return acc + w;
  }, 0);
  const wide = total > avail + 1;
  const move = {
    transitionProperty: ['left', 'width'] as ('left' | 'width')[],
    transitionDuration: reduced ? 0 : 220,
    transitionTimingFunction: 'ease-in-out' as const,
  };

  // Полосы сверху: одно дело в соседних колонках — одна полоса через них
  const { segs, hidden } = useMemo(() => {
    const at = new Map<string, { task: Task; cols: number[] }>();
    laid.forEach((l, i) =>
      l.strip.forEach((t) => {
        const k = keyOf(t);
        const e = at.get(k) ?? { task: t, cols: [] };
        e.cols.push(i);
        at.set(k, e);
      }),
    );
    const list: Seg[] = [];
    for (const { task, cols } of at.values()) {
      let s = cols[0];
      for (let j = 1; j <= cols.length; j++) {
        if (j === cols.length || cols[j] !== cols[j - 1] + 1) {
          const first = s === cols[0];
          const time = first && task.time && isMulti(task) ? `${task.time} ` : '';
          const label = parents.has(task.id) ? `${task.title} · ${spanLabel(task)}` : `${time}${task.title}`;
          list.push({ task, c0: s, c1: cols[j - 1], row: 0, label });
          s = cols[j];
        }
      }
    }
    list.sort((a, b) => a.c0 - b.c0 || b.c1 - b.c0 - (a.c1 - a.c0));
    const rowsEnd: number[] = [];
    for (const sg of list) {
      let r = 0;
      while (rowsEnd[r] !== undefined && rowsEnd[r] >= sg.c0) r++;
      sg.row = r;
      rowsEnd[r] = sg.c1;
    }
    // Сколько не поместилось в каждой колонке
    const hid = columns.map((_, i) => list.filter((sg) => sg.row >= MAX_ROWS && sg.c0 <= i && sg.c1 >= i).length);
    return { segs: list.filter((sg) => sg.row < MAX_ROWS), hidden: hid };
  }, [laid, columns, parents]);
  const rows = Math.min(MAX_ROWS, Math.max(0, ...segs.map((sg) => sg.row + 1))) + (hidden.some(Boolean) ? 1 : 0);

  /** Чьё дело — имена через запятую */
  const names = (t: Task) =>
    peopleOf(t)
      .map((id) => users.find((u) => u.id === id)?.name ?? '')
      .filter(Boolean)
      .join(', ');
  /**
   * Описание ярлыка одинаковое во всех днях: название, от и до, чьё, описание.
   * Строк — сколько влезет по высоте; сколько строк займёт текст, прикидываем по ширине.
   */
  const describe = (t: Task, h: number, w: number) => {
    const inner = Math.max(10, w - 8);
    const need = (text: string, charW: number) => Math.max(1, Math.ceil((text.length + 2) / Math.max(4, Math.floor(inner / charW))));
    let room = h - 2;
    const titleLines = Math.max(1, Math.min(need(t.title, 5.6), 3, Math.floor(room / 13)));
    room -= titleLines * 13;
    const lines: { text: string; n: number; dim?: boolean }[] = [];
    const parts: [string, boolean, number][] = [
      ...spanParts(t).map((x): [string, boolean, number] => [x, false, 2]),
      [names(t), true, 2],
      [t.note?.trim() ?? '', true, 99],
    ];
    for (const [text, dim, cap] of parts) {
      if (!text) continue;
      const fit = Math.floor(room / 11);
      if (fit <= 0) break;
      const n = Math.min(need(text, 5.4), cap, fit);
      lines.push({ text, n, dim });
      room -= n * 11;
    }
    return { titleLines, lines };
  };
  const y = (min: number) => ((min - fromHour * 60) / 60) * hourH;
  const press = (t: Task) => ({
    onPress: () => onTask(t),
    onLongPress: onLongTask ? () => onLongTask(t) : undefined,
    delayLongPress: 350,
  });

  const content = (
    <View style={{ flex: 1 }}>
      {/* Заголовки колонок */}
      {!headless && (
      <View style={[styles.headRow, { borderBottomColor: c.border }]}>
        {columns.map((col, i) => (
          <Animated.View key={col.key} style={[styles.abs, { top: 0, bottom: 0, left: LABEL_W + lefts[i], width: widths[i] }, move]}>
            <Pressable
              disabled={!col.onHeader && !(col.compact && onColumn)}
              onPress={col.compact && onColumn ? () => onColumn(col) : col.onHeader}
              style={styles.head}
            >
              {col.header}
            </Pressable>
          </Animated.View>
        ))}
      </View>
      )}

      {/* Полосы: весь день, многодневные и планы */}
      {rows > 0 && (
        <View style={{ height: rows * (BAR_H + 2) + 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }}>
          {segs.map((sg) => {
            const colors = pal.task(sg.task);
            const narrow = widths.slice(sg.c0, sg.c1 + 1).every((w) => w <= COMPACT_W);
            return (
              <Animated.View
                key={`${keyOf(sg.task)}-${sg.c0}`}
                style={[
                  styles.abs,
                  move,
                  {
                    top: 2 + sg.row * (BAR_H + 2),
                    height: BAR_H,
                    left: LABEL_W + lefts[sg.c0] + 1,
                    width: lefts[sg.c1] + widths[sg.c1] - lefts[sg.c0] - 2,
                  },
                  sg.task.doneAt ? { opacity: 0.45 } : null,
                ]}
              >
                <Pressable {...press(sg.task)} style={[styles.bar, narrow && { paddingLeft: 0 }]}>
                  {narrow ? (
                    <View style={[StyleSheet.absoluteFill, { flexDirection: 'row', margin: 6, marginHorizontal: 3, gap: 1 }]}>
                      {colors.map((col, k) => (
                        <View key={k} style={{ flex: 1, borderRadius: 2, backgroundColor: col }} />
                      ))}
                    </View>
                  ) : (
                    <>
                      <Body colors={colors} alpha={pal.bodyAlpha} />
                      <Tip colors={colors} />
                      <T style={[styles.barText, { color: c.text }]} numberOfLines={1}>
                        {sg.label}
                      </T>
                    </>
                  )}
                </Pressable>
              </Animated.View>
            );
          })}
          {hidden.map((n, i) =>
            n && !columns[i].compact ? (
              <Pressable
                key={`more-${i}`}
                onPress={columns[i].onHeader}
                style={{ position: 'absolute', top: 2 + MAX_ROWS * (BAR_H + 2), left: LABEL_W + lefts[i] + 4 }}
              >
                <T style={[styles.barText, { color: c.textMuted }]}>+{n}</T>
              </Pressable>
            ) : null,
          )}
        </View>
      )}

      {/* Часы и дела: подгоняем под оставшуюся высоту */}
      <View style={{ flex: 1 }} onLayout={(e) => setGridH(e.nativeEvent.layout.height)}>
        <ScrollView
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 2 }}
          scrollEnabled={scrollEnabled}
          refreshControl={refreshControl}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          <View style={{ height }}>
            {Array.from({ length: hours }, (_, i) => {
              // Подписи часов — через один, если час низкий
              const every = hourH < 22 ? 2 : 1;
              return (
                <React.Fragment key={i}>
                  <View pointerEvents="none" style={[styles.line, { top: i * hourH, left: LABEL_W, width: total, backgroundColor: c.border }]} />
                  {i % every ? null : (
                    <T style={[styles.hour, { top: i * hourH - 6, color: c.textMuted }]}>{String(fromHour + i).padStart(2, '0')}</T>
                  )}
                </React.Fragment>
              );
            })}
            {columns.map((col, ci) => {
              const l = laid[ci];
              const compact = !!col.compact;
              const inset = l.bands.length && !compact ? 5 : 0;
              return (
                <Animated.View
                  key={col.key}
                  style={[
                    styles.abs,
                    move,
                    { top: 0, height, left: LABEL_W + lefts[ci], width: widths[ci], borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: c.border },
                    compact && { backgroundColor: c.surface },
                  ]}
                >
                  <Pressable
                    style={StyleSheet.absoluteFill}
                    onPress={(e) => {
                      if (compact) return onColumn?.(col);
                      if (!onSlot) return;
                      const min = fromHour * 60 + Math.floor((e.nativeEvent.locationY / hourH) * 2) * 30;
                      onSlot(col, Math.min(min, 23 * 60 + 30));
                    }}
                  />
                  {/* Подложки планов: подзадачи видны внутри своего дела */}
                  {l.bands.map((b) => {
                    const top = Math.max(0, y(b.start));
                    const bottom = Math.min(height, y(b.end));
                    if (bottom <= top) return null;
                    const col0 = pal.task(b.task)[0];
                    return (
                      <Pressable
                        key={`band-${keyOf(b.task)}`}
                        {...press(b.task)}
                        style={[
                          styles.band,
                          {
                            top,
                            height: bottom - top,
                            backgroundColor: tint(col0, pal.bodyAlpha * 0.45),
                            borderColor: col0,
                            borderTopWidth: b.start > 0 && y(b.start) >= 0 ? 2 : 0,
                            borderBottomWidth: b.end < 1440 && y(b.end) <= height ? 2 : 0,
                          },
                        ]}
                      />
                    );
                  })}
                  <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { left: inset }]}>
                    {l.blocks.map((p) => {
                      // Обрезаем по краям сетки (многодневное утром и вечером выходит за видимые часы)
                      const top = Math.max(0, y(p.start));
                      const bottom = Math.min(height, y(p.end));
                      if (bottom <= 0 || top >= height) return null;
                      const h = Math.max(14, bottom - top - 1);
                      const colors = pal.task(p.task);
                      const done = !!p.task.doneAt;
                      if (compact) {
                        // Свёрнутый день: ярлык сужается в полоски своего цвета
                        return (
                          <View
                            key={keyOf(p.task)}
                            pointerEvents="none"
                            style={[styles.stripWrap, { top: top + 0.5, height: h, left: 3 + Math.min(p.lane, 2) * 6 }, done && { opacity: 0.45 }]}
                          >
                            {colors.slice(0, 2).map((col, k) => (
                              <View key={k} style={[styles.strip, { backgroundColor: col }]} />
                            ))}
                          </View>
                        );
                      }
                      const w = (widths[ci] - inset) / p.lanes;
                      const d = describe(p.task, h, w - 2);
                      return (
                        <Pressable
                          key={keyOf(p.task)}
                          {...press(p.task)}
                          style={[
                            styles.label,
                            {
                              top: top + 0.5,
                              height: h,
                              left: `${(p.lane / p.lanes) * 100}%`,
                              width: `${100 / p.lanes}%`,
                            },
                            done && { opacity: 0.45 },
                          ]}
                        >
                          <View style={styles.labelIn}>
                            <Body colors={colors} alpha={pal.bodyAlpha} />
                            <Tip colors={colors} />
                            <T
                              style={[styles.labelTitle, { color: c.text }, done ? { textDecorationLine: 'line-through' } : null]}
                              numberOfLines={d.titleLines}
                            >
                              {p.task.title}
                            </T>
                            {d.lines.map((ln, i) => (
                              <T key={i} style={[styles.labelSub, { color: ln.dim ? c.textMuted : c.text }]} numberOfLines={ln.n}>
                                {ln.text}
                              </T>
                            ))}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                  {col.day === today && now.getHours() >= fromHour && now.getHours() < toHour ? (
                    <View
                      pointerEvents="none"
                      style={[styles.now, { top: y(now.getHours() * 60 + now.getMinutes()), backgroundColor: c.event }]}
                    />
                  ) : null}
                </Animated.View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 &&
        (wide ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
            <View style={{ width: LABEL_W + total }}>{content}</View>
          </ScrollView>
        ) : (
          content
        ))}
    </View>
  );
}

/** Заголовок колонки дня: «пн» и число, сегодня — выделено. Свёрнутый — мельче */
export function DayHeader({ date, label, compact }: { date: Date; label: string; compact?: boolean }) {
  const c = useColors();
  const isToday = toISODate(date) === toISODate(new Date());
  if (compact) {
    return (
      <View style={{ alignItems: 'center', gap: 2 }}>
        <T style={{ fontFamily: font.regular, fontSize: 9, lineHeight: 11, color: c.textMuted }}>{label}</T>
        <View style={[styles.numSmall, isToday ? { backgroundColor: c.event } : null]}>
          <T style={{ fontFamily: isToday ? font.semibold : font.mono, fontSize: 10, lineHeight: 13, color: isToday ? c.onEvent : c.text }}>
            {date.getDate()}
          </T>
        </View>
      </View>
    );
  }
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
  abs: { position: 'absolute' },
  headRow: { height: HEAD_H, borderBottomWidth: StyleSheet.hairlineWidth },
  head: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  hour: { position: 'absolute', left: 0, width: LABEL_W - 5, textAlign: 'right', fontFamily: font.mono, fontSize: 10, lineHeight: 12 },
  line: { position: 'absolute', height: StyleSheet.hairlineWidth },
  tip: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  label: { position: 'absolute', paddingHorizontal: 1 },
  labelIn: { flex: 1, borderTopRightRadius: 5, borderBottomRightRadius: 5, borderTopLeftRadius: 2, borderBottomLeftRadius: 2, overflow: 'hidden', paddingLeft: TIP_W + 4, paddingRight: 3, paddingTop: 1 },
  labelTitle: { fontFamily: font.medium, fontSize: 10, lineHeight: 13 },
  labelSub: { fontFamily: font.mono, fontSize: 9, lineHeight: 11 },
  stripWrap: { position: 'absolute', flexDirection: 'row', gap: 1 },
  strip: { width: STRIP_W, borderRadius: 2.5 },
  band: { position: 'absolute', left: 0, right: 0, borderLeftWidth: 2 },
  bar: { flex: 1, borderTopRightRadius: 5, borderBottomRightRadius: 5, borderTopLeftRadius: 2, borderBottomLeftRadius: 2, overflow: 'hidden', paddingLeft: TIP_W + 4, paddingRight: 4, justifyContent: 'center' },
  barText: { fontFamily: font.medium, fontSize: 10, lineHeight: 13 },
  now: { position: 'absolute', left: 0, right: 0, height: 2 },
  num: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  numSmall: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
});
