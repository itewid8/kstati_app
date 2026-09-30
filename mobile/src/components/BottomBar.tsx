import * as Haptics from 'expo-haptics';
import { Mic, X } from '@/components/icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '@/lib/store';
import { cancelRecording, holdEnd, holdStart, MAX_MS, recordingStartedAt, toggleRecording, useVoiceLevel } from '@/lib/voice';
import { ICON, motion, useColors } from '@/theme';
import { T } from './ui';

const LABELS: Record<string, string> = { tasks: 'Дела', wishes: 'Хочу', watch: 'Смотреть' };
export const TAB_BAR_HEIGHT = 52;
export const MIC_SIZE = 64;
/** Сколько места снизу оставлять под таб-бар и микрофон */
export const useBottomSpace = () => useSafeAreaInsets().bottom + TAB_BAR_HEIGHT + MIC_SIZE + 32;

type Props = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { emit: (e: any) => any; navigate: (name: string) => void };
};

export function BottomBar({ state, navigation }: Props) {
  const c = useColors();
  const insets = useSafeAreaInsets();

  return (
    // Абсолютное позиционирование: список прокручивается под микрофоном,
    // а зона кнопки остаётся внутри границ View (на Android иначе не ловит нажатия).
    <View style={styles.root} pointerEvents="box-none">
      <MicCluster />
      <View style={[styles.bar, { backgroundColor: c.background, borderTopColor: c.border, paddingBottom: insets.bottom, height: TAB_BAR_HEIGHT + insets.bottom }]}>
        {state.routes.map((r, i) => {
          const active = state.index === i;
          return (
            <Pressable
              key={r.key}
              style={styles.tab}
              onPress={() => {
                const e = navigation.emit({ type: 'tabPress', target: r.key, canPreventDefault: true });
                if (!active && !e?.defaultPrevented) navigation.navigate(r.name);
              }}
            >
              <T weight="medium" color={active ? c.text : c.textMuted}>
                {LABELS[r.name] ?? r.name}
              </T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Где крестик относительно микрофона: половина кнопки (32) + отступ боковой колонки (12) + половина крестика (20).
 * Кнопка едет за пальцем не дальше крестика; наехала на него — запись отменяется.
 */
const CROSS_DX = MIC_SIZE / 2 + 12 + 20;
const CANCEL_DX = CROSS_DX - 12;

function MicCluster() {
  const c = useColors();
  const phase = useStore((s) => s.voice);
  const recording = phase === 'recording';
  const hold = useStore((s) => s.micMode) === 'hold';
  // Удержание: кнопка едет за пальцем влево; дальше CANCEL_DX — запись отменяется
  const drag = useRef(new Animated.Value(0)).current;
  const cancelled = useRef(false);
  const [armed, setArmed] = useState(false);

  const resetDrag = () => {
    Animated.timing(drag, { toValue: 0, duration: motion.fast, useNativeDriver: true }).start();
    setArmed(false);
  };

  // Режим удержания — жест из gesture-handler (сырые касания на Android перехватывались):
  // палец на кнопке — запись, повели влево дальше CANCEL_DX — отмена, отпустили — отправка
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .minDistance(0)
        .shouldCancelWhenOutside(false)
        .onBegin(() => {
          cancelled.current = useStore.getState().voice === 'processing';
          if (!cancelled.current) holdStart();
        })
        .onUpdate((e) => {
          if (cancelled.current) return;
          const dx = Math.min(0, e.translationX);
          drag.setValue(Math.max(dx, -CROSS_DX));
          setArmed(dx < -CANCEL_DX / 2);
          if (dx < -CANCEL_DX) {
            cancelled.current = true;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            cancelRecording();
            resetDrag();
          }
        })
        .onFinalize(() => {
          resetDrag();
          if (!cancelled.current) holdEnd();
          cancelled.current = true;
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const button = (
    <View style={[styles.mic, { backgroundColor: phase === 'processing' ? c.surface : c.primary, borderColor: c.border }]}>
      {phase === 'processing' ? (
        <ActivityIndicator color={c.text} />
      ) : recording && !hold ? (
        <View style={[styles.stop, { backgroundColor: c.onPrimary }]} />
      ) : (
        <Mic size={26} strokeWidth={1.5} color={c.onPrimary} />
      )}
    </View>
  );

  return (
    <View style={styles.cluster} pointerEvents="box-none">
      <View style={styles.side} pointerEvents="box-none">
        {recording && !hold ? (
          // Режим «нажать и отпустить»: отмена — отдельной кнопкой
          <Pressable onPress={cancelRecording} hitSlop={12} style={({ pressed }) => [styles.cancel, { borderColor: c.border, opacity: pressed ? 0.6 : 1 }]}>
            <X size={18} strokeWidth={ICON.stroke} color={c.text} />
          </Pressable>
        ) : recording && hold ? (
          <View style={[styles.cancel, { borderColor: armed ? c.danger : c.border }]} pointerEvents="none">
            <X size={18} strokeWidth={ICON.stroke} color={armed ? c.danger : c.textMuted} />
          </View>
        ) : null}
      </View>
      {hold ? (
        <GestureDetector gesture={pan}>
          <Animated.View style={{ transform: [{ translateX: drag }, { scale: recording ? 1.12 : 1 }] }}>{button}</Animated.View>
        </GestureDetector>
      ) : (
        <Pressable
          onPress={toggleRecording}
          disabled={phase === 'processing'}
          style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.96 : 1 }] })}
        >
          {button}
        </Pressable>
      )}
      <View style={[styles.side, { alignItems: 'flex-start', gap: 4 }]} pointerEvents="none">
        {recording && <Timer />}
        {recording && <Level />}
      </View>
    </View>
  );
}

function Timer() {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setMs(Date.now() - recordingStartedAt()), 200);
    return () => clearInterval(t);
  }, []);
  // Обратный отсчёт до автоостановки; последние 2 секунды — ярче
  const left = Math.max(0, Math.ceil((MAX_MS - ms) / 1000));
  return (
    <T mono variant="caption" muted={left > 2}>
      {`0:${String(left).padStart(2, '0')}`}
    </T>
  );
}

/** Индикатор уровня звука — тонкая полоска. С микрофоном — настоящий уровень, в заглушке — случайный. */
function Level() {
  const c = useColors();
  const w = useRef(new Animated.Value(0.1)).current;
  const level = useVoiceLevel((s) => s.level);

  useEffect(() => {
    if (level !== null) return;
    const t = setInterval(() => {
      Animated.timing(w, { toValue: 0.15 + Math.random() * 0.85, duration: motion.fast, useNativeDriver: false }).start();
    }, 160);
    return () => clearInterval(t);
  }, [w, level]);

  useEffect(() => {
    if (level === null) return;
    Animated.timing(w, { toValue: Math.max(0.04, level), duration: 90, useNativeDriver: false }).start();
  }, [w, level]);

  return (
    <View style={[styles.levelTrack, { backgroundColor: c.border }]}>
      <Animated.View
        style={{
          height: 2,
          backgroundColor: c.text,
          width: w.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  root: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  cluster: {
    height: MIC_SIZE,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  side: { width: 80, alignItems: 'flex-end', paddingHorizontal: 12 },
  mic: {
    width: MIC_SIZE,
    height: MIC_SIZE,
    borderRadius: MIC_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stop: { width: 20, height: 20, borderRadius: 3 },
  cancel: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  levelTrack: { width: 56, height: 2, overflow: 'hidden' },
});
