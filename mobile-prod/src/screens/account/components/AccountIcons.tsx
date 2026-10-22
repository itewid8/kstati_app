/**
 * Иконки экранов аккаунта, которых нет в src/ui/Icon (те же path, что в макетах).
 * Кандидаты в Icon: edit, copy, share.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { size as S, useTheme } from '@/ui';
import { BRAND } from './accountTheme';

type IconProps = { size: number; color: string; strokeWidth?: number };

/** Карандаш на плашке аватара */
export const EditIcon = memo(function EditIcon({ size, color, strokeWidth = 2.5 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
      <Path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </Svg>
  );
});

export const CopyIcon = memo(function CopyIcon({ size, color, strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
      <Rect x={9} y={9} width={12} height={12} />
      <Path d="M5 15H3V3h12v2" />
    </Svg>
  );
});

export const ShareIcon = memo(function ShareIcon({ size, color, strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
      <Path d="M4 12v8h16v-8M16 6l-4-4-4 4M12 2v13" />
    </Svg>
  );
});

/** Плитка 40×40 со знаком «Кстати» (пять столбиков волны, центральный красный) */
export const BrandTile = memo(function BrandTile() {
  const { c } = useTheme();
  return (
    <View accessible accessibilityLabel="Кстати" style={[styles.tile, { borderColor: c.border }]}>
      <Svg width={30} height={30} viewBox="0 0 100 100">
        <Rect x={21} y={39} width={7} height={22} rx={3.5} fill={BRAND.bar} />
        <Rect x={32.5} y={29} width={7} height={42} rx={3.5} fill={BRAND.bar} />
        <Rect x={46.5} y={19.5} width={7} height={61} rx={3.5} fill={BRAND.accent} />
        <Rect x={60.5} y={29} width={7} height={42} rx={3.5} fill={BRAND.bar} />
        <Rect x={72} y={39} width={7} height={22} rx={3.5} fill={BRAND.bar} />
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  tile: {
    width: S.iconButton,
    height: S.iconButton,
    borderWidth: S.border,
    backgroundColor: BRAND.tile,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
