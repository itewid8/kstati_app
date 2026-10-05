/**
 * Сцена календаря: содержимое масштаба, закладки людей у правого края и жесты.
 *   Закладки — фильтр по людям группы: нажал на человека — видны только его дела, ещё раз — снова все.
 *   Свайп одним пальцем — соседний период: старый уезжает, новый въезжает, когда React его нарисовал.
 *   Щипок: свести пальцы — крупнее (день → неделя → месяц → год), развести — мельче.
 *   Масштаб переключается сразу, как только пальцы свели/развели на ~12%, один раз за щипок.
 */
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { inkOn, usePalette } from '@/lib/colors';
import { useStore } from '@/lib/store';
import type { ID } from '@/lib/types';
import { font } from '@/theme';
import { T } from './ui';

/** Ширина закладки у правого края */
export const TAB_W = 22;
const TAB_H = 76;
const SPRING = { duration: 400, dampingRatio: 0.85 };

export function CalendarStage({
  members,
  person,
  onPerson,
  period,
  onSwipe,
  onZoomStep,
  onPinching,
  children,
}: {
  /** Закладки: люди группы (меньше двух — закладок нет) */
  members: ID[];
  /** Чьи дела показаны: null — всех */
  person: ID | null;
  onPerson: (id: ID | null) => void;
  /** Показанный период (масштаб и дата): сменился после свайпа — новый въезжает */
  period: string;
  /** Свайп влево (1) / вправо (-1) — соседний период */
  onSwipe: (dir: 1 | -1) => void;
  /** Щипок: 1 — крупнее период, -1 — мельче */
  onZoomStep: (step: 1 | -1) => void;
  /** Щипок начался/закончился — экрану выключить прокрутку и «потянуть для обновления» */
  onPinching?: (v: boolean) => void;
  children: React.ReactNode;
}) {
  const pal = usePalette();
  const users = useStore((s) => s.users);
  const meId = useStore((s) => s.me?.id);
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const tabs = members.length > 1;

  const tx = useSharedValue(0);
  const fade = useSharedValue(1);
  const scale = useSharedValue(1);
  /** В этом касании был второй палец — свайп не считается */
  const twoFingers = useSharedValue(false);
  /** Масштаб уже переключён в этом щипке */
  const fired = useSharedValue(false);

  // Свайп: новый период въезжает, когда React его нарисовал (или через 400 мс, если период не сменился)
  const pending = useRef<{ dir: number; timer?: ReturnType<typeof setTimeout> }>({ dir: 0 });
  const slideIn = () => {
    const dir = pending.current.dir;
    clearTimeout(pending.current.timer);
    pending.current = { dir: 0 };
    tx.set(reduced ? 0 : dir * width * 0.35);
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

  const zoom = (step: 1 | -1) => {
    Haptics.selectionAsync().catch(() => {});
    onZoomStep(step);
  };
  const setPinching = (v: boolean) => onPinching?.(v);

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      twoFingers.set(false);
      fired.set(false);
    })
    .onTouchesDown((e) => {
      if (e.numberOfTouches >= 2 && !twoFingers.get()) {
        twoFingers.set(true);
        tx.set(withTiming(0, { duration: 100 }));
        scheduleOnRN(setPinching, true);
      }
    })
    .onUpdate((e) => {
      scale.set(Math.max(0.92, Math.min(1.08, 1 + (e.scale - 1) * 0.5)));
      if (fired.get()) return;
      if (e.scale < 0.88) {
        fired.set(true);
        scheduleOnRN(zoom, 1);
      } else if (e.scale > 1.14) {
        fired.set(true);
        scheduleOnRN(zoom, -1);
      }
    })
    .onFinalize(() => {
      scale.set(withTiming(1, { duration: 150 }));
      if (twoFingers.get()) scheduleOnRN(setPinching, false);
    });

  const swipe = Gesture.Pan()
    .maxPointers(1)
    .activeOffsetX([-20, 20])
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      if (twoFingers.get()) return;
      if (!reduced) tx.set(e.translationX * 0.5);
    })
    .onEnd((e, success) => {
      const dx = e.translationX;
      if (!success || twoFingers.get() || (Math.abs(dx) < 70 && Math.abs(e.velocityX) < 600)) {
        tx.set(withSpring(0, { ...SPRING, velocity: e.velocityX * 0.5 }));
        return;
      }
      const dir = dx < 0 ? 1 : -1;
      fade.set(withTiming(0, { duration: 120 }));
      tx.set(
        withTiming(reduced ? 0 : -dir * width * 0.35, { duration: 120 }, (finished) => {
          if (finished) scheduleOnRN(swiped, dir as 1 | -1);
          else fade.set(withTiming(1, { duration: 120 }));
        }),
      );
    });

  const both = Gesture.Simultaneous(pinch, swipe);
  const stage = useAnimatedStyle(() => ({ opacity: fade.get(), transform: [{ translateX: tx.get() }, { scale: scale.get() }] }));
  const nameOf = (id: ID) => (id === meId ? 'Я' : (users.find((u) => u.id === id)?.name ?? '—'));

  return (
    <GestureDetector gesture={both}>
      <View collapsable={false} style={{ flex: 1 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <Animated.View style={[{ flex: 1, marginRight: tabs ? TAB_W : 0 }, stage]}>{children}</Animated.View>
        {/* Закладки людей: нажал — только его дела, ещё раз — снова все */}
        {tabs && (
          <View style={styles.tabs} pointerEvents="box-none">
            {members.map((id) => {
              const active = person === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => onPerson(active ? null : id)}
                  hitSlop={{ left: 10, top: 2, bottom: 2 }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={nameOf(id)}
                  style={[
                    styles.tab,
                    { backgroundColor: pal.of(id), width: active ? TAB_W + 4 : TAB_W },
                    person && !active ? { opacity: 0.35 } : null,
                  ]}
                >
                  <T numberOfLines={1} style={[styles.tabText, { color: inkOn(pal.of(id)), fontFamily: active ? font.semibold : font.medium }]}>
                    {nameOf(id)}
                  </T>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  tabs: { position: 'absolute', right: 0, top: 52, alignItems: 'flex-end', gap: 4 },
  tab: { height: TAB_H, borderTopLeftRadius: 6, borderBottomLeftRadius: 6, alignItems: 'center', justifyContent: 'center' },
  tabText: { width: TAB_H - 8, textAlign: 'center', fontSize: 11, lineHeight: 14, transform: [{ rotate: '-90deg' }] },
});
