/**
 * Расчёты бегущей строки (Marquee): когда текст не влезает, зазор между копиями, скорость и длительность круга.
 * Чистые функции — без react-native, проверяются scripts/test.sh.
 */

export const MARQUEE = {
  /** Пауза перед стартом: сначала видно начало строки с многоточием */
  delayMs: 1000,
  /** Скорость: 2.5em/с, но не быстрее 30 и не медленнее 18 px/с (мелкий текст едет медленнее — читается) */
  speedEm: 2.5,
  speedMin: 18,
  speedMax: 30,
  /** Зазор между копиями: 2em в пределах 12–24 px */
  gapEm: 2,
  gapMin: 12,
  gapMax: 24,
  /** Допуск округления раскладки: текст шире рамки меньше чем на полпикселя считается влезшим */
  slack: 0.5,
  /** Ширина, в которой меряется строка без ограничений */
  measureWidth: 20000,
} as const;

/** Размер шрифта по умолчанию в React Native */
const DEFAULT_FONT_SIZE = 14;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Строка не влезает в рамку (ширины в dp из onLayout) */
export function marqueeOverflows(textWidth: number, boxWidth: number): boolean {
  return boxWidth > 0 && textWidth - boxWidth > MARQUEE.slack;
}

export function marqueeGap(fontSize: number = DEFAULT_FONT_SIZE): number {
  return Math.round(clamp(fontSize * MARQUEE.gapEm, MARQUEE.gapMin, MARQUEE.gapMax));
}

export function marqueeSpeed(fontSize: number = DEFAULT_FONT_SIZE): number {
  return clamp(fontSize * MARQUEE.speedEm, MARQUEE.speedMin, MARQUEE.speedMax);
}

/** Сдвиг за один круг: ширина строки + зазор, после него вторая копия стоит ровно на месте первой */
export function marqueeShift(textWidth: number, gap: number): number {
  return textWidth + gap;
}

/** Длительность круга в мс при постоянной скорости speed px/с */
export function marqueeDuration(shift: number, speed: number): number {
  if (!(shift > 0) || !(speed > 0)) return 0;
  return Math.round((shift / speed) * 1000);
}
