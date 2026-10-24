/**
 * Штриховка поверх записи: моё дело, которое открытая группа не видит (lib/visibility.ts, hiddenIn).
 * Диагональные линии 1.5 с шагом 6 цветом текста, прозрачно — запись читается, но видно, что она «только моя».
 */
import { memo, useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';
import { useTheme } from './useTheme';

export const HATCH = { step: 6, line: 1.5, opacity: 0.16 } as const;

/** Узор штриховки для своего Svg (неделя рисует блок путём) — id из useHatchId */
export const HatchPattern = memo(function HatchPattern({ id, color }: { id: string; color: string }) {
  return (
    <Pattern id={id} patternUnits="userSpaceOnUse" width={HATCH.step} height={HATCH.step} patternTransform="rotate(45)">
      <Rect x={0} y={0} width={HATCH.line} height={HATCH.step} fill={color} fillOpacity={HATCH.opacity} />
    </Pattern>
  );
});

export const useHatchId = () => `hatch${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

/** Штриховка во весь родитель (absolute) */
export const Hatch = memo(function Hatch() {
  const { c } = useTheme();
  const id = useHatchId();
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <HatchPattern id={id} color={c.text} />
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
});
