import { useColorScheme } from 'react-native';
import type { PersonColor } from '@/lib/types';
import { palettes, personColor, personInk, type Palette, type Scheme } from './tokens';

export type Theme = {
  scheme: Scheme;
  dark: boolean;
  c: Palette;
  /** Цвет человека под текущую тему */
  person: (color: PersonColor) => string;
  /** Текст поверх цвета человека */
  personInk: (color: PersonColor) => string;
};

const themes: Record<Scheme, Theme> = {
  light: {
    scheme: 'light',
    dark: false,
    c: palettes.light,
    person: (color) => personColor(color, 'light'),
    personInk: (color) => personInk(color, 'light'),
  },
  dark: {
    scheme: 'dark',
    dark: true,
    c: palettes.dark,
    person: (color) => personColor(color, 'dark'),
    personInk: (color) => personInk(color, 'dark'),
  },
};

/** Тема по системе (или выбранная в настройках через Appearance). Объект стабилен для каждой темы */
export function useTheme(): Theme {
  return themes[useColorScheme() === 'dark' ? 'dark' : 'light'];
}
