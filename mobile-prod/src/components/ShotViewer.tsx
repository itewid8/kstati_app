/**
 * Снимок во весь экран: щипок — увеличить (до ×5), тянуть — двигать, двойное нажатие — ×2 / обратно.
 * Рамка отзыва (в пикселях снимка) рисуется поверх; масштаб — в углу.
 * Своя модалка с GestureHandlerRootView: внутри модалки жесты без неё не работают.
 */
import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon, fonts, useTheme } from '@/ui';

const MAX = 5;

type Frame = { x: number; y: number; w: number; h: number };

export function ShotViewer({
  uri,
  size,
  frame,
  onClose,
}: {
  uri: string | null;
  size: { width: number; height: number } | null;
  /** Рамка в пикселях снимка */
  frame?: Frame | null;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const { width, height } = useWindowDimensions();
  const [shown, setShown] = useState(1);
  const scale = useSharedValue(1);
  const saved = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const sx = useSharedValue(0);
  const sy = useSharedValue(0);

  // Картинка вписана в экран
  const k = size ? Math.min(width / size.width, height / size.height) : 1;
  const w = size ? size.width * k : width;
  const h = size ? size.height * k : height;

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(MAX, Math.max(1, saved.value * e.scale));
    })
    .onEnd(() => {
      saved.value = scale.value;
      if (scale.value <= 1) {
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        sx.value = 0;
        sy.value = 0;
      }
    });
  const pan = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      tx.value = sx.value + e.translationX;
      ty.value = sy.value + e.translationY;
    })
    .onEnd(() => {
      sx.value = tx.value;
      sy.value = ty.value;
    });
  const double = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const to = scale.value > 1 ? 1 : 2;
      scale.value = withTiming(to);
      saved.value = to;
      if (to === 1) {
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        sx.value = 0;
        sy.value = 0;
      }
    });
  // Подпись «×1.5»: шаг 0.1, обновляется только при смене
  useAnimatedReaction(
    () => Math.round(scale.value * 10) / 10,
    (v, prev) => {
      if (v !== prev) runOnJS(setShown)(v);
    },
  );
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }] }));

  const close = () => {
    setShown(1);
    scale.value = 1;
    saved.value = 1;
    tx.value = 0;
    ty.value = 0;
    sx.value = 0;
    sy.value = 0;
    onClose();
  };

  return (
    <Modal visible={!!uri} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
      <GestureHandlerRootView style={styles.fill}>
        <SafeAreaView style={styles.back} edges={['top', 'bottom']}>
          <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, double)}>
            <Animated.View style={[styles.center, style]}>
              {uri ? (
                <View style={{ width: w, height: h }}>
                  <Image source={{ uri }} style={{ width: w, height: h }} resizeMode="contain" />
                  {frame ? <View pointerEvents="none" style={[styles.frame, { borderColor: c.red, left: frame.x * k, top: frame.y * k, width: frame.w * k, height: frame.h * k }]} /> : null}
                </View>
              ) : null}
            </Animated.View>
          </GestureDetector>
          {shown > 1 ? <Text style={styles.zoom}>{`×${shown.toFixed(1).replace(/\.0$/, '')}`}</Text> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Закрыть" hitSlop={12} onPress={close} style={styles.close}>
            <Icon name="close" size={20} color="#FFFFFF" />
          </Pressable>
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  back: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: { position: 'absolute', borderWidth: 2.5 },
  zoom: { position: 'absolute', left: 16, top: 60, fontFamily: fonts.mono400, fontSize: 10, letterSpacing: 0.8, color: '#FFFFFF', opacity: 0.7 },
  close: { position: 'absolute', top: 52, right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
});
