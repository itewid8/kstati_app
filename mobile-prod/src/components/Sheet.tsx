import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { motion, useColors } from '@/theme';

/**
 * Своя вертикальная прокрутка внутри шторки (барабан времени): касание в ней не тянет шторку вниз.
 * Вызвать в onTouchStart такой области
 */
const DragBlock = createContext<() => void>(() => {});
export const useSheetDragBlock = () => useContext(DragBlock);

/**
 * Bottom sheet: фон surface, скругление 16 сверху, «ручка».
 * Короткая анимация 200 мс без пружин.
 * Смахнуть вниз из любого места шторки — закрыть (если её содержимое не прокручено вниз
 * и палец не на барабане времени). Обновление экранов здесь не срабатывает: шторка — отдельное окно.
 */
export function Sheet({
  visible,
  onClose,
  children,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const y = useRef(new Animated.Value(1)).current;
  // Смахивание вниз: шторка едет за пальцем, дальше 100 px или быстро — закрывается
  const drag = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(0);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  /** Касание началось на барабане времени — шторку не тянем */
  const blocked = useRef(false);
  const block = useMemo(() => () => (blocked.current = true), []);
  const pan = useMemo(() => {
    // Тянуть вниз можно из любого места, когда содержимое не прокручено (иначе палец прокручивает его вверх)
    const grab = (dy: number, dx: number) => !blocked.current && dy > 10 && Math.abs(dy) > Math.abs(dx) * 1.5 && scrollY.current <= 0;
    return PanResponder.create({
      // Новое касание: снова можно тянуть (барабан, если палец на нём, тут же запретит)
      onStartShouldSetPanResponderCapture: () => {
        blocked.current = false;
        return false;
      },
      onMoveShouldSetPanResponderCapture: (_, g) => grab(g.dy, g.dx),
      onMoveShouldSetPanResponder: (_, g) => grab(g.dy, g.dx),
      onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 100 || g.vy > 0.8) closeRef.current();
        else Animated.timing(drag, { toValue: 0, duration: motion.fast, useNativeDriver: true }).start();
      },
      onPanResponderTerminate: () => Animated.timing(drag, { toValue: 0, duration: motion.fast, useNativeDriver: true }).start(),
    });
  }, [drag]);

  useEffect(() => {
    if (visible) {
      drag.setValue(0);
      setMounted(true);
      Animated.timing(y, { toValue: 0, duration: motion.base, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else if (mounted) {
      Animated.timing(y, { toValue: 1, duration: motion.fast, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(
        () => setMounted(false),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!mounted) return null;

  const translateY = Animated.add(y.interpolate({ inputRange: [0, 1], outputRange: [0, height * 0.6] }), drag);
  const opacity = y.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  return (
    <Modal transparent visible statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim, opacity }]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>
        <View style={{ flex: 1 }} pointerEvents="box-none" />
        <Animated.View
          {...pan.panHandlers}
          style={[
            styles.sheet,
            { backgroundColor: c.surface, maxHeight: height * 0.88, paddingBottom: Math.max(insets.bottom, 12), transform: [{ translateY }] },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: c.border }]} />
          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 8 }}
            scrollEventThrottle={32}
            onScroll={(e) => (scrollY.current = e.nativeEvent.contentOffset.y)}
          >
            <DragBlock.Provider value={block}>{children}</DragBlock.Provider>
          </ScrollView>
          {footer}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
  },
});
