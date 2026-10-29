import { useEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder, StyleSheet, useWindowDimensions } from 'react-native';
import Reanimated, { FadeIn } from 'react-native-reanimated';
import { useBottomSpace } from '@/containers/common/layout';
import { UNDO_MS, useStore } from '@/lib/store';
import { UndoToastView } from '@/screens/sheets';
import { space } from '@/ui';

const AWAY_MS = 150;

/**
 * «УДАЛЕНО · ВЕРНУТЬ» — 5 секунд после удаления или отметки (UNDO_MS), правка тем временем не уходит на сервер; так же — короткие сообщения без кнопки.
 * Над нижней навигацией; смахнуть влево (или вправо) — убрать сразу
 */
export function UndoToast() {
  const undo = useStore((s) => s.undo);
  const clearUndo = useStore((s) => s.clearUndo);
  const bottom = useBottomSpace();
  const { width } = useWindowDimensions();
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!undo) return;
    x.setValue(0);
    const t = setTimeout(clearUndo, UNDO_MS);
    return () => clearTimeout(t);
  }, [undo, clearUndo, x]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderMove: (_, g) => x.setValue(g.dx),
        onPanResponderRelease: (_, g) => {
          if (Math.abs(g.dx) > 80 || Math.abs(g.vx) > 0.5) {
            const dir = g.dx < 0 ? -1 : 1;
            Animated.timing(x, { toValue: dir * width, duration: AWAY_MS, useNativeDriver: true }).start(() => useStore.getState().clearUndo());
          } else Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
        },
        onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start(),
      }),
    [x, width],
  );

  if (!undo) return null;
  return (
    <Animated.View
      {...pan.panHandlers}
      style={[
        styles.toast,
        {
          bottom,
          transform: [{ translateX: x }],
          opacity: x.interpolate({ inputRange: [-width, 0, width], outputRange: [0, 1, 0] }),
        },
      ]}
    >
      {/* Каждое новое сообщение проявляется заново (key) */}
      <Reanimated.View key={undo.at} entering={FadeIn.duration(180)}>
        <UndoToastView label={undo.label} onUndo={undo.restore} />
      </Reanimated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: { position: 'absolute', left: space.side, right: space.side },
});
