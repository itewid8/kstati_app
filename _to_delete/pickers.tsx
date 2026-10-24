/**
 * Свои выбор даты и времени.
 *   Дата — календарь с масштабом: месяц ⇄ год (тап по заголовку или щипок), стрелки листают месяцы или годы.
 *   Время — два барабана, как на iPhone: медленно тянете — по одной минуте, смахиваете — пролетает
 *   по инерции и плавно доезжает до ближайшего значения. Каждый барабан занимает половину ширины —
 *   крутить можно за любое место, не целясь в цифры.
 * Подтверждение — повторный тап по выбранному (дню или числу в центре барабана), без кнопки «Готово».
 */
import * as Haptics from 'expo-haptics';
import { ChevronLeft, ChevronRight } from '@/components/icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSheetDragBlock } from './Sheet';
import { FlatList, Pressable, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { addMonths, fromISODate, monthGrid, monthTitle, startOfMonth, toISODate, WEEKDAYS_SHORT } from '@/lib/dates';
import { font, ICON, useColors } from '@/theme';
import { Button, T } from './ui';

const pad2 = (n: number) => String(n).padStart(2, '0');

let lastTick = 0;
const tick = () => {
  const now = Date.now();
  if (now - lastTick < 28) return; // при быстрой прокрутке — не чаще ~35 раз в секунду
  lastTick = now;
  Haptics.selectionAsync().catch(() => {});
};

/** Сбрасывает контекст внешнего ScrollView для вложенного списка с собственной высотой */
const ScrollContext = (ScrollView as unknown as { Context: React.Context<unknown> }).Context;
const NoOuterScroll = ({ children }: { children: React.ReactNode }) => <ScrollContext.Provider value={null}>{children}</ScrollContext.Provider>;

/* ================= Время: барабаны ================= */

const ITEM = 44; // высота строки
const VISIBLE = 5; // выбранная по центру и по две сверху/снизу
const PAD = 2; // пустые строки по краям списка
const LOOPS = 60; // круговой барабан: значения повторены, стартуем с середины

function Wheel({
  items,
  index,
  onChange,
  onConfirm,
  align,
}: {
  items: string[];
  index: number;
  onChange: (i: number) => void;
  /** Тап по значению в центре */
  onConfirm: () => void;
  align: 'left' | 'right';
}) {
  const n = items.length;
  const total = n * LOOPS;
  const base = n * Math.floor(LOOPS / 2);
  const data = useMemo(() => Array.from({ length: total + PAD * 2 }, (_, i) => i - PAD), [total]);
  // Барабан крутят вверх-вниз — шторку при этом не тянем
  const blockSheetDrag = useSheetDragBlock();
  const listRef = useRef<FlatList<number>>(null);
  const y = useSharedValue((base + index) * ITEM);
  const lastPos = useSharedValue(base + index);
  /** Позиция, на которой барабан стоит (или куда доезжает) */
  const settled = useRef(base + index);
  const dragTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      y.value = e.contentOffset.y;
      const p = Math.round(e.contentOffset.y / ITEM);
      if (p !== lastPos.value) {
        lastPos.value = p;
        runOnJS(tick)();
      }
    },
  });

  const valueAt = (p: number) => ((p % n) + n) % n;

  /** Барабан остановился: плавно доводим до ближайшей строки и сообщаем значение */
  const settle = (offset: number) => {
    const p = Math.max(0, Math.min(total - 1, Math.round(offset / ITEM)));
    settled.current = p;
    const v = valueAt(p);
    if (v !== index) onChange(v);
    if (Math.abs(offset - p * ITEM) > 0.5) {
      listRef.current?.scrollToOffset({ offset: p * ITEM, animated: true });
    } else if (Math.abs(p - (base + v)) > n * 10) {
      // Далеко ушли по кругу — незаметно возвращаемся на то же значение в середине
      settled.current = base + v;
      listRef.current?.scrollToOffset({ offset: (base + v) * ITEM, animated: false });
    }
  };

  const goTo = (p: number) => {
    settled.current = p;
    const v = valueAt(p);
    if (v !== index) onChange(v);
    listRef.current?.scrollToOffset({ offset: p * ITEM, animated: true });
  };

  // Значение поменяли снаружи — докручиваем по короткому пути
  useEffect(() => {
    const cur = valueAt(settled.current);
    if (cur === index) return;
    let target = settled.current - cur + index;
    if (Math.abs(index - cur) > n / 2) target += index > cur ? -n : n;
    settled.current = target;
    listRef.current?.scrollToOffset({ offset: target * ITEM, animated: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const clearDrag = () => {
    if (dragTimer.current) clearTimeout(dragTimer.current);
    dragTimer.current = null;
  };
  const endDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const off = e.nativeEvent.contentOffset.y;
    // Отпустили без рывка — инерции не будет, доводим сами
    dragTimer.current = setTimeout(() => settle(off), 80);
  };

  return (
    <View style={{ flex: 1, height: ITEM * VISIBLE }} onTouchStart={blockSheetDrag}>
      {/* Барабан лежит внутри прокручиваемой карточки. У него своя фиксированная высота, поэтому
          вложенность безопасна — отвязываем его от внешней прокрутки, иначе React Native ругается
          «VirtualizedLists should never be nested inside plain ScrollViews». */}
      <NoOuterScroll>
      <Animated.FlatList
        ref={listRef}
        data={data}
        keyExtractor={(p) => String(p)}
        renderItem={({ item: p }) =>
          p < 0 || p >= total ? (
            <View style={{ height: ITEM }} />
          ) : (
            <WheelRow
              p={p}
              y={y}
              label={items[p % n]}
              align={align}
              onPress={() => (p === settled.current ? onConfirm() : goTo(p))}
            />
          )
        }
        getItemLayout={(_, i) => ({ length: ITEM, offset: ITEM * i, index: i })}
        initialScrollIndex={base + index}
        // Без жёсткого защёлкивания: барабан тормозит сам, а потом плавно доезжает до строки
        decelerationRate="normal"
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        overScrollMode="never"
        onScroll={onScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={clearDrag}
        onScrollEndDrag={endDrag}
        onMomentumScrollBegin={clearDrag}
        onMomentumScrollEnd={(e) => settle(e.nativeEvent.contentOffset.y)}
        initialNumToRender={VISIBLE + PAD * 2}
        maxToRenderPerBatch={12}
        windowSize={5}
      />
      </NoOuterScroll>
    </View>
  );
}

/** Строка барабана: дальше от центра — бледнее */
function WheelRow({
  p,
  y,
  label,
  align,
  onPress,
}: {
  p: number;
  y: SharedValue<number>;
  label: string;
  align: 'left' | 'right';
  onPress: () => void;
}) {
  const c = useColors();
  // Только затухание к краям: наклон и уменьшение на широких строках «гнули» столбик цифр
  const style = useAnimatedStyle(() => {
    const ad = Math.abs((p * ITEM - y.value) / ITEM);
    return { opacity: interpolate(ad, [0, 1, 2, 3], [1, 0.45, 0.2, 0.08], Extrapolation.CLAMP) };
  });
  return (
    // Строка во всю ширину половины панели — попадать в цифру не нужно
    <Pressable onPress={onPress} style={{ height: ITEM, justifyContent: 'center' }}>
      <Animated.View style={style}>
        <T
          style={{
            fontFamily: font.mono,
            fontSize: 24,
            lineHeight: 30,
            textAlign: align,
            color: c.text,
            paddingHorizontal: 14,
          }}
        >
          {label}
        </T>
      </Animated.View>
    </Pressable>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => pad2(i));
const MINUTES = Array.from({ length: 60 }, (_, i) => pad2(i));
const DEFAULT_TIME = '19:00';

/**
 * onPick(value, done): остановка барабана — done=false; повторный тап по времени в центре — done=true.
 * Если времени ещё нет, барабаны стоят на 19:00, и тап по центру его подтверждает.
 */
export function TimePanel({ value, onPick }: { value: string | null; onPick: (hhmm: string, done: boolean) => void }) {
  const c = useColors();
  const [h, m] = (value ?? DEFAULT_TIME).split(':').map(Number);
  const emit = (nh: number, nm: number, done = false) => onPick(`${pad2(nh)}:${pad2(nm)}`, done);
  const confirm = () => emit(h, m, true);
  return (
    <View style={[styles.panel, { borderColor: c.border }]}>
      <View style={{ height: ITEM * VISIBLE, flexDirection: 'row', alignItems: 'center' }}>
        {/* Полоса выбранного значения, как на iPhone */}
        <View pointerEvents="none" style={[styles.band, { backgroundColor: c.border }]} />
        <Wheel items={HOURS} index={h} align="right" onChange={(nh) => emit(nh, m)} onConfirm={confirm} />
        <T style={{ fontFamily: font.mono, fontSize: 24, lineHeight: 30, width: 12, textAlign: 'center' }}>:</T>
        <Wheel items={MINUTES} index={m} align="left" onChange={(nm) => emit(h, nm)} onConfirm={confirm} />
      </View>
    </View>
  );
}

/* ================= Дата: календарь месяц ⇄ год ================= */

const MONTH_SHORT = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

/**
 * onPick — выбран день; onDone — повторный тап по уже выбранному дню (закрыть);
 * «Сегодня» — вернуться к сегодняшнему дню; onClear — «Без даты» (время при этом не сбрасывается).
 * Тап по заголовку месяца — масштаб «год», там стрелки листают годы, тап по месяцу — открыть его.
 */
export function DatePanel({
  value,
  onPick,
  onDone,
  onClear,
}: {
  value: string | null;
  onPick: (iso: string) => void;
  onDone?: () => void;
  onClear?: () => void;
}) {
  const c = useColors();
  const today = toISODate(new Date());
  const [zoom, setZoom] = useState<'month' | 'year'>('month');
  const [month, setMonth] = useState(() => startOfMonth(value ? fromISODate(value) : new Date()));

  const zoomTo = (z: 'month' | 'year') => {
    if (z === zoom) return;
    Haptics.selectionAsync().catch(() => {});
    setZoom(z);
  };
  // Щипок: свести — год, развести — месяц
  const pinch = Gesture.Pinch().onEnd((e) => {
    if (e.scale < 0.88) runOnJS(zoomTo)('year');
    else if (e.scale > 1.14) runOnJS(zoomTo)('month');
  });

  const step = (dir: 1 | -1) => setMonth(zoom === 'month' ? addMonths(month, dir) : addMonths(month, 12 * dir));
  const title = zoom === 'month' ? monthTitle(month) : String(month.getFullYear());

  return (
    <GestureHandlerRootView style={[styles.panel, { borderColor: c.border }]}>
      <GestureDetector gesture={pinch}>
        <View collapsable={false}>
          <View style={styles.nav}>
            <Pressable onPress={() => step(-1)} hitSlop={10} style={styles.arrow}>
              <ChevronLeft size={ICON.size} strokeWidth={ICON.stroke} color={c.text} />
            </Pressable>
            <Pressable
              onPress={() => zoomTo(zoom === 'month' ? 'year' : 'month')}
              hitSlop={8}
              style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.6 : 1 })}
            >
              <T weight="medium" style={{ textAlign: 'center' }}>
                {title}
              </T>
            </Pressable>
            <Pressable onPress={() => step(1)} hitSlop={10} style={styles.arrow}>
              <ChevronRight size={ICON.size} strokeWidth={ICON.stroke} color={c.text} />
            </Pressable>
          </View>

          {/* Вернуться к сегодня из любого месяца или года; «Без даты» — убрать дату, время не трогаем */}
          <View style={styles.quick}>
            <Button
              kind="text"
              title="Сегодня"
              onPress={() => {
                setMonth(startOfMonth(new Date()));
                setZoom('month');
                onPick(today);
              }}
              style={{ height: 32 }}
            />
            {value ? <Button kind="text" title="Без даты" color={c.textMuted} onPress={() => onClear?.()} style={{ height: 32 }} /> : null}
          </View>

          {zoom === 'month' ? (
            <MonthDays
              month={month}
              value={value}
              today={today}
              onTap={(iso) => (iso === value ? onDone?.() : onPick(iso))}
            />
          ) : (
            <YearMonths
              year={month.getFullYear()}
              value={value}
              today={today}
              onTap={(m) => {
                setMonth(new Date(month.getFullYear(), m, 1));
                zoomTo('month');
              }}
            />
          )}
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

function MonthDays({ month, value, today, onTap }: { month: Date; value: string | null; today: string; onTap: (iso: string) => void }) {
  const c = useColors();
  const days = monthGrid(month);
  const weeks = days[35].getMonth() === month.getMonth() ? 6 : 5;
  return (
    <View>
      <View style={styles.row}>
        {WEEKDAYS_SHORT.map((w) => (
          <T key={w} variant="label" muted style={styles.weekday}>
            {w}
          </T>
        ))}
      </View>
      {Array.from({ length: weeks }, (_, wi) => (
        <View key={wi} style={styles.row}>
          {days.slice(wi * 7, wi * 7 + 7).map((d) => {
            const iso = toISODate(d);
            if (d.getMonth() !== month.getMonth()) return <View key={iso} style={styles.day} />;
            const sel = iso === value;
            const isToday = iso === today;
            return (
              <Pressable key={iso} onPress={() => onTap(iso)} style={styles.day}>
                {({ pressed }) => (
                  <View
                    key={`${sel}-${isToday}`}
                    style={[
                      styles.dayNum,
                      sel && { backgroundColor: c.primary },
                      !sel && isToday && { borderWidth: 1, borderColor: c.text },
                      !sel && pressed && { backgroundColor: c.border },
                    ]}
                  >
                    <T
                      variant="caption"
                      mono={!sel && !isToday}
                      weight={sel || isToday ? 'semibold' : 'regular'}
                      color={sel ? c.onPrimary : iso < today ? c.textMuted : c.text}
                    >
                      {d.getDate()}
                    </T>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function YearMonths({ year, value, today, onTap }: { year: number; value: string | null; today: string; onTap: (m: number) => void }) {
  const c = useColors();
  const key = (m: number) => `${year}-${pad2(m + 1)}`;
  return (
    <View style={styles.months}>
      {MONTH_SHORT.map((label, m) => {
        const sel = !!value && value.startsWith(key(m));
        const isNow = today.startsWith(key(m));
        return (
          <Pressable key={label} onPress={() => onTap(m)} style={styles.monthCell}>
            {({ pressed }) => (
              <View
                key={`${sel}-${isNow}`}
                style={[
                  styles.monthInner,
                  sel && { backgroundColor: c.primary },
                  !sel && isNow && { borderWidth: 1, borderColor: c.text },
                  !sel && pressed && { backgroundColor: c.border },
                ]}
              >
                <T weight={sel || isNow ? 'semibold' : 'regular'} color={sel ? c.onPrimary : c.text}>
                  {label}
                </T>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 12, padding: 8, flexGrow: 0 },
  band: { position: 'absolute', left: 0, right: 0, top: ITEM * PAD, height: ITEM, borderRadius: 10, opacity: 0.55 },
  nav: { flexDirection: 'row', alignItems: 'center', paddingBottom: 2 },
  quick: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: 4 },
  arrow: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', paddingVertical: 4 },
  day: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center' },
  dayNum: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  months: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 4 },
  monthCell: { width: '33.333%', height: 52, padding: 4 },
  monthInner: { flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
