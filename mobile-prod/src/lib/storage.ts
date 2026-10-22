/**
 * Хранилище на телефоне: JSON-файл в папке документов приложения.
 * Читаем синхронно (данные есть сразу при запуске), пишем с задержкой 0,4 с — не на каждое нажатие.
 * Пока нет сервера, это единственное место, где живут ваши данные.
 */
import { File, Paths } from 'expo-file-system';
import type { StateStorage } from 'zustand/middleware';

const file = (name: string) => new File(Paths.document, `${name}.json`);
/** Отложенные записи: таймер и последнее значение (его же пишет flushStorage) */
const pending = new Map<string, { timer: ReturnType<typeof setTimeout>; value: string }>();

function writeNow(name: string, value: string) {
  try {
    const f = file(name);
    if (!f.exists) f.create();
    f.write(value);
  } catch (e) {
    console.warn('Не удалось сохранить данные', e);
  }
}

function cancel(name: string) {
  const p = pending.get(name);
  if (p) clearTimeout(p.timer);
  pending.delete(name);
}

/**
 * Записать отложенное сейчас. Вызывается при уходе приложения в фон (sync.ts, AppState):
 * iOS может остановить приложение раньше, чем сработает таймер, и последняя правка потерялась бы
 */
export function flushStorage() {
  const all = [...pending.entries()];
  pending.clear();
  for (const [name, p] of all) {
    clearTimeout(p.timer);
    writeNow(name, p.value);
  }
}

export const fileStorage: StateStorage = {
  getItem: (name) => {
    try {
      const f = file(name);
      return f.exists ? f.textSync() : null;
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    cancel(name);
    const timer = setTimeout(() => {
      pending.delete(name);
      writeNow(name, value);
    }, 400);
    pending.set(name, { timer, value });
  },
  removeItem: (name) => {
    cancel(name);
    try {
      const f = file(name);
      if (f.exists) f.delete();
    } catch {
      /* нечего удалять */
    }
  },
};
