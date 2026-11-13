/**
 * Оценки разбора голосовых команд (тест): после команды человек ставит 👍 или 👎 и пишет, что хотел.
 * Каждая разобранная команда неделю лежит во временной записи (фраза, день, ответ модели, что сделало приложение) —
 * в журнал «ratings» попадает, только если её оценили. Записи, люди и заметки человека не хранятся.
 * Журнал — материал для дообучения своей модели (train/from-ratings.ts).
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

/**
 * Разобранная команда — только то, что нужно для обучения: сказанная фраза, день и время (от них считаются «завтра»,
 * «в субботу»), ответ модели и коротко — что сделало приложение. Записи, люди и заметки человека не сохраняются
 */
export type CommandRecord = {
  id: string;
  ts: string;
  /** Чья команда — чтобы стереть оценки вместе с аккаунтом; в выгрузку не попадает */
  userId: string;
  source: 'voice' | 'device' | 'text';
  transcript: string;
  today: string;
  now: string;
  /** Ответ модели как есть ('rules' — разобрали правила) */
  raw: string;
  /** rules | compact | fallback | full | tuned */
  path?: string;
  /** Какая модель разбирала */
  model: string;
  /** Что сделало приложение: «дело «Йога» 2026-11-14 19:00», «планы: я, 2026-11-14…2026-11-15» */
  did: string;
};

export type Rating = CommandRecord & { good: boolean; wish: string; ratedAt: string; app: string | null };

const KIND: Record<string, string> = { task: 'дело', wish: 'хотелка', watch: 'смотреть', idea: 'заметка', topic: 'тема' };
const ACTION: Record<string, string> = { update: 'изменить', mark: 'отметить', unmark: 'вернуть', delete: 'удалить' };
const q = (s: string) => `«${s.slice(0, 80)}»`;

/** Что сделало приложение — словами, без id; названия записей берём из контекста, сам контекст не храним */
export function describeResult(r: ParseResult, ctx: Context): string {
  const titleOf = (id: string) =>
    [...ctx.existing.tasks, ...ctx.existing.watch, ...ctx.existing.wishes].find((x) => x.id === id)?.title ?? ctx.existing.ideas?.find((x) => x.id === id)?.text.slice(0, 40) ?? '?';
  switch (r.type) {
    case 'items':
      return r.items
        .map((i) => {
          const d = i.data as Record<string, unknown>;
          const name = String(d.title ?? d.text ?? '');
          const when = [d.date, d.endDate && `…${String(d.endDate)}`, d.time].filter(Boolean).join(' ');
          const list = Array.isArray(d.items) ? ` [${(d.items as string[]).join(', ')}]` : '';
          return `${KIND[i.type] ?? i.type} ${q(name)}${list}${when ? ` ${when}` : ''}`;
        })
        .join('; ');
    case 'changes':
      return r.changes.map((c) => `${ACTION[c.action] ?? c.action} ${q(titleOf(c.chosen))}${c.occ ? ` (раз ${c.occ})` : ''}${c.patch ? ` ${JSON.stringify(c.patch)}` : ''}`).join('; ');
    case 'queryPlans': {
      const s = r.plans.scope as { kind: string; names?: string[]; category?: string };
      const who = s.kind === 'me' ? 'я' : s.kind === 'us' ? 'мы' : s.kind === 'category' ? s.category : (s.names ?? []).join(', ') || s.kind;
      return `планы: ${who}, ${r.plans.from}…${r.plans.to}${r.plans.query ? `, ищем ${q(r.plans.query)}` : ''}`;
    }
    case 'queryWatch': {
      const f = Object.entries(r.filters).filter(([, v]) => v.length).map(([k, v]) => `${k}=${v.join('/')}`);
      return `что посмотреть${f.length ? `: ${f.join(', ')}` : ''}`;
    }
    case 'queryWish':
      return `хотелки: ${r.personId === ctx.me.id ? 'мои' : 'другого человека'}`;
    case 'queryIdeas':
      return r.topicId ? 'открыть тему' : 'список тем';
    case 'unknownPerson':
      return `нет человека ${q(r.name)}`;
    case 'notFound':
      return `не нашлось ${q(r.query)}`;
    case 'unknown':
      return 'не понял';
  }
}

/** Запомнить разобранную команду на неделю; id — для оценки. Ошибка хранилища не мешает ответу */
export async function rememberCommand(
  store: Store,
  cmd: { userId: string; source: CommandRecord['source']; transcript: string; context: Context; raw: string; path?: string; result: ParseResult },
): Promise<string | undefined> {
  const id = randomUUID();
  const model = cmd.path === 'rules' ? 'rules' : config.promptMode === 'tuned' && config.tunedModel ? `${config.tunedModel} (${cmd.path})` : config.model;
  const rec: CommandRecord = {
    id,
    ts: new Date().toISOString(),
    userId: cmd.userId,
    source: cmd.source,
    transcript: cmd.transcript,
    today: cmd.context.today,
    now: cmd.context.now,
    raw: cmd.raw.slice(0, 2000),
    ...(cmd.path && { path: cmd.path }),
    model,
    did: describeResult(cmd.result, cmd.context).slice(0, 500),
  };
  try {
    await store.putTemp(`cmd#${id}`, rec, CMD_KEEP_SEC);
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
    const page = await store.listLog<Rating & { context?: Context; result?: ParseResult }>(LOG, after, 500);
    // Без привязки к человеку и его записей: фраза, оценка, пояснение, что сделало приложение.
    // Поля перечислены явно — оценки до 13.11 хранили и контекст разбора, его не отдаём
    type Old = { context?: Context; result?: ParseResult };
    const items = page.map(({ value: r }: { value: Rating & Old }) => ({
      ts: r.ts,
      transcript: r.transcript,
      good: r.good,
      wish: r.wish,
      did: r.did ?? (r.result && r.context ? describeResult(r.result, r.context) : ''),
      today: r.today ?? r.context?.today ?? '',
      now: r.now ?? r.context?.now ?? '',
      source: r.source,
      path: r.path,
      model: r.model,
      raw: r.raw,
      ratedAt: r.ratedAt,
      app: r.app,
    }));
    return { items, next: page.length === 500 ? page.at(-1)!.id : null };
  });
}
