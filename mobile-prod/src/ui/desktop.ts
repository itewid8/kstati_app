/**
 * Компьютерная раскладка веб-версии: широкое окно браузера (от 1024 px).
 * На телефоне и в узком окне — телефонная раскладка без изменений.
 */
import { useEffect, useRef } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

export const DESKTOP_MIN = 1024;
/** Меню быстрых действий у дела (правый щелчок) */
export const MENU_WIDTH = 440;
/** Боковая панель навигации */
export const SIDEBAR_WIDTH = 232;
/** Ширина содержимого списков и форм (календарь — во всю ширину) */
export const CONTENT_MAX = 920;
/** Окно вместо нижней шторки */
export const DIALOG_WIDTH = 520;
/** Редактор дела справа */
export const PANEL_WIDTH = 460;

export function useDesktop(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= DESKTOP_MIN;
}

/**
 * Правый клик в браузере = долгое нажатие (быстрые действия). Пропсы для Pressable; на телефоне — пусто.
 * onContextMenu нет в типах React Native, но react-native-web его передаёт
 */
export const contextMenu = (fn: (() => void) | undefined): object =>
  Platform.OS === 'web' && fn
    ? {
        onContextMenu: (e: { preventDefault(): void }) => {
          e.preventDefault();
          fn();
        },
      }
    : {};

/** Наведение мыши (есть только в браузере): Pressable передаёт его в style-функцию */
export const hovered = (state: unknown): boolean => !!(state as { hovered?: boolean }).hovered;

type Key = { key: string; stopImmediatePropagation(): void };
type KeyTarget = { addEventListener(t: 'keydown', fn: (e: Key) => void, capture: boolean): void; removeEventListener(t: 'keydown', fn: (e: Key) => void, capture: boolean): void };

/** Esc закрывает окно (веб). Пока открыто несколько — закрывает верхнее, то есть открытое последним */
const escStack: Array<{ current: () => void }> = [];
export function useEscape(onEscape: (() => void) | undefined, active = true) {
  const fn = useRef(onEscape ?? (() => {}));
  fn.current = onEscape ?? (() => {});
  useEffect(() => {
    if (Platform.OS !== 'web' || !active || !onEscape) return;
    const entry = fn;
    escStack.push(entry);
    const win = globalThis as unknown as KeyTarget;
    // Раньше горячих клавиш раскладки (перехват): Esc закрывает только это окно
    const onKey = (e: Key) => {
      if (e.key !== 'Escape' || escStack[escStack.length - 1] !== entry) return;
      e.stopImmediatePropagation();
      entry.current();
    };
    win.addEventListener('keydown', onKey, true);
    return () => {
      win.removeEventListener('keydown', onKey, true);
      escStack.splice(escStack.indexOf(entry), 1);
    };
  }, [active, !!onEscape]);
}
