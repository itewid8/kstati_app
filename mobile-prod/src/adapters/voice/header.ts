/** Шапка голосового окна: длительность записи, волна, ярлык действия */
import type { VoiceSheetHeader } from '@/screens/voice/types';

const pad2 = (n: number) => String(n).padStart(2, '0');

/** 4200 мс → «00:04» */
export function mmss(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  return `${pad2(Math.floor(sec / 60))}:${pad2(sec % 60)}`;
}

/** Расход команды: { tokens: 1840, rub: 0.37 } → «1 840 ТОК · 0,37 ₽» */
export function spendNote(spend: { tokens: number; rub: number }): string {
  const tokens = String(Math.max(0, Math.round(spend.tokens))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const rub = spend.rub < 0.005 ? '0' : spend.rub.toFixed(2).replace('.', ',');
  return `${tokens} ТОК · ${rub} ₽`;
}

/** live — идёт запись (красная точка, яркая волна); иначе запись закончена и показан ярлык действия */
export function sheetHeader(levels: readonly number[], ms: number, badge?: string, live = false): VoiceSheetHeader {
  return { duration: mmss(ms), levels, ...(live ? { live } : null), ...(badge ? { badge } : null) };
}
