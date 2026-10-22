import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type Insets = { top: number; bottom: number };

/** Верхний и нижний отступы safe area — объект стабилен, пока они не меняются */
export function useInsets(): Insets {
  const { top, bottom } = useSafeAreaInsets();
  return useMemo(() => ({ top, bottom }), [top, bottom]);
}
