import { useMemo } from 'react';
import { colorMap, type ColorMap } from '@/adapters/common/people';
import type { Snapshot } from '@/adapters/snapshot';

/** Цвета людей: пересчитываются, только когда меняются me, люди или группы (не на каждую правку дел) */
export function usePersonColors(s: Pick<Snapshot, 'me' | 'users' | 'groups'>): ColorMap {
  const { me, users, groups } = s;
  return useMemo(() => colorMap({ me, users, groups }), [me, users, groups]);
}
