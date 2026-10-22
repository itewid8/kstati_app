import { useSyncExternalStore } from 'react';
import { AppState, type NativeEventSubscription } from 'react-native';
import type { Clock } from '@/adapters/snapshot';
import { toISODate } from '@/lib/dates';

const clockOf = (d: Date): Clock => ({ today: toISODate(d), now: d.getHours() * 60 + d.getMinutes(), nowIso: d.toISOString() });

/*
 * Одни часы на всё приложение: тик на границе минуты и при возвращении в приложение.
 * Таймер работает, только пока на экране есть кто-то, кто их читает.
 */
let current = clockOf(new Date());
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
let appState: NativeEventSubscription | null = null;

function tick() {
  const d = new Date();
  const next = clockOf(d);
  if (next.today !== current.today || next.now !== current.now) {
    current = next;
    listeners.forEach((l) => l());
  }
  if (timer) clearTimeout(timer);
  // Следующая граница минуты (+50 мс, чтобы не проснуться чуть раньше)
  timer = setTimeout(tick, 60_000 - d.getSeconds() * 1000 - d.getMilliseconds() + 50);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    tick();
    appState = AppState.addEventListener('change', (st) => st === 'active' && tick());
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size) return;
    if (timer) clearTimeout(timer);
    timer = null;
    appState?.remove();
    appState = null;
  };
}

const getSnapshot = () => current;

/** Сегодня и минуты от полуночи — меняются раз в минуту (объект стабилен между тиками) */
export const useClock = (): Clock => useSyncExternalStore(subscribe, getSnapshot);
