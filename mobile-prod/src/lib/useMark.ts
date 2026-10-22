import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';

/** Сколько отмеченная строка остаётся на месте, прежде чем уехать в «Выполнено» */
export const MARK_DELAY = 1200;

/**
 * Отметка с задержкой: строка сразу показывает галочку и зачёркивание,
 * а в хранилище отметка уходит через MARK_DELAY — тогда строка плавно переезжает.
 * Повторный тап в эти 1,2 с отменяет отметку. Снятие отметки — сразу.
 */
export function useDelayedMark(isDone: boolean, commit: () => void, delay = MARK_DELAY) {
  const [pending, setPending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitRef = useRef(commit);
  commitRef.current = commit;

  // Ушли с экрана во время ожидания — отметку всё равно сохраняем
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        commitRef.current();
      }
    },
    [],
  );

  const toggle = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      setPending(false);
      return;
    }
    if (isDone) {
      commit();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (delay === 0) {
      commit();
      return;
    }
    setPending(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      commitRef.current();
      setPending(false);
    }, delay);
  };

  return { marked: isDone || pending, toggle };
}
