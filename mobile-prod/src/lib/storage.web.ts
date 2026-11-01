/**
 * Хранилище в браузере (веб-версия): localStorage вместо файла на телефоне. Тот же интерфейс, что у storage.ts.
 * Пишем с задержкой 0,4 с, как на телефоне; flushStorage — при закрытии вкладки.
 */
import type { StateStorage } from 'zustand/middleware';

const KEY = (name: string) => `kstati:${name}`;
const pending = new Map<string, { timer: ReturnType<typeof setTimeout>; value: string }>();

function writeNow(name: string, value: string) {
  try {
    localStorage.setItem(KEY(name), value);
  } catch (e) {
    console.warn('Не удалось сохранить данные', e);
  }
}

export function flushStorage() {
  const all = [...pending.entries()];
  pending.clear();
  for (const [name, p] of all) {
    clearTimeout(p.timer);
    writeNow(name, p.value);
  }
}

if (typeof window !== 'undefined') window.addEventListener('pagehide', flushStorage);

export const fileStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(KEY(name));
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    const p = pending.get(name);
    if (p) clearTimeout(p.timer);
    const timer = setTimeout(() => {
      pending.delete(name);
      writeNow(name, value);
    }, 400);
    pending.set(name, { timer, value });
  },
  removeItem: (name) => {
    const p = pending.get(name);
    if (p) clearTimeout(p.timer);
    pending.delete(name);
    try {
      localStorage.removeItem(KEY(name));
    } catch {
      /* нечего удалять */
    }
  },
};
