/**
 * Карточки «Обучения» по матрице действий (docs/action-matrix.md): data/practice.ndjson.
 *
 *   npx tsx train/scenarios.ts
 *
 * На каждый код матрицы — готовые «действия»: учебный набор записей, цель (что должно получиться) и задание
 * на карточку теми же словами, какими экран показывает итог. Фразу человек придумывает сам. Фраз генератор не выдаёт:
 * у сценария есть только служебная строка-образец, по ней код сервера (normalize) собирает цель и тем же проверяет,
 * что сервер такое действие вообще умеет. Не умеет — код уходит в «сбор фраз»: карточка с заданием, но без сверки.
 * Старый генератор фраз (train/generate.ts) и его наборы здесь не используются — только словари слов:
 * train/catalog.ts (слова обучения) и train/catalog-test.ts (слова только для замера, в обучение не идут).
 * Каждая десятая карточка — контрольная.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalize } from '../src/parse.js';
import { dayLabel, explainResult, type Card } from '../src/practice.js';
import { cleanSpeech, normalizeTimes } from '../src/spoken.js';
import type { Context, ParseResult } from '../src/types.js';
import * as BASE from './catalog.js';
import * as TEST from './catalog-test.js';

const PER_VOCAB = 25;
type Vocab = Pick<typeof BASE, 'TASKS' | 'PEOPLE' | 'FILMS' | 'WISHES' | 'GROUPS' | 'TOPICS' | 'IDEAS' | 'NOTES' | 'TRIPS' | 'SUBS' | 'LISTS' | 'MISSING' | 'RENAMES' | 'NEW_ITEMS'>;
type Act = Record<string, unknown>;
type Task = Context['existing']['tasks'][number];

/* ---------- случайность с зерном и даты ---------- */

let seed = 1;
const rnd = () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const pick = <T>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)] as T;
const some = <T>(a: readonly T[], n: number): T[] => [...a].sort(() => rnd() - 0.5).slice(0, n);
const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const low = (s: string) => s.toLowerCase();
const pad = (n: number) => String(n).padStart(2, '0');

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dowOf = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();
const MONTH_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
/** «20 ноября» */
const dayP = (iso: string) => `${Number(iso.slice(8))} ${MONTH_GEN[Number(iso.slice(5, 7)) - 1]}`;
const WD_ACC = ['воскресенье', 'понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу'];
const EACH = ['каждое', 'каждый', 'каждый', 'каждую', 'каждый', 'каждую', 'каждую'];
const time = () => `${pad(int(8, 21))}:${pick(['00', '00', '30'])}`;

/* ---------- учебный набор записей ---------- */

type World = { V: Vocab; ctx: Context; tasks: BASE.TaskWord[]; films: BASE.Film[]; wishes: BASE.WishWord[]; others: BASE.Person[]; list: { say: string; title: string; items: string[]; id: string }; topic: BASE.TopicWord & { id: string } };

function world(V: Vocab): World {
  const today = addDays('2026-11-20', int(0, 300));
  const [me, ...others] = some(V.PEOPLE, 4) as [BASE.Person, ...BASE.Person[]];
  const tasks = some(V.TASKS as BASE.TaskWord[], 6);
  const films = some(V.FILMS as BASE.Film[], 3);
  const wishes = some(V.WISHES as BASE.WishWord[], 3);
  const [say, title, all] = pick(V.LISTS);
  const list = { say, title, items: some(all, 4), id: 'p1' };
  const topic = { ...pick((V.TOPICS as BASE.TopicWord[]).filter((t) => !t.list && low(t.title) !== low(title))), id: 'p2' };
  const ideas = some(V.IDEAS, 2);
  const ctx: Context = {
    today,
    now: time(),
    me: { id: 'me1', name: me.nom },
    people: others.map((p, i) => ({ id: `u${i + 1}`, name: p.nom })),
    groups: some(V.GROUPS, 2),
    groupMembers: ['me1', 'u1', 'u2', 'u3'],
    topics: [
      { id: list.id, title: list.title, body: list.items.map((x) => `- [ ] ${x}`).join('\n') },
      { id: topic.id, title: topic.title },
    ],
    existing: {
      tasks: tasks.map((t, i) => ({ id: `t${i + 1}`, title: t.title, date: addDays(today, int(1, 20)), time: i % 2 ? null : time() })),
      watch: films.map((f, i) => ({ id: `m${i + 1}`, title: f.title })),
      wishes: wishes.map((w, i) => ({ id: `w${i + 1}`, title: w.title })),
      ideas: ideas.map((text, i) => ({ id: `i${i + 1}`, text: cap(text), topicId: i ? topic.id : null })),
    },
  };
  return { V, ctx, tasks, films, wishes, others, list, topic };
}

/* ---------- сценарий ---------- */

/**
 * actions — правильный ответ модели; ref — служебная строка-образец (человеку не показывается);
 * ok — цель и правда та, что заявлена в матрице; goal — задание для «сбора фраз», если сервер действие не умеет
 */
type Scn = { actions?: Act[]; ref?: string; ok?: (r: ParseResult) => boolean; goal?: string[]; /** Пояснение к заданию: что сейчас в наборе, что открыто на экране */ hint?: string[] };
type Make = (w: World) => Scn | null;

const one = (r: ParseResult, type: string) => (r.type === 'items' && r.items.length === 1 && r.items[0]!.type === type ? (r.items[0]!.data as Record<string, unknown>) : null);
const chg = (r: ParseResult, action: string, type: string, id: string) => {
  const c = r.type === 'changes' && r.changes.length === 1 ? r.changes[0]! : null;
  return c && c.action === action && c.type === type && c.chosen === id ? c : null;
};
const patchOf = (r: ParseResult, id: string) => (chg(r, 'update', 'task', id)?.patch ?? null) as Record<string, unknown> | null;
const q = (s: string) => `«${s}»`;

/** Дело из набора для правок: первое, с датой и временем */
const target = (w: World) => {
  const t = w.ctx.existing.tasks[0]!;
  t.time ??= time();
  return { t, word: w.tasks[0]! };
};
/** Сделать дело повторяющимся по дню недели; первый раз — в прошлом */
const repeating = (w: World, t: Task) => {
  const first = addDays(w.ctx.today, -int(8, 20));
  t.date = first;
  const dow = dowOf(first);
  t.repeat = { freq: 'week', every: 1, weekdays: [dow === 0 ? 7 : dow] };
  let next = addDays(w.ctx.today, 1);
  while (dowOf(next) !== dow) next = addDays(next, 1);
  return { dow, next };
};
const fresh = (w: World) => pick((w.V.TASKS as BASE.TaskWord[]).filter((t) => !w.tasks.includes(t)));
const freshFilm = (w: World) => pick((w.V.FILMS as BASE.Film[]).filter((f) => !w.films.includes(f)));
const freshWish = (w: World) => pick((w.V.WISHES as BASE.WishWord[]).filter((x) => !w.wishes.includes(x)));
const future = (w: World, a = 1, b = 40) => addDays(w.ctx.today, int(a, b));
const add = (title: string, extra: Act = {}): Act => ({ intent: 'add', type: 'task', title, ...extra });
const planInto = (title: string) => `в ${low(title).replace(/^поездка/, 'поездку').replace(/^командировка/, 'командировку')}`;
/** Многодневный план в наборе */
const plan = (w: World) => {
  const [, title] = pick(w.V.TRIPS);
  const start = future(w, 3, 30);
  const t: Task = { id: 't9', title, date: start, time: null, endDate: addDays(start, int(2, 4)) };
  w.ctx.existing.tasks.push(t);
  return t;
};

const KIND_W: Record<string, string> = { movie: 'фильм', series: 'сериал', cartoon: 'мультик', show: 'шоу', standup: 'стендап' };
const GENRE_W: Record<string, string> = { comedy: 'комедию', drama: 'драму', action: 'боевик', thriller: 'триллер', horror: 'ужасы', scifi: 'фантастику', detective: 'детектив', romance: 'мелодраму', adventure: 'приключения', documentary: 'документальное' };
const IMPORTANT = ['годовщина свадьбы', 'юбилей бабушки', 'годовщина знакомства', 'юбилей фирмы', 'юбилей деда', 'годовщина переезда', 'юбилей школы', 'годовщина помолвки'];
const REMIND = ['за 15 минут', 'за час', 'за два часа', 'накануне вечером', 'за день', 'за неделю', 'утром в день дела'];
const OFF_TOPIC = ['про погоду', 'про курс валют', 'про новости', 'про пробки', 'про спорт', 'про рецепт', 'про перевод слова', 'про расстояние между городами', 'про время работы магазина', 'про известного человека', 'про цены на билеты', 'про значение слова'];
const OTHER_HELPER = ['включить музыку', 'вызвать такси', 'построить маршрут', 'позвонить кому-нибудь', 'отправить сообщение', 'поставить будильник', 'включить свет', 'открыть другое приложение', 'рассказать анекдот', 'найти ближайшую аптеку'];
const SCRAPS = ['одно-два слова без смысла', 'междометие: «ну», «так», «ой»', 'начало фразы, которое вы обрываете', 'фразу в сторону, не для приложения', 'покашливание или «э-э-э»', 'слово «ладно» или «окей»'];

const MAKE: Record<string, Make> = {
  /* ----- дела: создание ----- */
  T01: (w) => { const t = fresh(w); return { ref: `Новое дело ${t.add}`, actions: [add(t.title)], ok: (r) => { const d = one(r, 'task'); return !!d && !d.date && !d.time; } }; },
  T02: (w) => { const t = fresh(w); const d = future(w); return { ref: `Новое дело ${t.add} ${dayP(d)}`, actions: [add(t.title, { date: d })], ok: (r) => { const x = one(r, 'task'); return x?.date === d && !x.time; } }; },
  T03: (w) => { const t = fresh(w); const d = future(w); const h = time(); return { ref: `Новое дело ${t.add} ${dayP(d)} в ${h}`, actions: [add(t.title, { date: d, time: h })], ok: (r) => { const x = one(r, 'task'); return x?.date === d && x.time === h; } }; },
  T04: (w) => { const t = fresh(w); const h = time(); return { ref: `Новое дело ${t.add} в ${h}`, actions: [add(t.title, { time: h })], ok: (r) => one(r, 'task')?.time === h }; },
  T05: (w) => {
    const t = fresh(w); const d = future(w); const h = int(9, 19);
    if (rnd() < 0.5) { const e = h + int(1, 3); return { ref: `Новое дело ${t.add} ${dayP(d)} с ${pad(h)}:00 до ${pad(e)}:00`, actions: [add(t.title, { date: d, time: `${pad(h)}:00`, end_time: `${pad(e)}:00` })], ok: (r) => one(r, 'task')?.endTime === `${pad(e)}:00` }; }
    const [say, min] = pick([['на час', 60], ['на два часа', 120], ['на полтора часа', 90]] as const);
    return { ref: `Новое дело ${t.add} ${dayP(d)} в ${pad(h)}:00 ${say}`, actions: [add(t.title, { date: d, time: `${pad(h)}:00`, duration_min: min })], ok: (r) => !!one(r, 'task')?.endTime };
  },
  T06: (w) => { const t = fresh(w); const d = future(w, 2, 30); const e = addDays(d, int(1, 4)); if (d.slice(0, 7) !== e.slice(0, 7)) return null; return { ref: `Новое дело ${t.add} с ${Number(d.slice(8))} по ${dayP(e)}`, actions: [add(t.title, { date: d, end_date: e })], ok: (r) => { const x = one(r, 'task'); return x?.date === d && x.endDate === e && !x.kind; } }; },
  T07: (w) => { const [say, title] = pick(w.V.TRIPS); const d = future(w, 5, 60); const e = addDays(d, int(2, 6)); if (d.slice(0, 7) !== e.slice(0, 7)) return null; return { ref: `${cap(say)} с ${Number(d.slice(8))} по ${dayP(e)}`, actions: [add(title, { date: d, end_date: e, kind: 'trip' })], ok: (r) => { const x = one(r, 'task'); return x?.kind === 'trip' && x.endDate === e; } }; },
  T08: (w) => { const p = pick(w.V.PEOPLE as BASE.Person[]); const d = future(w, 3, 200); return { ref: `${dayP(d)} день рождения ${p.gen}`, actions: [add(`День рождения ${p.gen}`, { date: d, kind: 'birthday' })], ok: (r) => one(r, 'task')?.kind === 'birthday' }; },
  T09: (w) => { const name = pick(w.V === BASE ? IMPORTANT.slice(0, 4) : IMPORTANT.slice(4)); const d = future(w, 3, 200); return { ref: `${dayP(d)} ${name}`, actions: [add(cap(name), { date: d, kind: 'important' })], ok: (r) => one(r, 'task')?.kind === 'important' }; },
  T10: (w) => {
    const t = fresh(w);
    if (rnd() < 0.5) return { ref: `Каждый день ${t.add}`, actions: [add(t.title, { date: addDays(w.ctx.today, 1) })], ok: (r) => (one(r, 'task')?.repeat as { freq?: string } | undefined)?.freq === 'day' };
    let d = addDays(w.ctx.today, 1); while ([0, 6].includes(dowOf(d))) d = addDays(d, 1);
    return { ref: `По будням ${t.add}`, actions: [add(t.title, { date: d })], ok: (r) => ((one(r, 'task')?.repeat as { weekdays?: number[] } | undefined)?.weekdays?.length ?? 0) === 5 };
  },
  T11: (w) => { const t = fresh(w); const d = future(w, 1, 7); const dow = dowOf(d); return { ref: `${cap(EACH[dow]!)} ${WD_ACC[dow]} ${t.add}`, actions: [add(t.title, { date: d })], ok: (r) => { const x = one(r, 'task'); return x?.date === d && (x.repeat as { freq?: string } | undefined)?.freq === 'week'; } }; },
  T12: (w) => {
    const t = fresh(w);
    if (rnd() < 0.5) { const n = int(2, 27); let d = addDays(w.ctx.today, 1); while (Number(d.slice(8)) !== n) d = addDays(d, 1); return { ref: `Каждое ${n} число ${t.add}`, actions: [add(t.title, { date: d })], ok: (r) => (one(r, 'task')?.repeat as { freq?: string } | undefined)?.freq === 'month' }; }
    return { ref: `Раз в две недели ${t.add}`, actions: [add(t.title, { date: addDays(w.ctx.today, 1) })], ok: (r) => (one(r, 'task')?.repeat as { every?: number } | undefined)?.every === 2 };
  },
  T13: (w) => { const t = fresh(w); const d = future(w, 1, 7); const dow = dowOf(d); const until = addDays(d, 7 * int(4, 10)); return { ref: `${cap(EACH[dow]!)} ${WD_ACC[dow]} до ${dayP(until)} ${t.add}`, actions: [add(t.title, { date: d })], ok: (r) => !!(one(r, 'task')?.repeat as { until?: string } | undefined)?.until, goal: [`Дело ${q(t.title)} · ${dayLabel(d)}`, `Повтор каждую неделю до ${dayLabel(until)}`] }; },
  T14: (w) => {
    const t = fresh(w); const d = future(w); const p = w.others[0]!;
    const [ref, people] = pick([[`Мы с ${p.ins} ${dayP(d)} ${t.add}`, ['me', p.nom]], [`У нас ${dayP(d)} ${t.add}`, ['all']], [`${p.dat} ${dayP(d)} ${t.add}`, [p.nom]]] as const);
    return { ref, actions: [add(t.title, { date: d, people })], ok: (r) => ((one(r, 'task')?.people as string[] | undefined)?.length ?? 0) > 0 };
  },
  T15: (w) => { const t = fresh(w); const d = future(w); const note = pick(w.V.NOTES); return { ref: `${cap(t.add)} ${dayP(d)}, ${note}`, actions: [add(t.title, { date: d, note: cap(note) })], ok: (r) => !!one(r, 'task')?.note }; },
  T16: (w) => { const p = plan(w); const sub = pick(w.V.SUBS); const h = time(); return { ref: `${cap(planInto(p.title))} добавь ${low(sub)} ${dayP(p.date!)} в ${h}`, actions: [add(sub, { date: p.date, time: h, parent: p.id })], ok: (r) => one(r, 'task')?.parentId === p.id }; },
  T17: (w) => { const p = plan(w); w.ctx.currentParentId = p.id; const sub = pick(w.V.SUBS); const h = time(); return { ref: `Добавь ${low(sub)} ${dayP(p.date!)} в ${h}`, actions: [add(sub, { date: p.date, time: h, parent: p.id })], ok: (r) => one(r, 'task')?.parentId === p.id, hint: ['План открыт на экране — не называйте его'] }; },
  T18: (w) => { const a = fresh(w); let b = fresh(w); if (b === a) b = fresh(w); if (a === b) return null; const d1 = future(w, 1, 10); const d2 = future(w, 11, 25); return { ref: `${cap(dayP(d1))} ${a.add}, а ${dayP(d2)} ${b.add}`, actions: [add(a.title, { date: d1 }), add(b.title, { date: d2 })], ok: (r) => r.type === 'items' && r.items.length === 2 && r.items.every((i) => i.type === 'task'), goal: [`Дело ${q(a.title)} · ${dayLabel(d1)}`, `Дело ${q(b.title)} · ${dayLabel(d2)}`, 'Оба — одной фразой'] }; },

  /* ----- дела: правка ----- */
  T20: (w) => { const { t, word } = target(w); const d = future(w, 21, 45); return { ref: `Перенеси ${word.acc} на ${dayP(d)}`, actions: [{ intent: 'update', target: [t.id], query: word.acc, date: d }], ok: (r) => { const p = patchOf(r, t.id); return p?.date === d && p.time === undefined; } }; },
  T21: (w) => { const { t, word } = target(w); let h = time(); if (h === t.time) h = '07:30'; return { ref: `Перенеси ${word.acc} на ${h}`, actions: [{ intent: 'update', target: [t.id], query: word.acc, time: h }], ok: (r) => { const p = patchOf(r, t.id); return p?.time === h && p.date === undefined; } }; },
  T22: (w) => { const { t, word } = target(w); const d = future(w, 21, 45); let h = time(); if (h === t.time) h = '07:30'; return { ref: `Перенеси ${word.acc} на ${dayP(d)} на ${h}`, actions: [{ intent: 'update', target: [t.id], query: word.acc, date: d, time: h }], ok: (r) => { const p = patchOf(r, t.id); return p?.date === d && p.time === h; } }; },
  T23: (w) => { const { t, word } = target(w); const name = pick(w.V.RENAMES); return { ref: `Переименуй ${word.acc} в ${name}`, actions: [{ intent: 'update', target: [t.id], query: word.acc, title: cap(name) }], ok: (r) => typeof patchOf(r, t.id)?.title === 'string' }; },
  T24: (w) => {
    const { t, word } = target(w); t.time = `${pad(int(9, 17))}:00`;
    if (rnd() < 0.5) return { ref: `Сделай ${word.acc} на два часа`, actions: [{ intent: 'update', target: [t.id], query: word.acc, duration_min: 120 }], ok: (r) => typeof patchOf(r, t.id)?.endTime === 'string' };
    const e = `${pad(Number(t.time.slice(0, 2)) + int(1, 3))}:00`;
    return { ref: `Продли ${word.acc} до ${e}`, actions: [{ intent: 'update', target: [t.id], query: word.acc, end_time: e }], ok: (r) => patchOf(r, t.id)?.endTime === e };
  },
  T25: (w) => { const { t, word } = target(w); const p = w.others[0]!; return { ref: `Добавь ${p.nom} в ${word.acc}`, actions: [{ intent: 'update', target: [t.id], query: word.acc, people: [p.nom] }], ok: (r) => ((patchOf(r, t.id)?.people as string[] | undefined) ?? []).includes('u1') }; },
  T26: (w) => { const { t, word } = target(w); const p = w.others[0]!; t.people = [w.ctx.me.name, p.nom]; return { ref: `Убери ${p.nom} из ${word.acc}`, actions: [{ intent: 'update', target: [t.id], query: word.acc, people: ['me'] }], ok: (r) => { const pp = patchOf(r, t.id)?.people as string[] | undefined; return !!pp && !pp.includes('u1') && pp.includes('me1'); }, hint: [`Сейчас участники: я, ${p.nom}`], goal: [`Убрать участника из дела ${q(t.title)}: ${p.nom}`] }; },
  T27: (w) => { const { t, word } = target(w); const dow = int(0, 6); return { ref: `${cap(word.acc)} теперь ${EACH[dow]} ${WD_ACC[dow]}`, actions: [{ intent: 'update', target: [t.id], query: word.acc }], ok: (r) => !!patchOf(r, t.id)?.repeat }; },
  T28: (w) => { const { t, word } = target(w); const { dow } = repeating(w, t); const to = (dow + int(1, 5)) % 7; return { ref: `${cap(word.acc)} теперь ${EACH[to]} ${WD_ACC[to]}`, actions: [{ intent: 'update', target: [t.id], query: word.acc }], ok: (r) => !!patchOf(r, t.id)?.repeat }; },
  T29: (w) => { const { t, word } = target(w); repeating(w, t); return { ref: `Больше не повторяй ${word.acc}`, actions: [{ intent: 'update', target: [t.id], query: word.acc }], ok: (r) => { const p = patchOf(r, t.id); return !!p && 'repeat' in p && p.repeat === null; }, hint: ['Сейчас дело повторяется каждую неделю'] }; },
  T30: (w) => { const { t, word } = target(w); return { ref: `Отметь ${word.acc}`, actions: [{ intent: 'mark', target: [t.id], query: word.acc }], ok: (r) => !!chg(r, 'mark', 'task', t.id) }; },
  T31: (w) => { const { t, word } = target(w); t.done = true; return { ref: `Верни ${word.acc} в невыполненные`, actions: [{ intent: 'unmark', target: [t.id], query: word.acc }], ok: (r) => !!chg(r, 'unmark', 'task', t.id), hint: ['Сейчас дело отмечено сделанным'] }; },
  T32: (w) => { const { t, word } = target(w); return { ref: `Удали ${word.acc}`, actions: [{ intent: 'delete', target: [t.id], query: word.acc }], ok: (r) => { const c = chg(r, 'delete', 'task', t.id); return !!c && !c.occ; } }; },
  T33: (w) => { const { t, word } = target(w); const { next } = repeating(w, t); return { ref: `Удали ${word.acc} ${dayP(next)}`, actions: [{ intent: 'delete', target: [t.id], query: word.acc }], ok: (r) => chg(r, 'delete', 'task', t.id)?.occ === next }; },
  T34: (w) => { const { t, word } = target(w); const { next } = repeating(w, t); return { ref: `Отметь ${word.acc} ${dayP(next)}`, actions: [{ intent: 'mark', target: [t.id], query: word.acc }], ok: (r) => chg(r, 'mark', 'task', t.id)?.occ === next }; },
  T35: (w) => { const { t, word } = target(w); const { next } = repeating(w, t); const to = addDays(next, int(1, 3)); return { ref: `Перенеси ${word.acc} ${dayP(next)} на ${dayP(to)}`, actions: [{ intent: 'update', target: [t.id], query: word.acc, date: to }], ok: (r) => { const c = chg(r, 'update', 'task', t.id); return c?.occ === next && c.patch?.date === to; }, goal: [`Перенести один раз повторяющегося дела ${q(t.title)}`, `Раз: ${dayLabel(next)} → ${dayLabel(to)}`, 'Остальные разы не трогать'] }; },
  T36: (w) => { const m = pick(w.V.MISSING); const intent = pick(['delete', 'mark', 'update']); return { ref: `${{ delete: 'Удали', mark: 'Отметь', update: 'Перенеси на завтра' }[intent]} ${m}`, actions: [{ intent, target: [], query: m }], ok: (r) => r.type === 'notFound' }; },
  T37: (w) => { const { t, word } = target(w); const d = future(w, 21, 45); const p = w.others[0]!; return { ref: `Перенеси ${word.acc} на ${dayP(d)} и добавь ${p.nom}`, actions: [{ intent: 'update', target: [t.id], query: word.acc, date: d, people: [p.nom] }], ok: (r) => { const x = patchOf(r, t.id); return x?.date === d && Array.isArray(x.people); } }; },
  T38: (w) => { const { t } = target(w); return { goal: [rnd() < 0.5 ? `Убрать время у дела ${q(t.title)}` : `Убрать дату у дела ${q(t.title)}: когда-нибудь`] }; },
  T39: (w) => { const a = plan(w); const sub = pick(w.V.SUBS); w.ctx.existing.tasks.push({ id: 't10', title: sub, date: a.date, time: time(), parentId: a.id }); const [, b] = pick(w.V.TRIPS.filter(([, x]) => x !== a.title)); w.ctx.existing.tasks.push({ id: 't11', title: b, date: addDays(a.date!, 20), time: null }); return { goal: rnd() < 0.6 ? [`Перенести ${q(sub)} из плана ${q(a.title)}`, `В план ${q(b)}`] : [`Вынуть ${q(sub)} из плана ${q(a.title)}`, 'Сделать обычным делом'] }; },
  T40: (w) => { const { t } = target(w); return { goal: [`Дописать заметку к делу ${q(t.title)}`, `Текст: ${pick(w.V.NOTES)}`] }; },
  T41: (w) => { const { t } = target(w); return { goal: [`Изменить тип дела ${q(t.title)}: ${pick(['важный день', 'путешествие', 'обычное дело'])}`] }; },
  T42: (w) => { const { t } = target(w); return { goal: [`Поставить себе напоминание о деле ${q(t.title)}`, `Когда: ${pick(REMIND)}`] }; },
  T43: (w) => { const { t } = target(w); return { goal: rnd() < 0.5 ? [`Отключить напоминание о деле ${q(t.title)}`] : [`Изменить напоминание о деле ${q(t.title)}`, `Теперь: ${pick(REMIND)}`] }; },
  T44: (w) => { const { t } = target(w); return { goal: [`Сделать дело ${q(t.title)} видимым только вам`] }; },
  T45: (w) => { const { t } = target(w); return { goal: [`Показать дело ${q(t.title)} группе ${q(w.ctx.groups![0]!.name)}`] }; },
  T46: (w) => { const { t } = target(w); return { goal: [`Скрыть дело ${q(t.title)} от группы ${q(w.ctx.groups![0]!.name)}`] }; },
  T47: (w) => ({ goal: [`Вернуть удалённое дело ${q(fresh(w).title)}`, 'Вы удалили его раньше'] }),
  T48: (w) => { const { t } = target(w); return { goal: ['Отменить последнее действие', `Вы только что ${pick([`удалили дело ${q(t.title)}`, `перенесли дело ${q(t.title)}`, `отметили дело ${q(t.title)} сделанным`, `добавили дело ${q(fresh(w).title)}`])}`] }; },

  /* ----- хочу ----- */
  W01: (w) => { const x = freshWish(w); return { ref: `Хочу ${low(x.title)}`, actions: [{ intent: 'add', type: 'wish', title: x.title }], ok: (r) => { const d = one(r, 'wish'); return !!d && !d.note; } }; },
  W02: (w) => { const x = freshWish(w); if (!x.note) return null; return { ref: `Хочу ${x.say}`, actions: [{ intent: 'add', type: 'wish', title: x.title, note: x.note }], ok: (r) => !!one(r, 'wish')?.note }; },
  W03: (w) => { const a = freshWish(w); const b = freshWish(w); if (a === b) return null; return { ref: `Хочу ${low(a.title)} и ${low(b.title)}`, actions: [{ intent: 'add', type: 'wish', title: a.title }, { intent: 'add', type: 'wish', title: b.title }], ok: (r) => r.type === 'items' && r.items.length === 2 && r.items.every((i) => i.type === 'wish'), goal: [`В «Хочу»: ${q(a.title)}`, `В «Хочу»: ${q(b.title)}`, 'Оба — одной фразой'] }; },
  W04: (w) => { const x = w.wishes[0]!; return { ref: `Отметь ${low(x.title)}, подарили`, actions: [{ intent: 'mark', target: ['w1'], query: low(x.title) }], ok: (r) => !!chg(r, 'mark', 'wish', 'w1') }; },
  W05: (w) => { const x = w.wishes[0]!; w.ctx.existing.wishes[0]!.done = true; return { ref: `Верни ${low(x.title)} в хотелки`, actions: [{ intent: 'unmark', target: ['w1'], query: low(x.title) }], ok: (r) => !!chg(r, 'unmark', 'wish', 'w1'), hint: ['Сейчас хотелка отмечена полученной'] }; },
  W06: (w) => { const x = w.wishes[0]!; return { ref: `Удали ${low(x.title)} из хотелок`, actions: [{ intent: 'delete', target: ['w1'], query: low(x.title) }], ok: (r) => !!chg(r, 'delete', 'wish', 'w1') }; },
  W07: (w) => { const x = w.wishes[0]!; const y = freshWish(w); return { ref: `Переименуй ${low(x.title)} в ${low(y.title)}`, actions: [{ intent: 'update', target: ['w1'], query: low(x.title), title: y.title }], ok: (r) => typeof chg(r, 'update', 'wish', 'w1')?.patch?.title === 'string', goal: [`Переименовать хотелку ${q(x.title)}`, `Новое название: ${y.title}`] }; },
  W08: () => ({ ref: 'Что я хотел купить', actions: [{ intent: 'query_wish', person: 'me' }], ok: (r) => r.type === 'queryWish' && r.personId === 'me1' }),
  W09: (w) => { const p = w.others[0]!; return { ref: `Что подарить ${p.dat}`, actions: [{ intent: 'query_wish', person: p.nom }], ok: (r) => r.type === 'queryWish' && r.personId === 'u1' }; },
  W10: (w) => { const p = pick((w.V.PEOPLE as BASE.Person[]).filter((x) => x.nom !== w.ctx.me.name && !w.others.includes(x))); return { ref: `Что подарить ${p.dat}`, actions: [{ intent: 'query_wish', person: p.nom }], ok: (r) => r.type === 'unknownPerson' }; },
  W11: (w) => ({ goal: [`Дописать подробности к хотелке ${q(w.wishes[0]!.title)}`, `Текст: ${pick(['цвет чёрный', 'размер побольше', 'не дороже пяти тысяч', 'лучше в подарочной упаковке', 'такой же, как у соседа'])}`] }),
  W13: (w) => ({ goal: [`Отметить, что вы подарите это: ${q(freshWish(w).title)}`, `Чьё желание: ${w.others[0]!.nom}`, 'Владелец об этом не узнает'] }),
  W14: (w) => ({ goal: [`Снять отметку «подарю» с желания ${q(freshWish(w).title)}`, `Чьё желание: ${w.others[0]!.nom}`] }),
  W15: (w) => ({ goal: [`Вернуть удалённую хотелку ${q(freshWish(w).title)}`, 'Вы удалили её раньше'] }),

  /* ----- смотреть ----- */
  F01: (w) => { const f = freshFilm(w); return { ref: `Запиши посмотреть ${f.acc}`, actions: [{ intent: 'add', type: 'watch', title: f.title }], ok: (r) => { const d = one(r, 'watch'); return !!d && !d.kind; } }; },
  F02: (w) => { const f = freshFilm(w); return { ref: `Запиши ${KIND_W[f.kind]} ${f.title}`, actions: [{ intent: 'add', type: 'watch', title: f.title, kind: f.kind }], ok: (r) => one(r, 'watch')?.kind === f.kind }; },
  F03: (w) => { const a = freshFilm(w); const b = freshFilm(w); if (a === b) return null; return { ref: `Посоветовали ${a.title} и ещё ${b.title}`, actions: [{ intent: 'add', type: 'watch', title: a.title }, { intent: 'add', type: 'watch', title: b.title }], ok: (r) => r.type === 'items' && r.items.length === 2 && r.items.every((i) => i.type === 'watch') }; },
  F04: (w) => { const f = freshFilm(w); const g = f.genres?.[0]; if (!g || !f.origin) return null; return { ref: `Добавь ${f.origin === 'ru' ? 'наше' : 'зарубежное'}, ${GENRE_W[g]}: ${f.title}`, actions: [{ intent: 'add', type: 'watch', title: f.title, genres: [g], origin: f.origin }], ok: (r) => { const d = one(r, 'watch'); return !!d && (d.genres as string[]).includes(g) && d.origin === f.origin; }, goal: [`В «Смотреть»: ${q(f.title)}`, `Назвать жанр и страну: ${GENRE_W[g]}, ${f.origin === 'ru' ? 'наше' : 'зарубежное'}`] }; },
  F05: (w) => { const f = w.films[0]!; return { ref: `Мы посмотрели ${f.acc}`, actions: [{ intent: 'mark', target: ['m1'], query: f.acc }], ok: (r) => !!chg(r, 'mark', 'watch', 'm1') }; },
  F06: (w) => { const f = w.films[0]!; w.ctx.existing.watch[0]!.done = true; return { ref: `Верни ${f.acc} в непросмотренные`, actions: [{ intent: 'unmark', target: ['m1'], query: f.acc }], ok: (r) => !!chg(r, 'unmark', 'watch', 'm1'), hint: ['Сейчас запись отмечена просмотренной'] }; },
  F07: (w) => { const f = w.films[0]!; return { ref: `Удали ${f.acc} из смотреть`, actions: [{ intent: 'delete', target: ['m1'], query: f.acc }], ok: (r) => !!chg(r, 'delete', 'watch', 'm1') }; },
  F08: (w) => { const f = w.films[0]!; const g = freshFilm(w); return { ref: `Переименуй ${f.acc} в ${g.title}`, actions: [{ intent: 'update', target: ['m1'], query: f.acc, title: g.title }], ok: (r) => typeof chg(r, 'update', 'watch', 'm1')?.patch?.title === 'string', goal: [`Исправить название в «Смотреть»: ${q(f.title)}`, `Новое название: ${g.title}`] }; },
  F09: () => ({ ref: 'Что посмотрим', actions: [{ intent: 'query_watch' }], ok: (r) => r.type === 'queryWatch' && Object.values(r.filters).every((f) => !f.length) }),
  F10: () => { const k = pick(Object.keys(KIND_W)); return { ref: `Какой ${KIND_W[k]} посмотреть`, actions: [{ intent: 'query_watch', kind: [k] }], ok: (r) => r.type === 'queryWatch' && r.filters.kind[0] === k && !r.filters.genre.length }; },
  F11: () => { const g = pick(Object.keys(GENRE_W)); return { ref: `Что посмотреть, хочу ${GENRE_W[g]}`, actions: [{ intent: 'query_watch', genre: [g] }], ok: (r) => r.type === 'queryWatch' && r.filters.genre[0] === g && !r.filters.kind.length && !r.filters.origin.length }; },
  F12: () => { const o = pick(['ru', 'foreign']); return { ref: `Что посмотреть из ${o === 'ru' ? 'нашего' : 'зарубежного'}`, actions: [{ intent: 'query_watch', origin: [o] }], ok: (r) => r.type === 'queryWatch' && r.filters.origin[0] === o && !r.filters.genre.length && !r.filters.fresh.length }; },
  F13: () => { const f = pick(['new', 'old']); return { ref: `Что посмотреть из ${f === 'new' ? 'новинок' : 'старого'}`, actions: [{ intent: 'query_watch', fresh: [f] }], ok: (r) => r.type === 'queryWatch' && r.filters.fresh[0] === f && !r.filters.origin.length }; },
  F14: () => { const k = pick(Object.keys(KIND_W).slice(0, 3)); const g = pick(Object.keys(GENRE_W).slice(0, 9)); const o = pick(['ru', 'foreign', null]); const f = pick(['new', 'old', null]); if (!o && !f) return null; return { ref: `Какой ${KIND_W[k]} посмотреть, ${GENRE_W[g]}${o ? `, ${o === 'ru' ? 'наше' : 'зарубежное'}` : ''}${f ? `, из ${f === 'new' ? 'новинок' : 'старого'}` : ''}`, actions: [{ intent: 'query_watch', kind: [k], genre: [g], ...(o && { origin: [o] }), ...(f && { fresh: [f] }) }], ok: (r) => r.type === 'queryWatch' && r.filters.kind[0] === k && r.filters.genre[0] === g && (!o || r.filters.origin[0] === o) && (!f || r.filters.fresh[0] === f) }; },
  F15: (w) => { const f = w.films[0]!; return { goal: [`Исправить у записи ${q(f.title)} в «Смотреть»`, pick([`Вид: ${KIND_W[pick(Object.keys(KIND_W).filter((k) => k !== f.kind))]}`, `Жанр: ${GENRE_W[pick(Object.keys(GENRE_W))]}`])] }; },
  F16: (w) => ({ goal: [`Вернуть удалённую запись ${q(freshFilm(w).title)} в «Смотреть»`, 'Вы удалили её раньше'] }),

  /* ----- заметки ----- */
  N01: (w) => { const t = pick(w.V.IDEAS); return { ref: `Запиши заметку: ${t}`, actions: [{ intent: 'add', type: 'idea', text: cap(t), topic: null }], ok: (r) => { const d = one(r, 'idea'); return !!d && !d.topicId && !d.newTopic; } }; },
  N02: (w) => { const t = pick(w.V.IDEAS); return { ref: `Запиши ${w.topic.into}: ${t}`, actions: [{ intent: 'add', type: 'idea', text: cap(t), topic: w.topic.title }], ok: (r) => one(r, 'idea')?.topicId === w.topic.id }; },
  N03: (w) => { const t = pick(w.V.IDEAS); const nt = pick((w.V.TOPICS as BASE.TopicWord[]).filter((x) => !x.list && x.title !== w.topic.title && low(x.title) !== low(w.list.title))); return { ref: `Запиши ${nt.into}: ${t}`, actions: [{ intent: 'add', type: 'idea', text: cap(t), topic: nt.title }], ok: (r) => !!one(r, 'idea')?.newTopic }; },
  N04: (w) => { const t = pick(w.V.IDEAS); w.ctx.currentTopicId = w.topic.id; return { ref: `Запиши сюда: ${t}`, actions: [{ intent: 'add', type: 'idea', text: cap(t), topic: null }], ok: (r) => one(r, 'idea')?.topicId === w.topic.id, hint: ['Тема открыта на экране — не называйте её'] }; },
  N05: (w) => ({ goal: ['Записать мысль, не называя её заметкой, идеей или мыслью', `О чём: ${pick(w.V.IDEAS)}`, 'Без «запиши» и «добавь» — как наблюдение вслух'] }),
  N06: (w) => { const i = w.ctx.existing.ideas![0]!; return { ref: `Перенеси заметку ${low(i.text)} ${w.topic.into}`, actions: [{ intent: 'update', target: [i.id], query: low(i.text), topic: w.topic.title }], ok: (r) => chg(r, 'update', 'idea', i.id)?.patch?.topicId === w.topic.id }; },
  N07: (w) => { const i = w.ctx.existing.ideas![0]!; return { ref: `Удали заметку ${low(i.text)}`, actions: [{ intent: 'delete', target: [i.id], query: low(i.text) }], ok: (r) => !!chg(r, 'delete', 'idea', i.id) }; },
  N08: (w) => { const i = w.ctx.existing.ideas![0]!; return { goal: [`Исправить текст заметки ${q(i.text)}`, `Новый текст: ${cap(pick(w.V.IDEAS))}`] }; },
  N09: (w) => ({ goal: [`Вернуть удалённую заметку ${q(cap(pick(w.V.IDEAS)))}`, 'Вы удалили её раньше'] }),

  /* ----- списки ----- */
  L01: (w) => { const [say, title, all] = pick(w.V.LISTS.filter(([, t]) => low(t) !== low(w.list.title))); const items = some(all, int(3, 5)); return { ref: `Запиши список ${say}: ${items.map(low).join(', ')}`, actions: [{ intent: 'add', type: 'idea', title, items, topic: null }], ok: (r) => { const i = r.type === 'items' && r.items.length === 1 ? r.items[0]! : null; return !!i && i.type === 'topic' && !i.id && !!i.data.body; } }; },
  L02: (w) => { const [nom, acc] = pick(w.V.NEW_ITEMS.filter(([n]) => !w.list.items.includes(n))); return { ref: `Добавь в ${w.list.say} ${acc}`, actions: [{ intent: 'list_edit', topic: w.list.title, add: [nom] }], ok: (r) => listChanges(r, w.list.id).join('|') === `+ ${nom}` }; },
  L03: (w) => { const [a, b] = some(w.V.NEW_ITEMS.filter(([n]) => !w.list.items.includes(n)), 2) as [[string, string], [string, string]]; return { ref: `Добавь в ${w.list.say} ${a[1]} и ${b[1]}`, actions: [{ intent: 'list_edit', topic: w.list.title, add: [a[0], b[0]] }], ok: (r) => listChanges(r, w.list.id).length === 2 && listChanges(r, w.list.id).every((c) => c.startsWith('+ ')) }; },
  L04: (w) => { const x = w.list.items[1]!; return { ref: `В теме ${low(w.list.title)} убери ${low(x)}`, actions: [{ intent: 'list_edit', topic: w.list.title, remove: [x] }], ok: (r) => listChanges(r, w.list.id).join('|') === `− ${x}` }; },
  L05: (w) => { const x = w.list.items[1]!; return { ref: `В теме ${low(w.list.title)} отметь ${low(x)}`, actions: [{ intent: 'list_edit', topic: w.list.title, check: [x] }], ok: (r) => listChanges(r, w.list.id).join('|') === `✓ ${x}` }; },
  L06: (w) => { const x = w.list.items[1]!; w.ctx.topics![0]!.body = w.list.items.map((i) => `- [${i === x ? 'x' : ' '}] ${i}`).join('\n'); return { ref: `В теме ${low(w.list.title)} сними отметку: ${low(x)}`, actions: [{ intent: 'list_edit', topic: w.list.title, uncheck: [x] }], ok: (r) => listChanges(r, w.list.id).join('|') === `○ ${x}`, hint: ['Сейчас пункт отмечен'], goal: [`В списке ${q(w.list.title)} снять отметку с пункта: ${x}`, 'Сейчас он отмечен'] }; },
  L07: (w) => { const x = w.list.items[1]!; const [nom] = pick(w.V.NEW_ITEMS.filter(([n]) => !w.list.items.includes(n))); return { ref: `В теме ${low(w.list.title)} замени ${low(x)} на ${low(nom)}`, actions: [{ intent: 'list_edit', topic: w.list.title, replace: [{ from: x, to: nom }] }], ok: (r) => listChanges(r, w.list.id).length === 1 && listChanges(r, w.list.id)[0]!.includes('→') }; },
  L08: (w) => { const [nom, acc] = pick(w.V.NEW_ITEMS.filter(([n]) => !w.list.items.includes(n))); w.ctx.currentTopicId = w.list.id; return { ref: `Добавь сюда ${acc}`, actions: [{ intent: 'list_edit', topic: null, add: [nom] }], ok: (r) => listChanges(r, w.list.id).join('|') === `+ ${nom}`, hint: ['Список открыт на экране — не называйте его'], goal: [`Список ${q(w.list.title)} открыт на экране`, `Добавить в него: ${nom}`, 'Список не называть'] }; },
  L09: (w) => { const x = w.list.items[1]!; const [nom, acc] = pick(w.V.NEW_ITEMS.filter(([n]) => !w.list.items.includes(n))); return { ref: `В теме ${low(w.list.title)} отметь ${low(x)} и добавь ${acc}`, actions: [{ intent: 'list_edit', topic: w.list.title, check: [x], add: [nom] }], ok: (r) => listChanges(r, w.list.id).length === 2, goal: [`В списке ${q(w.list.title)} одной фразой:`, `Отметить: ${x}`, `Добавить: ${nom}`] }; },

  /* ----- темы ----- */
  P01: (w) => { const nt = pick((w.V.TOPICS as BASE.TopicWord[]).filter((x) => !x.list && x.title !== w.topic.title && low(x.title) !== low(w.list.title))); return { ref: `Новая тема ${low(nt.title)}`, actions: [{ intent: 'add', type: 'topic', title: nt.title }], ok: (r) => { const i = r.type === 'items' && r.items.length === 1 ? r.items[0]! : null; return !!i && i.type === 'topic' && !i.id && !i.data.body; } }; },
  P02: (w) => ({ ref: `Открой ${low(w.topic.title)}`, actions: [{ intent: 'query_ideas', topic: w.topic.title }], ok: (r) => r.type === 'queryIdeas' && r.topicId === w.topic.id }),
  P03: () => ({ ref: 'Покажи мои заметки', actions: [{ intent: 'query_ideas', topic: null }], ok: (r) => r.type === 'queryIdeas' && r.topicId === null }),
  P04: () => ({ ref: 'Покажи заметки без темы', actions: [{ intent: 'query_ideas', topic: 'без темы' }], ok: (r) => r.type === 'queryIdeas' && r.topicId === 'inbox' }),
  P05: (w) => ({ goal: [`Переименовать тему ${q(w.topic.title)}`, `Новое название: ${pick((w.V.TOPICS as BASE.TopicWord[]).filter((x) => x.title !== w.topic.title)).title}`] }),
  P06: (w) => ({ goal: [`Удалить тему ${q(w.topic.title)} вместе с заметками`] }),
  P07: (w) => ({ goal: [rnd() < 0.6 ? `Убрать тему ${q(w.topic.title)} в архив` : `Вернуть тему ${q(w.topic.title)} из архива`] }),
  P08: (w) => ({ goal: [`Открыть ${rnd() < 0.5 ? `список ${q(w.list.title)}` : `тему ${q(w.topic.title)}`} группе ${q(w.ctx.groups![0]!.name)}`] }),
  P09: (w) => ({ goal: [`Закрыть тему ${q(w.topic.title)} от группы ${q(w.ctx.groups![0]!.name)}`, 'Сейчас группа её видит'] }),

  /* ----- вопросы о планах ----- */
  Q01: (w) => { const d = future(w, 1, 14); return { ref: `Что я делаю ${dayP(d)}`, actions: [{ intent: 'query_plans', scope: 'me', from: d, to: d, query: '' }], ok: (r) => r.type === 'queryPlans' && r.plans.scope.kind === 'me' && r.plans.from === d && r.plans.to === d && !r.plans.query }; },
  Q02: (w) => { const d = future(w, 1, 14); return { ref: `Что у нас ${dayP(d)}`, actions: [{ intent: 'query_plans', scope: 'us', from: d, to: d, query: '' }], ok: (r) => r.type === 'queryPlans' && r.plans.scope.kind === 'us' && r.plans.from === d && !r.plans.query }; },
  Q03: (w) => { const d = future(w, 1, 14); const p = w.others[0]!; return { ref: `Какие у нас с ${p.ins} планы ${dayP(d)}`, actions: [{ intent: 'query_plans', scope: 'people', people: [p.nom], from: d, to: d, query: '' }], ok: (r) => r.type === 'queryPlans' && r.plans.scope.kind === 'people' && r.plans.from === d }; },
  Q04: (w) => { const g = w.ctx.groups!.find((x) => ['friends', 'family', 'parents'].includes(x.category)); if (!g) return null; const d = future(w, 1, 14); const say = { friends: 'у наших друзей', family: 'у нас в семье', parents: 'у родителей' }[g.category as 'friends']; return { ref: `Что ${say} ${dayP(d)}`, actions: [{ intent: 'query_plans', scope: 'category', category: g.category, from: d, to: d, query: '' }], ok: (r) => r.type === 'queryPlans' && r.plans.scope.kind === 'category' && r.plans.from === d }; },
  Q05: (w) => { const g = w.ctx.groups![0]!; const d = future(w, 1, 14); return { ref: `Что в группе ${g.name} ${dayP(d)}`, actions: [{ intent: 'query_plans', scope: 'groups', groups: [g.name], from: d, to: d, query: '' }], ok: (r) => r.type === 'queryPlans' && r.plans.scope.kind === 'groups' && r.plans.from === d }; },
  Q06: (w) => { const d = future(w, 1, 14); const p = w.others[0]!; return { ref: `Что делает ${p.nom} ${dayP(d)}`, actions: [{ intent: 'query_plans', scope: 'us', who: [p.nom], from: d, to: d, query: '' }], ok: (r) => r.type === 'queryPlans' && r.plans.who?.[0] === 'u1' && r.plans.from === d }; },
  Q07: (w) => { const t = w.tasks[1]!; const to = `${Number(w.ctx.today.slice(0, 4)) + 1}${w.ctx.today.slice(4)}`; return { ref: `Когда у нас ${t.add}`, actions: [{ intent: 'query_plans', scope: 'us', from: w.ctx.today, to, query: low(t.title) }], ok: (r) => r.type === 'queryPlans' && !!r.plans.query }; },
  Q08: (w) => { const t = w.tasks[1]!; return { goal: [`Спросить, записано ли у вас дело ${q(t.title)}`, `На какие дни: ${pick(['на этой неделе', 'в ближайшие дни', 'на выходных', 'в этом месяце'])}`, 'Нужен ответ «да» или «нет»'] }; },
  Q09: (w) => ({ goal: [`Спросить, есть ли в списке ${q(w.list.title)} пункт: ${rnd() < 0.5 ? w.list.items[0] : pick(w.V.NEW_ITEMS)[0]}`, 'Нужен ответ «да» или «нет»'] }),

  /* ----- связи записей ----- */
  S01: (w) => {
    const t = fresh(w);
    const d = future(w, 1, 14);
    const items = some(w.V.NEW_ITEMS, 3).map(([n]) => n);
    return {
      ref: `${cap(t.add)} ${dayP(d)}, купить: ${items.map(low).join(', ')}`,
      actions: [add(t.title, { date: d }), { intent: 'add', type: 'idea', title: 'Купить', items, topic: null }],
      ok: (r) => r.type === 'items' && r.items.length === 2 && r.items.some((i) => i.type === 'task') && r.items.some((i) => i.type === 'topic'),
      hint: ['Одной фразой — и дело, и что купить к нему'],
    };
  },
  S02: (w) => {
    const { t, word } = target(w);
    return { ref: `Привяжи ${low(w.list.title)} к ${word.acc}`, actions: [{ intent: 'link', a: w.list.title, b: t.title }], ok: (r) => r.type === 'link' && [r.a.id, r.b.id].sort().join() === [t.id, w.list.id].sort().join() };
  },
  S03: (w) => {
    const { t } = target(w);
    w.ctx.links = [{ a: { type: 'task', id: t.id }, b: { type: 'note', id: w.list.id } }];
    return {
      ref: 'Что нужно купить',
      actions: [{ intent: 'query_linked', about: '', want: 'note' }],
      ok: (r) => r.type === 'queryLinked' && r.anchor.id === t.id,
      hint: [`Список ${q(w.list.title)} привязан к делу ${q(t.title)}`, 'Дело не называйте'],
    };
  },
  S04: (w) => {
    const [a, b] = w.ctx.existing.tasks as [Task, Task];
    w.ctx.links = [
      { a: { type: 'task', id: a.id }, b: { type: 'note', id: w.list.id } },
      { a: { type: 'task', id: b.id }, b: { type: 'note', id: 'i1' } },
    ];
    return {
      ref: `Что купить для дела ${low(b.title)}`,
      actions: [{ intent: 'query_linked', about: low(b.title), want: 'note' }],
      ok: (r) => r.type === 'queryLinked' && r.anchor.id === b.id,
      hint: [`К делу ${q(a.title)} привязан список ${q(w.list.title)}, к делу ${q(b.title)} — заметка`],
    };
  },
  S05: (w) => {
    const t = w.ctx.existing.tasks[2]!;
    t.date = addDays(w.ctx.today, -int(5, 120));
    w.ctx.links = [{ a: { type: 'note', id: w.list.id }, b: { type: 'task', id: t.id } }];
    return {
      ref: `Что я покупал для дела ${low(t.title)}`,
      actions: [{ intent: 'query_linked', about: low(t.title), want: 'note' }],
      ok: (r) => r.type === 'queryLinked' && r.anchor.id === t.id,
      hint: [`Дело ${q(t.title)} уже прошло, к нему привязан список ${q(w.list.title)}`],
    };
  },
  S06: (w) => {
    const m = w.ctx.existing.watch[0]!;
    const f = w.films[0]!;
    w.ctx.links = [{ a: { type: 'watch', id: m.id }, b: { type: 'note', id: 'i1' } }];
    return { ref: `Что связано с ${f.acc}`, actions: [{ intent: 'query_linked', about: f.title, want: null }], ok: (r) => r.type === 'queryLinked' && r.anchor.id === m.id, hint: ['К фильму привязана заметка'] };
  },
  S07: (w) => ({ goal: [`Удалить дело ${q(w.ctx.existing.tasks[0]!.title)} вместе с привязанным списком ${q(w.list.title)}`] }),
  S08: (w) => ({ goal: [`Отвязать список ${q(w.list.title)} от дела ${q(w.ctx.existing.tasks[0]!.title)}`, 'Сам список и дело оставить'] }),

  /* ----- не команда ----- */
  X01: () => ({ ref: 'Какая погода завтра', actions: [{ intent: 'unknown' }], ok: (r) => r.type === 'unknown', goal: ['Задайте вопрос не про дела, списки и заметки', `Например, ${pick(OFF_TOPIC)}`, 'Приложение должно ответить: не понял команду'] }),
  X02: () => ({ ref: 'Включи музыку', actions: [{ intent: 'unknown' }], ok: (r) => r.type === 'unknown', goal: ['Попросите то, что делает другой помощник', `Например, ${pick(OTHER_HELPER)}`, 'Приложение должно ответить: не понял команду'] }),
  X03: () => ({ ref: 'Ну это', actions: [{ intent: 'unknown' }], ok: (r) => r.type === 'unknown', goal: ['Скажите не команду, а обрывок', `Например, ${pick(SCRAPS)}`, 'Приложение должно ответить: не понял команду'] }),
};

function listChanges(r: ParseResult, id: string): string[] {
  const i = r.type === 'items' && r.items.length === 1 ? r.items[0]! : null;
  return i && i.type === 'topic' && i.id === id ? (i.data.changes ?? []) : [];
}

/* ---------- сборка ---------- */

const DO: Record<string, string> = { delete: 'удалить', mark: 'отметить', update: 'изменить' };
/** Задание: что должно получиться — теми же словами, что итог на экране; где итог — отказ, сказано, о чём просить */
function briefOf(r: ParseResult, ctx: Context, s: Scn): string[] {
  if (r.type === 'unknown') return s.goal!;
  if (r.type === 'notFound') return [`Попросите ${DO[String(s.actions![0]!.intent)] ?? 'изменить'} запись, которой у вас нет: ${r.query}`, 'Приложение должно ответить: не нашлось'];
  if (r.type === 'unknownPerson') return [`Спросите о желаниях человека, которого нет в ваших группах: ${r.name}`, 'Приложение должно ответить: такого человека нет'];
  return [...explainResult(r, ctx).split('\n'), ...(s.hint ?? [])];
}

const cards: Card[] = [];
const report: string[] = [];
for (const code of Object.keys(MAKE)) {
  const built = { base: 0, test: 0 };
  let collect = 0;
  let failed = 0;
  for (const [vocab, V] of [['base', BASE], ['test', TEST]] as const) {
    const seen = new Set<string>();
    for (let i = 0; i < PER_VOCAB * 12 && seen.size < PER_VOCAB; i++) {
      seed = (createHash('sha1').update(`${code}|${vocab}|${i}`).digest().readUInt32BE(0) || 1) >>> 0;
      const w = world(V as Vocab);
      let s: Scn | null;
      try {
        s = MAKE[code]!(w);
      } catch {
        s = null;
      }
      if (!s) continue;
      let brief: string[] | null = null;
      let isCollect = !s.actions;
      if (s.actions) {
        try {
          const want = normalize(s.actions as never, w.ctx, cleanSpeech(normalizeTimes(s.ref!)));
          if (s.ok!(want)) brief = briefOf(want, w.ctx, s);
        } catch {
          /* сервер не собрал цель — ниже уйдёт в сбор фраз или отсеется */
        }
        if (!brief) {
          failed++;
          // Сервер такое действие не умеет: если есть задание словами — карточка «сбор фраз»
          if (!s.goal || built[vocab] > 0) continue;
          isCollect = true;
        }
      }
      brief ??= s.goal!;
      const key = brief.join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      const id = `s${createHash('sha1').update(`${code}|${vocab}|${key}|${w.ctx.today}`).digest('hex').slice(0, 10)}`;
      if (isCollect) collect++;
      else built[vocab]++;
      cards.push({
        id,
        variant: code,
        vocab,
        phrase: isCollect ? '' : s.ref!,
        brief,
        ctx: w.ctx,
        actions: isCollect ? [] : s.actions!,
        control: parseInt(id.slice(-2), 16) % 10 === 0,
        ...(isCollect && { collect: true }),
      });
    }
  }
  const total = built.base + built.test;
  report.push(`${code}\t${total ? 'сверка' : collect ? 'сбор фраз' : 'НЕТ КАРТОЧЕК'}\t${total + collect}\t${failed ? `не прошло проверку: ${failed}` : ''}`);
}

// Код со сверкой не должен смешиваться со сбором фраз: если хоть часть сценариев сервер собрал — сбор по этому коду убираем
const checked = new Set(cards.filter((c) => !c.collect).map((c) => c.variant));
const out = cards.filter((c) => !c.collect || !checked.has(c.variant));
mkdirSync(join(process.cwd(), 'data'), { recursive: true });
writeFileSync(join(process.cwd(), 'data', 'practice.ndjson'), out.map((c) => JSON.stringify(c)).join('\n') + '\n');
console.log(report.join('\n'));
console.log(`\nКарточек ${out.length}: со сверкой ${out.filter((c) => !c.collect).length} (кодов ${checked.size}), сбор фраз ${out.filter((c) => c.collect).length} (кодов ${new Set(out.filter((c) => c.collect).map((c) => c.variant)).size}), контрольных ${out.filter((c) => c.control).length}`);
