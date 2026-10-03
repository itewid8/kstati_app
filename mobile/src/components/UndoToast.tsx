import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder, StyleSheet, useWindowDimensions } from 'react-native';
import { useStore } from '@/lib/store';
import { motion, space, useColors } from '@/theme';
import { useBottomSpace } from './BottomBar';
import { Button, T } from './ui';

const UNDO_MS = 5000;

/** «Удалено · Отменить» — 5 секунд после удаления; смахнуть влево (или вправо) — убрать сразу */
export function UndoToast() {
  const c = useColors();
  const undo = useStore((s) => s.undo);
  const clearUndo = useStore((s) => s.clearUndo);
  const bottom = useBottomSpace() - 16;
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
            Animated.timing(x, { toValue: dir * width, duration: motion.fast, useNativeDriver: true }).start(() => useStore.getState().clearUndo());
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
          backgroundColor: c.primary,
          transform: [{ translateX: x }],
          opacity: x.interpolate({ inputRange: [-width, 0, width], outputRange: [0, 1, 0] }),
        },
      ]}
    >
      <T color={c.onPrimary} style={{ flex: 1 }}>
        {undo.label}
      </T>
      <Button kind="text" title="Отменить" color={c.onPrimary} onPress={undo.restore} style={{ height: 40 }} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: space.side,
    right: space.side,
    minHeight: 48,
    borderRadius: 10,
    paddingLeft: 16,
    paddingRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
