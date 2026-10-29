/**
 * Цвета поля ввода: курсор — цветом текста, выделение — синим (на Android выделение заливается этим цветом целиком,
 * поэтому полупрозрачным, иначе выделенный текст сливается с заливкой; на iOS прозрачность система добавляет сама)
 */
import { Platform } from 'react-native';
import { useTheme } from './useTheme';
import { tint } from './tokens';

export function useInputColors(): { selectionColor: string; cursorColor: string } {
  const { c, person } = useTheme();
  const blue = person('blue');
  return { selectionColor: Platform.OS === 'android' ? tint(blue, 0.35) : blue, cursorColor: c.text };
}
