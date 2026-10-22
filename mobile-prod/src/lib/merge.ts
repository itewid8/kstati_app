/**
 * Сохранение ссылок при слиянии данных с сервера. Экраны подписаны на списки по ссылке:
 * новая ссылка без изменений — лишняя перерисовка (раньше — каждые 15 секунд на каждом экране).
 * Чистый модуль: без Expo и хранилища.
 */

/** Одинаковы ли значения из JSON по содержимому. Ключ со значением undefined считается отсутствующим */
export function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((x, i) => same(x, b[i]));
  }
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  const ka = Object.keys(ra).filter((k) => ra[k] !== undefined);
  const kb = Object.keys(rb).filter((k) => rb[k] !== undefined);
  return ka.length === kb.length && ka.every((k) => same(ra[k], rb[k]));
}

/** prev, если по содержимому ничего не поменялось, иначе next */
export const reuse = <T>(prev: T, next: T): T => (same(prev, next) ? prev : next);

/**
 * Новый список записей, где каждая неизменённая запись — прежний объект (по id).
 * Если и состав, и порядок прежние — возвращается сам prev
 */
export function reuseList<T extends { id: string }>(prev: readonly T[], next: readonly T[]): T[] {
  const byId = new Map(prev.map((x) => [x.id, x]));
  let identical = prev.length === next.length;
  const out = next.map((x, i) => {
    const old = byId.get(x.id);
    const kept = old !== undefined && same(old, x) ? old : x;
    if (kept !== prev[i]) identical = false;
    return kept;
  });
  return identical ? (prev as T[]) : out;
}
