import { useColorScheme } from 'react-native';

export type Colors = {
  background: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  danger: string;
  /** «Свободен», успешные подсказки */
  success: string;
  /** Дни с делами в календаре: заливка и цифра на ней */
  event: string;
  onEvent: string;
  scrim: string;
};

const dark: Colors = {
  background: '#1E1E1E',
  surface: '#252526',
  border: '#333333',
  text: '#E6E6E6',
  textMuted: '#8B8B8B',
  primary: '#E6E6E6',
  onPrimary: '#1E1E1E',
  danger: '#D16969',
  success: '#73C991',
  // Красный в духе VS Code / Fluent: приглушённый, белая цифра читается (контраст ≥ 4.5)
  event: '#C4314B',
  onEvent: '#FFFFFF',
  scrim: 'rgba(0,0,0,0.5)',
};

const light: Colors = {
  background: '#FFFFFF',
  surface: '#F7F7F7',
  border: '#E5E5E5',
  text: '#1A1A1A',
  textMuted: '#6B6B6B',
  primary: '#1A1A1A',
  onPrimary: '#FFFFFF',
  danger: '#C0392B',
  success: '#2E7D32',
  event: '#D13438',
  onEvent: '#FFFFFF',
  scrim: 'rgba(0,0,0,0.25)',
};

/** Тема: «как в системе» или выбранная в настройках (выбор применяется через Appearance в app/_layout) */
export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export const font = {
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
  mono: 'GeistMono_400Regular',
};

export const size = {
  title: 22,
  body: 16,
  caption: 13,
  label: 12,
};

export const space = {
  side: 16,
  rowMin: 52,
};

export const motion = {
  fast: 150,
  base: 200,
};

export const ICON = { size: 20, stroke: 1.5 };
