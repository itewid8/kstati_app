/**
 * Удержание элемента списка или календаря: через LONG_PRESS_MS элемент меряет себя в окне (measureInWindow) и отдаёт
 * свою копию без обработчиков — хост быстрых действий рисует её поднятой над затемнением (C-Quick*).
 * Компонент вызывает useLift и вешает ref и onLongPress на свой Pressable (delayLongPress = LONG_PRESS_MS).
 */
import { useCallback, useRef, type ReactElement } from 'react';
import type { View } from 'react-native';
import type { LiftRect, LiftShape } from './liftMath';

export type { LiftRect, LiftShape } from './liftMath';

/** Нажатый элемент: где он в окне, как его поднимать и его копия для рамки */
export type LiftTarget = { rect: LiftRect; shape: LiftShape; node: ReactElement };
export type LiftHandler = (target: LiftTarget) => void;

/** Задержка удержания: короче — путается с прокруткой, длиннее — кажется, что не сработало */
export const LONG_PRESS_MS = 350;

/** copy — копия элемента без обработчиков (строится только в момент удержания) */
export const useLift = (onLift: LiftHandler | undefined, shape: LiftShape, copy: () => ReactElement) => {
  const ref = useRef<View>(null);
  const latest = useRef(copy);
  latest.current = copy;
  const onLongPress = useCallback(() => {
    const view = ref.current;
    if (!onLift || !view) return;
    view.measureInWindow((x, y, width, height) => onLift({ rect: { x, y, width, height }, shape, node: latest.current() }));
  }, [onLift, shape]);
  return { ref, onLongPress: onLift ? onLongPress : undefined };
};
