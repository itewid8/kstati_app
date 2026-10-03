/**
 * Слои календаря: у каждого человека группы свой лист.
 *   Вместе — один общий лист: дела всех, ярлыки цвета людей.
 *   Стопкой — листы людей лежат стопкой в 3D; нажатие на лист открывает его.
 *   Один человек — его лист плоско, остальные спрятаны в закладки у правого края.
 * Щипок: развести пальцы — разложить стопкой, свести — склеить в общий. Листы идут за пальцами
 * и доезжают пружиной с их скоростью. Свайп одним пальцем — соседний период (неделя, месяц…).
 */
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { usePalette } from '@/lib/colors';
import { useStore, type LayerMode } from '@/lib/store';
import type { ID } from '@/lib/types';
import { font, useColors } from '@/theme';
import { T } from './ui';

/** Ширина закладки у правого края */
export const TAB_W = 22;
const TAB_H = 76;
const SPRING = { duration: 400, dampingRatio: 0.85 };
/** Насколько щипок двигает склейку: развести пальцы в ~1,5 раза — стопка */
const PINCH_GAIN = 1.8;

const clamp01 = (v: number) => {
  'worklet';
  return Math.min(1, Math.max(0, v));
};

/** Куда доехать листам: p — насколько разложены стопкой, f — насколько открыт один, fi — какой */
function targets(mode: LayerMode, members: ID[]) {
  if (mode.kind === 'together') return { p: 0, f: 0, fi: -1 };
  const fi = mode.kind === 'focus' ? members.indexOf(mode.id) : -1;
  // Открытого человека уже нет в группе — как стопка
  if (mode.kind === 'stack' || fi < 0) return { p: 1, f: 0, fi: -1 };
  return { p: 1, f: 1, fi };
}

export function CalendarLayers({
  members,
  render,
  period,
  onSwipe,
  onPinching,
}: {
  /** Листы снизу вверх */
  members: ID[];
  /** Содержимое листа: null — общий, иначе дела одного человека. pinching — сейчас щипок (прокрутку выключить) */
  render: (person: ID | null, pinching: boolean) => React.ReactNode;
  /** Показанный период (масштаб и дата): сменился после свайпа — новый въезжает */
  period: string;
  /** Свайп влево (1) / вправо (-1) — соседний период */
  onSwipe: (dir: 1 | -1) => void;
  /** Щипок начался/закончился — экрану выключить «потянуть для обновления» */
  onPinching?: (v: boolean) => void;
}) {
  const pal = usePalette();
  const users = useStore((s) => s.users);
  const mode = useStore((s) => s.layers);
  const setLayers = useStore((s) => s.setLayers);
  const reduced = useReducedMotion();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [pinching, setPinching] = useState(false);
  // Листы людей монтируем чуть позже общего (не мешаем первому показу) и дальше держим готовыми к щипку
  const [mounted, setMounted] = useState(mode.kind !== 'together');

  const start = targets(mode, members);
  const p = useSharedValue(start.p);
  const f = useSharedValue(start.f);
  const fi = useSharedValue(start.fi);
  const p0 = useSharedValue(0);
  const f0 = useSharedValue(0);
  const tx = useSharedValue(0);
  const fade = useSharedValue(1);
  /** Режим, к которому листы уже едут (после щипка — чтобы не перезапускать пружину без скорости) */
  const settled = useRef<LayerMode>(mode);
  const key = members.join(',');

  // В группе один человек — слоёв нет; человек ушёл из группы — его лист не открыт
  const layered = members.length > 1;
  useEffect(() => {
    if (!layered && mode.kind !== 'together') setLayers({ kind: 'together' });
    else if (mode.kind === 'focus' && !members.includes(mode.id)) setLayers({ kind: 'stack' });
  }, [mode, key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!layered || mounted) return;
    const timer = setTimeout(() => setMounted(true), 700);
    return () => clearTimeout(timer);
  }, [layered, mounted]);

  useEffect(() => {
    const t = targets(mode, members);
    if (t.fi >= 0) fi.set(t.fi);
    if (mode.kind !== 'together') setMounted(true);
    if (settled.current === mode) return;
    settled.current = mode;
    p.set(reduced ? withTiming(t.p, { duration: 0 }) : withSpring(t.p, SPRING));
    f.set(reduced ? withTiming(t.f, { duration: 0 }) : withSpring(t.f, SPRING));
  }, [mode, key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    onPinching?.(pinching);
  }, [pinching]); // eslint-disable-line react-hooks/exhaustive-deps

  const begin = () => {
    setMounted(true);
    setPinching(true);
  };
  const commit = (kind: LayerMode['kind']) => {
    const cur = useStore.getState().layers;
    // «Открыт один» без открытого (щипок начался посреди перехода) — стопка
    const next: LayerMode = kind === 'focus' ? (cur.kind === 'focus' ? cur : { kind: 'stack' }) : { kind };
    if (next.kind !== cur.kind) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    // Пружины уже едут туда — эффект их не перезапускает; иначе он поправит
    if (next.kind === kind) settled.current = next;
    setLayers(next);
  };

  const pinch = Gesture.Pinch()
    .enabled(layered)
    .onTouchesDown((e) => {
      if (e.numberOfTouches === 2) scheduleOnRN(begin);
    })
    .onStart(() => {
      cancelAnimation(p);
      cancelAnimation(f);
      p0.set(p.get());
      f0.set(f.get());
    })
    .onUpdate((e) => {
      const d = (e.scale - 1) * PINCH_GAIN;
      if (f0.get() > 0.5) {
        // Открыт один человек: свести — склеить всех, развести — обратно в стопку
        if (d < 0) {
          f.set(clamp01(f0.get() + d));
          p.set(clamp01(p0.get() + d));
        } else {
          f.set(clamp01(f0.get() - d));
          p.set(p0.get());
        }
      } else {
        p.set(clamp01(p0.get() + d));
      }
    })
    .onEnd((e) => {
      const v = e.velocity * PINCH_GAIN;
      let kind: LayerMode['kind'];
      if (f0.get() > 0.5) kind = f.get() > 0.5 ? 'focus' : p.get() > 0.5 ? 'stack' : 'together';
      else kind = p.get() + v * 0.15 > 0.5 ? 'stack' : 'together';
      p.set(withSpring(kind === 'together' ? 0 : 1, { ...SPRING, velocity: v }));
      f.set(withSpring(kind === 'focus' ? 1 : 0, SPRING));
      scheduleOnRN(commit, kind);
    })
    .onFinalize(() => {
      scheduleOnRN(setPinching, false);
    });

  // Свайп одним пальцем — соседний период. Старый уезжает, новый въезжает, когда React его нарисовал
  const pending = useRef<{ dir: number; timer?: ReturnType<typeof setTimeout> }>({ dir: 0 });
  const slideIn = () => {
    const dir = pending.current.dir;
    clearTimeout(pending.current.timer);
    pending.current = { dir: 0 };
    tx.set(reduced ? 0 : dir * box.w * 0.35);
    tx.set(withTiming(0, { duration: 160 }));
    fade.set(withTiming(1, { duration: 160 }));
  };
  const swiped = (dir: 1 | -1) => {
    pending.current = { dir, timer: setTimeout(slideIn, 400) };
    onSwipe(dir);
  };
  useEffect(() => {
    if (pending.current.dir) slideIn();
  }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

  const swipe = Gesture.Pan()
    .maxPointers(1)
    .activeOffsetX([-20, 20])
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      if (!reduced) tx.set(e.translationX * 0.5);
    })
    .onEnd((e, success) => {
      const dx = e.translationX;
      if (!success || (Math.abs(dx) < 70 && Math.abs(e.velocityX) < 600)) {
        tx.set(withSpring(0, { ...SPRING, velocity: e.velocityX * 0.5 }));
        return;
      }
      const dir = dx < 0 ? 1 : -1;
      fade.set(withTiming(0, { duration: 120 }));
      tx.set(
        withTiming(reduced ? 0 : -dir * box.w * 0.35, { duration: 120 }, (finished) => {
          if (finished) scheduleOnRN(swiped, dir as 1 | -1);
          else fade.set(withTiming(1, { duration: 120 }));
        }),
      );
    });

  const both = Gesture.Simultaneous(pinch, swipe);
  const stage = useAnimatedStyle(() => ({ opacity: fade.get(), transform: [{ translateX: tx.get() }] }));
  const merged = useAnimatedStyle(() => ({ opacity: 1 - clamp01(Math.max(p.get(), f.get()) * 2) }));
  const tabs = useAnimatedStyle(() => ({ opacity: clamp01(Math.max(p.get(), f.get()) * 2) }));

  const focusId = mode.kind === 'focus' ? mode.id : null;
  const nameOf = (id: ID) => (id === useStore.getState().me?.id ? 'Я' : (users.find((u) => u.id === id)?.name ?? '—'));
  const showSheets = mounted && members.length > 0;

  return (
    <GestureDetector gesture={both}>
      <View collapsable={false} style={{ flex: 1 }} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        <Animated.View style={[{ flex: 1 }, stage]}>
          <Animated.View style={[StyleSheet.absoluteFill, merged]} pointerEvents={mode.kind === 'together' ? 'auto' : 'none'}>
            {render(null, pinching)}
          </Animated.View>
          {showSheets &&
            members.map((id, i) => (
              <Sheet
                key={id}
                index={i}
                count={members.length}
                p={p}
                f={f}
                fi={fi}
                box={box}
                mode={mode}
                focused={focusId === id}
                pinching={pinching}
                onOpen={() => setLayers({ kind: 'focus', id })}
              >
                {render(id, pinching)}
              </Sheet>
            ))}
        </Animated.View>
        {/* Закладки людей у правого края: видны, когда календари разложены */}
        {showSheets && (
          <Animated.View style={[styles.tabs, tabs]} pointerEvents={mode.kind === 'together' ? 'none' : 'box-none'}>
            {members.map((id) => {
              const active = focusId === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => setLayers(active ? { kind: 'stack' } : { kind: 'focus', id })}
                  hitSlop={{ left: 10, top: 2, bottom: 2 }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={nameOf(id)}
                  style={[styles.tab, { backgroundColor: pal.of(id), width: active ? TAB_W + 6 : TAB_W }]}
                >
                  <T numberOfLines={1} style={[styles.tabText, { color: '#FFFFFF', fontFamily: active ? font.semibold : font.medium }]}>
                    {nameOf(id)}
                  </T>
                </Pressable>
              );
            })}
          </Animated.View>
        )}
      </View>
    </GestureDetector>
  );
}

/** Лист одного человека: в стопке наклонён и сдвинут, открытый — плоский, остальные уезжают вправо */
function Sheet({
  index,
  count,
  p: pv,
  f: fv,
  fi: fiv,
  box: b,
  mode: m,
  focused,
  pinching,
  onOpen,
  children,
}: {
  index: number;
  count: number;
  p: SharedValue<number>;
  f: SharedValue<number>;
  fi: SharedValue<number>;
  box: { w: number; h: number };
  mode: LayerMode;
  focused: boolean;
  pinching: boolean;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  const c = useColors();
  const style = useAnimatedStyle(() => {
    const P = pv.get();
    const F = fv.get();
    const isFocus = fiv.get() === index;
    // Насколько лист лежит в стопке: открытый по мере открытия выпрямляется
    const s = isFocus ? P * (1 - F) : P;
    const gap = Math.min(120, (b.h * 0.45) / Math.max(1, count - 1));
    const away = isFocus ? 0 : F;
    return {
      opacity: clamp01(Math.max(P, F) * 2) * (1 - away),
      transform: [
        { perspective: 1200 },
        { translateX: away * b.w * 0.5 },
        { translateY: ((count - 1) / 2 - index) * gap * s },
        { rotateX: `${48 * s}deg` },
        { rotateZ: `${-20 * s}deg` },
        { scale: 1 - 0.34 * s },
      ],
    };
  });
  const interactive = m.kind === 'focus' && focused;
  return (
    <Animated.View
      style={[styles.sheet, { backgroundColor: c.background, borderColor: c.border }, style]}
      // Пока щипок, лист рисуется готовой картинкой — дешевле крутить
      renderToHardwareTextureAndroid={pinching}
      pointerEvents={m.kind === 'stack' || interactive ? 'auto' : 'none'}
    >
      <View style={{ flex: 1 }} pointerEvents={interactive ? 'auto' : 'none'}>
        {children}
      </View>
      {m.kind === 'stack' && <Pressable style={StyleSheet.absoluteFill} onPress={onOpen} accessibilityRole="button" />}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    right: TAB_W,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  tabs: { position: 'absolute', right: 0, top: 56, alignItems: 'flex-end', gap: 4 },
  tab: { height: TAB_H, borderTopLeftRadius: 6, borderBottomLeftRadius: 6, alignItems: 'center', justifyContent: 'center' },
  tabText: { width: TAB_H - 8, textAlign: 'center', fontSize: 11, lineHeight: 14, transform: [{ rotate: '-90deg' }] },
});
