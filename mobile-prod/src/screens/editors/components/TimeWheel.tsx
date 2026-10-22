/**
 * Колесо времени (C-EditDate, C-EditPeriod; взаимодействие — раскадровка C-TimeStory).
 *
 * Покой: три строки 22 / 26 / 22, выбранная — 17/600 в полосе между линиями, соседние — 12/400 бледнее
 * (час ±1, минуты ± шаг). Центры строк через 24px, поэтому та же раскладка получается из непрерывной
 * ленты с шагом PITCH = 24: строка k стоит на y = MID + k·24 − pos.
 *
 * Взаимодействие (каждая колонка — часы и минуты — крутится отдельно, жест Pan из gesture-handler):
 *  01 касание   — колонка подсвечивается (заливка 6% + линия у двоеточия), короткий лёгкий отклик;
 *  03 ведём     — лента идёт за пальцем 1:1; размер, начертание и цвет меняются плавно по расстоянию до рамки
 *                 (два слоя текста 17/600 и 12/400 с перекрёстной прозрачностью и масштабом — только
 *                 transform/opacity на UI-потоке, без перерасчёта раскладки);
 *  04 инерция   — после броска лента докручивается (≈ время затухания 120 мс), цель — ближайшее
 *                 к точке остановки значение; на каждом шаге — тихий щелчок (Haptics.selection);
 *  05 доводка   — проскакивает цель на 4px и возвращается (вместе ≈ 180 мс);
 *  06 итог      — значение уходит наружу (onChange) только когда колесо встало.
 * Тап по верхней/нижней строке — шаг на одно значение. VoiceOver/TalkBack — adjustable ±1.
 * Минуты переносятся в часы: прокрутили 55 → 00 — час прибавился (00 → 55 — убавился), на сколько кругов
 * прошла лента минут, на столько и сдвигаются часы. Часы через полночь дату не меняют.
 */
import * as Haptics from 'expo-haptics';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, type AccessibilityActionEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { pad2, size as S, tint, useTheme } from '@/ui';
import { NoTimeButton } from './Buttons';
import { ET } from './text';

export type TimeValue = { hour: number; minute: number };

/* ---------- Геометрия (как в макете) ---------- */

const ROW_SIDE = 22;
const ROW_MID = 26;
/** Расстояние между центрами строк */
const PITCH = (ROW_SIDE + ROW_MID) / 2;
/** Высота окна колеса без рамки */
const WINDOW = ROW_SIDE * 2 + ROW_MID;
const MID = WINDOW / 2;
/** Высота ячейки одного числа (по центру — текст) */
const ITEM = ROW_MID;
/** Сколько чисел держим смонтированными по обе стороны от якоря */
const SLOTS = 4;
const SIZE_MID = ET.wheelCurrent.fontSize;
const SIZE_SIDE = ET.wheel.fontSize;

/* ---------- Движение ---------- */

/** Перелёт при доводке, px */
const OVERSHOOT = 4;
/** Доводка: до перелёта и обратно — вместе ≈ 180 мс */
const SNAP_OUT_MS = 110;
const SNAP_BACK_MS = 70;
/** Возврат после инерции (инерция уже донесла до перелёта) */
const SETTLE_MS = 120;
/** Постоянная затухания инерции: путь броска = скорость × DECAY_S */
const DECAY_S = 0.12;
/** Медленнее этого (px/с) — не бросок, а просто доводка */
const FLING_MIN = 220;
const INERTIA_MIN_MS = 140;
const INERTIA_MAX_MS = 420;
/** Тап: палец сдвинулся не больше чем на столько px */
const TAP_SLOP = 8;

const mod = (n: number, m: number) => ((n % m) + m) % m;

const clamp01 = (x: number) => {
  'worklet';
  return x < 0 ? 0 : x > 1 ? 1 : x;
};

/** Доля «удалённости» строки от рамки: 0 — в рамке, 1 — соседняя строка и дальше */
const distance = (abs: number, pos: number) => {
  'worklet';
  return Math.min(1, Math.abs(abs * PITCH - pos) / PITCH);
};

/** Встать на значение index: перелёт на 4px в сторону движения и возврат, потом commit */
function snapTo(pos: SharedValue<number>, index: number, commit: (index: number) => void) {
  'worklet';
  const target = index * PITCH;
  const delta = target - pos.value;
  const done = (finished?: boolean) => {
    'worklet';
    if (finished) scheduleOnRN(commit, index);
  };
  if (Math.abs(delta) < 1) {
    pos.value = withTiming(target, { duration: SNAP_BACK_MS }, done);
    return;
  }
  pos.value = withSequence(
    withTiming(target + Math.sign(delta) * OVERSHOOT, { duration: SNAP_OUT_MS, easing: Easing.out(Easing.quad) }),
    withTiming(target, { duration: SNAP_BACK_MS, easing: Easing.inOut(Easing.quad) }, done),
  );
}

/** Палец отпущен со скоростью velocity (px/с, в сторону роста pos): инерция → доводка → commit */
function fling(pos: SharedValue<number>, velocity: number, commit: (index: number) => void) {
  'worklet';
  const from = pos.value;
  const index = Math.round((from + velocity * DECAY_S) / PITCH);
  const target = index * PITCH;
  const dist = target - from;
  if (Math.abs(velocity) < FLING_MIN || Math.abs(dist) < PITCH / 2 || Math.sign(dist) !== Math.sign(velocity)) {
    snapTo(pos, index, commit);
    return;
  }
  // Начальная скорость out-quad = 2·путь/время — подбираем время под скорость пальца
  const ms = Math.min(INERTIA_MAX_MS, Math.max(INERTIA_MIN_MS, ((2 * Math.abs(dist)) / Math.abs(velocity)) * 1000));
  pos.value = withSequence(
    withTiming(target + Math.sign(dist) * OVERSHOOT, { duration: ms, easing: Easing.out(Easing.quad) }),
    withTiming(target, { duration: SETTLE_MS, easing: Easing.inOut(Easing.quad) }, (finished?: boolean) => {
      'worklet';
      if (finished) scheduleOnRN(commit, index);
    }),
  );
}

/* ---------- Отклик ---------- */

let lastTick = 0;
/** Щелчок на каждом шаге; при быстрой прокрутке — не чаще ~35 раз в секунду */
function tickHaptic() {
  const now = Date.now();
  if (now - lastTick < 28) return;
  lastTick = now;
  Haptics.selectionAsync().catch(() => {});
}

function touchHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/* ---------- Одно число на ленте ---------- */

type ItemProps = {
  abs: number;
  text: string;
  pos: SharedValue<number>;
  align: 'left' | 'right';
  strongColor: string;
  weakColor: string;
};

const WheelItem = memo(function WheelItem({ abs, text, pos, align, strongColor, weakColor }: ItemProps) {
  const place = useAnimatedStyle(() => ({ transform: [{ translateY: MID - ITEM / 2 + abs * PITCH - pos.value }] }));
  // Размер 17 → 12 по расстоянию до рамки; крупный слой гаснет, мелкий проявляется (середина — на полпути)
  const strong = useAnimatedStyle(() => {
    const d = distance(abs, pos.value);
    return { opacity: clamp01(1.5 - 2 * d), transform: [{ scale: (SIZE_MID - (SIZE_MID - SIZE_SIDE) * d) / SIZE_MID }] };
  });
  const weak = useAnimatedStyle(() => {
    const d = distance(abs, pos.value);
    return { opacity: clamp01(2 * d - 0.5), transform: [{ scale: (SIZE_MID - (SIZE_MID - SIZE_SIDE) * d) / SIZE_SIDE }] };
  });
  const layer = align === 'right' ? styles.layerRight : styles.layerLeft;
  return (
    <Animated.View pointerEvents="none" style={[styles.item, place]}>
      <Animated.View style={[layer, weak]}>
        <Text style={[ET.wheel, { color: weakColor }]}>{text}</Text>
      </Animated.View>
      <Animated.View style={[layer, strong]}>
        <Text style={[ET.wheelCurrent, { color: strongColor }]}>{text}</Text>
      </Animated.View>
    </Animated.View>
  );
});

/* ---------- Колонка ---------- */

type ColumnProps = {
  /** Значений в круге: 24 часа или 12 шагов по 5 минут */
  count: number;
  /** Текущее значение 0…count−1 */
  value: number;
  label: (value: number) => string;
  align: 'left' | 'right';
  accessibilityLabel: string;
  /** carry — сколько раз лента прошла через 0 (вперёд +1, назад −1): для переноса минут в часы */
  onChange?: (value: number, carry: number) => void;
};

const WheelColumn = memo(function WheelColumn({ count, value, label, align, accessibilityLabel, onChange }: ColumnProps) {
  const { c } = useTheme();
  /** Позиция ленты в px: число с «абсолютным» номером k стоит в рамке при pos = k·PITCH */
  const pos = useSharedValue(value * PITCH);
  const start = useSharedValue(0);
  const touch = useSharedValue(0);
  /** Палец на колонке или колесо докручивается после него — щелчки только в это время */
  const active = useSharedValue(false);
  /** Номер в центре ленты: вокруг него смонтированы ±SLOTS чисел */
  const [anchor, setAnchor] = useState(value);
  /** Абсолютный номер, на котором колесо стоит (или куда едет) */
  const settled = useRef(value);
  /** Абсолютный номер последнего значения, ушедшего наружу: от него считаем круги для переноса */
  const committed = useRef(value);
  const latest = useRef({ value, count, onChange });
  latest.current = { value, count, onChange };

  const commit = useCallback(
    (index: number) => {
      active.value = false;
      settled.current = index;
      setAnchor(index);
      const { value: cur, count: n, onChange: cb } = latest.current;
      const next = mod(index, n);
      const carry = Math.floor(index / n) - Math.floor(committed.current / n);
      committed.current = index;
      if (next !== cur || carry) cb?.(next, carry);
    },
    [active],
  );

  const onStep = useCallback((index: number, haptic: boolean) => {
    setAnchor(index);
    if (haptic) tickHaptic();
  }, []);

  useAnimatedReaction(
    () => Math.round(pos.value / PITCH),
    (cur, prev) => {
      if (prev !== null && cur !== prev) scheduleOnRN(onStep, cur, active.value);
    },
  );

  // Значение поменяли снаружи (другой край периода, «сейчас») — едем коротким путём, без щелчков
  useEffect(() => {
    const cur = mod(settled.current, count);
    if (cur === value) return;
    let diff = value - cur;
    if (diff > count / 2) diff -= count;
    else if (diff < -count / 2) diff += count;
    const target = settled.current + diff;
    settled.current = target;
    committed.current = target;
    setAnchor(target);
    pos.value = withTiming(target * PITCH, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [value, count, pos]);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        // Вертикаль забираем сразу (раньше прокрутки формы), горизонталь отдаём
        .activeOffsetY([-4, 4])
        .failOffsetX([-14, 14])
        .shouldCancelWhenOutside(false)
        .onBegin(() => {
          cancelAnimation(pos);
          active.value = true;
          touch.value = withTiming(1, { duration: 90 });
          scheduleOnRN(touchHaptic);
        })
        .onStart(() => {
          start.value = pos.value;
        })
        .onUpdate((e) => {
          // Палец вверх — лента вверх, значения растут
          pos.value = start.value - e.translationY;
        })
        .onFinalize((e, success) => {
          touch.value = withTiming(0, { duration: 160 });
          if (success) {
            fling(pos, -e.velocityY, commit);
            return;
          }
          const nearest = Math.round(pos.value / PITCH);
          const tap = Math.abs(e.translationX) < TAP_SLOP && Math.abs(e.translationY) < TAP_SLOP;
          const step = !tap ? 0 : e.y < MID - ROW_MID / 2 ? -1 : e.y > MID + ROW_MID / 2 ? 1 : 0;
          snapTo(pos, nearest + step, commit);
        }),
    [pos, start, touch, active, commit],
  );

  const onAccessibilityAction = useCallback(
    (e: AccessibilityActionEvent) => {
      const step = e.nativeEvent.actionName === 'increment' ? 1 : e.nativeEvent.actionName === 'decrement' ? -1 : 0;
      if (!step) return;
      const target = settled.current + step;
      settled.current = target;
      snapTo(pos, target, commit);
    },
    [pos, commit],
  );

  const highlight = useAnimatedStyle(() => ({ opacity: touch.value }));

  const slots = useMemo(() => Array.from({ length: SLOTS * 2 + 1 }, (_, j) => anchor - SLOTS + j), [anchor]);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ text: label(value) }}
        accessibilityActions={A11Y_ACTIONS}
        onAccessibilityAction={onAccessibilityAction}
        style={styles.column}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.highlight,
            align === 'right' ? styles.highlightRight : styles.highlightLeft,
            { backgroundColor: tint(c.text, 0.06), borderColor: c.hair },
            highlight,
          ]}
        />
        {slots.map((abs) => (
          <WheelItem
            key={abs}
            abs={abs}
            text={label(mod(abs, count))}
            pos={pos}
            align={align}
            strongColor={c.text}
            weakColor={c.muted}
          />
        ))}
      </Animated.View>
    </GestureDetector>
  );
});

const A11Y_ACTIONS = [{ name: 'increment' }, { name: 'decrement' }] as const;

/* ---------- Колесо ---------- */

type WheelProps = TimeValue & {
  /** Шаг минут (делитель 60), по умолчанию 5 */
  step?: number;
  /** Значение встало после прокрутки или тапа */
  onChange?: (value: TimeValue) => void;
  /** «Без времени» включено — колесо приглушено (прокрутка его выключит) */
  dimmed?: boolean;
};

const hourLabel = (h: number) => pad2(h);

export const TimeWheel = memo(function TimeWheel({ hour, minute, step = 5, onChange, dimmed }: WheelProps) {
  const { c } = useTheme();
  const count = Math.round(60 / step);
  // Минуты не кратны шагу (07:03) — держим «фазу», лента 03, 08, 13…
  const phase = mod(minute, step);
  const minuteIndex = Math.floor(mod(minute, 60) / step);
  const latest = useRef({ hour, minute, onChange });
  latest.current = { hour, minute, onChange };

  const minuteLabel = useCallback((i: number) => pad2(i * step + phase), [step, phase]);
  const setHour = useCallback((h: number) => latest.current.onChange?.({ hour: h, minute: latest.current.minute }), []);
  const setMinute = useCallback(
    (i: number, carry: number) =>
      latest.current.onChange?.({ hour: mod(latest.current.hour + carry, 24), minute: i * step + phase }),
    [step, phase],
  );

  return (
    <View style={[styles.wheel, { borderColor: c.border, backgroundColor: c.panel }, dimmed && styles.dimmed]}>
      <View pointerEvents="none" style={[styles.band, { borderColor: c.hair }]} />
      <View style={styles.columns}>
        <WheelColumn
          count={24}
          value={mod(hour, 24)}
          label={hourLabel}
          align="right"
          accessibilityLabel="Часы"
          onChange={setHour}
        />
        <View pointerEvents="none" style={styles.colons}>
          {[-1, 0, 1].map((d) => (
            <View key={d} style={[styles.colonRow, { height: d ? ROW_SIDE : ROW_MID }]}>
              <Text style={[d ? ET.wheel : ET.wheelCurrent, { color: d ? c.muted : c.text }]}>:</Text>
            </View>
          ))}
        </View>
        <WheelColumn
          count={count}
          value={minuteIndex}
          label={minuteLabel}
          align="left"
          accessibilityLabel="Минуты"
          onChange={setMinute}
        />
      </View>
    </View>
  );
});

type TimeRowProps = TimeValue & {
  noTime: boolean;
  step?: number;
  onChange?: (value: TimeValue) => void;
  onToggleNoTime?: () => void;
};

/** Колесо + «БЕЗ ВРЕМЕНИ» */
export const TimeRow = memo(function TimeRow({ hour, minute, step, noTime, onChange, onToggleNoTime }: TimeRowProps) {
  return (
    <View style={styles.timeRow}>
      <TimeWheel hour={hour} minute={minute} step={step} onChange={onChange} dimmed={noTime} />
      <NoTimeButton active={noTime} onPress={onToggleNoTime} />
    </View>
  );
});

const styles = StyleSheet.create({
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wheel: { flex: 1, borderWidth: S.border },
  dimmed: { opacity: 0.4 },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: ROW_SIDE,
    height: ROW_MID + 2 * S.hairline,
    borderTopWidth: S.hairline,
    borderBottomWidth: S.hairline,
  },
  columns: { height: WINDOW, flexDirection: 'row' },
  column: { flex: 1, minWidth: 0, overflow: 'hidden' },
  colons: { width: 12 },
  colonRow: { alignItems: 'center', justifyContent: 'center' },
  item: { position: 'absolute', left: 0, right: 0, top: 0, height: ITEM },
  layerRight: {
    ...StyleSheet.absoluteFill,
    alignItems: 'flex-end',
    justifyContent: 'center',
    transformOrigin: 'right center',
  },
  layerLeft: {
    ...StyleSheet.absoluteFill,
    alignItems: 'flex-start',
    justifyContent: 'center',
    transformOrigin: 'left center',
  },
  highlight: { ...StyleSheet.absoluteFill },
  highlightRight: { borderRightWidth: S.hairline },
  highlightLeft: { borderLeftWidth: S.hairline },
});
