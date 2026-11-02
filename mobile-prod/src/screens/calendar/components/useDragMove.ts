/**
 * Перетаскивание блока мышью (веб, компьютер): нажали левой кнопкой и повели дальше 5 px — блок едет за мышью,
 * отпустили — onDrop(dx, dy). Щелчок после перетаскивания не открывает дело. На телефоне ничего не делает.
 */
import { useEffect, useRef, useState } from 'react';
import { Platform, type View } from 'react-native';

/** DOM без lib.dom: только то, что нужно здесь */
type Ptr = { button: number; clientX: number; clientY: number; preventDefault(): void; stopPropagation(): void };
type Target = {
  addEventListener(type: string, fn: (e: Ptr) => void, capture?: boolean): void;
  removeEventListener(type: string, fn: (e: Ptr) => void, capture?: boolean): void;
};
const win = globalThis as unknown as Target;

export function useDragMove(enabled: boolean, onDrop: (dx: number, dy: number) => void) {
  const ref = useRef<View>(null);
  const drop = useRef(onDrop);
  drop.current = onDrop;
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!enabled || Platform.OS !== 'web') return;
    const el = ref.current as unknown as Target | null;
    if (!el) return;
    let sx = 0;
    let sy = 0;
    let dragging = false;
    let swallowClick = false;
    const move = (e: Ptr) => {
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (!dragging && Math.hypot(dx, dy) > 5) dragging = true;
      if (dragging) {
        e.preventDefault();
        setOffset({ x: dx, y: dy });
      }
    };
    const up = (e: Ptr) => {
      win.removeEventListener('pointermove', move);
      win.removeEventListener('pointerup', up);
      if (dragging) {
        swallowClick = true;
        drop.current(e.clientX - sx, e.clientY - sy);
      }
      dragging = false;
      setOffset(null);
    };
    const down = (e: Ptr) => {
      if (e.button !== 0) return;
      sx = e.clientX;
      sy = e.clientY;
      win.addEventListener('pointermove', move);
      win.addEventListener('pointerup', up);
    };
    const click = (e: Ptr) => {
      if (!swallowClick) return;
      swallowClick = false;
      e.stopPropagation();
      e.preventDefault();
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('click', click, true);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('click', click, true);
      win.removeEventListener('pointermove', move);
      win.removeEventListener('pointerup', up);
    };
  }, [enabled]);

  return { ref, offset };
}
