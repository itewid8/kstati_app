/**
 * Обучающий набор для дообучения YandexGPT Lite (Yandex AI Studio, LoRA).
 *
 * Идём от обратного: сначала каталог всех действий, которые понимает приложение (VARIANTS ниже — вид команды,
 * её разновидность и шаблоны фраз), потом под каждое действие — фразы из словаря (train/catalog.ts) в случайном,
 * но правдоподобном контексте (сегодня, люди, группы, темы, записи). Ответ — JSON в формате коротких правил.
 *
 * Каждый пример проверяется тем же кодом, что разбирает ответы модели на сервере (normalize): что не сходится
 * с задуманным — в набор не попадает, а попадает в отчёт. Фразы экзамена (eval/run.ts) в набор не берутся.
 *
 *   npm run train:data            — train/out/train.jsonl, train/out/valid.jsonl и train/ACTIONS.md
 *   npm run train:data -- 3       — другое случайное зерно (другие фразы)
 *
 * Строка набора: {"request":[{"role":"system","text":…},{"role":"user","text":…}],"response":"…"} —
 * system и user собирает buildTunedMessages, как на сервере в режиме PROMPT_MODE=tuned.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalize } from '../src/parse.js';
import { buildTunedMessages } from '../src/prompt.js';
import { quickParse } from '../src/quick.js';
import { cleanSpeech, nearestWeekday, spokenPeriod, spokenTime } from '../src/spoken.js';
import type { Context, ParseResult } from '../src/types.js';
import type { Category, Film, Person, TaskWord } from './catalog.js';

// Словарь: обычный или проверочный — слова, которых в обучении нет (TRAIN_VOCAB=test, см. catalog-test.ts)
const VOCAB = process.env.TRAIN_VOCAB === 'test' ? await import('./catalog-test.js') : await import('./catalog.js');
const { FILMS, GROUPS, IDEAS, LISTS, MALE_A, MISSING, NEW_ITEMS, NOISE, NOTES, PEOPLE, RENAMES, SUBS, TASKS, TOPICS, TRIPS, UNKNOWN_FILMS, WISHES } = VOCAB;
// Составные названия (train/compose.ts) — только в обучении: проверка на незнакомом остаётся на своём словаре
const COMPOSE = process.env.TRAIN_VOCAB !== 'test' && process.env.TRAIN_COMPOSE !== '0';

const HERE = dirname(fileURLToPath(import.meta.url));
// Скомпилированный файл лежит не там, где исходник: папку train ищем от текущей (npm run — из server/)
const ROOT = process.env.TRAIN_ROOT ?? join(process.cwd(), 'train');
void HERE;

/* ---------- случайность с зерном: набор воспроизводим ---------- */

let seed = Number(process.argv[2] ?? 1) >>> 0 || 1;
const rnd = () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)] as T;
const chance = (p: number) => rnd() < p;
const shuffle = <T>(a: readonly T[]): T[] => [...a].sort(() => rnd() - 0.5);
const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const pad = (n: number) => String(n).padStart(2, '0');

/* ---------- слова: готовые (catalog.ts) и составные (compose.ts) ---------- */

const made = COMPOSE ? (await import('./compose.js')).compose({ pick, chance }) : null;
// Составленное слово запоминаем по названию: правкам («перенеси …») нужны его формы
const TASK_BY = new Map<string, TaskWord>(TASKS.map((x) => [x.title, x]));
const FILM_BY = new Map<string, Film>(FILMS.map((x) => [x.title, x]));
const WISH_BY = new Map(WISHES.map((x) => [x.title, x]));
const keep = <T extends { title: string }>(by: Map<string, T>, x: T): T => {
  if (!by.has(x.title)) by.set(x.title, x);
  return by.get(x.title)!;
};
const anyTask = (): TaskWord => keep(TASK_BY, (chance(0.75) && made?.task()) || pick(TASKS));
const anyFilm = (): Film => keep(FILM_BY, (chance(0.65) && made?.film()) || pick(FILMS));
const anyWish = () => keep(WISH_BY, (chance(0.75) && made?.wish()) || pick(WISHES));
/** Несколько разных */
const some = <T extends { title: string }>(n: number, one: () => T): T[] => {
  const out = new Map<string, T>();
  for (let i = 0; i < n * 4 && out.size < n; i++) {
    const x = one();
    out.set(x.title, x);
  }
  return [...out.values()];
};

/* ---------- даты ---------- */

const DAY = 86400000;
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const addDays = (s: string, n: number) => iso(new Date(Date.parse(`${s}T00:00:00Z`) + n * DAY));
const dowOf = (s: string) => new Date(`${s}T00:00:00Z`).getUTCDay();

/** Даты, как их говорят (ответ модели — то же, что посчитает сервер, spokenPeriod) */
const DATE_SAYS = ['сегодня', 'завтра', 'послезавтра', 'в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу', 'в воскресенье', 'в следующую субботу', 'в следующий понедельник', 'в следующую среду', 'через неделю', 'через две недели', 'через три дня', 'через месяц'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const dateSay = () => (chance(0.2) ? `${1 + Math.floor(rnd() * 27)} ${pick(MONTHS_GEN)}` : pick(DATE_SAYS));
/** Время, как его говорят; ответ — по spokenTime (как на сервере) */
const TIME_SAYS = ['в 7 утра', 'в семь', 'в 8', 'в восемь утра', 'в 9', 'в десять', 'в 10:30', 'в 11', 'в 12', 'в час дня', 'в 14:00', 'в три', 'в 16:30', 'в пять', 'в 18:00', 'в шесть вечера', 'в 19:30', 'в девять вечера', 'в 21:00'];
const WEEKDAYS: [string, number, string][] = [
  ['на понедельник', 1, 'понедельник'],
  ['на вторник', 2, 'вторник'],
  ['на среду', 3, 'среду'],
  ['на четверг', 4, 'четверг'],
  ['на пятницу', 5, 'пятницу'],
  ['на субботу', 6, 'субботу'],
  ['на воскресенье', 0, 'воскресенье'],
];

/* ---------- контекст: сегодня, люди, группы, темы, записи ---------- */

type Ctx = Context & { existing: Required<Context['existing']> };

function makeCtx(): Ctx {
  const today = addDays('2026-10-01', Math.floor(rnd() * 180));
  const people = shuffle(PEOPLE);
  const me = people[0]!;
  const others = people.slice(1, 2 + Math.floor(rnd() * 3));
  const groups = shuffle(GROUPS).slice(0, 1 + Math.floor(rnd() * 3));
  const topics = shuffle(TOPICS)
    .slice(0, Math.floor(rnd() * 3))
    .map((t, i) => ({ id: `p${i + 1}`, title: t.title, ...(t.list && { body: t.list.map((x) => `- [ ] ${x}`).join('\n') }) }));
  const tasks = some(3 + Math.floor(rnd() * 6), anyTask)
    .map((t, i) => ({ id: `t${i + 1}`, title: t.title, date: chance(0.8) ? addDays(today, Math.floor(rnd() * 14) - 2) : null, time: chance(0.5) ? pick(['09:00', '10:00', '18:30', '19:00', '20:00']) : null }));
  const watch = some(2 + Math.floor(rnd() * 3), anyFilm)
    .map((f, i) => ({ id: `m${i + 1}`, title: f.title }));
  const wishes = some(1 + Math.floor(rnd() * 2), anyWish)
    .map((w, i) => ({ id: `w${i + 1}`, title: w.title }));
  return {
    today,
    now: `${pad(8 + Math.floor(rnd() * 14))}:${pad(Math.floor(rnd() * 12) * 5)}`,
    me: { id: 'me1', name: me.nom },
    people: others.map((p, i) => ({ id: `u${i + 1}`, name: p.nom })),
    groups,
    topics,
    existing: { tasks, watch, wishes, ideas: [] },
  };
}
const othersOf = (ctx: Ctx): Person[] => ctx.people.map((p) => PEOPLE.find((x) => x.nom === p.name)!).filter(Boolean);
const personAcc = (p: Person) => (/[ая]$/.test(p.nom) ? p.nom.replace(/а$/, 'у').replace(/я$/, 'ю') : p.gen);

/* ---------- пример ---------- */

type Raw = Record<string, unknown>;
type Example = { phrase: string; ctx: Ctx; actions: Raw[]; check: (r: ParseResult) => string | true };
type Variant = { id: string; group: string; title: string; count: number; make: () => Example | null };

/** Ответ модели — без пустых полей, как в коротких правилах */
const clean = (a: Raw): Raw =>
  Object.fromEntries(Object.entries(a).filter(([k, v]) => k === 'target' || (v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length))));

const items = (r: ParseResult) => (r.type === 'items' ? r.items : []);
function taskCheck(title: string, date: string | null, time: string | null, extra?: (d: Record<string, unknown>) => string | true) {
  return (r: ParseResult) => {
    const it = items(r)[0];
    if (!it || it.type !== 'task') return `не дело: ${r.type}`;
    const d = it.data as unknown as Record<string, unknown>;
    if (d.title !== title) return `title «${d.title}»`;
    if ((d.date ?? null) !== date) return `date ${d.date}, нужно ${date}`;
    if ((d.time ?? null) !== time) return `time ${d.time}, нужно ${time}`;
    return extra ? extra(d) : true;
  };
}
const changeCheck = (action: string, id: string, extra?: (c: Record<string, unknown>) => string | true) => (r: ParseResult) => {
  if (r.type !== 'changes') return `не правка: ${r.type}`;
  const c = r.changes[0] as unknown as Record<string, unknown>;
  if (c.action !== action) return `action ${c.action}`;
  if (c.chosen !== id) return `chosen ${c.chosen}, нужно ${id}`;
  return extra ? extra(c) : true;
};

/* ---------- дела ---------- */

// Как люди начинают команду «новое дело»: от голого «завтра йога» до «запиши в дела…»
const TASK_LEADS = [
  '', '', '', 'запиши ', 'запиши в дела ', 'запиши в календарь ', 'добавь в дела ', 'добавь в календарь ', 'внеси в дела ', 'поставь ',
  'запланируй ', 'напомни ', 'напомни мне ', 'не забудь ', 'добавь ', 'надо ', 'нужно ', 'мне надо ', 'не забыть ', 'создай дело ', 'новое дело ',
  'кстати ', 'слушай, запиши ', 'так, запиши в дела ',
];
function taskAdd(): Example | null {
  const ctx = makeCtx();
  const t = anyTask();
  const ds = chance(0.85) ? dateSay() : '';
  const ts = chance(0.6) ? pick(TIME_SAYS) : '';
  const lead = pick(TASK_LEADS);
  const parts = shuffle([ds, ts].filter(Boolean));
  const phrase = cap(chance(0.5) ? `${lead}${[...parts, t.add].join(' ')}` : `${lead}${[t.add, ...parts].join(' ')}`).trim();
  const date = ds ? (spokenPeriod(ds, ctx.today)?.from ?? null) : null;
  const time = ts ? spokenTime(ts) : null;
  // Время без даты — сегодня (так решает сервер)
  const day = date ?? (time ? ctx.today : null);
  return { phrase, ctx, actions: [clean({ intent: 'add', type: 'task', title: t.title, date: day, time })], check: taskCheck(t.title, day, time) };
}

function taskPeople(): Example | null {
  const ctx = makeCtx();
  const p = pick(othersOf(ctx));
  if (!p) return null;
  const t = anyTask();
  const ds = dateSay();
  const date = spokenPeriod(ds, ctx.today)?.from ?? null;
  const way = pick(['pair', 'all', 'me', 'other'] as const);
  const phrase =
    way === 'pair' ? `Мы с ${p.ins} ${ds} ${t.add}` : way === 'all' ? `У нас ${ds} ${t.add}` : way === 'me' ? `У меня ${ds} ${t.add}` : `${p.dat} ${ds} ${t.add}`;
  const people = way === 'pair' ? ['me', p.nom] : way === 'all' ? ['all'] : way === 'me' ? ['me'] : [p.nom];
  const want = way === 'pair' ? ['me1', `u${ctx.people.findIndex((x) => x.name === p.nom) + 1}`] : way === 'me' ? ['me1'] : way === 'other' ? [`u${ctx.people.findIndex((x) => x.name === p.nom) + 1}`] : null;
  return {
    phrase: cap(phrase),
    ctx,
    actions: [clean({ intent: 'add', type: 'task', title: t.title, date, people })],
    check: taskCheck(t.title, date, null, (d) => {
      if (!want) return true;
      const got = ((d.people as string[] | undefined) ?? []).slice().sort();
      return JSON.stringify(got) === JSON.stringify(want.slice().sort()) ? true : `people ${JSON.stringify(got)}`;
    }),
  };
}

function taskDuration(): Example | null {
  const ctx = makeCtx();
  const t = anyTask();
  const ds = dateSay();
  const date = spokenPeriod(ds, ctx.today)?.from ?? null;
  if (chance(0.5)) {
    const h = 9 + Math.floor(rnd() * 11);
    const phrase = cap(`${t.add} ${ds} с ${h} до ${h + 2}`);
    return { phrase, ctx, actions: [clean({ intent: 'add', type: 'task', title: t.title, date, time: `${pad(h)}:00`, end_time: `${pad(h + 2)}:00` })], check: taskCheck(t.title, date, `${pad(h)}:00`, (d) => (d.endTime === `${pad(h + 2)}:00` ? true : `endTime ${d.endTime}`)) };
  }
  const [say, min] = pick([['на два часа', 120], ['на час', 60], ['на полтора часа', 90], ['на 45 минут', 45], ['на три часа', 180]] as [string, number][]);
  const ts = pick(['в 10', 'в 18:00', 'в 12', 'в 15:00']);
  const time = spokenTime(ts);
  const phrase = cap(`${t.add} ${ds} ${ts} ${say}`);
  return { phrase, ctx, actions: [clean({ intent: 'add', type: 'task', title: t.title, date, time, duration_min: min })], check: taskCheck(t.title, date, time) };
}

function taskRange(): Example | null {
  const ctx = makeCtx();
  const [say, title] = pick(TRIPS);
  const m = pick(MONTHS_GEN);
  const a = 1 + Math.floor(rnd() * 20);
  const b = a + 1 + Math.floor(rnd() * 6);
  const p = spokenPeriod(`${a} ${m}`, ctx.today);
  if (!p) return null;
  const end = addDays(p.from, b - a);
  const lead = chance(0.4) ? `Мы с ${pick(othersOf(ctx))?.ins ?? 'семьёй'} ` : '';
  const phrase = cap(`${lead}${say} с ${a} по ${b} ${m}`);
  return { phrase, ctx, actions: [clean({ intent: 'add', type: 'task', title, date: p.from, end_date: end, kind: 'trip' })], check: taskCheck(title, p.from, null, (d) => (d.endDate === end ? true : `endDate ${d.endDate}`)) };
}

const REPEATS = ['каждую субботу', 'каждый понедельник', 'по будням', 'каждый день', 'по выходным', 'раз в две недели по средам', 'каждое 15 число', 'каждую пятницу'];
function taskRepeat(): Example | null {
  const ctx = makeCtx();
  const t = anyTask();
  const rep = pick(REPEATS);
  const ts = chance(0.5) ? pick(TIME_SAYS) : '';
  const phrase = cap(chance(0.5) ? `${t.add} ${rep} ${ts}` : `${rep} ${ts} ${t.add}`).replace(/\s+/g, ' ').trim();
  // Первый раз серии считает сервер — берём его ответ и требуем, чтобы повтор был
  const probe = normalize([{ intent: 'add', type: 'task', title: t.title, time: ts ? spokenTime(ts) : null }] as never, ctx, phrase);
  const it = items(probe)[0];
  if (!it || it.type !== 'task' || !it.data.date) return null;
  const date = it.data.date;
  const time = ts ? spokenTime(ts) : null;
  return {
    phrase,
    ctx,
    actions: [clean({ intent: 'add', type: 'task', title: t.title, date, time })],
    check: taskCheck(t.title, date, time, (d) => (d.repeat ? true : 'нет повтора')),
  };
}

function taskKind(): Example | null {
  const ctx = makeCtx();
  const ds = dateSay();
  const date = spokenPeriod(ds, ctx.today)?.from ?? null;
  if (!date) return null;
  if (chance(0.6)) {
    const p = pick(PEOPLE);
    const phrase = cap(`${ds} день рождения ${p.gen}`);
    const title = `День рождения ${p.gen}`;
    return { phrase, ctx, actions: [clean({ intent: 'add', type: 'task', title, date, kind: 'birthday' })], check: taskCheck(title, date, null, (d) => (d.kind === 'birthday' ? true : `kind ${d.kind}`)) };
  }
  const [say, title] = pick([['годовщина свадьбы', 'Годовщина свадьбы'], ['юбилей у мамы', 'Юбилей мамы'], ['важный день: защита диплома', 'Защита диплома']] as [string, string][]);
  return { phrase: cap(`${ds} ${say}`), ctx, actions: [clean({ intent: 'add', type: 'task', title, date, kind: 'important' })], check: taskCheck(title, date, null, (d) => (d.kind === 'important' ? true : `kind ${d.kind}`)) };
}

function taskNote(): Example | null {
  const ctx = makeCtx();
  const t = anyTask();
  const ds = dateSay();
  const note = pick(NOTES);
  const date = spokenPeriod(ds, ctx.today)?.from ?? null;
  const phrase = cap(`${t.add} ${ds}, ${note}`);
  return { phrase, ctx, actions: [clean({ intent: 'add', type: 'task', title: t.title, date, note: cap(note) })], check: taskCheck(t.title, date, null, (d) => (d.note === cap(note) ? true : `note «${d.note}»`)) };
}

function taskParent(): Example | null {
  const ctx = makeCtx();
  const [, title] = pick(TRIPS);
  const from = addDays(ctx.today, 3 + Math.floor(rnd() * 10));
  const plan = { id: 't90', title, date: from, time: null, endDate: addDays(from, 3) };
  ctx.existing.tasks.push(plan);
  const sub = pick(SUBS);
  const open = chance(0.3);
  if (open) ctx.currentParentId = 't90';
  const ts = pick(['в 10', 'в 12', 'в 15:00', 'в 19:00']);
  const time = spokenTime(ts);
  const phrase = cap(open ? `${sub.toLowerCase()} ${ts}` : (chance(0.5) ? `в ${title.toLowerCase().replace(/^поездка/, 'поездку').replace(/^командировка/, 'командировку')}` : `для ${title.toLowerCase().replace(/^поездка/, 'поездки').replace(/^командировка/, 'командировки')}`) + ` добавь ${sub.toLowerCase()} ${ts}`);
  return { phrase, ctx, actions: [clean({ intent: 'add', type: 'task', title: sub, date: from, time, parent: 't90' })], check: taskCheck(sub, from, time, (d) => (d.parentId === 't90' ? true : `parent ${d.parentId}`)) };
}

/* ---------- хотелки и «Смотреть» ---------- */

function wishAdd(): Example | null {
  const ctx = makeCtx();
  const w = anyWish();
  const phrase = cap(`${pick(['добавь в мой вишлист', 'хочу', 'запиши в хотелки', 'добавь в список желаний', 'я бы хотел', 'добавь в хотелки', 'запиши в вишлист', 'хочу в подарок', 'мечтаю о', 'было бы классно получить'])} ${w.say}`);
  return {
    phrase,
    ctx,
    actions: [clean({ intent: 'add', type: 'wish', title: w.title, note: w.note })],
    check: (r) => {
      const it = items(r)[0];
      if (!it || it.type !== 'wish') return `не хотелка: ${r.type}`;
      return it.data.title === w.title ? true : `title «${it.data.title}»`;
    },
  };
}

// Год, жанры и вид даёт ПоискКино по названию (src/films.ts); вид, названный моделью, сервер ставит выше найденного,
// поэтому угадывать его нельзя. Модели — название как сказано; вид — только если он прозвучал («сериал Кухню»)
const filmRaw = (f: Film, said: boolean) => clean({ intent: 'add', type: 'watch', title: f.title, kind: said ? f.kind : undefined });
const KIND_WORD: Record<string, string> = { movie: 'фильм', series: 'сериал', cartoon: 'мультик', show: 'передачу', standup: 'стендап' };
function watchAdd(): Example | null {
  const ctx = makeCtx();
  if (chance(0.15)) {
    const title = pick(UNKNOWN_FILMS);
    const phrase = `${pick(['Добавь фильм', 'Сохрани фильм', 'Хочу посмотреть фильм'])} ${title}`;
    return { phrase, ctx, actions: [clean({ intent: 'add', type: 'watch', title, kind: 'movie' })], check: (r) => (items(r)[0]?.type === 'watch' ? true : `не смотреть: ${r.type}`) };
  }
  // Несколько фильмов в одной фразе — слабое место маленькой модели (второй теряется или путается вид): таких примеров половина
  const many = chance(0.5);
  const films = many ? some(chance(0.3) ? 3 : 2, anyFilm) : [anyFilm()];
  const f = films[0]!;
  const lead = pick([
    'добавь', 'хочу посмотреть', 'сохрани', 'было бы круто посмотреть', 'запиши в смотреть', 'надо глянуть', 'запиши посмотреть', 'добавь в смотреть',
    'добавь в фильмы', 'запиши в фильмы', 'добавь посмотреть', 'надо бы посмотреть', 'давай как-нибудь посмотрим', 'посоветовали', 'хотим посмотреть',
    'запомни', 'кстати, надо посмотреть', 'в список посмотреть',
  ]);
  void f;
  // Вид называют не всегда: у одного фильма — в 40% фраз, в перечислении — реже и у каждого отдельно
  const said = films.map(() => chance(many ? 0.2 : 0.4));
  const accs = films.map((x, i) => (said[i] ? `${KIND_WORD[x.kind]} ` : '') + x.acc);
  const last = accs.pop()!;
  const listed = accs.length ? `${accs.join(', ')}${pick([' и ', ' и ', ', ', ' а ещё ', ' и ещё '])}${last}` : last;
  const phrase = cap(`${lead} ${listed}`);
  return {
    phrase,
    ctx,
    actions: films.map((x, i) => filmRaw(x, said[i]!)),
    check: (r) => {
      const its = items(r);
      if (its.length !== films.length) return `записей ${its.length}`;
      for (let i = 0; i < films.length; i++) {
        const it = its[i]!;
        if (it.type !== 'watch') return 'не смотреть';
        if (it.data.title !== films[i]!.title) return `title «${it.data.title}»`;
        if (said[i] && it.data.kind !== films[i]!.kind) return `kind ${it.data.kind}`;
      }
      return true;
    },
  };
}

/** Вопрос «что посмотреть»: фраза и фильтры — вручную, чтобы падежи и согласование были живыми */
const WATCH_QUERIES: [string, Record<string, string[]>][] = [
  ['что посмотрим', {}],
  ['что посмотреть вечером', {}],
  ['давай что-нибудь посмотрим', {}],
  ['что-нибудь смешное', { genre: ['comedy'] }],
  ['что-нибудь смешное зарубежное', { genre: ['comedy'], origin: ['foreign'] }],
  ['какой-нибудь ужастик', { genre: ['horror'] }],
  ['какой-нибудь наш старый фильм', { kind: ['movie'], origin: ['ru'], fresh: ['old'] }],
  ['какой сериал посмотреть из нового', { kind: ['series'], fresh: ['new'] }],
  ['посоветуй детектив', { genre: ['detective'] }],
  ['хочу фантастику', { genre: ['scifi'] }],
  ['что из мультиков посмотрим', { kind: ['cartoon'] }],
  ['какую-нибудь драму', { genre: ['drama'] }],
  ['давай зарубежный сериал', { kind: ['series'], origin: ['foreign'] }],
  ['наше старое кино', { kind: ['movie'], origin: ['ru'], fresh: ['old'] }],
  ['что-нибудь новое и смешное', { genre: ['comedy'], fresh: ['new'] }],
  ['боевик посмотрим', { genre: ['action'] }],
  ['что-то романтическое', { genre: ['romance'] }],
  ['документалку какую-нибудь', { genre: ['documentary'] }],
  ['какой фильм посмотреть', { kind: ['movie'] }],
  ['наш сериал', { kind: ['series'], origin: ['ru'] }],
];
// Вопрос «что посмотреть» из частей: начало + то, что названо (вид, жанр, чьё, новое/старое). Не названо — фильтра нет
const WQ_START = ['что посмотрим', 'что бы посмотреть', 'что посмотреть', 'посоветуй', 'что бы такое посмотреть', 'что глянуть', 'что бы нам посмотреть', 'подскажи что посмотреть', 'что сегодня посмотрим'];
const WQ_KIND: [string, string][] = [['фильм', 'movie'], ['кино', 'movie'], ['сериал', 'series'], ['сериальчик', 'series'], ['мультик', 'cartoon'], ['мультфильм', 'cartoon']];
const WQ_GENRE: [string, string][] = [['смешное', 'comedy'], ['комедию', 'comedy'], ['ужастик', 'horror'], ['что-то страшное', 'horror'], ['фантастику', 'scifi'], ['драму', 'drama'], ['детектив', 'detective'], ['боевик', 'action'], ['про любовь', 'romance'], ['документалку', 'documentary'], ['триллер', 'thriller'], ['приключения', 'adventure']];
const WQ_ORIGIN: [string, string][] = [['из наших', 'ru'], ['российское', 'ru'], ['отечественное', 'ru'], ['из зарубежных', 'foreign'], ['иностранное', 'foreign'], ['американское', 'foreign']];
const WQ_FRESH: [string, string][] = [['из новинок', 'new'], ['посвежее', 'new'], ['из нового', 'new'], ['из старого', 'old'], ['старое', 'old'], ['из классики', 'old']];
function composeWatchQuery(): [string, Record<string, string[]>] {
  const f: Record<string, string[]> = {};
  const parts: string[] = [];
  const add = (key: string, list: [string, string][], p: number) => {
    if (!chance(p)) return;
    const [say, v] = pick(list);
    parts.push(say);
    f[key] = [v];
  };
  add('kind', WQ_KIND, 0.4);
  add('genre', WQ_GENRE, 0.4);
  add('origin', WQ_ORIGIN, 0.3);
  add('fresh', WQ_FRESH, 0.25);
  return [[pick(WQ_START), ...parts].join(' '), f];
}

function watchQuery(): Example | null {
  const ctx = makeCtx();
  const [say, f] = chance(0.3) ? pick(WATCH_QUERIES) : composeWatchQuery();
  const phrase = cap(say) + (/^(что|какой|какую|какие|какое)/.test(say) && chance(0.6) ? '?' : '');
  return {
    phrase,
    ctx,
    actions: [clean({ intent: 'query_watch', ...f })],
    check: (r) => {
      if (r.type !== 'queryWatch') return `не вопрос: ${r.type}`;
      for (const k of ['kind', 'genre', 'origin', 'fresh'] as const) if (JSON.stringify(r.filters[k]) !== JSON.stringify(f[k] ?? [])) return `${k} ${JSON.stringify(r.filters[k])}`;
      return true;
    },
  };
}

function wishQuery(): Example | null {
  const ctx = makeCtx();
  if (chance(0.4))
    return { phrase: pick(['Что я хотел?', 'Что у меня в вишлисте?', 'Что я хотела?', 'Что я хотел купить?', 'Что я хотела купить?', 'Что мне подарить?', 'Что мне хочется?', 'Покажи мои хотелки', 'Что у меня в хотелках?', 'Мой вишлист', 'Что там у меня в желаниях?', 'Что я там хотел?']), ctx, actions: [{ intent: 'query_wish', person: 'me' }], check: (r) => (r.type === 'queryWish' && r.personId === 'me1' ? true : `получено ${r.type}`) };
  const p = pick(othersOf(ctx));
  if (!p) return null;
  const phrase = pick([`Что подарить ${p.dat}?`, `Что хочет ${p.nom}?`, `Что ${p.nom} хотел${/[ая]$/.test(p.nom) && !MALE_A.includes(p.nom) ? 'а' : ''}?`, `Что в вишлисте у ${p.gen}?`]);
  const id = `u${ctx.people.findIndex((x) => x.name === p.nom) + 1}`;
  return { phrase, ctx, actions: [{ intent: 'query_wish', person: p.nom }], check: (r) => (r.type === 'queryWish' && r.personId === id ? true : `получено ${JSON.stringify(r)}`) };
}

/* ---------- вопросы о планах ---------- */

const PERIODS = ['в субботу', 'на выходных', 'на этой неделе', 'на следующей неделе', 'завтра', 'сегодня', 'в пятницу', 'в воскресенье', ''];
const CATEGORY_SAYS: [string, Category][] = [
  ['у наших друзей', 'friends'],
  ['у друзей', 'friends'],
  ['у родителей', 'parents'],
  ['в семье', 'family'],
];
function plansQuery(): Example | null {
  const ctx = makeCtx();
  const per = pick(PERIODS);
  const p = per ? spokenPeriod(per, ctx.today) : { from: ctx.today, to: addDays(ctx.today, 6) };
  if (!p) return null;
  const way = pick(['us', 'me', 'people', 'category', 'groups', 'when'] as const);
  let phrase = '';
  let raw: Raw = {};
  let want: (s: Record<string, unknown>) => boolean = () => true;
  if (way === 'us') {
    phrase = pick([`Что у нас ${per}?`, `Какие у нас планы ${per}?`, `Чем мы заняты ${per}?`]);
    raw = { scope: 'us' };
    want = (s) => s.kind === 'us';
  } else if (way === 'me') {
    phrase = pick([`Что я делаю ${per}?`, `Какие у меня планы ${per}?`, `Я свободен ${per}?`]);
    raw = { scope: 'me' };
    want = (s) => s.kind === 'me';
  } else if (way === 'people') {
    const o = pick(othersOf(ctx));
    if (!o) return null;
    phrase = pick([`Что у нас с ${o.ins} ${per}?`, `Какие у нас с ${o.ins} планы ${per}?`]);
    raw = { scope: 'people', people: [o.nom] };
    want = (s) => s.kind === 'people';
  } else if (way === 'category') {
    const [say, cat] = pick(CATEGORY_SAYS);
    phrase = pick([`Что ${say} ${per}?`, `Какие планы ${say} ${per}?`]);
    raw = { scope: 'category', category: cat };
    want = (s) => s.kind === 'category' && s.category === cat;
  } else if (way === 'groups') {
    if (!ctx.groups!.some((g) => g.name === 'Футбол')) ctx.groups!.push({ name: 'Футбол', category: 'friends' });
    phrase = `Что у нас в Футболе ${per}?`;
    raw = { scope: 'groups', groups: ['Футбол'] };
    want = (s) => s.kind === 'groups';
  } else {
    // «Когда у нас баня?» — только дела-существительные («когда у нас забрать посылку» так не говорят)
    const nouns = ctx.existing.tasks.filter((x) => TASK_BY.get(x.title)?.add === x.title.toLowerCase() && !/^\S+(ть|ти|чь)(ся)?(\s|$)/i.test(x.title));
    if (!nouns.length) return null;
    const t = pick(nouns);
    phrase = `Когда у нас ${t.title.toLowerCase()}?`;
    raw = { scope: 'us', query: t.title.toLowerCase() };
    const res = { from: ctx.today, to: addDays(ctx.today, 365) };
    return {
      phrase,
      ctx,
      actions: [clean({ intent: 'query_plans', ...raw, from: res.from, to: res.to })],
      check: (r) => (r.type === 'queryPlans' && r.plans.query ? true : `получено ${r.type}`),
    };
  }
  phrase = phrase.replace(/\s+\?/, '?');
  return {
    phrase,
    ctx,
    actions: [clean({ intent: 'query_plans', ...raw, from: p.from, to: p.to, query: '' })],
    check: (r) => {
      if (r.type !== 'queryPlans') return `не планы: ${r.type}`;
      if (!want(r.plans.scope as unknown as Record<string, unknown>)) return `scope ${JSON.stringify(r.plans.scope)}`;
      if (r.plans.from !== p.from || r.plans.to !== p.to) return `период ${r.plans.from}…${r.plans.to}`;
      return true;
    },
  };
}

/* ---------- правки дел, фильмов, хотелок ---------- */

/** Дело из контекста по словарю (нужна форма «перенеси …») */
function someTask(ctx: Ctx): { id: string; w: TaskWord; date: string | null } | null {
  const t = pick(ctx.existing.tasks);
  const w = TASK_BY.get(t.title);
  return w ? { id: t.id, w, date: t.date } : null;
}

function taskMove(): Example | null {
  const ctx = makeCtx();
  const t = someTask(ctx);
  if (!t || !t.date) return null;
  const way = pick(['day', 'time', 'both', 'rel'] as const);
  const verb = pick(['перенеси', 'передвинь', 'сдвинь']);
  let phrase = '';
  const patch: Raw = {};
  if (way === 'day' || way === 'both') {
    const [say, dow] = pick(WEEKDAYS);
    phrase = `${verb} ${t.w.acc} ${say}`;
    patch.date = nearestWeekday(dow, t.date, ctx.today);
  }
  if (way === 'rel') {
    const say = pick(['на завтра', 'на послезавтра', 'на следующую неделю']);
    phrase = `${verb} ${t.w.acc} ${say}`;
    const p = spokenPeriod(say.replace(/^на /, say.includes('недел') ? 'на ' : ''), ctx.today);
    if (!p) return null;
    patch.date = p.from;
  }
  if (way === 'time' || way === 'both') {
    const [say, hm] = pick([['на восемь', '20:00'], ['на 10 утра', '10:00'], ['на 18:30', '18:30'], ['на семь вечера', '19:00'], ['на два', '14:00'], ['на 11', '11:00']] as [string, string][]);
    phrase = phrase ? `${phrase} ${say}` : `${verb} ${t.w.acc} ${say}`;
    patch.time = hm;
  }
  phrase = cap(phrase);
  return {
    phrase,
    ctx,
    actions: [clean({ intent: 'update', target: [t.id], ...patch, query: t.w.acc })],
    check: changeCheck('update', t.id, (c) => {
      const p = (c.patch ?? {}) as Record<string, unknown>;
      for (const [k, v] of Object.entries(patch)) if (p[k] !== v) return `${k}=${p[k]}, нужно ${v}`;
      return true;
    }),
  };
}

function taskEdit(): Example | null {
  const ctx = makeCtx();
  const t = someTask(ctx);
  if (!t) return null;
  const way = pick(['rename', 'people', 'end', 'duration'] as const);
  let phrase = '';
  const patch: Raw = {};
  if (way === 'rename') {
    const to = pick(RENAMES);
    phrase = `Переименуй ${t.w.acc} в ${to}`;
    patch.title = cap(to);
  } else if (way === 'people') {
    const p = pick(othersOf(ctx));
    if (!p) return null;
    phrase = `Добавь ${personAcc(p)} в ${t.w.acc}`;
    patch.people = [p.nom];
  } else if (way === 'end') {
    const h = pick([20, 21, 22, 19]);
    phrase = `Продли ${t.w.acc} до ${h}`;
    patch.end_time = `${h}:00`;
  } else {
    // Длительность считается от времени начала — только для дел со временем
    if (!ctx.existing.tasks.find((x) => x.id === t.id)?.time) return null;
    const [say, min] = pick([['на два часа', 120], ['на час', 60], ['на три часа', 180]] as [string, number][]);
    phrase = `Сделай ${t.w.acc} ${say}`;
    patch.duration_min = min;
  }
  return { phrase, ctx, actions: [clean({ intent: 'update', target: [t.id], ...patch, query: t.w.acc })], check: changeCheck('update', t.id) };
}

function taskRepeatChange(): Example | null {
  const ctx = makeCtx();
  const t = someTask(ctx);
  if (!t || !t.date) return null;
  const tt = ctx.existing.tasks.find((x) => x.id === t.id)!;
  const stop = chance(0.4);
  if (stop) tt.repeat = { freq: 'week', every: 1, weekdays: [dowOf(t.date) || 7] } as never;
  const phrase = cap(stop ? pick([`больше не повторяй ${t.w.acc}`, `сделай ${t.w.acc} разовой`]) : `${t.w.acc} теперь ${pick(['каждое воскресенье', 'каждую субботу', 'по будням', 'каждый день'])}`);
  return { phrase, ctx, actions: [clean({ intent: 'update', target: [t.id], query: t.w.acc })], check: changeCheck('update', t.id, (c) => ((c.patch as Record<string, unknown> | undefined)?.repeat !== undefined ? true : 'нет repeat')) };
}

function markUnmarkDelete(): Example | null {
  const ctx = makeCtx();
  const what = pick(['task', 'task', 'watch', 'wish'] as const);
  const action = pick(['mark', 'mark', 'delete', 'delete', 'unmark'] as const);
  let id = '';
  let query = '';
  let phrase = '';
  if (what === 'task') {
    const t = someTask(ctx);
    if (!t) return null;
    id = t.id;
    query = t.w.acc;
    if (action === 'unmark') ctx.existing.tasks.find((x) => x.id === id)!.done = true;
    phrase = action === 'mark' ? pick([`Сделал ${t.w.acc}`, `Отметь ${t.w.acc}`, `Готово: ${t.w.title.toLowerCase()}`]) : action === 'delete' ? pick([`Удали ${t.w.acc}`, `Убери ${t.w.acc}`]) : `Верни ${t.w.acc} в невыполненные`;
  } else if (what === 'watch') {
    const m = pick(ctx.existing.watch);
    const f = FILM_BY.get(m.title)!;
    id = m.id;
    query = f.acc;
    if (action === 'unmark') m.done = true;
    phrase = action === 'mark' ? pick([`Мы посмотрели ${f.acc}`, `Посмотрели ${f.acc}`]) : action === 'delete' ? `Удали ${f.acc} из смотреть` : `Верни ${f.acc} в непросмотренные`;
  } else {
    const w = pick(ctx.existing.wishes);
    const word = WISH_BY.get(w.title)!;
    const acc = word.say.split(',')[0]!;
    id = w.id;
    query = acc;
    if (action === 'unmark') w.done = true;
    phrase = action === 'mark' ? `Мне подарили ${acc}` : action === 'delete' ? `Удали ${acc} из вишлиста` : `Верни ${acc} в вишлист`;
  }
  return { phrase, ctx, actions: [clean({ intent: action, target: [id], query })], check: changeCheck(action, id) };
}

function missingTarget(): Example | null {
  const ctx = makeCtx();
  const word = pick(MISSING);
  // Слова записи не должны совпасть с существующими — иначе это не «нет такой записи»
  const stems = word.toLowerCase().split(' ').filter((w) => w.length >= 4).map((w) => w.slice(0, 4));
  if ([...ctx.existing.tasks, ...ctx.existing.watch, ...ctx.existing.wishes].some((x) => stems.some((st) => x.title.toLowerCase().includes(st)))) return null;
  const [verb, intent] = pick([['Удали', 'delete'], ['Убери', 'delete'], ['Вычеркни', 'delete'], ['Перенеси', 'update'], ['Отметь', 'mark'], ['Отметь сделанным', 'mark']] as [string, string][]);
  const phrase = `${verb} ${word}${intent === 'update' ? ' на завтра' : ''}`;
  return { phrase, ctx, actions: [clean({ intent, target: [], query: word, ...(intent === 'update' && { date: addDays(ctx.today, 1) }) })], check: (r) => (r.type === 'notFound' ? true : `получено ${r.type}`) };
}

function deleteOccurrence(): Example | null {
  const ctx = makeCtx();
  const t = someTask(ctx);
  if (!t) return null;
  const tt = ctx.existing.tasks.find((x) => x.id === t.id)!;
  tt.date = addDays(ctx.today, -14);
  tt.time = '19:00';
  const [, dow, word] = pick(WEEKDAYS);
  tt.repeat = { freq: 'week', every: 1, weekdays: [dow || 7] } as never;
  tt.date = addDays(tt.date, (dow - dowOf(tt.date) + 7) % 7);
  const action = pick(['delete', 'mark'] as const);
  const on = word === 'вторник' ? `во ${word}` : `в ${word}`;
  const phrase = action === 'delete' ? `Удали ${t.w.acc} ${on}` : `Сделали ${t.w.acc} ${on}`;
  return { phrase, ctx, actions: [clean({ intent: action, target: [t.id], query: t.w.acc })], check: changeCheck(action, t.id, (c) => (c.occ ? true : 'нет раза серии')) };
}

/* ---------- заметки ---------- */

function ideaAdd(): Example | null {
  const ctx = makeCtx();
  const text = (chance(0.75) && made?.idea()) || pick(IDEAS);
  const named = chance(0.5) ? pick(TOPICS.filter((x) => !x.list)) : null;
  if (named && !ctx.topics!.some((x) => x.title === named.title) && chance(0.7)) ctx.topics!.push({ id: `p${ctx.topics!.length + 1}`, title: named.title });
  const phrase = named
    ? `${pick(['Добавь', 'Запиши', 'Сохрани'])} ${named.into} ${text}`
    : `${pick(['Запиши идею:', 'Мысль:', 'Запиши в заметки', 'Идея:', 'Добавь в заметки', 'Сохрани в заметки', 'Заметка:', 'Запиши мысль', 'Новая заметка', 'Запиши заметку', 'Есть идея'])} ${text}`;
  const want = `${cap(text)}.`;
  return {
    phrase,
    ctx,
    actions: [clean({ intent: 'add', type: 'idea', text: want, topic: named?.title ?? null })],
    check: (r) => {
      const it = items(r)[0];
      if (!it || it.type !== 'idea') return `не идея: ${r.type}`;
      return true;
    },
  };
}

function ideaList(): Example | null {
  const ctx = makeCtx();
  const [say, title, pool] = (chance(0.6) && made?.list()) || pick(LISTS);
  const list = shuffle(pool).slice(0, 2 + Math.floor(rnd() * 5));
  const lead = pick(['Запиши в заметки', 'Сделай список', 'Создай список', 'Запиши список', 'Новый список', 'Добавь в заметки']);
  const sep = chance(0.5) ? ' ' : ', ';
  const phrase = `${lead} ${say}${chance(0.3) ? ':' : ''} ${list.map((x) => x.toLowerCase()).join(sep)}`;
  return { phrase, ctx, actions: [{ intent: 'add', type: 'idea', title, items: list, topic: null }], check: (r) => (items(r)[0]?.type === 'topic' ? true : `получено ${r.type}`) };
}

function listEdit(): Example | null {
  const ctx = makeCtx();
  const topic = (chance(0.6) && made?.listTopic()) || pick(TOPICS.filter((x) => x.list));
  if (!topic.list || topic.list.length < 2) return null;
  const item = pick(topic.list);
  // Рядом — другие списки (без такого пункта): тему надо взять из фразы, а для «… купил» — найти по пункту
  const others = [0, 1, 2]
    .slice(0, Math.floor(rnd() * 3))
    .map(() => (chance(0.6) && made?.listTopic()) || pick(TOPICS.filter((x) => x.list)))
    .filter((x) => x.title !== topic.title && !x.list!.includes(item));
  ctx.topics = shuffle([topic, ...new Map(others.map((x) => [x.title, x])).values()]).map((x, i) => ({ id: `p${i + 1}`, title: x.title, body: x.list!.map((y) => `- [ ] ${y}`).join('\n') }));
  // Замена пункта — самая редкая в жизни и самая трудная для модели команда: её больше
  const way = pick(['add', 'add', 'remove', 'remove', 'check', 'check', 'replace', 'replace', 'replace'] as const);
  // Новый пункт: как в списке и как говорят («добавь аптечку»)
  const [newItem, newAcc] = (chance(0.7) && made?.newItem()) || pick(NEW_ITEMS);
  if (topic.list.includes(newItem)) return null;
  const phrase =
    way === 'add' ? pick([`Добавь ${topic.into} ${newAcc}`, `Запиши ${topic.into} ${newAcc}`, `${cap(newAcc)} добавь ${topic.into}`])
    : way === 'remove' ? pick([`Убери ${item.toLowerCase()} ${topic.from}`, `Удали ${item.toLowerCase()} ${topic.from}`, `Вычеркни ${item.toLowerCase()} ${topic.from}`])
    : way === 'check' ? `${item} ${pick(['купил', 'взял', 'купила', 'взяла', 'есть', 'готово'])}`
    : pick([`Замени ${item.toLowerCase()} на ${newAcc} ${topic.at}`, `${cap(topic.at!)} замени ${item.toLowerCase()} на ${newAcc}`, `Поменяй ${item.toLowerCase()} на ${newAcc} ${topic.at}`, `Вместо ${item.toLowerCase()} ${newAcc} ${topic.at}`]);
  const raw: Raw = { intent: 'list_edit', topic: topic.title };
  if (way === 'add') raw.add = [newItem];
  if (way === 'remove') raw.remove = [item];
  if (way === 'check') raw.check = [item];
  if (way === 'replace') raw.replace = [{ from: item, to: newItem }];
  const id = ctx.topics.find((x) => x.title === topic.title)!.id;
  return { phrase: cap(phrase), ctx, actions: [raw], check: (r) => {
      const it = items(r)[0] as { type: string; id?: string } | undefined;
      return it?.type === 'topic' && it.id === id ? true : `получено ${r.type} ${it?.id ?? ''}`;
    },
  };
}

function topicActions(): Example | null {
  const ctx = makeCtx();
  if (chance(0.5)) {
    const name = pick(['идеи для подарков', 'планы на отпуск', ...TOPICS.filter((x) => !x.list).map((x) => x.title.toLowerCase())]);
    return { phrase: `${pick(['Создай тему', 'Новая тема', 'Заведи тему'])} ${name}`, ctx, actions: [{ intent: 'add', type: 'topic', title: cap(name) }], check: (r) => (items(r)[0]?.type === 'topic' ? true : `получено ${r.type}`) };
  }
  const t = pick(TOPICS);
  if (!ctx.topics!.some((x) => x.title === t.title)) ctx.topics!.push({ id: `p${ctx.topics!.length + 1}`, title: t.title });
  const id = ctx.topics!.find((x) => x.title === t.title)!.id;
  return { phrase: `${pick(['Покажи', 'Открой'])} ${t.title.toLowerCase()}`, ctx, actions: [{ intent: 'query_ideas', topic: t.title }], check: (r) => (r.type === 'queryIdeas' && r.topicId === id ? true : `получено ${JSON.stringify(r)}`) };
}

/* ---------- не команды ---------- */

function unknown(): Example | null {
  const ctx = makeCtx();
  return { phrase: cap(pick(NOISE)), ctx, actions: [{ intent: 'unknown' }], check: (r) => (r.type === 'unknown' ? true : `получено ${r.type}`) };
}

/* ---------- каталог действий ---------- */

const VARIANTS: Variant[] = [
  { id: 'task.add', group: 'Дела', title: 'Добавить дело: дата и время словами в любом порядке', count: 300, make: taskAdd },
  { id: 'task.people', group: 'Дела', title: 'Добавить дело с людьми: «мы с Кариной», «у нас», «у меня», «Диме …»', count: 70, make: taskPeople },
  { id: 'task.duration', group: 'Дела', title: 'Добавить дело с длительностью: «с 18 до 20», «на два часа»', count: 50, make: taskDuration },
  { id: 'task.range', group: 'Дела', title: 'Многодневное дело: «едем в Питер с 7 по 9 декабря»', count: 50, make: taskRange },
  { id: 'task.repeat', group: 'Дела', title: 'Повторяющееся дело: «каждую субботу», «по будням», «каждое 15 число»', count: 60, make: taskRepeat },
  { id: 'task.kind', group: 'Дела', title: 'День рождения и важная дата', count: 40, make: taskKind },
  { id: 'task.note', group: 'Дела', title: 'Дело с подробностями в заметке: «…, взять паспорт»', count: 60, make: taskNote },
  { id: 'task.parent', group: 'Дела', title: 'Подзадача плана: «в поездку в Питер добавь Эрмитаж», открытый план', count: 50, make: taskParent },
  { id: 'task.move', group: 'Правки', title: 'Перенести дело: на день недели, на завтра, на время', count: 110, make: taskMove },
  { id: 'task.edit', group: 'Правки', title: 'Переименовать, добавить человека, продлить, задать длительность', count: 70, make: taskEdit },
  { id: 'task.repeatChange', group: 'Правки', title: 'Изменить повтор: «теперь каждое воскресенье», «больше не повторяй»', count: 40, make: taskRepeatChange },
  { id: 'change.markDelete', group: 'Правки', title: 'Отметить, снять отметку, удалить: дела, фильмы, хотелки', count: 120, make: markUnmarkDelete },
  { id: 'change.occurrence', group: 'Правки', title: 'Раз повторяющегося дела: «удали йогу в субботу», «сделали баню в субботу»', count: 40, make: deleteOccurrence },
  { id: 'change.missing', group: 'Правки', title: 'Правка несуществующей записи: «удали слона» — target пустой', count: 80, make: missingTarget },
  { id: 'wish.add', group: 'Хотелки', title: 'Добавить хотелку с подробностями', count: 140, make: wishAdd },
  { id: 'wish.query', group: 'Хотелки', title: 'Вопрос «что подарить», «что хочет», «что я хотел»', count: 90, make: wishQuery },
  { id: 'watch.add', group: 'Смотреть', title: 'Добавить фильм, сериал, мультик (один или два); незнакомое название — без данных', count: 180, make: watchAdd },
  { id: 'watch.query', group: 'Смотреть', title: 'Вопрос «что посмотреть» с фильтрами и без', count: 150, make: watchQuery },
  { id: 'plans.query', group: 'Планы', title: 'Вопросы о планах: мы, я, с человеком, категория, группа, «когда»', count: 110, make: plansQuery },
  { id: 'idea.add', group: 'Заметки', title: 'Записать идею, в названную тему', count: 150, make: ideaAdd },
  { id: 'idea.list', group: 'Заметки', title: 'Заметка-список из перечня', count: 140, make: ideaList },
  { id: 'idea.listEdit', group: 'Заметки', title: 'Правка списка: добавить, убрать, отметить, заменить', count: 170, make: listEdit },
  { id: 'idea.topic', group: 'Заметки', title: 'Создать тему, показать тему', count: 60, make: topicActions },
  { id: 'unknown', group: 'Прочее', title: 'Не команда: шум, обрывки, вопросы не про приложение', count: 90, make: unknown },
];

/* ---------- сборка ---------- */

const evalPhrases = new Set(
  [...readFileSync(join(process.cwd(), 'eval', 'run.ts'), 'utf8').matchAll(/^\s*\['([^']+)'/gm)].map((m) => m[1]!.toLowerCase().replace(/[?!.,]/g, '').trim()),
);

type Row = { variant: string; phrase: string; request: { role: string; text: string }[]; response: string; ctx: Ctx };
const rows: Row[] = [];
type Stat = { ok: number; dropped: number; rules: number; reasons: Record<string, number>; examples: string[] };
const report: Record<string, Stat> = {};
// Частые ошибки распознавания речи: окончание не то, слово разбито или слито, пропущен предлог,
// лишнее «ну», повтор слова, «е» вместо «ё». Ответ остаётся правильным — модель учится понимать и такое
const FILLERS = ['ну', 'эээ', 'э', 'так', 'короче', 'типа', 'вот', 'слушай'];
const ENDINGS: [RegExp, string][] = [
  [/у$/, 'а'],
  [/ю$/, 'я'],
  [/ой$/, 'ая'],
  [/ие$/, 'ия'],
  [/ть$/, 'ти'],
  [/ешь$/, 'ет'],
  [/ов$/, 'ы'],
];
function asrNoise(p: string): string {
  let w = p.split(' ');
  const at = () => Math.floor(rnd() * w.length);
  if (chance(0.08)) w.splice(chance(0.5) ? 0 : at(), 0, pick(FILLERS));
  if (chance(0.04)) {
    const i = at();
    if (w[i] && /[а-я]{3,}/i.test(w[i]!)) w.splice(i, 0, w[i]!.toLowerCase());
  }
  if (chance(0.08)) {
    // окончание слова длиннее четырёх букв (не цифры, не первое слово — там глагол команды)
    const i = 1 + Math.floor(rnd() * Math.max(1, w.length - 1));
    const x = w[i];
    const rule = x && x.length > 4 && /^[а-яё]+$/i.test(x) ? ENDINGS.find(([re]) => re.test(x)) : undefined;
    if (rule) w[i] = x!.replace(rule[0], rule[1]);
  }
  if (chance(0.05)) {
    const i = w.findIndex((x, k) => k > 0 && /^(в|на|к|с)$/i.test(x) && !/^\d/.test(w[k + 1] ?? ''));
    if (i > 0) w.splice(i, 1);
  }
  if (chance(0.04)) {
    const i = w.findIndex((x) => x.length >= 9 && /^[а-я]+$/i.test(x));
    if (i >= 0) w.splice(i, 1, w[i]!.slice(0, 4), w[i]!.slice(4));
  }
  if (chance(0.03) && w.length > 2) {
    const i = 1 + Math.floor(rnd() * (w.length - 2));
    if (/^(на|в|не|по)$/.test(w[i]!)) w.splice(i, 2, w[i]! + w[i + 1]!);
  }
  w = w.filter(Boolean);
  return w.join(' ').replace(/ё/g, chance(0.7) ? 'е' : 'ё');
}

/** Как фраза приходит от распознавания: бывает с маленькой буквы, без знаков, с заглавной посреди («что я делаю На выходных») */
function speechLike(p: string): string {
  let t = asrNoise(p);
  if (chance(0.3)) t = t.charAt(0).toLowerCase() + t.slice(1);
  if (chance(0.3)) t = t.replace(/[?!.]$/, '');
  if (chance(0.08)) {
    const w = t.split(' ');
    const i = 1 + Math.floor(rnd() * Math.max(1, w.length - 1));
    if (w[i] && /^[а-я]/.test(w[i]!)) w[i] = cap(w[i]!);
    t = w.join(' ');
  }
  return t;
}

const seen = new Set<string>();

for (const v of VARIANTS) {
  const st: Stat = { ok: 0, dropped: 0, rules: 0, reasons: {}, examples: [] };
  report[v.id] = st;
  let tries = 0;
  while (st.ok < v.count && tries < v.count * 8) {
    tries++;
    const ex = v.make();
    if (!ex) continue;
    // Как в проде: распознанная фраза проходит чистку сервера (cleanSpeech) до правил и модели
    const phrase = cleanSpeech(speechLike(ex.phrase.replace(/\s+/g, ' ').trim()));
    const key = phrase.toLowerCase().replace(/[?!.,]/g, '').trim();
    if (evalPhrases.has(key)) continue;
    if (seen.has(`${key}|${ex.ctx.today}`)) continue;
    // Простые фразы сервер разбирает правилами без модели — в наборе их немного, остальное место — сложным
    if (quickParse(phrase, ex.ctx)) {
      st.rules++;
      if (!chance(0.2)) continue;
    }
    let res: ParseResult;
    try {
      res = normalize(ex.actions as never, ex.ctx, phrase);
    } catch (e) {
      res = { type: 'unknown' };
      void e;
    }
    const ok = ex.check(res);
    if (ok !== true) {
      st.dropped++;
      st.reasons[ok] = (st.reasons[ok] ?? 0) + 1;
      if (process.env.TRAIN_DEBUG) console.log(`✗ ${v.id}: «${phrase}» — ${ok}`);
      continue;
    }
    seen.add(`${key}|${ex.ctx.today}`);
    const [system, user] = buildTunedMessages(phrase, ex.ctx);
    rows.push({ variant: v.id, phrase, request: [system!, user!], response: JSON.stringify({ actions: ex.actions }), ctx: ex.ctx });
    st.ok++;
    if (st.examples.length < 3) st.examples.push(`«${phrase}» → ${JSON.stringify({ actions: ex.actions })}`);
  }
}

/* ---------- запись: обучение и проверка (каждый десятый) ---------- */

mkdirSync(join(ROOT, 'out'), { recursive: true });
const mixed = shuffle(rows);
const valid = mixed.filter((_, i) => i % 10 === 0);
const train = mixed.filter((_, i) => i % 10 !== 0);
const line = (r: Row) => JSON.stringify({ request: r.request, response: r.response, ctx: r.ctx, variant: r.variant });
writeFileSync(join(ROOT, 'out', 'train.jsonl'), train.map(line).join('\n') + '\n');
writeFileSync(join(ROOT, 'out', 'valid.jsonl'), valid.map(line).join('\n') + '\n');

const md: string[] = [
  '# Каталог действий и обучающий набор',
  '',
  'Сгенерировано `npm run train:data` (train/generate.ts). Каждое действие — вид команды, которую понимает «Кстати»;',
  'под него — фразы из словаря train/catalog.ts в случайном контексте. Ответы проверены кодом сервера (normalize).',
  '',
  `Всего: ${rows.length} примеров · обучение ${train.length} · проверка ${valid.length}. Фразы экзамена (eval) исключены.`,
  '',
  '| Группа | Действие | Примеров | Отсеяно | Простых (правила) |',
  '|---|---|---|---|---|',
  ...VARIANTS.map((v) => `| ${v.group} | ${v.title} | ${report[v.id]!.ok} | ${report[v.id]!.dropped} | ${report[v.id]!.rules} |`),
  '',
  '## Примеры',
  '',
];
for (const v of VARIANTS) {
  md.push(`### ${v.group}: ${v.title}`, '');
  for (const e of report[v.id]!.examples) md.push(`- ${e}`);
  const reasons = Object.entries(report[v.id]!.reasons).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (reasons.length) md.push('', `Отсеяно (сервер понял иначе): ${reasons.map(([r, n]) => `${r} ×${n}`).join('; ')}`);
  md.push('');
}
writeFileSync(join(ROOT, 'ACTIONS.md'), md.join('\n'));

const tokensApprox = Math.round(rows.reduce((a, r) => a + r.request[1]!.text.length + r.response.length, 0) / 3);
console.log(`Примеров: ${rows.length} (обучение ${train.length}, проверка ${valid.length}) · ≈${tokensApprox} токенов текста`);
for (const v of VARIANTS) {
  const s = report[v.id]!;
  console.log(`${String(s.ok).padStart(4)} ${String(s.dropped).padStart(4)} отсеяно  ${v.id}`);
}
