/**
 * Статистика расходов на распознавание и модель: по дням (Москва), на человека и по всем.
 * Последние 30 команд с текстом фразы — spendlog#<id>, 90 дней (как журнал голосовых команд).
 * Запись spend#<id>#<день> — человек, spend#all#<день> — все вместе и по людям (для /admin). Хранится 12 месяцев
 * (политика конфиденциальности, цель «защита сервиса и учёт расходов»).
 * Пишется на каждый разбор, удачный или нет: деньги тратятся в любом случае. Копейки — целыми, чтобы не копить ошибку.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireUser } from './auth.js';
import type { Store } from './store/types.js';

/** Откуда команда: голос на сервере (SpeechKit + модель), речь распознал телефон, текст («разобрать заново») */
export type SpendSource = 'voice' | 'device' | 'text';
type Part = { n: number; tokens: number; kop: number };
export type DayStat = Part & { sttSec: number; rules: number; src: Partial<Record<SpendSource, Part>> };
type AllDay = DayStat & { users: Record<string, Part> };

const KEEP_SEC = 365 * 24 * 3600;
const empty = (): DayStat => ({ n: 0, tokens: 0, kop: 0, sttSec: 0, rules: 0, src: {} });
const add = (p: Part | undefined, tokens: number, kop: number): Part => ({ n: (p?.n ?? 0) + 1, tokens: (p?.tokens ?? 0) + tokens, kop: (p?.kop ?? 0) + kop });

export const mskDayOf = (ms: number) => new Date(ms + 3 * 3600_000).toISOString().slice(0, 10);

/** Учесть одну команду. Ошибки хранилища не мешают ответу: статистика — не главное */
/** Одна команда для экрана «Расходы»: что сказали, как разобрали, сколько стоило. Последние 30, хранятся 90 дней */
export type SpendCommand = {
  ts: string;
  src: SpendSource;
  /** rules | compact | fallback | full; нет — речь не распознана */
  path?: string;
  /** Обращений к модели: 2 и больше — был повтор */
  calls: number;
  tokens: number;
  kop: number;
  sttSec: number;
  text: string;
  result: string;
};
const RECENT = 30;
const RECENT_KEEP_SEC = 90 * 24 * 3600;

export type SpendInfo = { path?: string; calls?: number; text?: string; result?: string };

/** Учесть одну команду (по дням и в списке последних) */
export async function recordSpend(store: Store, userId: string, src: SpendSource, spend: { tokens: number; rub: number }, sttSec: number, info: SpendInfo = {}, now = Date.now()) {
  const day = mskDayOf(now);
  const kop = Math.round(spend.rub * 100);
  const rules = info.path === 'rules' ? 1 : 0;
  const bump = <T extends DayStat>(d: T): T => ({
    ...d,
    ...add(d, spend.tokens, kop),
    sttSec: Math.round((d.sttSec + sttSec) * 10) / 10,
    rules: d.rules + rules,
    src: { ...d.src, [src]: add(d.src[src], spend.tokens, kop) },
  });
  try {
    const mine = (await store.getTemp<DayStat>(`spend#${userId}#${day}`)) ?? empty();
    await store.putTemp(`spend#${userId}#${day}`, bump(mine), KEEP_SEC);
    const all = (await store.getTemp<AllDay>(`spend#all#${day}`)) ?? { ...empty(), users: {} };
    const next = bump(all);
    await store.putTemp(`spend#all#${day}`, { ...next, users: { ...all.users, [userId]: add(all.users[userId], spend.tokens, kop) } }, KEEP_SEC);
    const cmd: SpendCommand = {
      ts: new Date(now).toISOString(),
      src,
      ...(info.path && { path: info.path }),
      calls: info.calls ?? 0,
      tokens: spend.tokens,
      kop,
      sttSec: Math.round(sttSec * 10) / 10,
      text: (info.text ?? '').slice(0, 200),
      result: info.result ?? '',
    };
    const recent = (await store.getTemp<SpendCommand[]>(`spendlog#${userId}`)) ?? [];
    await store.putTemp(`spendlog#${userId}`, [cmd, ...recent].slice(0, RECENT), RECENT_KEEP_SEC);
  } catch (e) {
    console.warn('Расход не записан:', (e as Error).message);
  }
}

const daysBack = (n: number, now = Date.now()) => Array.from({ length: n }, (_, i) => mskDayOf(now - (n - 1 - i) * 86400_000));

/** Дни подряд (старые первыми), пустые — нулями */
export async function readDays<T extends DayStat>(store: Store, who: string, days: number): Promise<Array<{ day: string } & T>> {
  const list = daysBack(days);
  const rows = await Promise.all(list.map((d) => store.getTemp<T>(`spend#${who}#${d}`)));
  return list.map((day, i) => ({ day, ...((rows[i] ?? empty()) as T) }));
}

const Days = z.object({ days: z.coerce.number().int().min(1).max(90).default(30) });

export function registerSpend(app: FastifyInstance, store: Store) {
  /** Мои расходы по дням: команды, токены, копейки, секунды распознавания на сервере, по источникам */
  app.get('/stats/spend', async (req) => {
    const user = await requireUser(req, store);
    const { days } = Days.parse(req.query);
    const recent = (await store.getTemp<SpendCommand[]>(`spendlog#${user.id}`)) ?? [];
    return { days: await readDays(store, user.id, days), recent };
  });
}
