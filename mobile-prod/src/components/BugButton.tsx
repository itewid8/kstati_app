/**
 * Кнопка-жучок поверх приложения: нажатие — снимок экрана и окно отчёта (BugReport); тянуть — переложить
 * (плавно доезжает до ближайшего края, место помнится); долгое нажатие — спрятать (вернуть — Настройки → «Кнопка отзыва»).
 * Рисуется в корне и в каждом окне-модалке (у модалок свой слой — иначе кнопка была бы под ними).
 * Перетаскивание на PanResponder: внутри модалок обработчик жестов без своей обёртки не работает.
 */
import { usePathname } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, PanResponder, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openMenu } from '@/components/ActionMenu';
import { useBug } from '@/lib/bugReport';
import { logError } from '@/lib/diag';
import { useStore } from '@/lib/store';
import { Icon, useTheme } from '@/ui';
import { captureVisible } from './ModalShot';

const SIZE = 44;
const EDGE = 6;
const LONG_MS = 600;

/** Снимок экрана (кнопка на это время прячется) и окно отчёта */
export async function startBugReport(route: string) {
  const bug = useBug.getState();
  bug.setCapturing(true);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 30))));
  let shot: string | null = null;
  try {
    shot = await captureVisible();
  } catch (e) {
    logError(e);
  }
  useBug.getState().open({ shot, route });
}

export function BugButton() {
  const { c } = useTheme();
  const signedIn = useStore((s) => !!s.session);
  const enabled = useStore((s) => s.bugButton);
  const pos = useStore((s) => s.bugPos);
  const capturing = useBug((s) => s.capturing);
  const reporting = useBug((s) => !!s.report);
  const route = usePathname();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const clamp = (x: number, y: number) => ({
    x: Math.min(Math.max(x, EDGE), width - SIZE - EDGE),
    y: Math.min(Math.max(y, insets.top + EDGE), height - insets.bottom - SIZE - EDGE),
  });
  const start = clamp(pos ? pos.x * width : width - SIZE - EDGE, pos ? pos.y * height : height * 0.55);
  const cur = useRef(start);
  const xy = useRef(new Animated.ValueXY(start)).current;
  useEffect(() => {
    cur.current = start;
    xy.setValue(start);
    // Место меняется только из хранилища или при повороте экрана
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos?.x, pos?.y, width, height]);

  const routeRef = useRef(route);
  routeRef.current = route;
  const size = useRef({ width, height, top: insets.top, bottom: insets.bottom });
  size.current = { width, height, top: insets.top, bottom: insets.bottom };

  const responder = useMemo(() => {
    let moved = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let base = { x: 0, y: 0 };
    const stopTimer = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        moved = false;
        base = cur.current;
        timer = setTimeout(() => {
          timer = null;
          if (moved) return;
          moved = true; // отпускание после долгого нажатия — не нажатие
          openMenu({
            title: 'Кнопка отзыва',
            actions: [{ label: 'Спрятать (вернуть — в Настройках)', onPress: () => useStore.getState().setBugButton(false) }],
          });
        }, LONG_MS);
      },
      onPanResponderMove: (_e, g) => {
        if (!moved && Math.abs(g.dx) + Math.abs(g.dy) < 6) return;
        moved = true;
        stopTimer();
        xy.setValue({ x: base.x + g.dx, y: base.y + g.dy });
      },
      onPanResponderRelease: (_e, g) => {
        stopTimer();
        if (!moved) {
          void startBugReport(routeRef.current);
          return;
        }
        const s = size.current;
        const x = base.x + g.dx + SIZE / 2 < s.width / 2 ? EDGE : s.width - SIZE - EDGE;
        const y = Math.min(Math.max(base.y + g.dy, s.top + EDGE), s.height - s.bottom - SIZE - EDGE);
        cur.current = { x, y };
        // Плавно, без отскока: замедление к краю
        Animated.timing(xy, { toValue: { x, y }, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
        useStore.getState().setBugPos({ x: x / s.width, y: y / s.height });
      },
      onPanResponderTerminate: stopTimer,
    });
  }, [xy]);

  if (!signedIn || !enabled || capturing || reporting) return null;
  return (
    <Animated.View
      {...responder.panHandlers}
      accessibilityRole="button"
      accessibilityLabel="Сообщить об ошибке"
      style={[styles.button, { backgroundColor: c.text, transform: xy.getTranslateTransform() }]}
    >
      <Icon name="bug" size={22} color={c.bg} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.4,
    zIndex: 9999,
    elevation: 20,
  },
});
