/**
 * Оценки разбора голосовых команд (тест): после команды человек ставит 👍 или 👎 и пишет, что хотел.
 * Каждая разобранная команда неделю лежит во временной записи (фраза, контекст разбора, ответ модели) — сохраняется
 * в журнал «ratings» только если её оценили. Журнал — материал для дообучения своей модели (train/from-ratings.ts).
 */
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { HttpError, requireUser } from './auth.js';
import { appVersion } from './client.js';
import { config } from './config.js';
import type { Store } from './store/index.js';
import type { Context, ParseResult } from './types.js';
import { requireAdmin } from './subs.js';
import { rateRecent } from './spend.js';

/** Сколько ждём оценку команды */
const CMD_KEEP_SEC = 7 * 24 * 3600;
/** Сколько храним оценки */
const RATING_KEEP_SEC = 365 * 24 * 3600;
const LOG = 'ratings';

/** Разобранная команда — всё, что нужно, чтобы потом повторить разбор и обучить модель */
export type CommandRecord = {
  id: string;
  ts: string;
  userId: string;
  source: 'voice' | 'device' | 'text';
  transcript: string;
  context: Context;
  /** Ответ модели как есть ('rules' — разобрали правила) */
  raw: string;
  /** rules | compact | fallback | full | tuned */
  path?: string;
  /** Какая модель разбирала */
  model: string;
  result: ParseResult;
};

export type Rating = CommandRecord & { good: boolean; wish: string; ratedAt: string; app: string | null };

/** Запомнить разобранную команду на неделю; id — для оценки. Ошибка хранилища не мешает ответу */
export async function rememberCommand(store: Store, cmd: Omit<CommandRecord, 'id' | 'ts' | 'model'>): Promise<string | undefined> {
  const id = randomUUID();
  const model = cmd.path === 'rules' ? 'rules' : config.promptMode === 'tuned' && config.tunedModel ? `${config.tunedModel} (${cmd.path})` : config.model;
  try {
    await store.putTemp(`cmd#${id}`, { ...cmd, id, ts: new Date().toISOString(), model, raw: cmd.raw.slice(0, 4000) } satisfies CommandRecord, CMD_KEEP_SEC);
    return id;
  } catch {
    return undefined;
  }
}

/** Стереть оценки человека — при удалении аккаунта */
export async function deleteRatingsOf(store: Store, userId: string) {
  let after = '';
  for (;;) {
    const page = await store.listLog<Rating>(LOG, after, 200);
    if (!page.length) return;
    for (const r of page) if (r.value.userId === userId) await store.deleteLog(LOG, r.id);
    after = page.at(-1)!.id;
  }
}

const Rate = z.object({ id: z.string().uuid(), good: z.boolean(), wish: z.string().max(500).optional() });

export function registerRatings(app: FastifyInstance, store: Store) {
  /** Оценка команды: 👍 — разобрана верно; 👎 — неверно, wish — что человек хотел. Повторная оценка заменяет прежнюю */
  app.post('/voice/rate', async (req) => {
    const user = await requireUser(req, store);
    const b = Rate.parse(req.body);
    const cmd = await store.getTemp<CommandRecord>(`cmd#${b.id}`);
    if (!cmd || cmd.userId !== user.id) throw new HttpError(404, 'not_found', 'Эту команду уже не оценить');
    const wish = b.good ? '' : (b.wish ?? '').trim();
    const rating: Rating = { ...cmd, good: b.good, wish, ratedAt: new Date().toISOString(), app: appVersion(req) ?? null };
    await store.putLog(LOG, `${cmd.ts}#${cmd.id}`, rating, RATING_KEEP_SEC);
    await rateRecent(store, user.id, cmd.id, b.good ? 'up' : 'down');
    return { ok: true };
  });

  /** Все оценки для дообучения (страница /admin): по 500, дальше — с after */
  app.get('/admin/ratings', async (req) => {
    await requireAdmin(req, store);
    const { after } = z.object({ after: z.string().max(200).default('') }).parse(req.query);
    const page = await store.listLog<Rating>(LOG, after, 500);
    return { items: page.map((p) => p.value), next: page.length === 500 ? page.at(-1)!.id : null };
  });
}
