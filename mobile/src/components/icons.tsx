/**
 * Иконки приложения — только те 11, что нужны. Контуры взяты из Lucide (лицензия ISC).
 * Раньше подключалась вся библиотека lucide-react-native (~1 800 иконок в сборке).
 */
import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

type IconProps = { size?: number; strokeWidth?: number; color?: string };

function make(children: React.ReactNode) {
  return function Icon({ size = 24, strokeWidth = 2, color = '#000' }: IconProps) {
    return (
      <Svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </Svg>
    );
  };
}

export const CalendarDays = make(
  <>
    <Path d="M8 2v3" />
    <Path d="M16 2v3" />
    <Rect x="3" y="3" width="18" height="18" rx="2" />
    <Path d="M3 9h18" />
    <Path d="M8 13h.01" />
    <Path d="M12 13h.01" />
    <Path d="M16 13h.01" />
    <Path d="M8 17h.01" />
    <Path d="M12 17h.01" />
    <Path d="M16 17h.01" />
  </>,
);
export const Check = make(<Path d="M20 6 9 17l-5-5" />);
export const ChevronDown = make(<Path d="m6 9 6 6 6-6" />);
export const ChevronLeft = make(<Path d="m15 18-6-6 6-6" />);
export const ChevronRight = make(<Path d="m9 18 6-6-6-6" />);
export const ExternalLink = make(
  <>
    <Path d="M15 3h6v6" />
    <Path d="M10 14 21 3" />
    <Path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </>,
);
export const List = make(
  <>
    <Path d="M3 5h.01" />
    <Path d="M3 12h.01" />
    <Path d="M3 19h.01" />
    <Path d="M8 5h13" />
    <Path d="M8 12h13" />
    <Path d="M8 19h13" />
  </>,
);
export const Mic = make(
  <>
    <Path d="M12 19v3" />
    <Path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <Rect x="9" y="2" width="6" height="13" rx="3" />
  </>,
);
export const Plus = make(
  <>
    <Path d="M5 12h14" />
    <Path d="M12 5v14" />
  </>,
);
export const Trash2 = make(
  <>
    <Path d="M10 11v6" />
    <Path d="M14 11v6" />
    <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <Path d="M3 6h18" />
    <Path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </>,
);
export const X = make(
  <>
    <Path d="M18 6 6 18" />
    <Path d="m6 6 12 12" />
  </>,
);
