/**
 * Компьютерная раскладка веб-версии: широкое окно браузера (от 1024 px).
 * На телефоне и в узком окне — телефонная раскладка без изменений.
 */
import { Platform, useWindowDimensions } from 'react-native';

export const DESKTOP_MIN = 1024;
/** Боковая панель навигации */
export const SIDEBAR_WIDTH = 232;
/** Ширина содержимого списков и форм (календарь — во всю ширину) */
export const CONTENT_MAX = 920;
/** Окно вместо нижней шторки */
export const DIALOG_WIDTH = 520;

export function useDesktop(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= DESKTOP_MIN;
}

/** Наведение мыши (есть только в браузере): Pressable передаёт его в style-функцию */
export const hovered = (state: unknown): boolean => !!(state as { hovered?: boolean }).hovered;
