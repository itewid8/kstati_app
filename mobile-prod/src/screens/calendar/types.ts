/**
 * Общие типы экранов календаря (C-Day, C-Week, C-Month, C-Year). Экраны только рисуют:
 * данные приходят пропсами, действия уходят колбэками. Переходник из Task описан в src/lib/calendarLayout/index.ts.
 */
import type { DayMinute, IsoDate } from '@/lib/calendarLayout';
import type { ID, PersonColor } from '@/lib/types';
import type { NavTab } from '@/ui';

export type { DayMinute, IsoDate };

export type CalendarView = 'day' | 'week' | 'month' | 'year';

export type CalendarPerson = {
  id: ID;
  /** Имя в подписях дел: «Саня» (в дне и месяце — заглавными) */
  name: string;
  /** Подпись вкладки справа: «Я», «КАРИНА» */
  tabLabel: string;
  color: PersonColor;
};

/** Дело со временем в сетке (неделя, день): минуты от полуночи этого дня */
export type TimedEvent = {
  id: ID;
  title: string;
  /** Описание (в дне — строка под названием): «Клиника на Мира, каб. 4» */
  note?: string;
  start: DayMinute;
  end: DayMinute;
  /** Кто: отмеченные участники, иначе автор (peopleOf) — порядок задаёт порядок цветов */
  people: readonly ID[];
  done?: boolean;
  /** Подзадача общего дела: к подписи «кто» добавляется « · <название>» */
  parentTitle?: string;
  /** Дело началось вчера / кончится завтра: «→ 15:00», «07:00 →», «весь день» */
  fromPrevDay?: boolean;
  toNextDay?: boolean;
};

/** Полоса над сеткой: на весь день, многодневное, общее дело с подзадачами */
export type CalendarBar = {
  id: ID;
  title: string;
  /** Приглушённая подпись сразу за названием, вместе с разделителем: « · 8–10 окт» */
  meta?: string;
  startDate: IsoDate;
  endDate: IsoDate;
  people: readonly ID[];
};

/** Общее для всех видов: верхняя панель, переключатель вида, нижняя навигация */
export type CalendarChromeProps = {
  /** «МЫ С КАРИНОЙ» */
  groupLabel: string;
  /** Кнопка профиля: буква и свой цвет */
  me: { letter: string; color: PersonColor };
  hasNews?: boolean;
  /** Отступы safe area (на телефоне — useSafeAreaInsets) */
  insets?: { top: number; bottom: number };

  onOpenGroup?: () => void;
  onOpenList?: () => void;
  onAdd?: () => void;
  onOpenFeed?: () => void;
  onOpenSettings?: () => void;
  onChangeView?: (view: CalendarView) => void;
  onNavigate?: (tab: NavTab) => void;
  onRec?: () => void;
};

/** Вкладки людей у правого края (неделя, день): скрытые не закрашены */
export type PersonFilterProps = {
  people: readonly CalendarPerson[];
  hiddenPeople?: readonly ID[];
  onTogglePerson?: (id: ID) => void;
};
