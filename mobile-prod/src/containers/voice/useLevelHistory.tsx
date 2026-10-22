import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { recordedMs, useVoiceLevel } from '@/lib/voice';

const EMPTY: readonly number[] = [];

/**
 * Волна в шапке голосового окна: последние n значений громкости записи (useVoiceLevel 0…1 → 0…100).
 * Новая запись начинает с пустой волны; после записи остаётся волна сказанной фразы
 */
export function useLevelHistory(n: number): readonly number[] {
  const [levels, setLevels] = useState<readonly number[]>(EMPTY);
  useEffect(() => {
    let buf: number[] = [];
    const offPhase = useStore.subscribe((s, prev) => {
      if (s.voice === 'recording' && prev.voice !== 'recording') {
        buf = [];
        setLevels(EMPTY);
      }
    });
    const offLevel = useVoiceLevel.subscribe(({ level }) => {
      if (level == null || useStore.getState().voice !== 'recording') return;
      buf = [...buf, Math.round(Math.max(0, Math.min(1, level)) * 100)].slice(-n);
      setLevels(buf);
    });
    return () => {
      offPhase();
      offLevel();
    };
  }, [n]);
  return levels;
}

/** Длительность записи в мс с точностью до секунды: во время записи тикает, потом — длина последней */
export function useRecordedMs(live: boolean): number {
  const [ms, setMs] = useState(() => Math.floor(recordedMs() / 1000) * 1000);
  useEffect(() => {
    const read = () => setMs(Math.floor(recordedMs() / 1000) * 1000);
    read();
    if (!live) return;
    const t = setInterval(read, 250);
    return () => clearInterval(t);
  }, [live]);
  return ms;
}
