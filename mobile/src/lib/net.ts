/**
 * Запросы к серверу «Кстати». Токен передаётся явно — модуль не знает про хранилище.
 * Ошибки: ApiError — сервер ответил отказом (status, code, message); NetError — нет связи.
 */
import { API_URL } from './config';
import type { PersonColor, ReminderSettings, Repeat } from './types';

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
        // Не Authorization: его перехватывает Яндекс Облако (см. server/src/auth.ts)
        ...(opts.token && { 'X-Kstati-Token': opts.token }),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: ctrl.signal,
    });
  } catch (e) {
    // expo/fetch при отмене по таймеру пишет «Fetch request has been canceled», а не AbortError
    throw new NetError(ctrl.signal.aborted || (e as Error).name === 'AbortError' ? 'timeout' : String((e as Error).message ?? e));
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

type TaskOp = {
  id: string;
  groupId: string;
  title: string;
  date: string | null;
  time: string | null;
  note?: string;
  doneAt: string | null;
  repeat: Repeat | null;
  doneDates: string[];
  skipDates: string[];
  reminders: string[] | null;
  endDate: string | null;
  endTime: string | null;
  people: string[];
  parentId: string | null;
};
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
  | { op: 'topic.put'; topic: { id: string; title: string; groupIds: string[] } }
  | { op: 'topic.delete'; id: string }
  | { op: 'idea.put'; idea: { id: string; topicId: string | null; text: string } }
  | { op: 'idea.delete'; id: string }
  | { op: 'group.create'; group: { id: string; name: string; category: string } }
  | { op: 'group.update'; id: string; name?: string; category?: string }
  | { op: 'group.join'; code: string }
  | { op: 'group.leave'; id: string }
  | { op: 'group.admin'; id: string; userId: string; admin: boolean }
  | { op: 'group.remove'; id: string; userId: string }
  | { op: 'profile'; name?: string; nick?: string | null; gender?: 'm' | 'f' | null; color?: PersonColor | null; avatar?: string | null }
  /** Личные напоминания: по умолчанию и для отдельных дел (null — убрать своё) */
  | { op: 'prefs'; reminders?: ReminderSettings; overrides?: Record<string, string[] | null> };

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
    case 'topic.put':
      return `topic:${o.topic.id}`;
    case 'topic.delete':
      return `topic:${o.id}`;
    case 'idea.put':
      return `idea:${o.idea.id}`;
    case 'idea.delete':
      return `idea:${o.id}`;
    default:
      return null;
  }
}
