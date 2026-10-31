/**
 * Снимок во весь экран: щипок — увеличить (до ×5), тянуть — двигать, двойное нажатие — ×2 / обратно.
 * Своя модалка с GestureHandlerRootView: внутри модалки жесты без неё не работают.
 */
import { Image, Modal, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '@/ui';

const MAX = 5;

export function ShotViewer({ uri, size, onClose }: { uri: string | null; size: { width: number; height: number } | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
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
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }] }));

  const close = () => {
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
            <Animated.View style={[styles.center, style]}>{uri ? <Image source={{ uri }} style={{ width: w, height: h }} resizeMode="contain" /> : null}</Animated.View>
          </GestureDetector>
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
  close: { position: 'absolute', top: 52, right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
});
