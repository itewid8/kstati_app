/**
 * AppMetrica (Яндекс): сессии, падения приложения и несколько своих событий.
 * Включается, только если в mobile/.env задан EXPO_PUBLIC_APPMETRICA_KEY и установлен пакет
 * @appmetrica/react-native-analytics. Иначе все вызовы молча ничего не делают.
 * Содержимое фраз и записей сюда не отправляем — только типы событий.
 */
const KEY = process.env.EXPO_PUBLIC_APPMETRICA_KEY ?? '';

type AM = { activate: (cfg: Record<string, unknown>) => void; reportEvent: (name: string, params?: Record<string, unknown>) => void };
let am: AM | null = null;

export function initAnalytics() {
  if (!KEY || am) return;
  try {
    // Необязательная зависимость: без пакета сборка не ломается
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@appmetrica/react-native-analytics');
    am = (mod.default ?? mod) as AM;
    am.activate({ apiKey: KEY, sessionTimeout: 120, crashReporting: true, logs: __DEV__ });
  } catch (e) {
    am = null;
    console.warn('AppMetrica не подключена', e);
  }
}

export function track(event: string, params?: Record<string, string | number | boolean>) {
  try {
    am?.reportEvent(event, params);
  } catch {
    /* аналитика не должна мешать работе */
  }
}
