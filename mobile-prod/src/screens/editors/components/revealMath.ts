/**
 * Поле в фокусе над клавиатурой: на сколько прокрутить поля окна редактирования. Чистый модуль, без React.
 * Координаты — в окне (measureInWindow), сверху вниз.
 */

/** Отрезок по вертикали: верх и низ */
export type Span = { top: number; bottom: number };

/**
 * Сдвиг прокрутки (> 0 — вниз), чтобы поле целиком попало в видимую часть.
 * Поле выше видимой части — его верх к верху; ниже — его низ к низу, но верх поля не уходит выше видимой части
 * (высокое описание показывается с начала). Видимая часть уже исчезла (клавиатура выше верха) — не двигаем
 */
export const revealDelta = (field: Span, view: Span): number => {
  if (view.bottom <= view.top) return 0;
  if (field.top < view.top) return field.top - view.top;
  if (field.bottom <= view.bottom) return 0;
  return Math.min(field.bottom - view.bottom, field.top - view.top);
};

/** Сколько места под полями закрывает клавиатура: низ экрана окна минус верх клавиатуры (окно уже сжато — 0) */
export const keyboardOverlap = (screenBottom: number, keyboardTop: number): number =>
  Math.max(0, Math.round(screenBottom - keyboardTop));

/** Заголовок в одну строку (24/28 + отступ 8 + линия 1.5) — поля стоят на своём месте, длиннее — ниже на разницу */
export const titleShift = (titleHeight: number, oneLine: number): number => (titleHeight > oneLine + 4 ? Math.ceil(titleHeight - oneLine) : 0);
