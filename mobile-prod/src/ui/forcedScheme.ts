/**
 * Тема, выбранная в настройках, там, где Appearance.setColorScheme нет (веб): «светлая» / «тёмная» поверх системной.
 * На телефоне всегда null — тему переключает сама система через Appearance.
 */
import { useSyncExternalStore } from 'react';

type Scheme = 'light' | 'dark';
let forced: Scheme | null = null;
const listeners = new Set<() => void>();

export function setForcedScheme(s: Scheme | null) {
  if (forced === s) return;
  forced = s;
  listeners.forEach((f) => f());
}

const subscribe = (f: () => void) => {
  listeners.add(f);
  return () => listeners.delete(f);
};

export const useForcedScheme = (): Scheme | null => useSyncExternalStore(subscribe, () => forced, () => forced);
