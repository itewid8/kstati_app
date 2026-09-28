/**
 * Запросы к серверу «Кстати». Токен передаётся явно — модуль не знает про хранилище.
 * Ошибки: ApiError — сервер ответил отказом (status, code, message); NetError — нет связи.
 */
import { API_URL } from './config';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export class NetError extends Error {}

/** Текст ошибки для человека */
export const errorText = (e: unknown): string =>
  e instanceof ApiError ? e.message : e instanceof NetError ? 'Нет связи с сервером. Проверьте интернет.' : 'Что-то пошло не так';

export async function request<T = any>(
  path: string,
  opts: { method?: 'GET' | 'POST' | 'DELETE'; body?: unknown; token?: string | null; timeoutMs?: number } = {},
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20_000);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
      headers: {
        ...(opts.body !== undefined && { 'Content-Type': 'application/json' }),
        ...(opts.token && { Authorization: `Bearer ${opts.token}` }),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: ctrl.signal,
    });
  } catch (e) {
    throw new NetError((e as Error).name === 'AbortError' ? 'timeout' : String((e as Error).message ?? e));
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text().catch(() => '');
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* не JSON */
  }
  if (!res.ok) throw new ApiError(res.status, json?.error ?? `http_${res.status}`, json?.message ?? `Ошибка сервера (${res.status})`);
  return json as T;
}

/* ---------- операции изменения данных (POST /ops) ---------- */

type TaskOp = { id: string; groupId: string; title: string; date: string | null; time: string | null; note?: string; doneAt: string | null };
type WatchOp = {
  id: string;
  groupId: string;
  title: string;
  kind: string | null;
  genres: string[];
  origin: string | null;
  year: number | null;
  watchedAt: string | null;
};
type WishOp = { id: string; title: string; note: string; link: string; receivedAt: string | null };

export type Op =
  | { op: 'task.put'; task: TaskOp }
  | { op: 'watch.put'; watch: WatchOp }
  | { op: 'item.delete'; groupId: string; id: string }
  | { op: 'wish.put'; wish: WishOp }
  | { op: 'wish.delete'; id: string }
  | { op: 'group.create'; group: { id: string; name: string; category: string } }
  | { op: 'group.update'; id: string; name?: string; category?: string }
  | { op: 'group.join'; code: string }
  | { op: 'group.leave'; id: string }
  | { op: 'group.admin'; id: string; userId: string; admin: boolean }
  | { op: 'group.remove'; id: string; userId: string }
  | { op: 'profile'; name?: string; nick?: string | null; gender?: 'm' | 'f' | null };

export type OpResult = { ok: boolean; error?: string; message?: string; [k: string]: unknown };

/** Ключ записи, которую меняет операция: повторная правка той же записи заменяет прежнюю в очереди */
export function opKey(o: Op): string | null {
  switch (o.op) {
    case 'task.put':
      return `item:${o.task.id}`;
    case 'watch.put':
      return `item:${o.watch.id}`;
    case 'item.delete':
      return `item:${o.id}`;
    case 'wish.put':
      return `wish:${o.wish.id}`;
    case 'wish.delete':
      return `wish:${o.id}`;
    default:
      return null;
  }
}
