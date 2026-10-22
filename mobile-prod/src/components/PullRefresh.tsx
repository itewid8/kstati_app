/**
 * «Потянуть вниз, чтобы обновить» — одинаково из любой точки экрана.
 *
 * Как устроено:
 *   PullScreen оборачивает экран целиком одним жестом. Жест включается, только если палец идёт вниз
 *   (не вбок, не вверх, одним пальцем) и прокрутка экрана стоит в самом верху — тогда тянуть больше некуда,
 *   и движение достаётся обновлению. Иначе жест сразу отказывается, и работают прокрутка, свайпы и нажатия.
 *   Прокрутки экрана — PullScrollView: сообщают, где стоят, и не перехватывают жест обновления.
 *   Крутилка одна на всё приложение — сверху поверх экрана (PullIndicator): идёт за пальцем,
 *   отпустил раньше порога — уезжает обратно, дальше порога — крутится, пока идёт обновление.
 */
import React, { createContext, forwardRef, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler';
import Animated, { interpolate, makeMutable, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { fetchActivity, syncNow } from '@/lib/sync';
import { useColors } from '@/theme';

/** Дольше крутилку не держим: синхронизация доделается в фоне, а экран не выглядит зависшим */
const MAX_MS = 8_000;
/** Сколько потянуть вниз, чтобы обновить */
const PULL_PX = 140;
/** Сдвиг пальца, после которого понятно направление */
const SLOP = 12;

/* ---------- одно обновление на всё приложение ---------- */

let busy = false;
const listeners = new Set<() => void>();
/** То же для жестов (UI-поток): пока идёт обновление, новое не начинаем */
const busyUI = makeMutable(false);
const setBusy = (v: boolean) => {
  busy = v;
  busyUI.set(v);
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const useBusy = () => useSyncExternalStore(subscribe, () => busy);

/**
 * Обновить: сразу отправить несохранённое и забрать новое с сервера.
 * Не меньше 400 мс — чтобы было видно, что сработало, и не больше 8 с — при плохой связи.
 */
export async function refreshAll() {
  if (busy) return;
  setBusy(true);
  try {
    const work = syncNow().then(() => fetchActivity(true)).catch(() => {});
    await Promise.all([Promise.race([work, new Promise((r) => setTimeout(r, MAX_MS))]), new Promise((r) => setTimeout(r, 400))]);
  } catch {
    /* ошибки синхронизации показывает строка состояния сети */
  } finally {
    setBusy(false);
  }
}

/* ---------- жест на весь экран ---------- */

/** Насколько потянули: 1 — достаточно, чтобы обновить */
const pull = makeMutable(0);

/** Экран: стоит ли его прокрутка в самом верху (нет прокрутки — тоже верх) и ссылка на жест обновления */
type Ctx = { atTop: SharedValue<boolean>; pan: React.RefObject<GestureType | undefined> };
const PullCtx = createContext<Ctx | null>(null);

/** Экран, который обновляется потягиванием вниз из любой точки. Его прокрутки — PullScrollView */
export function PullScreen({ children }: { children: React.ReactNode }) {
  const atTop = useSharedValue(true);
  const x0 = useSharedValue(0);
  const y0 = useSharedValue(0);
  const panRef = useRef<GestureType | undefined>(undefined);

  const pan = Gesture.Pan()
    .withRef(panRef)
    .manualActivation(true)
    .maxPointers(1)
    .onTouchesDown((e) => {
      const t = e.allTouches[0];
      if (!t) return;
      x0.set(t.absoluteX);
      y0.set(t.absoluteY);
    })
    .onTouchesMove((e, state) => {
      const t = e.allTouches[0];
      if (!t || e.numberOfTouches > 1) {
        state.fail();
        return;
      }
      const dx = t.absoluteX - x0.get();
      const dy = t.absoluteY - y0.get();
      // Вбок или вверх — это не обновление: отдаём свайпам и прокрутке
      if ((Math.abs(dx) > SLOP && Math.abs(dx) >= dy) || dy < -SLOP / 2) {
        state.fail();
        return;
      }
      if (dy > SLOP) {
        if (atTop.get() && !busyUI.get()) state.activate();
        else state.fail();
      }
    })
    .onUpdate((e) => {
      pull.set(Math.max(0, e.translationY) / PULL_PX);
    })
    .onEnd((e) => {
      if (e.translationY > PULL_PX) scheduleOnRN(refreshAll);
    })
    .onFinalize(() => {
      if (pull.get() > 0) pull.set(withTiming(0, { duration: 200 }));
    });

  return (
    <PullCtx.Provider value={{ atTop, pan: panRef }}>
      <GestureDetector gesture={pan}>
        <View collapsable={false} style={{ flex: 1 }}>
          {children}
        </View>
      </GestureDetector>
    </PullCtx.Provider>
  );
}

/**
 * Прокрутка внутри PullScreen. Сообщает, стоит ли в самом верху, и работает вместе с жестом обновления:
 * не в верху — палец тянет прокрутку, в верху и вниз — тянет обновление. Без «резинки» у края — её заменяет крутилка
 */
export const PullScrollView = forwardRef<ScrollView, ScrollViewProps>(function PullScrollView({ onScroll, ...props }, ref) {
  const ctx = useContext(PullCtx);
  useEffect(() => {
    ctx?.atTop.set(true);
  }, [ctx]);
  const native = useMemo(() => {
    const g = Gesture.Native();
    return ctx ? g.simultaneousWithExternalGesture(ctx.pan as React.RefObject<GestureType>) : g;
  }, [ctx]);
  return (
    <GestureDetector gesture={native}>
      <ScrollView
        ref={ref}
        overScrollMode="never"
        bounces={false}
        scrollEventThrottle={16}
        {...props}
        onScroll={(e) => {
          ctx?.atTop.set(e.nativeEvent.contentOffset.y <= 1);
          onScroll?.(e);
        }}
      />
    </GestureDetector>
  );
});

/* ---------- крутилка ---------- */

/** Крутилка сверху поверх всего экрана: идёт за пальцем и крутится, пока идёт обновление */
export function PullIndicator() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const refreshing = useBusy();
  const shown = useShown(refreshing);
  // Ниже шапки: крутилка не прячется под вырезом камеры и видна там, куда тянет палец
  const top = insets.top + 84;
  const style = useAnimatedStyle(() => {
    const p = Math.max(Math.min(pull.get(), 1), shown.get());
    return {
      opacity: Math.min(1, p * 1.5),
      transform: [{ translateY: interpolate(p, [0, 1], [-56, top]) }, { rotate: `${Math.min(pull.get(), 1.5) * 270}deg` }],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.indicator, { backgroundColor: c.surface, borderColor: c.border }, style]}>
      <ActivityIndicator size="small" color={c.text} animating={refreshing} hidesWhenStopped={false} />
    </Animated.View>
  );
}

/** 1, пока идёт обновление (крутилка стоит сверху), плавно 0 — когда закончилось */
const shownValue = makeMutable(0);
function useShown(refreshing: boolean) {
  useEffect(() => {
    shownValue.set(withTiming(refreshing ? 1 : 0, { duration: 200 }));
  }, [refreshing]);
  return shownValue;
}

const styles = StyleSheet.create({
  indicator: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
});
