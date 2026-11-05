/**
 * Сборка HTTP-сервера. Отдельно от запуска (index.ts), чтобы тесты могли гонять запросы без сети.
 */
import Fastify, { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Data, registerData } from './api.js';
import { toOggOpus } from './audio.js';
import { HttpError, registerAuth, requireUser } from './auth.js';
import { registerPages } from './pages.js';
import { mskDay, registerSubs, voiceLimitOf } from './subs.js';
import { recordSpend, registerSpend } from './spend.js';
import { API_LEVEL, apiLevel, appVersion } from './client.js';
import { config } from './config.js';
import { sendMail, type MailFile } from './mail.js';
import { randomUUID } from 'node:crypto';
import { costOf, writeLog } from './log.js';
import { parseText } from './parse.js';
import { normalizeTimes } from './spoken.js';
import type { Store, User } from './store/index.js';
import type { Context, ParseResult } from './types.js';
import { recognize, STT_LANGS, YandexError, type SttLang, type Usage } from './yandex.js';

/** Текст ошибки для журнала — с причиной из cause (код сети и т. п.), иначе видно только «fetch failed» */
const errText = (e: unknown) => {
  if (!(e instanceof Error)) return String(e).slice(0, 500);
  const cause = (e as { cause?: { code?: string; message?: string } }).cause;
  const extra = cause ? ` (${[cause.code, cause.message].filter(Boolean).join(': ')})` : '';
  return (e.message + extra).slice(0, 500);
};
const ctxSize = (c: Context) => ({ tasks: c.existing.tasks.length, watch: c.existing.watch.length, wishes: c.existing.wishes.length, ideas: c.existing.ideas?.length ?? 0, people: c.people.length });

/** Сегодняшняя дата по Москве — для суточного лимита */

const VoiceMeta = z.object({
  groupId: z.string().max(64),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  now: z.string().regex(/^\d{2}:\d{2}$/),
  /** Открытая тема идей (если запись начали на её экране) */
  topicId: z.string().max(64).nullable().optional(),
  /** Открытый план большого дела: новое дело станет его подзадачей */
  parentId: z.string().max(64).nullable().optional(),
  /** Язык распознавания (S7); нет — русский. Для /voice/text не важен */
  lang: z.enum(STT_LANGS).optional(),
});

/** Команда удалась — тратит суточный лимит: есть что создать, изменить или показать */
export const voiceSucceeded = (r: ParseResult): boolean => {
  if (r.type === 'items') return r.items.length > 0;
  if (r.type === 'changes') return r.changes.length > 0;
  return r.type !== 'unknown' && r.type !== 'notFound' && r.type !== 'unknownPerson';
};

/** Отзывы хранятся 12 месяцев (политика конфиденциальности) */
const FEEDBACK_KEEP_SEC = 365 * 24 * 3600;
/** Дневные счётчики лимитов удаляются через двое суток */
const COUNTER_KEEP_SEC = 2 * 24 * 3600;

export type Deps = {
  store: Store;
  /** Для тестов можно подменить распознавание и разбор */
  recognize?: (ogg: Buffer, lang?: SttLang) => Promise<string>;
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

  /* ---------- веб-версия: запросы из браузера с разрешённых сайтов (CORS) ---------- */
  const allowedOrigin = (o: string | undefined) =>
    !!o && (config.webOrigins.includes(o) || (!config.isProd && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)));
  app.addHook('onRequest', async (req, reply) => {
    const origin = req.headers.origin;
    if (!allowedOrigin(origin)) return;
    reply.header('access-control-allow-origin', origin);
    reply.header('vary', 'Origin');
    reply.header('access-control-allow-headers', 'content-type, x-kstati-token, x-kstati-api, x-kstati-app');
    reply.header('access-control-allow-methods', 'GET, POST, PUT, DELETE, OPTIONS');
    reply.header('access-control-max-age', '86400');
    if (req.method === 'OPTIONS') return reply.code(204).send();
  });

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

  // api — самый новый уровень API сервера (S5): новое приложение проверяет api >= 2
  // feedback — настроена ли отправка отзывов (без самих ключей): удобно проверить после выкладки
  app.get('/health', async () => ({
    ok: true,
    model: config.model,
    db: config.db,
    api: API_LEVEL,
    feedback: { email: !!config.feedbackEmail },
    films: !!config.poiskkinoKey,
  }));

  registerAuth(app, store);
  registerPages(app);
  registerSubs(app, store);
  registerSpend(app, store);
  registerData(app, store, data);

  /** Контекст для ИИ собирает сервер из базы: люди моих групп, дела текущей группы, мои хотелки */
  async function buildContext(user: User, meta: z.infer<typeof VoiceMeta>, api: number): Promise<Context> {
    const { groups, people } = await data.circle(user);
    const group = groups.find((g) => g.id === meta.groupId);
    if (!group) throw new HttpError(403, 'not_member', 'Нет доступа к группе');
    const nameOf = (id: string) => (id === user.id ? user.name : (people.find((p) => p.id === id)?.name ?? ''));
    const [items, wishes, notes] = await Promise.all([
      data.groupItems(user, meta.groupId),
      store.listWishes(user.id),
      store.listNotes(user.id).catch(() => []),
    ]);
    const topics = notes.flatMap((n) => (n.kind === 'topic' && !n.archivedAt ? [{ id: n.id, title: n.title, body: n.body ?? '' }] : []));
    // Для переноса и удаления голосом хватает последних идей; текст укорачиваем — экономим токены
    const ideas = notes
      .flatMap((n) => (n.kind === 'idea' ? [n] : []))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 60)
      .map((n) => ({ id: n.id, text: n.text.length > 90 ? `${n.text.slice(0, 90)}…` : n.text, topicId: n.topicId }));
    return {
      today: meta.today,
      now: meta.now,
      me: { id: user.id, name: user.name },
      people: people.map((p) => ({ id: p.id, name: p.name })),
      groups: groups.map((g) => ({ name: g.name, category: g.category })),
      existing: {
        tasks: items.flatMap((t) =>
          t.type === 'task'
            ? [
                {
                  id: t.id,
                  title: t.title,
                  date: t.date,
                  time: t.time,
                  done: !!t.doneAt,
                  endDate: t.endDate ?? null,
                  endTime: t.endTime ?? null,
                  people: (t.people?.length ? t.people : [t.createdBy]).map(nameOf).filter(Boolean),
                  parentId: t.parentId ?? null,
                  ...(t.repeat && { repeat: t.repeat, skipDates: t.skipDates ?? [] }),
                },
              ]
            : [],
        ),
        watch: items.flatMap((w) => (w.type === 'watch' ? [{ id: w.id, title: w.title, done: !!w.watchedAt }] : [])),
        wishes: wishes.map((w) => ({ id: w.id, title: w.title, done: !!w.receivedAt })),
        ideas,
      },
      topics,
      currentTopicId: meta.topicId && topics.some((t) => t.id === meta.topicId) ? meta.topicId : null,
      groupMembers: group.memberIds,
      currentParentId: meta.parentId && items.some((t) => t.id === meta.parentId && t.type === 'task' && !t.parentId) ? meta.parentId : null,
      api,
    };
  }

  /** Расход команды для приложения: токены модели и рубли (модель + распознавание SpeechKit, если было) */
  const spendOf = (usage: Usage | undefined, audioSec: number | null | false) => {
    const tokens = usage?.total ?? 0;
    const stt = audioSec === false ? 0 : Math.max(1, Math.ceil((audioSec ?? 0) / 15)) * config.sttPrice15s;
    return { tokens, rub: Math.round(((usage ? costOf(usage, config.model) : 0) + stt) * 100) / 100 };
  };

  /**
   * Суточный лимит голосовых команд на человека. Списывается только удачная команда: распознали речь и поняли, что
   * сделать. Сбой распознавания или модели, пустая запись, «не понял», «не нашёл такое дело», неизвестный человек —
   * лимит не тратят. До разбора лимит только проверяется (checkVoiceQuota), списание — после (spendVoiceQuota)
   */
  const quotaKey = (user: User) => `voice#${user.id}#${mskDay()}`;
  async function checkVoiceQuota(user: User): Promise<number> {
    const key = quotaKey(user);
    const limit = voiceLimitOf(user);
    const used = (await store.getCounters([key]))[key] ?? 0;
    if (used >= limit) throw new HttpError(429, 'daily_limit', `На сегодня голосовые команды закончились (${limit} в день). Завтра лимит обновится.`);
    return limit - used;
  }
  async function spendVoiceQuota(user: User, result: ParseResult, left: number): Promise<number> {
    if (!voiceSucceeded(result)) return left;
    // Параллельные команды могли выбрать лимит — результат всё равно отдаём, счётчик выше лимита не растёт
    const limit = voiceLimitOf(user);
    const n = await store.incrUpTo(quotaKey(user), limit, COUNTER_KEEP_SEC);
    return n === null ? 0 : limit - n;
  }

  /** S6: сколько голосовых команд потрачено сегодня (по Москве), без списания */
  app.get('/voice/quota', async (req) => {
    const user = await requireUser(req, store);
    const key = quotaKey(user);
    const limit = voiceLimitOf(user);
    const used = Math.min((await store.getCounters([key]))[key] ?? 0, limit);
    return { limit, used, left: limit - used };
  });

  /**
   * Отзыв из приложения: ошибка или предложение. Хранится на сервере 12 месяцев (ключ feedback#…, как в политике
   * конфиденциальности) и уходит письмом на FEEDBACK_EMAIL — снимок экрана и сведения из приложения вложениями.
   * Только российские сервисы (Yandex Cloud): данные за границу не уходят. Письмо не дошло — отзыв всё равно сохранён.
   * issue в ответе — для старых версий приложения, всегда null
   */
  const Feedback = z.object({
    kind: z.enum(['bug', 'idea']),
    text: z.string().trim().min(1).max(4000),
    device: z.string().max(200).optional(),
    /** Снимок экрана: JPEG в base64 (кнопка-жучок) */
    screenshot: z.string().max(1_400_000).optional(),
    /** Сведения из приложения: экран, связь, журнал событий */
    context: z.record(z.unknown()).optional(),
  });
  app.post('/feedback', async (req) => {
    const user = await requireUser(req, store);
    const body = Feedback.parse(req.body);
    const n = await store.incrUpTo(`feedback#${user.id}#${mskDay()}`, config.feedbackDailyLimit, COUNTER_KEEP_SEC);
    if (n === null) throw new HttpError(429, 'daily_limit', 'На сегодня отзывов достаточно — спасибо! Завтра можно снова.');
    const ts = new Date().toISOString();
    const id = randomUUID().slice(0, 8);
    const context = body.context && JSON.stringify(body.context).length <= 40_000 ? body.context : null;
    const entry = { id, ts, userId: user.id, name: user.name, email: user.email ?? null, kind: body.kind, text: body.text, app: appVersion(req) ?? null, api: apiLevel(req), device: body.device ?? null };
    await store.putTemp(`feedback#${ts}#${user.id}`, { ...entry, context, screenshot: !!body.screenshot }, FEEDBACK_KEEP_SEC);
    if (config.feedbackEmail) {
      const subject = `${body.kind === 'bug' ? 'Ошибка' : 'Предложение'} от ${user.name || user.id}`;
      const text = [body.text, '', `Кто: ${user.name} (${user.email ?? user.id})`, `Приложение: ${entry.app ?? '—'} · API ${entry.api}`, `Устройство: ${entry.device ?? '—'}`, `Когда: ${ts}`, `Отзыв: ${id}`].join('\n');
      const files: MailFile[] = [
        ...(body.screenshot ? [{ name: `screen-${id}.jpg`, type: 'image/jpeg', base64: body.screenshot }] : []),
        ...(context ? [{ name: `context-${id}.json`, type: 'application/json', base64: Buffer.from(JSON.stringify(context, null, 2)).toString('base64') }] : []),
      ];
      await sendMail(config.feedbackEmail, subject, text, files).catch((e) => req.log.error({ err: errText(e) }, 'Отзыв не отправлен письмом'));
    }
    return { ok: true, issue: null };
  });

  /**
   * Отзыв голосом: запись → текст для поля отзыва (без разбора моделью — только распознавание).
   * Голосовые команды не тратит; своё ограничение — FEEDBACK_DAILY_LIMIT × 3 записей в сутки
   */
  app.post('/feedback/voice', async (req) => {
    const user = await requireUser(req, store);
    const body = z.object({ audio: z.string().min(1).max(1_500_000), lang: z.enum(STT_LANGS).optional() }).parse(req.body);
    const n = await store.incrUpTo(`feedback-voice#${user.id}#${mskDay()}`, config.feedbackDailyLimit * 3, COUNTER_KEEP_SEC);
    if (n === null) throw new HttpError(429, 'daily_limit', 'На сегодня записей достаточно — допишите текстом.');
    const conv = await toOgg(Buffer.from(body.audio, 'base64'));
    const text = (await stt(conv.ogg, body.lang ?? 'ru-RU')).trim();
    return { text };
  });

  /**
   * Разбор текста — «Разобрать заново» и речь, распознанная самим телефоном (src: 'device'; SpeechKit не тратится,
   * но команда считается в суточный лимит, как запись)
   */
  app.post('/voice/text', async (req) => {
    const user = await requireUser(req, store);
    const body = VoiceMeta.extend({ text: z.string().min(1).max(1000), src: z.literal('device').optional() }).parse(req.body);
    const source = body.src === 'device' ? 'device' : 'text';
    if (source === 'device') body.text = normalizeTimes(body.text);
    const client = { api: apiLevel(req), app: appVersion(req), ...(source === 'device' && body.lang && body.lang !== 'ru-RU' && { lang: body.lang }) };
    const context = await buildContext(user, body, client.api);
    const before = await checkVoiceQuota(user);
    const t0 = Date.now();
    try {
      const { result, raw, usage, attempts, path } = await parse(body.text, context);
      await writeLog({ source, userId: user.id, ...client, transcript: body.text, result: result.type, detail: result, raw, attempts, tokens: usage, ctx: ctxSize(context), llmMs: Date.now() - t0 });
      const left = await spendVoiceQuota(user, result, before);
      const spend = spendOf(usage, false);
      await recordSpend(store, user.id, source, spend, 0, { path, calls: attempts, text: body.text, result: result.type });
      return { transcript: body.text, result, left, spend };
    } catch (e) {
      await writeLog({ source, userId: user.id, ...client, transcript: body.text, ctx: ctxSize(context), llmMs: Date.now() - t0, error: errText(e) });
      throw e;
    }
  });

  /** Голос: { groupId, today, now, audio: base64 } → { transcript, result } */
  app.post('/voice', async (req) => {
    const user = await requireUser(req, store);
    const body = VoiceMeta.extend({ audio: z.string().min(1).max(1_500_000) }).parse(req.body);
    const lang = body.lang ?? 'ru-RU';
    const client = { api: apiLevel(req), app: appVersion(req), ...(lang !== 'ru-RU' && { lang }) };
    const context = await buildContext(user, body, client.api);
    const before = await checkVoiceQuota(user);
    const audio = Buffer.from(body.audio, 'base64');

    const t0 = Date.now();
    let audioSec: number | null = null;
    let transcript = '';
    let t1 = t0;
    try {
      const conv = await toOgg(audio);
      audioSec = conv.seconds;
      // Время через пробел («в 18 0 0») показываем и разбираем как «18:00»
      transcript = normalizeTimes(await stt(conv.ogg, lang));
      t1 = Date.now();
      if (!transcript) {
        await writeLog({ source: 'voice', userId: user.id, ...client, audioSec, audioBytes: audio.length, transcript: '', result: 'unknown', sttMs: t1 - t0 });
        const spend = spendOf(undefined, audioSec);
        await recordSpend(store, user.id, 'voice', spend, audioSec ?? 0, { result: 'unknown' });
        return { transcript: '', result: { type: 'unknown' }, left: before, spend };
      }
      const { result, raw, usage, attempts, path } = await parse(transcript, context);
      await writeLog({
        source: 'voice', userId: user.id, ...client, audioSec, audioBytes: audio.length, transcript, result: result.type, detail: result,
        raw, attempts, tokens: usage, ctx: ctxSize(context), sttMs: t1 - t0, llmMs: Date.now() - t1,
      });
      const left = await spendVoiceQuota(user, result, before);
      const spend = spendOf(usage, audioSec);
      await recordSpend(store, user.id, 'voice', spend, audioSec ?? 0, { path, calls: attempts, text: transcript, result: result.type });
      return { transcript, result, left, spend };
    } catch (e) {
      await writeLog({ source: 'voice', userId: user.id, ...client, audioSec, audioBytes: audio.length, transcript, ctx: ctxSize(context), error: errText(e) });
      throw e;
    }
  });

  return app;
}
