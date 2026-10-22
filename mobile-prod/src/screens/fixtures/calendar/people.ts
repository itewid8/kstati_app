/**
 * Люди и общие данные макетов календаря (C-Day, C-Week, C-Month, C-Year, C-Plan): неделя 5–11 октября 2026,
 * сегодня — понедельник 5-е, сейчас 17:52. Цвета: s = blue (Саня), k = pink (Карина), o = green (Олег).
 */
import type { CalendarChromeProps, CalendarPerson } from '../../calendar/types';

export const SANYA: CalendarPerson = { id: 's', name: 'Саня', tabLabel: 'Я', color: 'blue' };
export const KARINA: CalendarPerson = { id: 'k', name: 'Карина', tabLabel: 'КАРИНА', color: 'pink' };
export const OLEG: CalendarPerson = { id: 'o', name: 'Олег', tabLabel: 'ОЛЕГ', color: 'green' };

export const TODAY = '2026-10-05';
/** 17:52 */
export const NOW = 17 * 60 + 52;

/** Минуты от полуночи: hm(9.5) = 570 */
export const hm = (hours: number) => Math.round(hours * 60);

export const chrome: Pick<CalendarChromeProps, 'groupLabel' | 'me'> = {
  groupLabel: 'МЫ С КАРИНОЙ',
  me: { letter: 'С', color: 'blue' },
};
