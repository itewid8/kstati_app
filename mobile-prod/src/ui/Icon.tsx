import { memo } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

type IconSpec = {
  d: string;
  /** Кружки контура (ползунки фильтра) */
  rings?: ReadonlyArray<readonly [number, number, number]>;
  /** Залитые кружки вместо линий (три точки) */
  dots?: ReadonlyArray<readonly [number, number, number]>;
  strokeWidth: number;
};

/** Линейные иконки 24×24 из макетов C-* (тот же path, что в HTML) */
const ICONS = {
  back: { d: 'm15 18-6-6 6-6', strokeWidth: 2 },
  forward: { d: 'm9 18 6-6-6-6', strokeWidth: 2 },
  plus: { d: 'M12 5v14M5 12h14', strokeWidth: 2 },
  bell: { d: 'M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0', strokeWidth: 2 },
  list: { d: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01', strokeWidth: 2 },
  chevronUp: { d: 'm6 15 6-6 6 6', strokeWidth: 3 },
  chevronDown: { d: 'm6 9 6 6 6-6', strokeWidth: 3 },
  chevronRight: { d: 'm9 18 6-6-6-6', strokeWidth: 2.2 },
  close: { d: 'M18 6 6 18M6 6l12 12', strokeWidth: 2 },
  check: { d: 'M5 12l5 5L20 7', strokeWidth: 3.5 },
  link: { d: 'M7 17 17 7M8 7h9v9', strokeWidth: 2.2 },
  /** Стрелка «было → станет» (C-ShareAsk) */
  arrow: { d: 'M5 12h14M13 6l6 6-6 6', strokeWidth: 2 },
  /** Замок «Только я» (C-EditVisible, C-ShareMine) */
  lock: { d: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4', strokeWidth: 2.4 },
  filter: {
    d: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0',
    rings: [
      [16, 6, 2],
      [10, 12, 2],
      [18, 18, 2],
    ],
    strokeWidth: 2,
  },
  dots: {
    d: '',
    dots: [
      [5, 12, 1.8],
      [12, 12, 1.8],
      [19, 12, 1.8],
    ],
    strokeWidth: 0,
  },
  people: {
    d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    strokeWidth: 2.2,
  },
} as const satisfies Record<string, IconSpec>;

export type IconName = keyof typeof ICONS;

type Props = {
  name: IconName;
  size: number;
  color: string;
  /** По умолчанию — толщина из макета для этой иконки */
  strokeWidth?: number;
};

export const Icon = memo(function Icon({ name, size, color, strokeWidth }: Props) {
  const spec: IconSpec = ICONS[name];
  if (spec.dots) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        {spec.dots.map(([cx, cy, r]) => (
          <Circle key={cx} cx={cx} cy={cy} r={r} />
        ))}
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth ?? spec.strokeWidth}>
      <Path d={spec.d} />
      {spec.rings?.map(([cx, cy, r]) => <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />)}
    </Svg>
  );
});
