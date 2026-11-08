/**
 * AppMetrica (Яндекс): падения приложения, ошибки и несколько своих событий. Данные хранятся в России.
 * Ключ — EXPO_PUBLIC_APPMETRICA_KEY в mobile-prod/.env (не секрет: он всё равно внутри приложения). Без ключа
 * или без нативного модуля (Expo Go) все вызовы молча ничего не делают. В вебе — пустышка (analytics.web.ts).
 *
 * Что уходит: падения (нативные — сам модуль, JS — через ловушку в lib/diag.ts), ошибки, пойманные в коде,
 * последние переходы между экранами к падению, версия, модель телефона, система, id пользователя в приложении.
 * Что не уходит: тексты команд, названия дел, заметки — вообще никакое содержимое. Рекламный id и место — выключены.
 */
type AM = {
  activate: (cfg: Record<string, unknown>) => void;
  reportEvent: (name: string, params?: Record<string, unknown>) => void;
  reportError: (identifier: string, message?: string, reason?: Error) => void;
  reportUnhandledException: (error: Error) => void;
  putErrorEnvironmentValue: (key: string, value?: string) => void;
  setUserProfileID: (id?: string) => void;
};

const KEY = process.env.EXPO_PUBLIC_APPMETRICA_KEY ?? '';
let am: AM | null = null;

export function initAnalytics() {
  if (!KEY || am) return;
  try {
    const mod = require('@appmetrica/react-native-analytics');
    const lib = (mod.default ?? mod) as AM;
    lib.activate({
      apiKey: KEY,
      sessionTimeout: 120,
      crashReporting: true,
      nativeCrashReporting: true,
      locationTracking: false,
      advIdentifiersTracking: false,
      revenueAutoTrackingEnabled: false,
      logs: __DEV__,
    });
    am = lib;
  } catch (e) {
    am = null;
    console.warn('AppMetrica не подключена', e);
  }
}

/** Аналитика не должна мешать работе: любая её ошибка глотается */
const safe = (f: (m: AM) => void) => {
  if (!am) return;
  try {
    f(am);
  } catch {
    /* ничего */
  }
};

export function track(event: string, params?: Record<string, string | number | boolean>) {
  safe((m) => m.reportEvent(event, params));
}

/** Кто пользуется (id в приложении, не почта) — чтобы найти падения человека, который написал в поддержку */
export function setAnalyticsUser(id: string | null) {
  safe((m) => m.setUserProfileID(id ?? undefined));
}

const asError = (e: unknown) => (e instanceof Error ? e : new Error(String(e)));
/** Последние переходы и действия — приложатся к отчёту о падении */
const withTrail = (m: AM, trail: string) => m.putErrorEnvironmentValue('trail', trail.slice(-1000));

/** Падение: необработанная ошибка JS или экран «Что-то сломалось» */
export function reportCrash(e: unknown, trail: string) {
  safe((m) => {
    withTrail(m, trail);
    m.reportUnhandledException(asError(e));
  });
}

/** Ошибка, после которой приложение работает дальше. Группируется по месту и первой строке сообщения */
export function reportProblem(e: unknown, trail: string) {
  const err = asError(e);
  safe((m) => {
    withTrail(m, trail);
    m.reportError(err.message.split('\n')[0]!.slice(0, 100) || 'error', err.message.slice(0, 500), err);
  });
}
