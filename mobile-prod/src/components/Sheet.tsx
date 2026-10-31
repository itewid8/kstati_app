import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BugButton } from './BugButton';
import { ModalShot } from './ModalShot';
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
import { size as S, space, useTheme } from '@/ui';

const OPEN_MS = 220;
const CLOSE_MS = 150;
/** Дальше — закрыть */
const DRAG_CLOSE_PX = 100;

type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Ниже прокрутки, всегда на месте (кнопки окна) */
  footer?: React.ReactNode;
  /**
   * Новые окна: поля 16 по бокам и 10 между блоками (как BottomSheet из src/ui).
   * Без него содержимое во всю ширину — строки со своими отступами (окно групп)
   */
  inset?: boolean;
  /** Поверх открыто другое окно (полное окно дела): смахивание не закрывает это */
  locked?: boolean;
};

/**
 * Нижнее окно в стиле «Инструмент» (как BottomSheet из src/ui): квадратное, рамка сверху 1.5px, «ручка» 36×4, затемнение.
 * Своё окно (Modal) — клавиатура поднимает его целиком; содержимое прокручивается, footer стоит снизу.
 * Смахнуть вниз из любого места — закрыть (если содержимое не прокручено вниз). Выезжает за 220 мс без пружин.
 */
export function Sheet({ visible, onClose, children, footer, inset = false, locked = false }: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const y = useRef(new Animated.Value(1)).current;
  // Смахивание вниз: окно едет за пальцем, дальше 100 px или быстро — закрывается
  const drag = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(0);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  const pan = useMemo(() => {
    // Тянуть вниз можно из любого места, когда содержимое не прокручено (иначе палец прокручивает его вверх)
    const grab = (dy: number, dx: number) => !lockedRef.current && dy > 10 && Math.abs(dy) > Math.abs(dx) * 1.5 && scrollY.current <= 0;
    const back = () => Animated.timing(drag, { toValue: 0, duration: CLOSE_MS, useNativeDriver: true }).start();
    return PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, g) => grab(g.dy, g.dx),
      onMoveShouldSetPanResponder: (_, g) => grab(g.dy, g.dx),
      onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > DRAG_CLOSE_PX || g.vy > 0.8) closeRef.current();
        else back();
      },
      onPanResponderTerminate: back,
    });
  }, [drag]);

  useEffect(() => {
    if (visible) {
      drag.setValue(0);
      setMounted(true);
      Animated.timing(y, { toValue: 0, duration: OPEN_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else if (mounted) {
      Animated.timing(y, { toValue: 1, duration: CLOSE_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() =>
        setMounted(false),
      );
    }
    // Только по visible: mounted меняется внутри
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!mounted) return null;

  const translateY = Animated.add(y.interpolate({ inputRange: [0, 1], outputRange: [0, height * 0.6] }), drag);
  const opacity = y.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const bottom = 18 + insets.bottom;

  return (
    <Modal transparent visible statusBarTranslucent navigationBarTranslucent animationType="none" onRequestClose={onClose}>
      <ModalShot>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim, opacity }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Закрыть" style={styles.fill} onPress={onClose} />
        </Animated.View>
        <View style={styles.fill} pointerEvents="box-none" />
        <Animated.View
          {...pan.panHandlers}
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              borderTopColor: c.border,
              backgroundColor: c.bg,
              maxHeight: height * 0.9,
              paddingBottom: footer ? bottom : 0,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: c.hair }]} />
          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[inset && styles.inset, { paddingBottom: footer ? 10 : bottom }]}
            scrollEventThrottle={32}
            onScroll={(e) => (scrollY.current = e.nativeEvent.contentOffset.y)}
          >
            {children}
          </ScrollView>
          {footer ? <View style={inset ? styles.footerInset : undefined}>{footer}</View> : null}
        </Animated.View>
      </KeyboardAvoidingView>
      <BugButton />
      </ModalShot>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  sheet: { borderTopWidth: S.border, paddingTop: 8 },
  grabber: { alignSelf: 'center', width: S.grabberWidth, height: S.grabberHeight, marginBottom: 10 },
  inset: { paddingHorizontal: space.side, gap: 10 },
  footerInset: { paddingHorizontal: space.side },
});
