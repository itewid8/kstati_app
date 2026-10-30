/**
 * Фильмы из ПоискКино (данные Кинопоиска): по названию — рейтинг Кинопоиска, год, жанры, вид и страна.
 * Ключ — POISKKINO_API_KEY (Lockbox); нет ключа — поиска нет. Ответы кэшируются навсегда (ключ film#…),
 * в сутки — не больше POISKKINO_DAILY запросов (бесплатный тариф — 200). Ошибка сервиса — просто без данных.
 */
import { config } from './config.js';
import type { Store } from './store/index.js';
import type { Genre, Kind, Origin } from './types.js';

export type FilmInfo = {
  kpId: number;
  /** Рейтинг Кинопоиска, одна цифра после точки; нет — null */
  rating: number | null;
  year: number | null;
  genres: Genre[];
  kind: Kind | null;
  origin: Origin | null;
};

type Doc = {
  id?: unknown;
  name?: unknown;
  alternativeName?: unknown;
  enName?: unknown;
  year?: unknown;
  type?: unknown;
  rating?: { kp?: unknown } | null;
  votes?: { kp?: unknown } | null;
  genres?: { name?: unknown }[] | null;
  countries?: { name?: unknown }[] | null;
};

const GENRE: Record<string, Genre> = {
  комедия: 'comedy',
  драма: 'drama',
  боевик: 'action',
  военный: 'action',
  вестерн: 'action',
  триллер: 'thriller',
  криминал: 'thriller',
  ужасы: 'horror',
  фантастика: 'scifi',
  фэнтези: 'scifi',
  детектив: 'detective',
  мелодрама: 'romance',
  приключения: 'adventure',
  документальный: 'documentary',
};
const KIND: Record<string, Kind> = { movie: 'movie', 'tv-series': 'series', cartoon: 'cartoon', 'animated-series': 'cartoon', anime: 'cartoon', 'tv-show': 'show' };
const RU = new Set(['Россия', 'СССР']);

export const normTitle = (s: string) =>
  s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** Ответ поиска → лучший фильм: совпало название (год, если назван), из таких — с наибольшим числом оценок */
export function pickFilm(docs: unknown, title: string, year: number | null): FilmInfo | null {
  if (!Array.isArray(docs)) return null;
  const want = normTitle(title);
  const same = (docs as Doc[]).filter((d) => [d.name, d.alternativeName, d.enName].some((n) => normTitle(str(n)) === want));
  const pool = year ? same.filter((d) => num(d.year) === year) : same;
  const best = (pool.length ? pool : same).sort((a, b) => (num(b.votes?.kp) ?? 0) - (num(a.votes?.kp) ?? 0))[0];
  const id = best ? num(best.id) : null;
  if (!best || id === null) return null;
  const kp = num(best.rating?.kp);
  const genres = [...new Set((best.genres ?? []).map((g) => GENRE[str(g?.name).toLowerCase()]).filter((g): g is Genre => !!g))].slice(0, 3);
  const countries = (best.countries ?? []).map((c) => str(c?.name));
  return {
    kpId: id,
    rating: kp && kp > 0 ? Math.round(kp * 10) / 10 : null,
    year: num(best.year),
    genres,
    kind: KIND[str(best.type)] ?? null,
    origin: countries.length ? (countries.some((c) => RU.has(c)) ? 'ru' : 'foreign') : null,
  };
}

export type FilmDeps = { fetch?: typeof fetch };

/** Найти фильм (с кэшем и суточным лимитом); нет ключа, лимит, ошибка или не нашёлся — null */
export async function lookupFilm(store: Store, title: string, year: number | null, deps: FilmDeps = {}): Promise<FilmInfo | null> {
  if (!config.poiskkinoKey || !normTitle(title)) return null;
  const cacheKey = `film#${normTitle(title).slice(0, 120)}#${year ?? ''}`;
  const cached = await store.getKey(cacheKey).catch(() => null);
  if (cached !== null) {
    try {
      return JSON.parse(cached) as FilmInfo | null;
    } catch {
      /* испорченная запись — ищем заново */
    }
  }
  const day = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
  if ((await store.incrUpTo(`poiskkino#${day}`, config.poiskkinoDaily)) === null) return null;
  try {
    const url = `${config.poiskkinoUrl}/v1.4/movie/search?page=1&limit=10&query=${encodeURIComponent(title.trim())}`;
    const res = await (deps.fetch ?? fetch)(url, { headers: { 'X-API-KEY': config.poiskkinoKey, accept: 'application/json' }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const body = (await res.json()) as { docs?: unknown };
    const info = pickFilm(body.docs, title, year);
    // Кэшируем и «не нашлось» — чтобы не тратить лимит на то же название
    await store.claimKey(cacheKey, JSON.stringify(info)).catch(() => false);
    return info;
  } catch {
    return null;
  }
}
