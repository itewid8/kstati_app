/**
 * Кнопка-жучок поверх приложения — «язычок» у края экрана (как вкладки людей в календаре).
 * Нажать — снимок экрана и окно отчёта (BugReport). Зажать и тянуть — язычок плавно превращается в кружок и идёт
 * за пальцем с запаздыванием и «желе»: тянется по ходу движения и сплющивается поперёк. Отпустить — летит по инерции
 * к ближайшему краю, пружинит и снова становится язычком; место помнится. Долгое нажатие без движения — спрятать
 * (вернуть — Настройки → «Кнопка отзыва»).
 * Рисуется в корне и в каждом окне-модалке (у модалок свой слой). PanResponder и Animated с нативным драйвером:
 * внутри модалок обработчику жестов нужна своя обёртка, а трансформы и так считаются не в JS.
 */
import { usePathname } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openMenu } from '@/components/ActionMenu';
import { useBug } from '@/lib/bugReport';
import { logError } from '@/lib/diag';
import { captureScreen } from '@/lib/screenshot';
import { useStore } from '@/lib/store';
import { Icon, useTheme } from '@/ui';

/** Кружок при перетаскивании */
const SIZE = 40;
/** Язычок: та же фигура, сжатая по ширине (16 × 40), прижата к краю */
const TAB = 0.4;
const TAB_W = SIZE * TAB;
/** Центр язычка от края экрана: язычок прижат к краю (на пиксель заходит за него), значок виден целиком */
const TAB_INSET = TAB_W / 2 - 1;
const LONG_MS = 600;
const N = { useNativeDriver: true } as const;

/** Снимок экрана (кнопка на это время прячется) и окно отчёта */
export async function startBugReport(route: string) {
  const bug = useBug.getState();
  bug.setCapturing(true);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 30))));
  let shot: string | null = null;
  try {
    shot = await captureScreen();
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

  const geo = useRef({ width, height, top: insets.top, bottom: insets.bottom });
  geo.current = { width, height, top: insets.top, bottom: insets.bottom };
  const clampY = (y: number) => Math.min(Math.max(y, geo.current.top + SIZE), geo.current.height - geo.current.bottom - SIZE);
  /** Центр язычка у левого (right = false) или правого края */
  const tabX = (right: boolean) => (right ? geo.current.width - TAB_INSET : TAB_INSET);

  const right = pos ? pos.x >= 0.5 : true;
  const restY = clampY(pos ? pos.y * height : height * 0.55);
  const tx = useRef(new Animated.Value(tabX(right))).current;
  const ty = useRef(new Animated.Value(restY)).current;
  const sx = useRef(new Animated.Value(TAB)).current;
  const sy = useRef(new Animated.Value(1)).current;
  const cur = useRef({ x: tabX(right), y: restY, right });

  useEffect(() => {
    cur.current = { x: tabX(right), y: restY, right };
    tx.setValue(cur.current.x);
    ty.setValue(restY);
    // Место меняется только из хранилища или при повороте экрана
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [right, restY, width]);

  const routeRef = useRef(route);
  routeRef.current = route;

  const responder = useMemo(() => {
    let moved = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let grabX = 0;
    let grabY = 0;
    const stopTimer = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };
    /** Желе: тянется вдоль скорости, сплющивается поперёк */
    const wobble = (vx: number, vy: number) => {
      const ax = Math.min(Math.abs(vx), 3);
      const ay = Math.min(Math.abs(vy), 3);
      Animated.spring(sx, { toValue: 1 + ax * 0.12 - ay * 0.06, friction: 4, tension: 160, ...N }).start();
      Animated.spring(sy, { toValue: 1 + ay * 0.12 - ax * 0.06, friction: 4, tension: 160, ...N }).start();
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        moved = false;
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
        if (!moved) {
          // Начали тянуть: язычок выходит из-за края и становится кружком
          moved = true;
          stopTimer();
          const from = cur.current;
          grabX = from.right ? geo.current.width - SIZE * 0.8 : SIZE * 0.8;
          grabY = from.y;
          Animated.spring(sx, { toValue: 1, friction: 5, tension: 120, ...N }).start();
          Animated.spring(sy, { toValue: 1, friction: 5, tension: 120, ...N }).start();
        }
        // За пальцем — пружиной: запаздывает и догоняет с перелётом
        Animated.spring(tx, { toValue: grabX + g.dx, friction: 7, tension: 140, ...N }).start();
        Animated.spring(ty, { toValue: grabY + g.dy, friction: 7, tension: 140, ...N }).start();
        wobble(g.vx, g.vy);
      },
      onPanResponderRelease: (_e, g) => {
        stopTimer();
        if (!moved) {
          void startBugReport(routeRef.current);
          return;
        }
        // Бросок: по инерции к краю (сторона — куда летит или где отпустили), вверх-вниз — с учётом скорости
        const x = grabX + g.dx + g.vx * 120;
        const toRight = x > geo.current.width / 2;
        const y = clampY(grabY + g.dy + g.vy * 140);
        cur.current = { x: tabX(toRight), y, right: toRight };
        Animated.parallel([
          Animated.spring(tx, { toValue: tabX(toRight), velocity: g.vx, friction: 6, tension: 70, ...N }),
          Animated.spring(ty, { toValue: y, velocity: g.vy, friction: 6, tension: 70, ...N }),
          // Долетел — снова язычок, с пружинкой
          Animated.sequence([Animated.delay(120), Animated.spring(sx, { toValue: TAB, friction: 4, tension: 110, ...N })]),
          Animated.spring(sy, { toValue: 1, friction: 3.5, tension: 120, ...N }),
        ]).start();
        useStore.getState().setBugPos({ x: toRight ? 1 : 0, y: y / geo.current.height });
      },
      onPanResponderTerminate: stopTimer,
    });
    // Значения Animated живут весь срок кнопки
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Значок не искажается: обратный масштаб
  const ix = useMemo(() => Animated.divide(1, sx), [sx]);
  const iy = useMemo(() => Animated.divide(1, sy), [sy]);

  if (!signedIn || !enabled || capturing || reporting) return null;
  return (
    <Animated.View
      {...responder.panHandlers}
      hitSlop={{ top: 6, bottom: 6, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel="Сообщить об ошибке"
      style={[
        styles.shape,
        {
          backgroundColor: c.text,
          transform: [
            { translateX: Animated.subtract(tx, SIZE / 2) },
            { translateY: Animated.subtract(ty, SIZE / 2) },
            { scaleX: sx },
            { scaleY: sy },
          ],
        },
      ]}
    >
      <Animated.View style={{ transform: [{ scaleX: ix }, { scaleY: iy }] }}>
        <Icon name="bug" size={13} color={c.bg} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shape: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    elevation: 20,
  },
});
