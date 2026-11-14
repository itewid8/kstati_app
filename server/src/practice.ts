/**
 * «Обучение» (тест): человек проговаривает карточки, сервер сверяет услышанное и разбор с образцом.
 * Карточка — фраза или задание своими словами в учебном наборе записей (data/practice.jsonl.gz, train/practice-deck.ts):
 * разбор идёт вхолостую — записи человека не читаются и не меняются, лимит голосовых команд не тратится.
 * Попытки копятся в журнале «practice» (текст, итог сверки, запись голоса) — материал для словаря исправлений,
 * шума в обучающем наборе и сравнения систем распознавания (train/practice-report.ts).
 * Карточки чаще берутся из видов команд, где ошибок больше. Каждая десятая — контрольная: в обучение не идёт.
 */
import type { FastifyInstance } from 'fastify';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { z } from 'zod';
import type { toOggOpus } from './audio.js';
import { HttpError, requireUser } from './auth.js';
import { appVersion } from './client.js';
import { writeLog } from './log.js';
import { normalize, type parseText } from './parse.js';
import { sameResult, sameText } from './practiceCheck.js';
import { describeResult } from './ratings.js';
import { cleanSpeech, normalizeTimes } from './spoken.js';
import type { Store } from './store/index.js';
import { mskDay, requireAdmin } from './subs.js';
import type { Context, ParseResult } from './types.js';

export type Card = {
  id: string;
  /** Вид команды (train/generate.ts): task.add, plans.query… */
  variant: string;
  /** Слова: base — из словаря обучения (фраза в обучение не попадает), test — которых в обучении нет */
  vocab: 'base' | 'test';
  phrase: string;
  /** Задание без готовой фразы; нет — карточку можно только прочитать */
  brief: string[] | null;
  ctx: Context;
  /** Образец ответа модели */
  actions: unknown[];
  control: boolean;
};
export type Mode = 'say' | 'do';

/** Попытка. userId — чтобы стереть вместе с аккаунтом; в выгрузку идёт обезличенный «speaker» */
export type Attempt = {
  id: string;
  ts: string;
  userId: string;
  cardId: string;
  variant: string;
  vocab: Card['vocab'];
  control: boolean;
  mode: Mode;
  phrase: string;
  heard: string;
  /** Другие варианты распознавания, если телефон их дал */
  alts: string[];
  /** Услышано слово в слово (только у фразы) */
  sttOk: boolean | null;
  /** Разбор совпал с образцом: у фразы — полностью, у задания — без названий */
  parseOk: boolean;
  /** Разбор совпал с образцом полностью */
  strict: boolean;
  raw: string;
  path?: string;
  did: string;
  want: string;
  lang?: string;
  device?: string;
  app: string | null;
  audio: boolean;
  /** Отметка человека: etalon — образец неверен, said — сказал не то, что на карточке */
  flag?: 'etalon' | 'said';
};

type UserState = { consent: boolean; seen: string[]; total: number; day: string; today: number };
type Stats = Record<string, { n: number; bad: number }>;

const LOG = 'practice';
const AUDIO = 'practice-audio';
const KEEP_SEC = 365 * 24 * 3600;
const STATE_KEEP_SEC = 400 * 24 * 3600;
const DAILY_LIMIT = 400;
const SEEN_MAX = 600;
/** Доля заданий «своими словами» среди карточек, где задание есть */
const DO_SHARE = 0.3;
const stateKey = (userId: string) => `practice#u#${userId}`;
const STATS_KEY = 'practice#stats';

type Deck = { cards: Card[]; byId: Map<string, Card>; byVariant: Map<string, Card[]> };
let deck: Deck | null = null;

export function makeDeck(cards: Card[]): Deck {
  const byVariant = new Map<string, Card[]>();
  for (const c of cards) byVariant.set(c.variant, [...(byVariant.get(c.variant) ?? []), c]);
  return { cards, byId: new Map(cards.map((c) => [c.id, c])), byVariant };
}

function loadDeck(): Deck {
  if (deck) return deck;
  const file = fileURLToPath(new URL('../data/practice.jsonl.gz', import.meta.url));
  const cards = existsSync(file)
    ? gunzipSync(readFileSync(file)).toString('utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as Card)
    : [];
  deck = makeDeck(cards);
  return deck;
}

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
/** «18 октября, воскресенье» */
export const dayLabel = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${WEEKDAYS[d.getUTCDay()]}`;
};

/** Вес вида команды: чем больше ошибок, тем чаще карточки; без попыток — как при каждой четвёртой ошибке */
const weightOf = (s: { n: number; bad: number } | undefined) => 0.5 + 4 * (s ? (s.bad + 1) / (s.n + 4) : 0.25);

export function pickCard(d: Deck, seen: readonly string[], stats: Stats, rnd: () => number = Math.random): Card | null {
  if (!d.cards.length) return null;
  const was = new Set(seen);
  const variants = [...d.byVariant.keys()];
  const total = variants.reduce((a, v) => a + weightOf(stats[v]), 0);
  for (let i = 0; i < 12; i++) {
    let x = rnd() * total;
    const v = variants.find((k) => (x -= weightOf(stats[k])) <= 0) ?? variants.at(-1)!;
    const pool = d.byVariant.get(v)!.filter((c) => !was.has(c.id));
    if (pool.length) return pool[Math.floor(rnd() * pool.length)]!;
  }
  const fresh = d.cards.filter((c) => !was.has(c.id));
  const pool = fresh.length ? fresh : d.cards;
  return pool[Math.floor(rnd() * pool.length)]!;
}

/** Образец итога: ответ-образец, разобранный кодом сервера по фразе карточки */
export const wantOf = (card: Card): ParseResult => normalize(card.actions as never, card.ctx, cleanSpeech(normalizeTimes(card.phrase)));

const speakerOf = (userId: string) => createHash('sha256').update(`practice:${userId}`).digest('hex').slice(0, 8);

/** Стереть попытки и записи голоса человека — при удалении аккаунта */
export async function deletePracticeOf(store: Store, userId: string) {
  for (const scope of [LOG, AUDIO]) {
    let after = '';
    for (;;) {
      const page = await store.listLog<{ userId?: string }>(scope, after, 200);
      if (!page.length) break;
      for (const r of page) if (r.value.userId === userId) await store.deleteLog(scope, r.id);
      after = page.at(-1)!.id;
    }
  }
  await store.deleteTemp(stateKey(userId));
}

const AttemptBody = z.object({
  cardId: z.string().min(1).max(40),
  mode: z.enum(['say', 'do']),
  text: z.string().trim().min(1).max(1000),
  alts: z.array(z.string().max(1000)).max(5).optional(),
  /** Запись голоса (wav/m4a в base64) — хранится в OggOpus */
  audio: z.string().max(1_500_000).optional(),
  lang: z.string().max(12).optional(),
  device: z.string().max(200).optional(),
});
const FlagBody = z.object({ id: z.string().uuid(), flag: z.enum(['etalon', 'said']).nullable() });

export function registerPractice(app: FastifyInstance, store: Store, deps: { parse: typeof parseText; toOgg: typeof toOggOpus }) {
  const stateOf = async (userId: string): Promise<UserState> => {
    const s = (await store.getTemp<UserState>(stateKey(userId))) ?? { consent: false, seen: [], total: 0, day: '', today: 0 };
    return s.day === mskDay() ? s : { ...s, day: mskDay(), today: 0 };
  };
  const saveState = (userId: string, s: UserState) => store.putTemp(stateKey(userId), s, STATE_KEEP_SEC);
  const statsOf = async () => (await store.getTemp<Stats>(STATS_KEY)) ?? {};
  const progress = (s: UserState) => ({ today: s.today, total: s.total });
  const cards = () => {
    const d = loadDeck();
    if (!d.cards.length) throw new HttpError(503, 'no_deck', 'Карточки ещё не собраны');
    return d;
  };

  /** Согласие на хранение попыток и записей голоса: без него карточки не выдаются */
  app.post('/practice/consent', async (req) => {
    const user = await requireUser(req, store);
    const s = await stateOf(user.id);
    await saveState(user.id, { ...s, consent: true });
    return { ok: true };
  });

  /** Следующая карточка; again — та же ещё раз (произнести повторно) */
  app.get('/practice/next', async (req) => {
    const user = await requireUser(req, store);
    const { again } = z.object({ again: z.string().max(40).optional() }).parse(req.query);
    const s = await stateOf(user.id);
    if (!s.consent) return { consent: false, progress: progress(s) };
    const d = cards();
    const card = (again && d.byId.get(again)) || pickCard(d, s.seen, await statsOf());
    if (!card) throw new HttpError(503, 'no_deck', 'Карточки ещё не собраны');
    const mode: Mode = card.brief && !again && Math.random() < DO_SHARE ? 'do' : 'say';
    return {
      consent: true,
      card: { id: card.id, mode, text: mode === 'say' ? card.phrase : null, brief: mode === 'do' ? card.brief : null, today: `${dayLabel(card.ctx.today)} · ${card.ctx.now}` },
      progress: progress(s),
    };
  });

  /** Попытка: услышанный текст → разбор в учебном наборе записей → сверка с образцом */
  app.post('/practice/attempt', async (req) => {
    const user = await requireUser(req, store);
    const b = AttemptBody.parse(req.body);
    const s = await stateOf(user.id);
    if (!s.consent) throw new HttpError(403, 'no_consent', 'Сначала начните обучение');
    const card = cards().byId.get(b.cardId);
    if (!card) throw new HttpError(404, 'not_found', 'Такой карточки нет');
    if (b.mode === 'do' && !card.brief) throw new HttpError(400, 'bad_mode', 'У карточки нет задания');
    if ((await store.incrUpTo(`practice#${user.id}#${mskDay()}`, DAILY_LIMIT, 2 * 24 * 3600)) === null)
      throw new HttpError(429, 'daily_limit', 'На сегодня карточек достаточно — продолжим завтра.');

    const heard = normalizeTimes(b.text);
    const t0 = Date.now();
    const out = await deps.parse(heard, card.ctx);
    let want: ParseResult = { type: 'unknown' };
    try {
      want = wantOf(card);
    } catch {
      /* образец не разобрался — попытку всё равно сохраняем */
    }
    const strict = sameResult(out.result, want);
    const parseOk = b.mode === 'say' ? strict : sameResult(out.result, want, true);
    const sttOk = b.mode === 'say' ? sameText(heard, card.phrase) : null;
    const id = randomUUID();
    const ts = new Date().toISOString();
    const logId = `${ts}#${id}`;

    let audio = false;
    if (b.audio) {
      try {
        const conv = await deps.toOgg(Buffer.from(b.audio, 'base64'));
        await store.putLog(AUDIO, logId, { userId: user.id, sec: conv.seconds, ogg: conv.ogg.toString('base64') }, KEEP_SEC);
        audio = true;
      } catch (e) {
        req.log.error({ err: String(e).slice(0, 200) }, 'Запись голоса карточки не сохранена');
      }
    }
    const rec: Attempt = {
      id,
      ts,
      userId: user.id,
      cardId: card.id,
      variant: card.variant,
      vocab: card.vocab,
      control: card.control,
      mode: b.mode,
      phrase: card.phrase,
      heard,
      alts: (b.alts ?? []).map((a) => a.trim()).filter((a) => a && a !== b.text),
      sttOk,
      parseOk,
      strict,
      raw: out.raw.slice(0, 2000),
      ...(out.path && { path: out.path }),
      did: describeResult(out.result, card.ctx).slice(0, 500),
      want: describeResult(want, card.ctx).slice(0, 500),
      ...(b.lang && { lang: b.lang }),
      ...(b.device && { device: b.device }),
      app: appVersion(req) ?? null,
      audio,
    };
    await store.putLog(LOG, logId, rec, KEEP_SEC);
    await store.putTemp(`practice#a#${id}`, rec, 24 * 3600);
    await writeLog({ source: 'practice', userId: user.id, app: rec.app ?? undefined, path: out.path, transcript: heard, result: out.result.type, raw: out.raw, attempts: out.attempts, tokens: out.usage, llmMs: Date.now() - t0, pass: parseOk });

    const next: UserState = { ...s, seen: [...s.seen.filter((x) => x !== card.id), card.id].slice(-SEEN_MAX), total: s.total + 1, today: s.today + 1 };
    await saveState(user.id, next);
    const stats = await statsOf();
    const v = stats[card.variant] ?? { n: 0, bad: 0 };
    stats[card.variant] = { n: v.n + 1, bad: v.bad + (parseOk && sttOk !== false ? 0 : 1) };
    await store.putTemp(STATS_KEY, stats, STATE_KEEP_SEC);

    return { id, heard, sttOk, parseOk, did: rec.did, want: rec.want, progress: progress(next) };
  });

  /** Отметка попытки: образец неверен или сказано не то, что на карточке; null — снять. В течение суток */
  app.post('/practice/flag', async (req) => {
    const user = await requireUser(req, store);
    const b = FlagBody.parse(req.body);
    const rec = await store.getTemp<Attempt>(`practice#a#${b.id}`);
    if (!rec || rec.userId !== user.id) throw new HttpError(404, 'not_found', 'Эту попытку уже не отметить');
    const was = !!rec.flag;
    const { flag: _old, ...rest } = rec;
    void _old;
    const upd: Attempt = { ...rest, ...(b.flag && { flag: b.flag }) };
    await store.putLog(LOG, `${rec.ts}#${rec.id}`, upd, KEEP_SEC);
    await store.putTemp(`practice#a#${b.id}`, upd, 24 * 3600);
    // Отмеченная попытка — не ошибка модели: на выбор карточек не влияет
    const bad = !(rec.parseOk && rec.sttOk !== false);
    if (bad && was !== !!b.flag) {
      const stats = await statsOf();
      const v = stats[rec.variant];
      if (v) {
        stats[rec.variant] = { n: v.n, bad: Math.max(0, v.bad + (b.flag ? -1 : 1)) };
        await store.putTemp(STATS_KEY, stats, STATE_KEEP_SEC);
      }
    }
    return { ok: true };
  });

  /** Попытки для разбора (страница /admin): по 500, дальше — с after. Без привязки к человеку: speaker — обезличенный голос */
  app.get('/admin/practice', async (req) => {
    await requireAdmin(req, store);
    const { after } = z.object({ after: z.string().max(200).default('') }).parse(req.query);
    const page = await store.listLog<Attempt>(LOG, after, 500);
    const items = page.map(({ id, value: { userId, ...r } }) => ({ ...r, logId: id, speaker: speakerOf(userId) }));
    return { items, next: page.length === 500 ? page.at(-1)!.id : null };
  });

  /** Запись голоса попытки (OggOpus в base64); id — logId из /admin/practice */
  app.get('/admin/practice/audio', async (req) => {
    await requireAdmin(req, store);
    const { id } = z.object({ id: z.string().min(2).max(200) }).parse(req.query);
    const page = await store.listLog<{ sec: number | null; ogg: string }>(AUDIO, id.slice(0, -1), 5);
    const hit = page.find((r) => r.id === id);
    if (!hit) throw new HttpError(404, 'not_found', 'Записи нет');
    return { sec: hit.value.sec, ogg: hit.value.ogg };
  });
}
