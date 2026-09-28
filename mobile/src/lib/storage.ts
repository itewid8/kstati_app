/**
 * Хранилище на телефоне: JSON-файл в папке документов приложения.
 * Читаем синхронно (данные есть сразу при запуске), пишем с задержкой 0,4 с — не на каждое нажатие.
 * Пока нет сервера, это единственное место, где живут ваши данные.
 */
import { File, Paths } from 'expo-file-system';
import type { StateStorage } from 'zustand/middleware';

const file = (name: string) => new File(Paths.document, `${name}.json`);
const pending = new Map<string, ReturnType<typeof setTimeout>>();

function writeNow(name: string, value: string) {
  try {
    const f = file(name);
    if (!f.exists) f.create();
    f.write(value);
  } catch (e) {
    console.warn('Не удалось сохранить данные', e);
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
    clearTimeout(pending.get(name));
    pending.set(name, setTimeout(() => writeNow(name, value), 400));
  },
  removeItem: (name) => {
    clearTimeout(pending.get(name));
    try {
      const f = file(name);
      if (f.exists) f.delete();
    } catch {
      /* нечего удалять */
    }
  },
};
