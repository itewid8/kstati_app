/**
 * Переходы календаря — как в «Календаре» iOS и Fantastical: двигается только содержимое вида, панели стоят.
 *
 * Щипок (день ↔ неделя ↔ месяц ↔ год): пока пальцы на экране, содержимое следует за ними — масштаб вокруг точки
 * щипка и лёгкое растворение (поток UI). Отпустили дальше порога или резко — вид меняется сразу, без пустого кадра,
 * и новый «вырастает» из точки щипка пружиной, которой передана скорость пальцев; иначе — пружиной назад.
 * Переключатель ДЕНЬ/НЕДЕЛЯ/МЕСЯЦ/ГОД даёт тот же переход из центра.
 *
 * Свайп влево-вправо — соседний период: содержимое идёт за пальцем; дальше четверти ширины или быстрым жестом —
 * уезжает, новый период въезжает с другой стороны пружиной. Стрелки ‹ › и «СЕГОДНЯ» дают тот же въезд.
 * Уменьшение движения в системе — переключение без анимации.
 */
import * as Haptics from 'expo-haptics';
import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type AnimatedStyle,
} from 'react-native-reanimated';
import type { ViewStyle } from 'react-native';
import { mondayOf } from '@/adapters/calendar/events';
import { zoomTarget } from '@/adapters/calendar/zoom';
import {
  ZOOM_VIEWS,
  zoomCommits,
  zoomDir,
  zoomFollow,
  zoomNext,
  zoomProgress,
  zoomShift,
  type ZoomDir,
  type ZoomView,
} from '@/lib/calendarLayout';
import { toISODate } from '@/lib/dates';
import { useStore } from '@/lib/store';
import { CalendarContentWrap } from '@/screens/calendar/components/CalendarScaffold';
import { size as S } from '@/ui';
import { useInsets } from '../common';
import { nextDay, prevDay } from './DayContainer';
import { nextMonth, prevMonth } from './MonthContainer';
import { nextWeek, prevWeek } from './WeekContainer';
import { nextYear, prevYear } from './YearContainer';

/** Пружины: «мягкая» для появления вида, «упругая» для возврата под пальцем (близко к UISpringTimingParameters) */
const ENTER = { damping: 26, stiffness: 260, mass: 1 } as const;
const BACK = { damping: 20, stiffness: 300, mass: 0.8 } as const;
const FADE_IN = { duration: 200, easing: Easing.out(Easing.cubic) } as const;

/** Насколько больше/меньше появляется новый вид: крупнее период — «опускается» из большего, мельче — растёт из меньшего */
const ENTER_SCALE = 0.14;
/** Свайп: доля ширины и скорость (px/с), после которых период меняется */
const PAGE_DISTANCE = 0.22;
const PAGE_VELOCITY = 550;
/** Новый период въезжает с этой доли ширины */
const PAGE_ENTER = 0.32;

const STEP: Record<ZoomView, readonly [() => void, () => void]> = {
  day: [prevDay, nextDay],
  week: [prevWeek, nextWeek],
  month: [prevMonth, nextMonth],
  year: [prevYear, nextYear],
};

/** Какой период виден при этой дате: выбор другого дня внутри месяца/недели/года период не меняет — без въезда */
export const periodOf = (view: ZoomView, date: string) =>
  view === 'year' ? date.slice(0, 4) : view === 'month' ? date.slice(0, 7) : view === 'week' ? mondayOf(date) : date;

const LayerStyle = createContext<AnimatedStyle<ViewStyle> | null>(null);

/** Слой содержимого вида (CalendarScaffold оборачивает им сетку): на нём — масштаб, сдвиг, прозрачность */
function ZoomLayer({ children }: { children?: ReactNode }) {
  const style = useContext(LayerStyle);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="box-none">
      {children}
    </Animated.View>
  );
}

type Props = { view: ZoomView; children: ReactNode };

export function CalendarZoom({ view, children }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useInsets();
  const reduced = useReducedMotion();
  const date = useStore((s) => s.calendarDate);

  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const dir = useSharedValue<ZoomDir>(0);
  const fx = useSharedValue(width / 2);
  const fy = useSharedValue(height / 2);

  /** Откуда пришла смена вида/даты: щипок, свайп — анимацию входа уже знаем; иначе (кнопки) — выводим сами */
  const pending = useRef<{ kind: 'zoom'; dir: ZoomDir; velocity: number } | { kind: 'page'; side: -1 | 1 } | null>(null);
  const prev = useRef({ view, date });

  useEffect(() => {
    const was = prev.current;
    prev.current = { view, date };
    if (was.view === view && periodOf(view, was.date) === periodOf(view, date)) return;
    const how = pending.current;
    pending.current = null;
    if (reduced) {
      scale.value = 1;
      opacity.value = 1;
      tx.value = 0;
      ty.value = 0;
      return;
    }
    if (was.view !== view) {
      // Новый вид вырастает из точки щипка (или из центра — переключатель)
      const d: ZoomDir =
        how?.kind === 'zoom' ? how.dir : ZOOM_VIEWS.indexOf(view) > ZOOM_VIEWS.indexOf(was.view) ? 1 : -1;
      if (how?.kind !== 'zoom') {
        fx.value = width / 2;
        fy.value = height / 2;
      }
      const s0 = 1 + d * ENTER_SCALE;
      const shift = zoomShift(s0, fx.value, fy.value, width, height);
      scale.value = s0;
      tx.value = shift.x;
      ty.value = shift.y;
      opacity.value = 0.25;
      const v = how?.kind === 'zoom' ? how.velocity : 0;
      scale.value = withSpring(1, { ...ENTER, velocity: v });
      tx.value = withSpring(0, ENTER);
      ty.value = withSpring(0, ENTER);
      opacity.value = withTiming(1, FADE_IN);
      return;
    }
    // Тот же вид, другой период: въезд сбоку (свайп — со стороны, куда листали; кнопки — по направлению даты)
    const side = how?.kind === 'page' ? how.side : date > was.date ? 1 : -1;
    scale.value = 1;
    ty.value = 0;
    tx.value = side * width * PAGE_ENTER;
    opacity.value = 0.4;
    tx.value = withSpring(0, ENTER);
    opacity.value = withTiming(1, FADE_IN);
  }, [view, date, reduced, width, height, scale, opacity, tx, ty, fx, fy]);

  const commitZoom = useCallback(
    (d: ZoomDir, x: number, y: number, velocity: number) => {
      const s = useStore.getState();
      const target = zoomTarget({
        view,
        date: s.calendarDate,
        dir: d,
        x,
        y,
        frame: { width, height, top: insets.top, bottom: insets.bottom + S.contentBottom },
        today: toISODate(new Date()),
      });
      if (!target) return;
      Haptics.selectionAsync().catch(() => {});
      pending.current = { kind: 'zoom', dir: d, velocity };
      s.setCalendarDate(target.date);
      s.setTasksView(target.view);
    },
    [view, width, height, insets],
  );

  const commitPage = useCallback(
    (side: -1 | 1) => {
      pending.current = { kind: 'page', side: side === 1 ? 1 : -1 };
      const [back, fwd] = STEP[view];
      if (side === 1) fwd();
      else back();
    },
    [view],
  );

  const pinch = Gesture.Pinch()
    .onStart((e) => {
      fx.value = e.focalX;
      fy.value = e.focalY;
      dir.value = 0;
    })
    .onUpdate((e) => {
      const d = zoomDir(e.scale);
      if (d !== 0) dir.value = d;
      const can = zoomNext(view, dir.value) !== null;
      const s = zoomFollow(e.scale, can);
      const shift = zoomShift(s, fx.value, fy.value, width, height);
      scale.value = s;
      tx.value = shift.x;
      ty.value = shift.y;
      opacity.value = can ? 1 - 0.6 * zoomProgress(e.scale, dir.value) : 1;
    })
    .onEnd((e) => {
      const d = dir.value;
      if (zoomNext(view, d) !== null && zoomCommits(e.scale, e.velocity, d)) {
        // Вид меняется сразу — без ожидания растворения старого; скорость пальцев уходит в пружину нового
        runOnJS(commitZoom)(d, fx.value, fy.value, -d * e.velocity * 0.5);
        return;
      }
      scale.value = withSpring(1, { ...BACK, velocity: e.velocity });
      tx.value = withSpring(0, BACK);
      ty.value = withSpring(0, BACK);
      opacity.value = withTiming(1, FADE_IN);
    });

  const page = Gesture.Pan()
    .maxPointers(1)
    .activeOffsetX([-16, 16])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      tx.value = e.translationX;
      opacity.value = 1 - Math.min(0.5, Math.abs(e.translationX) / width);
    })
    .onEnd((e) => {
      const far = Math.abs(e.translationX) > width * PAGE_DISTANCE;
      const fast = Math.abs(e.velocityX) > PAGE_VELOCITY && Math.sign(e.velocityX) === Math.sign(e.translationX);
      if (e.translationX !== 0 && (far || fast)) {
        // Палец влево — следующий период (он въедет справа)
        const side: -1 | 1 = e.translationX < 0 ? 1 : -1;
        tx.value = withTiming(-side * width * 0.6, { duration: 140, easing: Easing.in(Easing.quad) }, (done) => {
          if (done) runOnJS(commitPage)(side);
        });
        opacity.value = withTiming(0.2, { duration: 140 });
        return;
      }
      tx.value = withSpring(0, { ...BACK, velocity: e.velocityX });
      opacity.value = withTiming(1, FADE_IN);
    });

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, page)}>
      <Animated.View style={styles.fill}>
        <LayerStyle.Provider value={style}>
          <CalendarContentWrap.Provider value={ZoomLayer}>{children}</CalendarContentWrap.Provider>
        </LayerStyle.Provider>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
