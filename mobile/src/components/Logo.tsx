import React from 'react';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { useColors } from '@/theme';
import { T } from './ui';

/** Знак «Кстати»: три столбика голосовой волны, центральный красный. Цвета — из темы. */
export function LogoMark({ size = 40 }: { size?: number }) {
  const c = useColors();
  return (
    <Svg width={size} height={size} viewBox="22 22 56 56">
      <Rect x={27} y={38} width={7} height={24} rx={3.5} fill={c.text} />
      <Rect x={46.5} y={26} width={7} height={48} rx={3.5} fill={c.event} />
      <Rect x={66} y={35} width={7} height={30} rx={3.5} fill={c.text} />
    </Svg>
  );
}

/** Знак и название рядом — для экрана входа */
export function Logo() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <LogoMark size={36} />
      <T variant="title" weight="semibold">
        Кстати
      </T>
    </View>
  );
}
