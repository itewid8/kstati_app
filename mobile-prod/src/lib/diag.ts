/**
 * Сведения для отчёта об ошибке (кнопка-жучок): журнал последних событий в памяти (переходы, ошибки, отказы сервера —
 * без текста дел и заметок), последняя ошибка и падение прошлого запуска (файл в документах приложения).
 * Модуль без зависимостей от хранилища: состояние приложения передаёт вызывающий (collectContext).
 */
import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import { Dimensions, Platform } from 'react-native';

export type DiagEvent = { at: string; type: 'route' | 'error' | 'net' | 'action'; text: string };

const MAX = 50;
const events: DiagEvent[] = [];
let lastError: { at: string; message: string; stack?: string; fatal?: boolean } | null = null;

/** Записать событие в журнал (текст — коротко и без личных данных) */
export function logEvent(type: DiagEvent['type'], text: string) {
  events.push({ at: new Date().toISOString(), type, text: text.slice(0, 200) });
  if (events.length > MAX) events.splice(0, events.length - MAX);
}

export function logError(e: unknown, fatal = false) {
  const err = e instanceof Error ? e : new Error(String(e));
  lastError = { at: new Date().toISOString(), message: err.message.slice(0, 500), stack: err.stack?.slice(0, 4000), fatal };
  logEvent('error', err.message);
  return lastError;
}

/* ---------- падение прошлого запуска ---------- */

// В браузере файлов нет — снимок падения не сохраняем (crashFile бросит, вызовы ниже в try)
const crashFile = () => {
  if (Platform.OS === 'web') throw new Error('web');
  return new File(Paths.document, 'last-crash.json');
};

export type CrashInfo = { at: string; message: string; stack?: string; events: DiagEvent[] };

function saveCrash(e: unknown) {
  try {
    const err = logError(e, true);
    const f = crashFile();
    if (!f.exists) f.create();
    f.write(JSON.stringify({ ...err, events } satisfies CrashInfo));
  } catch {
    /* записать не вышло — ничего не поделать */
  }
}

/** Падение прошлого запуска (и забыть его): null — не падало */
export function takeCrash(): CrashInfo | null {
  try {
    const f = crashFile();
    if (!f.exists) return null;
    const crash = JSON.parse(f.textSync()) as CrashInfo;
    f.delete();
    return crash;
  } catch {
    return null;
  }
}

type GlobalErrorUtils = { getGlobalHandler: () => (e: unknown, fatal?: boolean) => void; setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void };
let installed = false;

/** Ловушка необработанных ошибок: фатальная — в файл (спросим при следующем запуске), любая — в журнал */
export function installCrashHandler() {
  const eu = (globalThis as { ErrorUtils?: GlobalErrorUtils }).ErrorUtils;
  if (installed || !eu) return;
  installed = true;
  const prev = eu.getGlobalHandler();
  eu.setGlobalHandler((e, fatal) => {
    if (fatal) saveCrash(e);
    else logError(e);
    prev(e, fatal);
  });
}

/* ---------- сведения ---------- */

export type AppState = Record<string, unknown>;

/** Всё, что нужно разобрать отчёт: приложение, устройство, экран, состояние, журнал, последняя ошибка */
export function collectContext(route: string, state: AppState, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const cfg = Constants.expoConfig;
  const { width, height, scale } = Dimensions.get('window');
  const constants = Platform.constants as Record<string, unknown> | undefined;
  return {
    app: { version: cfg?.version, build: Platform.OS === 'ios' ? cfg?.ios?.buildNumber : cfg?.android?.versionCode },
    device: {
      os: Platform.OS,
      osVersion: String(Platform.Version),
      model: constants?.Model ?? constants?.model ?? Constants.deviceName ?? null,
      screen: `${Math.round(width)}×${Math.round(height)} @${scale}`,
    },
    time: { now: new Date().toISOString(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
    route,
    state,
    lastError,
    events: [...events],
    ...extra,
  };
}
