/**
 * «Обучение» (тест): человек проговаривает карточки, сервер сверяет услышанное и разбор с образцом.
 * Карточка — фраза или задание своими словами в учебном наборе записей (data/practice.ndjson, train/practice-deck.ts):
 * разбор идёт вхолостую — записи человека не читаются и не меняются, лимит голосовых команд не тратится.
 * Разбирает только своя модель (parseText, ownOnly): правила сервера и облачная модель в обучении не участвуют.
 * Попытки копятся в журнале «practice» (текст, итог сверки, запись голоса) — материал для словаря исправлений,
 * шума в обучающем наборе и сравнения систем распознавания (train/practice-report.ts).
 * Карточки чаще берутся из видов команд, где ошибок больше. Каждая десятая — контрольная: в обучение не идёт.
 */
import type { FastifyInstance } from 'fastify';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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
  /** Услышано слово в слово; null — не сверяется (задание или «сказал иначе») */
  sttOk: boolean | null;
  /** Разбор совпал с образцом: у фразы — полностью, у задания и «сказал иначе» — без названий */
  parseOk: boolean;
  /** Сверка как есть, без отметок: текст с фразой карточки (null у задания), разбор полностью и без названий */
  textOk: boolean | null;
  strict: boolean;
  soft: boolean;
  raw: string;
  path?: string;
  did: string;
  want: string;
  lang?: string;
  device?: string;
  app: string | null;
  audio: boolean;
  /**
   * Отметки человека, независимые. said — сказал не то, что на карточке: попытка считается как «своими словами»
   * (текст не сверяется, разбор — без названий). card — плохая карточка: кривая фраза или неверный образец;
   * без said попытка в счёт не идёт
   */
  said?: boolean;
  card?: boolean;
  /**
   * Оценка человека: то, что получилось, — верно или нет; note — что не так. Оценка расходится со сверкой
   * (верно, а с образцом не совпало; неверно, а совпало) — образец под вопросом: card ставится сам
   */
  good?: boolean;
  note?: string;
};

/** Вердикт с учётом отметок */
const judged = <T extends Pick<Attempt, 'mode' | 'textOk' | 'strict' | 'soft' | 'said'>>(a: T) => {
  const own = a.mode === 'do' || !!a.said;
  return { sttOk: own ? null : a.textOk, parseOk: own ? a.soft : a.strict };
};
/** Ошибка телефона или модели — для выбора карточек; плохая карточка без «сказал иначе» ошибкой не считается */
const isMiss = (a: Pick<Attempt, 'sttOk' | 'parseOk' | 'good'>) => (a.good !== undefined ? !a.good : !a.parseOk) || a.sttOk === false;

type UserState = { consent: boolean; seen: string[]; total: number; day: string; today: number };
type Stats = Record<string, { n: number; bad: number }>;

const LOG = 'practice';
const AUDIO = 'practice-audio';
const KEEP_SEC = 365 * 24 * 3600;
const STATE_KEEP_SEC = 400 * 24 * 3600;
const DAILY_LIMIT = 400;
const SEEN_MAX = 600;
/** Доля заданий «своими словами» среди карточек, где задание есть; у заметок — выше: там важнее живые формулировки */
const DO_SHARE = 0.3;
const DO_SHARE_NOTES = 0.7;
/**
 * Виды команд, которые выдаются чаще: заметки (что считать заметкой, а что делом или фильмом — слабое место)
 * и добавление фильмов (худший вид по замеру на незнакомых словах)
 */
const boostOf = (variant: string) => (variant.startsWith('idea.') ? 3 : variant === 'watch.add' ? 2 : 1);
const stateKey = (userId: string) => `practice#u#${userId}`;
const STATS_KEY = 'practice#stats';
/** Сколько раз карточку отметили плохой; с двух отметок её больше не выдаём */
const BAD_KEY = 'practice#bad';
const BAD_HIDE = 2;

type Deck = { cards: Card[]; byId: Map<string, Card>; byVariant: Map<string, Card[]> };
let deck: Deck | null = null;

export function makeDeck(cards: Card[]): Deck {
  const byVariant = new Map<string, Card[]>();
  for (const c of cards) byVariant.set(c.variant, [...(byVariant.get(c.variant) ?? []), c]);
  return { cards, byId: new Map(cards.map((c) => [c.id, c])), byVariant };
}

function loadDeck(): Deck {
  if (deck) return deck;
  const file = fileURLToPath(new URL('../data/practice.ndjson', import.meta.url));
  const cards = existsSync(file)
    ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as Card)
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
const weightOf = (s: { n: number; bad: number } | undefined, variant = '') => boostOf(variant) * (0.5 + 4 * (s ? (s.bad + 1) / (s.n + 4) : 0.25));

export function pickCard(d: Deck, seen: readonly string[], stats: Stats, rnd: () => number = Math.random): Card | null {
  if (!d.cards.length) return null;
  const was = new Set(seen);
  const variants = [...d.byVariant.keys()];
  const total = variants.reduce((a, v) => a + weightOf(stats[v], v), 0);
  for (let i = 0; i < 12; i++) {
    let x = rnd() * total;
    const v = variants.find((k) => (x -= weightOf(stats[k], k)) <= 0) ?? variants.at(-1)!;
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
// flag — от первой версии приложения (одна отметка из двух)
const FlagBody = z.object({
  id: z.string().uuid(),
  said: z.boolean().optional(),
  card: z.boolean().optional(),
  good: z.boolean().nullable().optional(),
  note: z.string().trim().max(500).optional(),
  flag: z.enum(['etalon', 'said']).nullable().optional(),
});

/* ---------- итог разбора словами — для экрана ---------- */

const WATCH_KIND: Record<string, string> = { movie: 'фильмы', series: 'сериалы', cartoon: 'мультфильмы', show: 'шоу', standup: 'стендап' };
const WATCH_ONE: Record<string, string> = { movie: 'фильм', series: 'сериал', cartoon: 'мультфильм', show: 'шоу', standup: 'стендап' };
const GENRE: Record<string, string> = { comedy: 'комедии', drama: 'драмы', action: 'боевики', thriller: 'триллеры', horror: 'ужасы', scifi: 'фантастика', detective: 'детективы', romance: 'мелодрамы', adventure: 'приключения', documentary: 'документальное' };
const ORIGIN: Record<string, string> = { ru: 'наши', foreign: 'зарубежные' };
const FRESH: Record<string, string> = { new: 'новые', old: 'старые' };
const TASK_KIND: Record<string, string> = { birthday: 'день рождения', important: 'важный день', trip: 'путешествие' };
const NOUN: Record<string, string> = { task: 'дело', wish: 'хотелку', watch: 'запись в «Смотреть»', idea: 'заметку' };
const MARKED: Record<string, string> = { task: 'сделанным', wish: 'полученным', watch: 'просмотренным', idea: 'сделанным' };
const GROUP_KIND: Record<string, string> = { couple: 'пары', family: 'семьи', parents: 'родителей', friends: 'друзей', other: 'других групп' };
const quoted = (s: string) => `«${s}»`;

/** Что приложение сделало бы по команде — обычными словами, по строке на запись или правку */
export function explainResult(r: ParseResult, ctx: Context): string {
  const nameOf = (id: string) => (id === ctx.me.id ? 'я' : (ctx.people.find((p) => p.id === id)?.name ?? '?'));
  const titleOf = (id: string) =>
    [...ctx.existing.tasks, ...ctx.existing.watch, ...ctx.existing.wishes].find((x) => x.id === id)?.title ?? ctx.existing.ideas?.find((x) => x.id === id)?.text.slice(0, 60) ?? '?';
  const topicOf = (id: string | null | undefined) => ctx.topics?.find((t) => t.id === id)?.title;
  const whenOf = (date: unknown, time: unknown, endDate?: unknown, endTime?: unknown) =>
    [
      typeof date === 'string' ? dayLabel(date) + (typeof endDate === 'string' ? ` — ${dayLabel(endDate)}` : '') : 'без даты',
      typeof time === 'string' ? time + (typeof endTime === 'string' ? `–${endTime}` : '') : '',
    ]
      .filter(Boolean)
      .join(', ');
  switch (r.type) {
    case 'items':
      return r.items
        .map((i) => {
          if (i.type === 'task') {
            const d = i.data;
            const extra = [
              d.kind && TASK_KIND[d.kind],
              d.repeat && 'с повтором',
              d.people?.length && `участники: ${d.people.map(nameOf).join(', ')}`,
              d.parentId && `внутри плана ${quoted(titleOf(d.parentId))}`,
              d.note && `заметка: ${d.note}`,
            ].filter(Boolean);
            return [`Дело ${quoted(d.title)}`, whenOf(d.date, d.time, d.endDate, d.endTime), ...extra].join(' · ');
          }
          if (i.type === 'wish') return [`В «Хочу»: ${quoted(i.data.title)}`, i.data.note && `заметка: ${i.data.note}`].filter(Boolean).join(' · ');
          if (i.type === 'watch') return [`В «Смотреть»: ${quoted(i.data.title)}`, i.data.kind && WATCH_ONE[i.data.kind], ...i.data.genres.map((g) => GENRE[g] ?? g)].filter(Boolean).join(' · ');
          if (i.type === 'idea') {
            const topic = i.data.newTopic ? `в новую тему ${quoted(i.data.newTopic)}` : topicOf(i.data.topicId) ? `в тему ${quoted(topicOf(i.data.topicId)!)}` : '';
            return [`Заметка ${quoted(i.data.title)}`, topic].filter(Boolean).join(' · ');
          }
          const lines = (i.data.body ?? '').split('\n').map((l) => l.replace(/^- \[[ x]\] /, '').trim()).filter(Boolean);
          // Правка списка — что поменялось («✓ Цемент», «+ Сыр»); новый — пункты целиком; без пунктов — тема
          if (i.id) return `Список ${quoted(i.data.title)}: ${i.data.changes?.join(', ') || lines.join(', ') || 'без изменений'}`;
          return lines.length ? `Новый список ${quoted(i.data.title)}: ${lines.join(', ')}` : `Новая тема ${quoted(i.data.title)}`;
        })
        .join('\n');
    case 'changes':
      return r.changes
        .map((c) => {
          const what = `${NOUN[c.type] ?? c.type} ${quoted(titleOf(c.chosen))}${c.occ ? ` (${dayLabel(c.occ)})` : ''}`;
          if (c.action === 'delete') return `Удалить ${what}`;
          if (c.action === 'mark') return `Отметить ${MARKED[c.type]}: ${what}`;
          if (c.action === 'unmark') return `Снять отметку: ${what}`;
          const p = c.patch ?? {};
          const parts = [
            p.title !== undefined && `название — ${quoted(p.title)}`,
            p.date !== undefined && `день — ${p.date ? dayLabel(p.date) : 'без даты'}`,
            p.time !== undefined && `время — ${p.time ?? 'без времени'}`,
            p.endDate !== undefined && `до дня — ${p.endDate ? dayLabel(p.endDate) : 'нет'}`,
            p.endTime !== undefined && `до — ${p.endTime ?? 'нет'}`,
            p.repeat !== undefined && (p.repeat ? 'повтор изменён' : 'повтор снят'),
            p.people !== undefined && `участники — ${p.people.map(nameOf).join(', ') || 'никто'}`,
            p.topicId !== undefined && `тема — ${topicOf(p.topicId) ? quoted(topicOf(p.topicId)!) : 'без темы'}`,
            p.newTopic != null && `новая тема — ${quoted(p.newTopic)}`,
          ].filter(Boolean);
          return `Изменить ${what}: ${parts.join(', ') || 'без изменений'}`;
        })
        .join('\n');
    case 'queryPlans': {
      const s = r.plans.scope;
      const whose =
        s.kind === 'me' ? 'мои' : s.kind === 'us' || s.kind === 'current' ? 'наши' : s.kind === 'category' ? GROUP_KIND[s.category] : s.names.join(', ');
      const period = r.plans.from === r.plans.to ? dayLabel(r.plans.from) : `${dayLabel(r.plans.from)} — ${dayLabel(r.plans.to)}`;
      return [`Показать планы: ${whose}`, period, r.plans.who?.length && `чьи: ${r.plans.who.map(nameOf).join(', ')}`, r.plans.query && `найти ${quoted(r.plans.query)}`].filter(Boolean).join(' · ');
    }
    case 'queryWatch': {
      const f = [...r.filters.kind.map((k) => WATCH_KIND[k] ?? k), ...r.filters.genre.map((g) => GENRE[g] ?? g), ...r.filters.origin.map((o) => ORIGIN[o] ?? o), ...r.filters.fresh.map((x) => FRESH[x] ?? x)];
      return `Что посмотреть: ${f.join(', ') || 'всё'}`;
    }
    case 'queryWish':
      return r.personId === ctx.me.id ? 'Показать мои хотелки' : `Показать хотелки: ${nameOf(r.personId)}`;
    case 'queryIdeas':
      return r.topicId === null ? 'Показать список тем' : r.topicId === 'inbox' ? 'Показать заметки без темы' : `Открыть тему ${quoted(topicOf(r.topicId) ?? '?')}`;
    case 'unknownPerson':
      return `Нет человека ${quoted(r.name)}`;
    case 'notFound':
      return `Не нашлось ${quoted(r.query)}`;
    case 'unknown':
      return 'Не понял команду';
  }
}

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
    const bad = (await store.getTemp<Record<string, number>>(BAD_KEY)) ?? {};
    const hidden = Object.keys(bad).filter((k) => bad[k]! >= BAD_HIDE);
    const card = (again && d.byId.get(again)) || pickCard(d, [...s.seen, ...hidden], await statsOf());
    if (!card) throw new HttpError(503, 'no_deck', 'Карточки ещё не собраны');
    const mode: Mode = card.brief && !again && Math.random() < (card.variant.startsWith('idea.') ? DO_SHARE_NOTES : DO_SHARE) ? 'do' : 'say';
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
    // Только своя модель: без правил сервера и облачной страховки — обучение про неё
    const out = await deps.parse(heard, card.ctx, undefined, { ownOnly: true }).catch((e: unknown) => {
      req.log.error({ err: String(e).slice(0, 200) }, 'Своя модель не ответила на карточку');
      throw new HttpError(503, 'own_model', 'Модель не ответила — попробуйте ещё раз');
    });
    let want: ParseResult = { type: 'unknown' };
    try {
      want = wantOf(card);
    } catch {
      /* образец не разобрался — попытку всё равно сохраняем */
    }
    const strict = sameResult(out.result, want);
    const soft = sameResult(out.result, want, true);
    const textOk = b.mode === 'say' ? sameText(heard, card.phrase) : null;
    const { sttOk, parseOk } = judged({ mode: b.mode, textOk, strict, soft });
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
      textOk,
      strict,
      soft,
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
    // Для экрана — словами; в журнале остаётся краткая запись
    const shown = { did: explainResult(out.result, card.ctx), want: explainResult(want, card.ctx) };
    await store.putTemp(`practice#a#${id}`, { ...rec, shown }, 24 * 3600);
    await writeLog({ source: 'practice', userId: user.id, app: rec.app ?? undefined, path: out.path, transcript: heard, result: out.result.type, raw: out.raw, attempts: out.attempts, tokens: out.usage, llmMs: Date.now() - t0, pass: parseOk });

    const next: UserState = { ...s, seen: [...s.seen.filter((x) => x !== card.id), card.id].slice(-SEEN_MAX), total: s.total + 1, today: s.today + 1 };
    await saveState(user.id, next);
    const stats = await statsOf();
    const v = stats[card.variant] ?? { n: 0, bad: 0 };
    stats[card.variant] = { n: v.n + 1, bad: v.bad + (isMiss(rec) ? 1 : 0) };
    await store.putTemp(STATS_KEY, stats, STATE_KEEP_SEC);

    return { id, heard, sttOk, parseOk, ...shown, said: false, card: false, progress: progress(next) };
  });

  /**
   * Оценка и отметки попытки, в течение суток: good — получилось верно или нет (note — что не так),
   * said — сказал иначе; card — плохая карточка (старые версии приложения).
   * Ответ — вердикт заново: «сказал иначе» снимает сверку текста и сверяет разбор без названий
   */
  app.post('/practice/flag', async (req) => {
    const user = await requireUser(req, store);
    const b = FlagBody.parse(req.body);
    type Kept = Attempt & { shown?: { did: string; want: string } };
    const kept = await store.getTemp<Kept>(`practice#a#${b.id}`);
    if (!kept || kept.userId !== user.id) throw new HttpError(404, 'not_found', 'Эту попытку уже не отметить');
    const { shown, ...rec } = kept;
    const said = b.flag !== undefined ? b.flag === 'said' : (b.said ?? !!rec.said);
    const good = b.good === undefined ? rec.good : (b.good ?? undefined);
    // Замечание человека к попытке (и к карточке): что не так или как должно быть; снимается вместе с отметкой
    const note = b.card === false ? '' : (b.note ?? rec.note ?? '');
    const { said: _s, card: _c, good: _g, note: _n, ...rest } = rec;
    void _s;
    void _c;
    void _g;
    void _n;
    const verdict = judged({ ...rest, said });
    // Оценка человека против сверки с образцом — образец под вопросом; без оценки — как отметили (старые версии)
    const bad = good !== undefined ? good !== verdict.parseOk : b.flag !== undefined ? b.flag === 'etalon' : (b.card ?? !!rec.card);
    const upd: Attempt = { ...rest, ...verdict, ...(said && { said }), ...(bad && { card: bad }), ...(good !== undefined && { good }), ...(note && { note }) };
    await store.putLog(LOG, `${rec.ts}#${rec.id}`, upd, KEEP_SEC);
    await store.putTemp(`practice#a#${b.id}`, { ...upd, shown }, 24 * 3600);
    // Выбор карточек: считается ошибка телефона или модели, а не плохая карточка
    const delta = (isMiss(upd) ? 1 : 0) - (isMiss(rec) ? 1 : 0);
    if (delta) {
      const stats = await statsOf();
      const v = stats[rec.variant];
      if (v) {
        stats[rec.variant] = { n: v.n, bad: Math.max(0, v.bad + delta) };
        await store.putTemp(STATS_KEY, stats, STATE_KEEP_SEC);
      }
    }
    if (!!rec.card !== bad) {
      const all = (await store.getTemp<Record<string, number>>(BAD_KEY)) ?? {};
      const n = Math.max(0, (all[rec.cardId] ?? 0) + (bad ? 1 : -1));
      if (n) all[rec.cardId] = n;
      else delete all[rec.cardId];
      await store.putTemp(BAD_KEY, all, STATE_KEEP_SEC);
    }
    return { ok: true, id: upd.id, heard: upd.heard, sttOk: upd.sttOk, parseOk: upd.parseOk, did: shown?.did ?? upd.did, want: shown?.want ?? upd.want, said, card: bad, good: good ?? null };
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
