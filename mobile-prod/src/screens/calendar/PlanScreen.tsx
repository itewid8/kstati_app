/**
 * План — дело с подзадачами (C-Plan), вид «СЕТКА». Презентационный экран: план и его подзадачи приходят пропсами.
 *
 * Раскладка как в макете: панель «назад · подпись · + · …» (top 20), шапка плана с 70 (полоса цвета плана слева,
 * название 24/26, период и владелец, прогресс сегментами, переключатель СЕТКА / СПИСОК), под ней колонки дней
 * периода (x 40 … правое поле 16) с подписями, чертой 1.5px и сеткой часов до верха навигации.
 * Видимые часы — hourRange по подзадачам (±1 ч). Пересекающиеся подзадачи одного дня стоят рядом (layoutDayLanes).
 * Сделанная подзадача — заливка вдвое бледнее и зачёркнутое название.
 */
import { memo, useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { dayNo, hourRange, layoutDayLanes, type DayMinute, type IsoDate, type LaneBlock } from '@/lib/calendarLayout';
import type { ID, PersonColor } from '@/lib/types';
import { BottomNav, IconButton, LONG_PRESS_MS, Marquee, fonts, size as S, space, tint, type as T, useLift, useTheme, type LiftTarget, type NavTab } from '@/ui';
import { NO_INSETS, useScreenSize } from './components/CalendarScaffold';
import { HourLines } from './components/HourLines';
import { useLongPressId } from './components/longPress';
import { WEEKDAYS, addDays, pad2, parts, timeRange, weekday } from './format';

export type PlanStepEvent = {
  id: ID;
  title: string;
  /** «Ласточка, вагон 5» — видно, если блок не ниже 40px */
  note?: string;
  date: IsoDate;
  start: DayMinute;
  end: DayMinute;
  done?: boolean;
};

export type PlanMode = 'grid' | 'list';

export type PlanScreenProps = {
  /** «ПЛАН · МЫ С КАРИНОЙ» */
  caption: string;
  /** Неразрывные пробелы в названии сохраняются: «Командировка в Казань» */
  title: string;
  color: PersonColor;
  /** «7 ОКТ 06:00 → 9 ОКТ 15:00» */
  rangeLabel: string;
  /** «КАРИНА» */
  ownerLabel: string;
  /** Период плана — колонки сетки */
  startDate: IsoDate;
  endDate: IsoDate;
  steps: readonly PlanStepEvent[];
  insets?: { top: number; bottom: number };

  onBack?: () => void;
  onAddStep?: () => void;
  onMore?: () => void;
  /** Переключатель СЕТКА / СПИСОК: список рисует другой экран */
  onChangeMode?: (mode: PlanMode) => void;
  onOpenStep?: (id: ID) => void;
  /** Удержание подзадачи (быстрые действия): id и нажатый блок */
  onLongPressStep?: (id: ID, lift: LiftTarget) => void;
  onNavigate?: (tab: NavTab) => void;
  onRec?: () => void;
};

const P = {
  headerTop: 70,
  /** Высота шапки до измерения (одна строка названия) и зазор до колонок */
  headerFallback: 101,
  headerGap: 7,
  gridLeft: 40,
  gridRight: space.side,
  hourLabelLeft: space.side,
  /** От верха колонок: подписи дней, черта, первая линия часов */
  labelTop: 5,
  rule: 20,
  gridTop: 24,
  segment: 6,
  toggle: 28,
  /** Описание видно, если блок не ниже */
  noteMinH: 40,
} as const;
const DONE_FACTOR = 0.5;
const TIP = 1.5;

type StepProps = {
  step: PlanStepEvent;
  lane: LaneBlock;
  x: number;
  y: number;
  color: string;
  onOpenStep?: (id: ID) => void;
  onLongPressStep?: (id: ID, lift: LiftTarget) => void;
};

const PlanStepBlock = memo(function PlanStepBlock(props: StepProps) {
  const { step, lane, x, y, color, onOpenStep, onLongPressStep } = props;
  const { c } = useTheme();
  const open = useCallback(() => onOpenStep?.(step.id), [onOpenStep, step.id]);
  const hold = useLongPressId(step.id, onLongPressStep);
  // Копия — в начале координат рамки
  const lift = useLift(hold, 'block', () => <PlanStepBlock {...props} x={-lane.x} y={-lane.y} onOpenStep={undefined} onLongPressStep={undefined} />);
  const time = timeRange(step);
  return (
    <Pressable
      ref={lift.ref}
      accessibilityRole="button"
      accessibilityLabel={`${step.title}, ${time}`}
      accessibilityState={{ checked: !!step.done }}
      onPress={onOpenStep ? open : undefined}
      onLongPress={lift.onLongPress}
      delayLongPress={LONG_PRESS_MS}
      style={[
        styles.step,
        {
          left: x + lane.x,
          top: y + lane.y,
          width: lane.w,
          height: lane.h,
          backgroundColor: tint(color, step.done ? c.tintAlpha * DONE_FACTOR : c.tintAlpha),
        },
      ]}
    >
      <View style={[styles.tip, { backgroundColor: color }]} />
      <Text style={[styles.stepTitle, { color: c.text }, step.done && styles.done]}>{step.title}</Text>
      <Text style={[styles.stepTime, { color: c.text }]}>{time}</Text>
      {step.note && lane.h >= P.noteMinH ? <Text style={[styles.stepNote, { color: c.muted }]}>{step.note}</Text> : null}
    </Pressable>
  );
});

export const PlanScreen = memo(function PlanScreen(props: PlanScreenProps) {
  const {
    caption,
    title,
    color,
    rangeLabel,
    ownerLabel,
    startDate,
    endDate,
    steps,
    insets = NO_INSETS,
    onBack,
    onAddStep,
    onMore,
    onChangeMode,
    onOpenStep,
    onLongPressStep,
    onNavigate,
    onRec,
  } = props;
  const { c, person } = useTheme();
  const [screen, onLayout] = useScreenSize();
  const [headerH, setHeaderH] = useState<number>(P.headerFallback);
  const onHeaderLayout = useCallback((e: LayoutChangeEvent) => setHeaderH(e.nativeEvent.layout.height), []);
  const fill = person(color);
  const top = insets.top;

  const days = useMemo(() => {
    const n = Math.max(1, dayNo(endDate) - dayNo(startDate) + 1);
    return Array.from({ length: n }, (_, i) => addDays(startDate, i));
  }, [startDate, endDate]);
  const done = steps.filter((s) => s.done).length;

  const gx = P.gridLeft;
  const col = (screen.width - P.gridLeft - P.gridRight) / days.length;
  const colTop = top + P.headerTop + headerH + P.headerGap;
  const gridY = colTop + P.gridTop;
  const gridBottom = screen.height - insets.bottom - S.contentBottom;

  const range = useMemo(() => hourRange(steps), [steps]);
  const hourPx = Math.max(1, gridBottom - gridY) / (range.hEnd - range.h0);
  const lanes = useMemo(
    () =>
      days.map((d) => {
        const list = steps.filter((s) => s.date === d).sort((a, b) => a.start - b.start);
        return { list, blocks: layoutDayLanes(list, { width: col, hourPx, h0: range.h0, hEnd: range.hEnd }) };
      }),
    [days, steps, col, hourPx, range],
  );

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]} onLayout={onLayout}>
      {days.map((d, i) => (
        <View key={d} pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View
            style={[
              styles.abs,
              { left: gx + i * col, width: col, top: colTop, height: gridBottom - colTop },
              i % 2 === 1 && { backgroundColor: c.alt },
            ]}
          />
          <Text style={[styles.abs, styles.dayLabel, { left: gx + i * col, width: col, top: colTop + P.labelTop, color: c.text }]}>
            {`${WEEKDAYS[weekday(d)]} ${pad2(parts(d).d)}`}
          </Text>
        </View>
      ))}
      <View pointerEvents="none" style={[styles.rule, { top: colTop + P.rule, backgroundColor: c.border }]} />

      <HourLines
        top={gridY}
        hourPx={hourPx}
        h0={range.h0}
        hEnd={range.hEnd}
        lineLeft={P.gridLeft}
        lineRight={P.gridRight}
        labelLeft={P.hourLabelLeft}
        labelStyle={styles.hourLabel}
      />

      {lanes.map(({ list, blocks }, i) =>
        blocks.map((lane) => {
          const step = list.find((s) => s.id === lane.id);
          return step ? (
            <PlanStepBlock
              key={lane.id}
              step={step}
              lane={lane}
              x={gx + i * col}
              y={gridY}
              color={fill}
              onOpenStep={onOpenStep}
              onLongPressStep={onLongPressStep}
            />
          ) : null;
        }),
      )}

      <View style={[styles.side, styles.bar, { top: top + S.topBarTop }]}>
        <IconButton icon="back" iconSize={S.iconSmall} accessibilityLabel="Назад" onPress={onBack} />
        <Marquee style={[T.caption, styles.flex, { color: c.muted }]}>
          {caption}
        </Marquee>
        <IconButton icon="plus" iconSize={S.iconSmall} accessibilityLabel="Добавить подзадачу" onPress={onAddStep} />
        <IconButton icon="dots" iconSize={S.iconSmall} accessibilityLabel="Ещё" onPress={onMore} />
      </View>

      <View style={[styles.side, { top: top + P.headerTop }]} onLayout={onHeaderLayout}>
        <View style={styles.head}>
          <View style={[styles.headStrip, { backgroundColor: fill }]} />
          <Text style={[styles.title, { color: c.text }]}>{title}</Text>
          <Text style={[styles.meta, { color: c.text }]}>
            {`${rangeLabel} · `}
            <Text style={{ color: c.muted }}>{ownerLabel}</Text>
          </Text>
        </View>
        <View style={styles.progress} accessibilityLabel={`Сделано ${done} из ${steps.length}`}>
          {steps.map((s, i) => (
            <View
              key={s.id}
              style={[styles.segment, i < done ? { backgroundColor: fill } : { borderWidth: S.border, borderColor: c.border }]}
            />
          ))}
          <Text style={[styles.progressText, { color: c.text }]}>{`${done}/${steps.length}`}</Text>
        </View>
        <View style={styles.modes}>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: true }}
            onPress={onChangeMode ? () => onChangeMode('grid') : undefined}
            style={[styles.mode, { borderColor: c.border, backgroundColor: c.text }]}
          >
            <Text style={[styles.modeOn, { color: c.bg }]}>СЕТКА</Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: false }}
            onPress={onChangeMode ? () => onChangeMode('list') : undefined}
            style={[styles.mode, styles.modeNext, { borderColor: c.border, backgroundColor: c.panel }]}
          >
            <Text style={[styles.modeOff, { color: c.text }]}>СПИСОК</Text>
          </Pressable>
        </View>
      </View>

      <BottomNav active="tasks" onSelect={onNavigate} onRec={onRec} style={[styles.side, { bottom: insets.bottom + S.navBottom }]} />
    </View>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden' },
  abs: { position: 'absolute' },
  side: { position: 'absolute', left: space.side, right: space.side },
  flex: { flex: 1 },
  bar: { height: S.topBarHeight, flexDirection: 'row', alignItems: 'center', gap: space.barGap },
  head: { paddingLeft: 10 },
  headStrip: { position: 'absolute', left: 0, top: 2, bottom: 1, width: S.strip },
  title: { fontFamily: fonts.sans700, fontSize: 24, lineHeight: 26, letterSpacing: -0.96 },
  meta: { marginTop: 4, fontFamily: fonts.mono400, fontSize: 9, lineHeight: 11, letterSpacing: 0.54 },
  progress: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 4 },
  segment: { flex: 1, height: P.segment },
  progressText: { marginLeft: 6, fontFamily: fonts.mono600, fontSize: 10, lineHeight: 12 },
  modes: { marginTop: 10, flexDirection: 'row' },
  mode: { height: P.toggle, paddingHorizontal: 10, borderWidth: S.border, justifyContent: 'center' },
  modeNext: { borderLeftWidth: 0 },
  modeOn: { fontFamily: fonts.mono600, fontSize: 9.5, letterSpacing: 0.76 },
  modeOff: { fontFamily: fonts.mono400, fontSize: 9.5, letterSpacing: 0.76 },
  dayLabel: { paddingLeft: 6, fontFamily: fonts.mono600, fontSize: 9, lineHeight: 11, letterSpacing: 0.54 },
  rule: { position: 'absolute', left: 0, right: 0, height: S.border },
  hourLabel: { fontSize: 8.5, lineHeight: 10 },
  step: { position: 'absolute', overflow: 'hidden', paddingTop: 3, paddingRight: 4, paddingLeft: 7, gap: 1 },
  tip: { position: 'absolute', left: 0, top: 0, bottom: 0, width: TIP },
  stepTitle: { fontFamily: fonts.sans600, fontSize: 10, lineHeight: 12 },
  done: { textDecorationLine: 'line-through' },
  stepTime: { fontFamily: fonts.mono400, fontSize: 8.5, lineHeight: 10 },
  stepNote: { fontFamily: fonts.sans400, fontSize: 8.5, lineHeight: 10 },
});
