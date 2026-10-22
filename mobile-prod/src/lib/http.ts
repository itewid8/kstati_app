/**
 * Ответ сервера → данные или ошибка. Чистый модуль (без Expo): его подключают net.ts, sync.ts и тесты.
 *
 * Отказом сервера (ApiError) считается только ответ в формате нашего сервера: JSON { error: 'snake_code', message? }
 * (server/src/app.ts, setErrorHandler). Всё остальное — NetError, то есть «повторить позже»:
 * нет связи, TLS, таймаут, страница прокси или VPN (403/451/502/503 в HTML), JSON без кода, ответ 200 не в JSON
 * (портал Wi-Fi, заглушка провайдера). Иначе такая страница выглядела бы как окончательный отказ, и правка терялась.
 */
import type { FailKind } from './outbox';
import type { OpResult } from './ops';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Ответа нашего сервера нет. status — код ответа, если он был (страница прокси), иначе null */
export class NetError extends Error {
  constructor(
    message: string,
    public status: number | null = null,
  ) {
    super(message);
  }
}

/** Код ошибки нашего сервера: «not_member», «bad_request» (не «Not Found» из чужого JSON) */
const CODE = /^[a-z][a-z0-9_]*$/;

/** Ошибка в формате нашего сервера или null */
export function serverError(contentType: string | null, text: string): { code: string; message: string | null } | null {
  if (!contentType || !/\bjson\b/i.test(contentType)) return null;
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return null;
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const { error, message } = body as { error?: unknown; message?: unknown };
  if (typeof error !== 'string' || !CODE.test(error)) return null;
  return { code: error, message: typeof message === 'string' ? message : null };
}

/** Тело ответа → данные (2xx) или исключение ApiError / NetError */
export function readBody(status: number, contentType: string | null, text: string): unknown {
  if (status >= 200 && status < 300) {
    if (!text.trim()) return null;
    if (contentType && /html/i.test(contentType)) throw new NetError(`bad_response ${status}`, status);
    try {
      return JSON.parse(text);
    } catch {
      throw new NetError(`bad_response ${status}`, status);
    }
  }
  const err = serverError(contentType, text);
  if (!err) throw new NetError(`http_${status}`, status);
  throw new ApiError(status, err.code, err.message ?? `Ошибка сервера (${status})`);
}

/** Ошибка запроса: выйти (401 нашего сервера), повторить позже или окончательный отказ (прочие 4xx нашего сервера) */
export function failKind(e: unknown): FailKind {
  if (!(e instanceof ApiError)) return 'retry';
  if (e.status === 401) return 'auth';
  if (e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429) return 'reject';
  return 'retry';
}

/** Код отказа для журнала и карантина */
export const failCode = (e: unknown): string => (e instanceof ApiError ? e.code : e instanceof NetError ? 'net' : 'unknown');

export type ResponseLike = { status: number; headers: { get(name: string): string | null }; text(): Promise<string> };

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Запрос с таймаутом на всё сразу: соединение, заголовки и тело. По таймеру запрос отменяется (abort),
 * а ответ ждём не дольше timeoutMs, даже если fetch отмену не заметил: зависшее VPN-соединение не держит очередь
 */
export async function exchange<S>(
  ctrl: { readonly signal: S; abort(): void },
  send: (signal: S) => Promise<ResponseLike>,
  timeoutMs: number,
): Promise<unknown> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      ctrl.abort();
      reject(new NetError('timeout'));
    }, timeoutMs);
  });
  const work = (async () => {
    let res: ResponseLike;
    try {
      res = await send(ctrl.signal);
    } catch (e) {
      throw new NetError(messageOf(e));
    }
    let text: string;
    try {
      text = await res.text();
    } catch (e) {
      // Соединение оборвалось посреди ответа: «пустой успех» здесь потерял бы отправленную пачку
      throw new NetError(`body: ${messageOf(e)}`, res.status);
    }
    return readBody(res.status, res.headers.get('content-type'), text);
  })();
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ответ POST /ops: по результату на каждую операцию. Другой ответ (не тот JSON, не та длина) — NetError:
 * пачка останется в очереди, а не будет сочтена отправленной
 */
export function opsResults(res: unknown, count: number): OpResult[] {
  const results = res && typeof res === 'object' && !Array.isArray(res) ? (res as { results?: unknown }).results : undefined;
  if (!Array.isArray(results) || results.length !== count) throw new NetError('bad_response /ops');
  return results.map((r: unknown): OpResult => {
    if (!r || typeof r !== 'object' || typeof (r as { ok?: unknown }).ok !== 'boolean') throw new NetError('bad_response /ops');
    return r as OpResult;
  });
}
