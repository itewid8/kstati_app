/**
 * «Поделиться → Кстати» (модуль modules/kstati-share, только Android). Нет модуля (iOS, старая сборка) — ничего не приходит.
 */
import { requireOptionalNativeModule } from 'expo';

export type SharePayload = {
  subject: string | null;
  texts: string[];
  /** Текстовые файлы (.txt, .md) */
  files: { name: string; text: string }[];
  /** Сколько пришло не текстом (картинки) — не переносятся */
  skipped: number;
  /** Пакет приложения-источника, если Android его сообщил */
  from: string | null;
};

type Native = { take(): SharePayload | null; addListener(name: 'onShare', fn: () => void): { remove(): void } };

const native = requireOptionalNativeModule<Native>('KstatiShare');

/** Забрать то, чем поделились (один раз) */
export function takeShared(): SharePayload | null {
  try {
    return native?.take() ?? null;
  } catch {
    return null;
  }
}

/** Поделились, пока приложение открыто */
export function onShared(fn: () => void): () => void {
  if (!native) return () => {};
  const sub = native.addListener('onShare', fn);
  return () => sub.remove();
}
