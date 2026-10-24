/**
 * Запросы к серверу «Кстати». Токен передаётся явно — модуль не знает про хранилище.
 * Ошибки: ApiError — сервер ответил отказом (status, code, message); NetError — нет ответа нашего сервера (http.ts).
 */
import Constants from 'expo-constants';
import { API_URL } from './config';
import { ApiError, exchange, NetError } from './http';

/** Уровень API, который понимает приложение: сервер включает для него новые поля и виды ответа */
export const API_LEVEL = 3;

const build = String(Constants.expoConfig?.android?.versionCode ?? Constants.expoConfig?.ios?.buildNumber ?? '0');
/** Версия клиента для журнала сервера: «ru.kstati.app/0.1.0(1)» */
export const APP_ID = `ru.kstati.app/${Constants.expoConfig?.version ?? '0'}(${build})`;

export { ApiError, failKind, NetError } from './http';

/** Текст ошибки для человека */
export const errorText = (e: unknown): string =>
  e instanceof ApiError ? e.message : e instanceof NetError ? 'Нет связи с сервером. Проверьте интернет.' : 'Что-то пошло не так';

/**
 * Запрос к серверу. Таймаут — на весь запрос вместе с телом ответа (http.ts, exchange).
 * Ошибка: ApiError — отказ в формате нашего сервера; NetError — всё остальное (нет связи, таймаут, страница прокси/VPN)
 */
export async function request<T = unknown>(
  path: string,
  opts: { method?: 'GET' | 'POST' | 'DELETE'; body?: unknown; token?: string | null; timeoutMs?: number } = {},
): Promise<T> {
  const data = await exchange(
    new AbortController(),
    (signal) =>
      fetch(`${API_URL}${path}`, {
        method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
        headers: {
          'x-kstati-api': String(API_LEVEL),
          'x-kstati-app': APP_ID,
          ...(opts.body !== undefined && { 'Content-Type': 'application/json' }),
          // Не Authorization: его перехватывает Яндекс Облако (см. server/src/auth.ts)
          ...(opts.token && { 'X-Kstati-Token': opts.token }),
        },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal,
      }),
    opts.timeoutMs ?? 20_000,
  );
  return data as T;
}

/* ---------- операции изменения данных (POST /ops): описаны в ops.ts (без зависимостей от Expo) ---------- */
export { opKey, type Op, type OpResult } from './ops';
