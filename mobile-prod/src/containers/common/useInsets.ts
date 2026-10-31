import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type Insets = { top: number; bottom: number };

/**
 * Насколько шапку экранов поднять ближе к строке состояния (отзыв #4 «слишком много пустого пространства»):
 * верхняя панель стоит на size.topBarTop (20) ниже safe area — на телефоне это лишние 12 dp пустоты над кнопками.
 * Сдвиг общий для всех экранов (всё отсчитывается от insets.top), поэтому раскладка внутри экранов не меняется.
 * Без строки состояния (стенд сверки, web) отступ 0 — там ничего не сдвигаем
 */
export const HEAD_TIGHTEN = 12;

/** Верхний и нижний отступы safe area — объект стабилен, пока они не меняются */
export function useInsets(): Insets {
  const { top, bottom } = useSafeAreaInsets();
  const tight = top > HEAD_TIGHTEN ? top - HEAD_TIGHTEN : top;
  return useMemo(() => ({ top: tight, bottom }), [tight, bottom]);
}
