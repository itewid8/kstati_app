/** Типы react-native-svg для scripts/typecheck-lite.sh: элементы, которые рисуют src/screens и src/ui */
declare module 'react-native-svg' {
  import type { ComponentType, ReactNode } from 'react';
  import type { StyleProp, ViewStyle } from 'react-native';

  type NumberProp = number | string;
  type Loose = { [key: string]: unknown };
  export type SvgElementProps = Loose & {
    children?: ReactNode;
    fill?: string;
    fillOpacity?: NumberProp;
    stroke?: string;
    strokeWidth?: NumberProp;
    strokeLinecap?: 'butt' | 'round' | 'square';
    strokeLinejoin?: 'miter' | 'round' | 'bevel';
    opacity?: NumberProp;
    clipPath?: string;
  };
  export type SvgProps = SvgElementProps & { width?: NumberProp; height?: NumberProp; viewBox?: string; style?: StyleProp<ViewStyle> };

  const Svg: ComponentType<SvgProps>;
  export default Svg;
  export const Path: ComponentType<SvgElementProps & { d?: string }>;
  export const Rect: ComponentType<SvgElementProps & { x?: NumberProp; y?: NumberProp; width?: NumberProp; height?: NumberProp; rx?: NumberProp }>;
  export const Circle: ComponentType<SvgElementProps & { cx?: NumberProp; cy?: NumberProp; r?: NumberProp }>;
  export const G: ComponentType<SvgElementProps>;
  export const Defs: ComponentType<{ children?: ReactNode }>;
  export const ClipPath: ComponentType<{ id: string; children?: ReactNode }>;
  export const LinearGradient: ComponentType<Loose & { id: string; x1?: NumberProp; y1?: NumberProp; x2?: NumberProp; y2?: NumberProp; children?: ReactNode }>;
  export const Stop: ComponentType<Loose & { offset?: NumberProp; stopColor?: string; stopOpacity?: NumberProp }>;
}
