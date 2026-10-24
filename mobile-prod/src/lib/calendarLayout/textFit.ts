/**
 * Сколько строк текста целиком помещается в блоке (дело недели и дня, полоса, ячейка месяца).
 * Строка, которая влезает не по всей высоте, не рисуется вовсе: обрезанный по высоте кусок текста некрасив.
 *
 * Текст блока — столбец кусков (название, время, описание, кто). У куска своя высота строки и число строк
 * (после переноса), между соседними кусками — зазор (gap у столбца). Куски идут по порядку: не влез кусок —
 * не рисуются и все ниже. Многострочный кусок показывается по целым строкам (окно высотой height обрезает
 * его ровно по границе строки).
 */

export type TextSegment = {
  /** Высота строки куска, px */
  readonly lineHeight: number;
  /** Сколько строк в куске после переноса; 0 — куска нет (без зазора) */
  readonly lines: number;
  /** Зазор над куском, если выше есть видимый кусок */
  readonly gapBefore?: number;
};

export type TextFit = {
  /** Высота окна текста: сумма видимых строк и зазоров между видимыми кусками */
  readonly height: number;
  /** Видимых строк в каждом куске (0 — кусок не рисуется) */
  readonly lines: readonly number[];
};

/** Погрешность дробных высот (часы, рамки 1.5px): строка «влезает», если не хватает меньше сотой пикселя */
const EPS = 0.01;

export const fitTextLines = (avail: number, segments: readonly TextSegment[]): TextFit => {
  const lines = segments.map(() => 0);
  let y = 0;
  let any = false;
  for (let i = 0; i < segments.length; i++) {
    const { lineHeight, lines: n, gapBefore = 0 } = segments[i];
    if (n <= 0 || lineHeight <= 0) continue;
    const gap = any ? gapBefore : 0;
    const fit = Math.min(n, Math.floor((avail - y - gap + EPS) / lineHeight));
    if (fit <= 0) break;
    lines[i] = fit;
    y += gap + fit * lineHeight;
    any = true;
    if (fit < n) break;
  }
  return { height: y, lines };
};

/** Строк по измеренной высоте куска (onLayout): 0 — ещё не измерен или пуст */
export const linesOf = (height: number, lineHeight: number): number =>
  lineHeight > 0 && height > 0 ? Math.max(1, Math.round(height / lineHeight)) : 0;

/**
 * Сколько одинаковых строк (дел ячейки месяца) помещается в высоту avail при зазоре gap между ними, но не больше max
 */
export const fitRows = (avail: number, rowHeight: number, gap: number, max: number): number =>
  Math.max(0, Math.min(max, Math.floor((avail + gap + EPS) / (rowHeight + gap))));

/** Полоса формы блока (Band из dayColumn): по ней текст обрезается по горизонтали */
type TextBand = { readonly y0: number; readonly y1: number; readonly left: number; readonly right: number };

/**
 * Высота под текст в блоке недели от top (textInsetTop) вниз: пока полосы идут подряд и в каждой текст рисуется
 * (шире minWidth — узкая полоса основы под гостем текст не показывает). Ниже первой такой узкой полосы
 * строка была бы срезана верхом гостя
 */
export const textRoom = (bands: readonly TextBand[], top: number, minWidth: number): number => {
  let bottom = top;
  for (const b of bands) {
    if (b.y1 <= top + EPS) continue;
    if (b.y0 > bottom + EPS || b.right - b.left <= minWidth + EPS) break;
    bottom = b.y1;
  }
  return Math.max(0, bottom - top);
};
