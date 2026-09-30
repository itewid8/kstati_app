/**
 * Сборка HTTP-сервера. Отдельно от запуска (index.ts), чтобы тесты могли гонять запросы без сети.
 */
import Fastify, { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Data, registerData } from './api.js';
import { toOggOpus } from './audio.js';
import { HttpError, registerAuth, requireUser } from './auth.js';
import { config } from './config.js';
import { writeLog } from './log.js';
import { parseText } from './parse.js';
import { normalizeTimes } from './spoken.js';
import type { Store, User } from './store/index.js';
import type { Context } from './types.js';
import { recognize, YandexError } from './yandex.js';

/** Текст ошибки для журнала — с причиной из cause (код сети и т. п.), иначе видно только «fetch failed» */
const errText = (e: unknown) => {
  if (!(e instanceof Error)) return String(e).slice(0, 500);
  const cause = (e as { cause?: { code?: string; message?: string } }).cause;
  const extra = cause ? ` (${[cause.code, cause.message].filter(Boolean).join(': ')})` : '';
  return (e.message + extra).slice(0, 500);
};
const ctxSize = (c: Context) => ({ tasks: c.existing.tasks.length, watch: c.existing.watch.length, wishes: c.existing.wishes.length, people: c.people.length });

/** Сегодняшняя дата по Москве — для суточного лимита */
const mskDay = () => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);

const VoiceMeta = z.object({
  groupId: z.string().max(64),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  now: z.string().regex(/^\d{2}:\d{2}$/),
});

export type Deps = {
  store: Store;
  /** Для тестов можно подменить распознавание и разбор */
  recognize?: (ogg: Buffer) => Promise<string>;
  parse?: typeof parseText;
  toOgg?: typeof toOggOpus;
};

export async function buildApp(deps: Deps): Promise<FastifyInstance> {
  const { store } = deps;
  const data = new Data(store);
  const stt = deps.recognize ?? recognize;
  const parse = deps.parse ?? parseText;
  const toOgg = deps.toOgg ?? toOggOpus;

  const app = Fastify({ logger: { level: config.isProd ? 'info' : 'warn' }, bodyLimit: 2 * 1024 * 1024, trustProxy: true });

  /* ---------- защита от перебора: 120 запросов в минуту с адреса ---------- */
  const hits = new Map<string, number[]>();
  app.addHook('onRequest', async (req, reply) => {
    if (req.url === '/health') return;
    const now = Date.now();
    const list = (hits.get(req.ip) ?? []).filter((t) => now - t < 60_000);
    if (list.length >= 120) return reply.code(429).send({ error: 'rate_limited' });
    list.push(now);
    hits.set(req.ip, list);
    if (hits.size > 10_000) hits.clear();
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof z.ZodError) return reply.code(400).send({ error: 'bad_request', message: err.issues[0]?.message, details: err.issues.slice(0, 5) });
    if (err instanceof HttpError) return reply.code(err.status).send({ error: err.code, message: err.message });
    if (err instanceof YandexError) {
      req.log.error({ service: err.service, status: err.status }, err.message);
      return reply.code(502).send({ error: 'upstream', service: err.service });
    }
    req.log.error(err);
    return reply.code(500).send({ error: 'server' });
  });

  app.get('/health', async () => ({ ok: true, model: config.model, db: config.db }));

  registerAuth(app, store);
  registerData(app, store, data);

  /** Контекст для ИИ собирает сервер из базы: люди моих групп, дела текущей группы, мои хотелки */
  async function buildContext(user: User, meta: z.infer<typeof VoiceMeta>): Promise<Context> {
    const { groups, people } = await data.circle(user);
    if (!groups.some((g) => g.id === meta.groupId)) throw new HttpError(403, 'not_member', 'Нет доступа к группе');
    const [items, wishes] = await Promise.all([store.listItems(meta.groupId), store.listWishes(user.id)]);
    return {
      today: meta.today,
      now: meta.now,
      me: { id: user.id, name: user.name },
      people: people.map((p) => ({ id: p.id, name: p.name })),
      groups: groups.map((g) => ({ name: g.name, category: g.category })),
      existing: {
        tasks: items.flatMap((t) => (t.type === 'task' ? [{ id: t.id, title: t.title, date: t.date, time: t.time, done: !!t.doneAt }] : [])),
        watch: items.flatMap((w) => (w.type === 'watch' ? [{ id: w.id, title: w.title, done: !!w.watchedAt }] : [])),
        wishes: wishes.map((w) => ({ id: w.id, title: w.title, done: !!w.receivedAt })),
      },
    };
  }

  /** Суточный лимит голосовых команд на человека */
  async function takeVoiceQuota(user: User) {
    const n = await store.incrUpTo(`voice#${user.id}#${mskDay()}`, config.voiceDailyLimit);
    if (n === null) throw new HttpError(429, 'daily_limit', `На сегодня голосовые команды закончились (${config.voiceDailyLimit} в день). Завтра лимит обновится.`);
    return config.voiceDailyLimit - n;
  }

  /** Разбор текста — «Разобрать заново» */
  app.post('/voice/text', async (req) => {
    const user = await requireUser(req, store);
    const body = VoiceMeta.extend({ text: z.string().min(1).max(1000) }).parse(req.body);
    const context = await buildContext(user, body);
    const left = await takeVoiceQuota(user);
    const t0 = Date.now();
    try {
      const { result, raw, usage, attempts } = await parse(body.text, context);
      await writeLog({ source: 'text', userId: user.id, transcript: body.text, result: result.type, detail: result, raw, attempts, tokens: usage, ctx: ctxSize(context), llmMs: Date.now() - t0 });
      return { transcript: body.text, result, left };
    } catch (e) {
      await writeLog({ source: 'text', userId: user.id, transcript: body.text, ctx: ctxSize(context), llmMs: Date.now() - t0, error: errText(e) });
      throw e;
    }
  });

  /** Голос: { groupId, today, now, audio: base64 } → { transcript, result } */
  app.post('/voice', async (req) => {
    const user = await requireUser(req, store);
    const body = VoiceMeta.extend({ audio: z.string().min(1).max(1_500_000) }).parse(req.body);
    const context = await buildContext(user, body);
    const left = await takeVoiceQuota(user);
    const audio = Buffer.from(body.audio, 'base64');

    const t0 = Date.now();
    let audioSec: number | null = null;
    let transcript = '';
    let t1 = t0;
    try {
      const conv = await toOgg(audio);
      audioSec = conv.seconds;
      // Время через пробел («в 18 0 0») показываем и разбираем как «18:00»
      transcript = normalizeTimes(await stt(conv.ogg));
      t1 = Date.now();
      if (!transcript) {
        await writeLog({ source: 'voice', userId: user.id, audioSec, audioBytes: audio.length, transcript: '', result: 'unknown', sttMs: t1 - t0 });
        return { transcript: '', result: { type: 'unknown' }, left };
      }
      const { result, raw, usage, attempts } = await parse(transcript, context);
      await writeLog({
        source: 'voice', userId: user.id, audioSec, audioBytes: audio.length, transcript, result: result.type, detail: result,
        raw, attempts, tokens: usage, ctx: ctxSize(context), sttMs: t1 - t0, llmMs: Date.now() - t1,
      });
      return { transcript, result, left };
    } catch (e) {
      await writeLog({ source: 'voice', userId: user.id, audioSec, audioBytes: audio.length, transcript, ctx: ctxSize(context), error: errText(e) });
      throw e;
    }
  });

  return app;
}
