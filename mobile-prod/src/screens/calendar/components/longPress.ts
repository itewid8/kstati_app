import { useCallback } from 'react';
import type { ID } from '@/lib/types';
import type { LiftHandler, LiftTarget } from '@/ui';

/** Удержание элемента id → (id, нажатый блок); без обработчика — undefined (элемент не держится) */
export const useLongPressId = (id: ID, handler?: (id: ID, lift: LiftTarget) => void): LiftHandler | undefined => {
  const cb = useCallback((lift: LiftTarget) => handler?.(id, lift), [handler, id]);
  return handler ? cb : undefined;
};
