import { Mic } from '@/components/icons';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '@/lib/store';
import { holdEnd, holdStart, MAX_MS, recordingStartedAt, toggleRecording, useVoiceLevel } from '@/lib/voice';
import { motion, useColors } from '@/theme';
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

function MicCluster() {
  const c = useColors();
  const phase = useStore((s) => s.voice);
  const recording = phase === 'recording';
  const hold = useStore((s) => s.micMode) === 'hold';

  return (
    <View style={styles.cluster} pointerEvents="box-none">
      <View style={styles.side} pointerEvents="none">{recording && <Timer />}</View>
      <Pressable
        // «Нажать — начать, ещё раз — стоп» или «держать, пока говоришь» (Настройки → Приложение)
        {...(hold ? { onPressIn: holdStart, onPressOut: holdEnd } : { onPress: toggleRecording })}
        disabled={phase === 'processing'}
        style={({ pressed }) => [
          styles.mic,
          {
            backgroundColor: phase === 'processing' ? c.surface : c.primary,
            borderColor: c.border,
            // В режиме удержания кнопка заметно «вдавлена», пока идёт запись
            transform: [{ scale: hold && recording ? 1.12 : pressed ? 0.96 : 1 }],
          },
        ]}
      >
        {phase === 'processing' ? (
          <ActivityIndicator color={c.text} />
        ) : recording && !hold ? (
          <View style={[styles.stop, { backgroundColor: c.onPrimary }]} />
        ) : (
          <Mic size={26} strokeWidth={1.5} color={c.onPrimary} />
        )}
      </Pressable>
      <View style={[styles.side, { alignItems: 'flex-start' }]} pointerEvents="none">{recording && <Level />}</View>
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
  levelTrack: { width: 56, height: 2, overflow: 'hidden' },
});
