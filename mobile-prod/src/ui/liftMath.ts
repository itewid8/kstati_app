/**
 * «Поднятый» элемент над затемнением (быстрые действия по удержанию, C-Quick*): рамка вокруг нажатой строки или блока
 * и сдвиг вверх, если нижнее окно её закрывает. Чистый модуль: без React.
 */

/** Прямоугольник в координатах окна (measureInWindow) */
export type LiftRect = { x: number; y: number; width: number; height: number };

/**
 * row — строка списка: рамка шире строки (как в макете), копия строки внутри растягивается по ширине;
 * block — блок календаря: рамка вплотную снаружи, копия того же размера, всё увеличено на BLOCK_SCALE
 */
export type LiftShape = 'row' | 'block';

/** Рамка поднятой строки: строка 44 + разделитель 1 → рамка 48 + 2×1.5, на 5.5 шире с каждой стороны (C-Quick*) */
export const ROW_OUTSET = { x: 5.5, top: 3.5, bottom: 2.5 } as const;
export const LIFT_BORDER = 1.5;
export const BLOCK_SCALE = 1.03;
/** Зазор между поднятым элементом и верхним краем нижнего окна */
export const LIFT_GAP = 8;

/** Внешний прямоугольник рамки (с обводкой) для нажатого элемента */
export const liftFrame = (rect: LiftRect, shape: LiftShape): LiftRect => {
  if (shape === 'block') {
    return { x: rect.x - LIFT_BORDER, y: rect.y - LIFT_BORDER, width: rect.width + 2 * LIFT_BORDER, height: rect.height + 2 * LIFT_BORDER };
  }
  return {
    x: rect.x - ROW_OUTSET.x,
    y: rect.y - ROW_OUTSET.top,
    width: rect.width + 2 * ROW_OUTSET.x,
    height: rect.height + ROW_OUTSET.top + ROW_OUTSET.bottom,
  };
};

/**
 * Сдвиг по вертикали (≤ 0), чтобы рамка не уходила под нижнее окно: её низ не ниже limit (верх окна минус зазор),
 * а верх не выше minTop. Окно ещё не измерено (limit ≤ 0) — без сдвига
 */
export const liftShift = (frame: LiftRect, limit: number, minTop = 0): number => {
  if (limit <= 0) return 0;
  const over = frame.y + frame.height - limit;
  if (over <= 0) return 0;
  return -Math.min(over, Math.max(0, frame.y - minTop));
};
