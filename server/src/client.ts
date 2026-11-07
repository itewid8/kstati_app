/**
 * Версия приложения из заголовка x-kstati-app: ru.kstati.app/1.0.0(12) — только для журнала и отзывов.
 */
import type { FastifyRequest } from 'fastify';

const header = (req: FastifyRequest, name: string) => {
  const v = req.headers[name];
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? '';
};

export function appVersion(req: FastifyRequest): string | undefined {
  return header(req, 'x-kstati-app').slice(0, 80) || undefined;
}
