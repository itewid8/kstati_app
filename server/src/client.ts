/**
 * Версия клиента (S5). Новое приложение шлёт заголовки:
 *   x-kstati-api: 2                          — уровень API: от него зависят новые виды ответов;
 *   x-kstati-app: ru.kstati.app/1.0.0(12)    — само приложение (только для журнала).
 * Нет заголовка — старое приложение, уровень 1. Новые типы ответов и значения перечислений
 * отдаются только при уровне ≥ 2 (см. docs/server-changes-v2.md).
 */
import type { FastifyRequest } from 'fastify';

/** Самый новый уровень API, который понимает сервер (отдаётся в /health) */
export const API_LEVEL = 3;

const header = (req: FastifyRequest, name: string) => {
  const v = req.headers[name];
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? '';
};

export function apiLevel(req: FastifyRequest): number {
  const n = Number.parseInt(header(req, 'x-kstati-api'), 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 99) : 1;
}

export function appVersion(req: FastifyRequest): string | undefined {
  return header(req, 'x-kstati-app').slice(0, 80) || undefined;
}
