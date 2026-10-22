/** Шапка голосового окна: длительность записи, волна, ярлык действия */
import type { VoiceSheetHeader } from '@/screens/voice/types';

const pad2 = (n: number) => String(n).padStart(2, '0');

/** 4200 мс → «00:04» */
export function mmss(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  return `${pad2(Math.floor(sec / 60))}:${pad2(sec % 60)}`;
}

/** live — идёт запись (красная точка, яркая волна); иначе запись закончена и показан ярлык действия */
export function sheetHeader(levels: readonly number[], ms: number, badge?: string, live = false): VoiceSheetHeader {
  return { duration: mmss(ms), levels, ...(live ? { live } : null), ...(badge ? { badge } : null) };
}
