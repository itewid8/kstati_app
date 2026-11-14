/**
 * Сравнение для «Обучения» (src/practice.ts, train/practice-*.ts): совпал ли услышанный текст с фразой карточки
 * и дал ли разбор то же, что образец. Без зависимостей — годится и серверу, и скриптам.
 */
import { normalizeTimes } from './spoken.js';
import type { ParseResult } from './types.js';

const lower = (s: string) => s.toLowerCase().replace(/ё/g, 'е');

/** Текст для сравнения: без регистра, «ё», знаков и лишних пробелов; время — в одном виде («в 18 00» = «в 18:00») */
export const textKey = (s: string) =>
  lower(normalizeTimes(s))
    .replace(/[^a-zа-я0-9:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const sameText = (a: string, b: string) => textKey(a) === textKey(b);

/** Слова — их в мягком сравнении не сверяем: человек сказал своими словами, название могло выйти другим */
const WORDING = new Set(['title', 'text', 'note', 'body', 'query', 'newTopic', 'name', 'link', 'changes']);

const canon = (v: unknown, soft: boolean, key = ''): unknown => {
  if (soft && WORDING.has(key)) return '';
  if (Array.isArray(v)) return v.map((x) => canon(x, soft));
  if (v && typeof v === 'object')
    return Object.fromEntries(
      Object.entries(v)
        .filter(([k, x]) => k !== 'key' && x !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, x]) => [k, canon(x, soft, k)]),
    );
  return typeof v === 'string' ? lower(v).replace(/[.!]+$/, '').trim() : v;
};

/**
 * Итог разбора одной строкой для сравнения. Ключи правок случайные — их нет; регистр, «ё» и точка в конце человеку
 * не видны как ошибка. soft — без названий и текстов: сверяются действие, запись, даты, время, люди
 */
export const resultKey = (r: ParseResult, soft = false) => JSON.stringify(canon(r, soft));

export const sameResult = (a: ParseResult, b: ParseResult, soft = false) => resultKey(a, soft) === resultKey(b, soft);
