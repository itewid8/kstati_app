/**
 * Щипок между видами календаря: день ↔ неделя ↔ месяц ↔ год (как в старом приложении, CalendarStage).
 * Свести пальцы — крупнее период (+1), развести — мельче (−1).
 *
 * Всё считается в логарифме масштаба z = ln(scale): сведение и разведение пальцев в одно и то же число раз
 * дают одинаковый ход. Пока пальцы на экране, текущий вид следует за ними (масштаб вокруг точки щипка) и
 * растворяется, следующий проступает из-под него (progress 0…1). Отпустили дальше порога (или резким движением) —
 * переход доводится пружиной, иначе вид пружиной возвращается.
 *
 * Функции вызываются из ворклетов жеста (поток UI) — отсюда директива 'worklet'; вне приложения это просто строка.
 */

export type ZoomView = 'day' | 'week' | 'month' | 'year';
/** +1 — к более крупному периоду (свели пальцы), −1 — к более мелкому (развели), 0 — направление ещё не ясно */
export type ZoomDir = -1 | 0 | 1;

/** От мелкого к крупному */
export const ZOOM_VIEWS: readonly ZoomView[] = ['day', 'week', 'month', 'year'];

export const ZOOM = {
  /** |z| меньше — направление не выбрано (дрожание пальцев) */
  deadband: 0.03,
  /** |z| при отпускании, с которого вид переключается: масштаб 0.88 / 1.13 (в старом приложении 0.88 / 1.14) */
  commit: 0.125,
  /** |z|, на котором переход завершён: старый вид растворился, новый проступил целиком (×0.64 / ×1.57) */
  full: 0.45,
  /** Резкий щипок: скорость |dz/dt| в 1/с, с которой вид переключается и до порога… */
  flick: 0.9,
  /** …если пальцы прошли хотя бы столько */
  flickMin: 0.05,
  /** Новый вид проступает из масштаба e^±0.2 (крупнее период — из большего, мельче — из меньшего) */
  preview: 0.2,
  /** Дальше переключать некуда (день развести, год свести): вид тянется за пальцами на 15% и пружинит назад */
  rubber: 0.15,
} as const;

/** Следующий вид в направлении dir; null — дальше некуда */
export const zoomNext = (view: ZoomView, dir: ZoomDir): ZoomView | null => {
  'worklet';
  if (dir === 0) return null;
  const i = ZOOM_VIEWS.indexOf(view) + dir;
  return i >= 0 && i < ZOOM_VIEWS.length ? ZOOM_VIEWS[i] : null;
};

/** Направление по текущему масштабу щипка (scale > 0): свели пальцы (scale < 1) — +1 */
export const zoomDir = (scale: number): ZoomDir => {
  'worklet';
  const z = Math.log(Math.max(scale, 1e-6));
  return z <= -ZOOM.deadband ? 1 : z >= ZOOM.deadband ? -1 : 0;
};

/** Ход перехода 0…1 в направлении dir (движение против направления — 0) */
export const zoomProgress = (scale: number, dir: ZoomDir): number => {
  'worklet';
  const toward = -dir * Math.log(Math.max(scale, 1e-6));
  return Math.max(0, Math.min(1, toward / ZOOM.full));
};

/**
 * Переключать ли вид, когда пальцы отпустили: прошли порог или резко двигались в сторону dir.
 * velocity — скорость масштаба (scale/с, как в событии щипка)
 */
export const zoomCommits = (scale: number, velocity: number, dir: ZoomDir): boolean => {
  'worklet';
  if (dir === 0) return false;
  const s = Math.max(scale, 1e-6);
  const toward = -dir * Math.log(s);
  const speed = (-dir * velocity) / s;
  if (speed <= -ZOOM.flick) return false;
  return toward >= ZOOM.commit || (toward >= ZOOM.flickMin && speed >= ZOOM.flick);
};

/** Масштаб текущего вида под пальцами: есть куда переключать — за пальцами до конца перехода, иначе — резинка */
export const zoomFollow = (scale: number, canZoom: boolean): number => {
  'worklet';
  const z = Math.log(Math.max(scale, 1e-6));
  if (!canZoom) return Math.exp(z * ZOOM.rubber);
  return Math.exp(Math.max(-ZOOM.full, Math.min(ZOOM.full, z)));
};

/** Масштаб текущего вида в конце перехода: уходит туда же, куда вели пальцы */
export const zoomExitScale = (dir: ZoomDir): number => {
  'worklet';
  return Math.exp(-dir * ZOOM.full);
};

/** Масштаб следующего вида при ходе progress: проступает из e^(dir·0.2) к 1 */
export const zoomEnterScale = (progress: number, dir: ZoomDir): number => {
  'worklet';
  return Math.exp(dir * ZOOM.preview * (1 - Math.max(0, Math.min(1, progress))));
};

/** Сдвиг, чтобы масштаб s шёл вокруг точки (fx, fy) слоя w × h (RN масштабирует вокруг центра) */
export const zoomShift = (s: number, fx: number, fy: number, w: number, h: number): { x: number; y: number } => {
  'worklet';
  return { x: (fx - w / 2) * (1 - s), y: (fy - h / 2) * (1 - s) };
};
