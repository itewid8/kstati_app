/**
 * Сколько строк в каждом куске текста блока (название, время, описание, кто) — по высоте из onLayout.
 * Нужно fitTextLines: в блоке рисуются только строки, которые влезают целиком. Пока кусок не измерен — одна строка.
 * Высота меняется только при переносе (ширина блока, текст), так что лишних перерисовок нет.
 */
import { useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { linesOf } from '@/lib/calendarLayout';

type Handler = (e: LayoutChangeEvent) => void;

export const useTextLines = (lineHeights: readonly number[]): [readonly number[], readonly Handler[]] => {
  const n = lineHeights.length;
  const [heights, setHeights] = useState<readonly number[]>(() => lineHeights.map(() => 0));
  const handlers = useMemo(
    () =>
      Array.from({ length: n }, (_, i): Handler => (e) => {
        const h = e.nativeEvent.layout.height;
        setHeights((prev) => (Math.abs((prev[i] ?? 0) - h) < 0.5 ? prev : Array.from({ length: n }, (_, j) => (j === i ? h : (prev[j] ?? 0)))));
      }),
    [n],
  );
  const lines = useMemo(() => lineHeights.map((lh, i) => linesOf(heights[i] ?? 0, lh) || 1), [lineHeights, heights]);
  return [lines, handlers];
};
