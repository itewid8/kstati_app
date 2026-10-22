/**
 * ЗАГЛУШКА вместо ИИ на сервере (POST /voice/text).
 * Простые правила, которых хватает на фразы из раздела 8 ТЗ.
 * Когда появится сервер, этот модуль заменится вызовом API с тем же форматом ответа.
 */
import { changesRepeat, firstDate, spokenRepeat, stopsRepeat, stripRepeat } from './spokenRepeat';
import { addDays, toISODate } from './dates';
import { uid } from './ids';
import { periodFromText } from './plans';
import {
  emptyFilters,
  type ChangeAction,
  type ChangeDraft,
  type ChangePatch,
  type DraftItem,
  type ItemType,
  type PlansQuery,
  type Task,
  type WatchItem,
  type Wish,
  type Genre,
  type ID,
  type Kind,
  type Origin,
  type User,
  type WatchDraft,
  type WatchFilters,
} from './types';

export type ParseResult =
  | { type: 'items'; items: DraftItem[] }
  | { type: 'queryWatch'; filters: WatchFilters }
  | { type: 'queryWish'; personId: ID }
  | { type: 'unknownPerson'; name: string }
  | { type: 'changes'; changes: ChangeDraft[] }
  | { type: 'notFound'; query: string }
  | { type: 'queryPlans'; plans: PlansQuery }
  /** «Покажи идеи для подарков»: тема (id), 'inbox' — «Без темы», null — список тем */
  | { type: 'queryIdeas'; topicId: ID | null }
  | { type: 'unknown' };

/** Записи, среди которых ищем цель для «перенеси / отметь / удали» */
export type Existing = { tasks: Task[]; wishes: Wish[]; watch: WatchItem[] };

/* Мини-«база знаний» вместо LLM */
const KNOWN: (WatchDraft & { stems: string[] })[] = [
  { stems: ['интерстелл'], title: 'Интерстеллар', kind: 'movie', genres: ['scifi', 'drama'], origin: 'foreign', year: 2014 },
  { stems: ['слово пацан'], title: 'Слово пацана', kind: 'series', genres: ['drama'], origin: 'ru', year: 2023 },
  { stems: ['дюн'], title: 'Дюна', kind: 'movie', genres: ['scifi', 'adventure'], origin: 'foreign', year: 2021 },
  { stems: ['аватар'], title: 'Аватар', kind: 'movie', genres: ['scifi', 'adventure'], origin: 'foreign', year: 2009 },
  { stems: ['брат'], title: 'Брат', kind: 'movie', genres: ['drama', 'action'], origin: 'ru', year: 1997 },
  { stems: ['друзь'], title: 'Друзья', kind: 'series', genres: ['comedy'], origin: 'foreign', year: 1994 },
  { stems: ['во все тяжк'], title: 'Во все тяжкие', kind: 'series', genres: ['drama', 'thriller'], origin: 'foreign', year: 2008 },
  { stems: ['оппенгейм'], title: 'Оппенгеймер', kind: 'movie', genres: ['drama'], origin: 'foreign', year: 2023 },
  { stems: ['шрэк', 'шрек'], title: 'Шрэк', kind: 'cartoon', genres: ['comedy', 'adventure'], origin: 'foreign', year: 2001 },
  { stems: ['джентльмен'], title: 'Джентльмены', kind: 'movie', genres: ['comedy', 'action'], origin: 'foreign', year: 2019 },
  { stems: ['ирони'], title: 'Ирония судьбы', kind: 'movie', genres: ['comedy', 'romance'], origin: 'ru', year: 1975 },
];

const KIND_WORDS: [RegExp, Kind][] = [
  [/мульт/, 'cartoon'],
  [/сериал/, 'series'],
  [/стендап|стенд-ап/, 'standup'],
  [/шоу/, 'show'],
  [/фильм|кино/, 'movie'],
];

const GENRE_WORDS: [RegExp, Genre][] = [
  [/смешн|комеди|поржать|посмеяться/, 'comedy'],
  [/драм/, 'drama'],
  [/боевик/, 'action'],
  [/триллер|напряж/, 'thriller'],
  [/ужас|страшн|хоррор/, 'horror'],
  [/фантаст|космос/, 'scifi'],
  [/детектив/, 'detective'],
  [/мелодрам|романтич|про любовь/, 'romance'],
  [/приключ/, 'adventure'],
  [/документ/, 'documentary'],
];

const ORIGIN_WORDS: [RegExp, Origin][] = [
  [/наш|русск|российск|советск|отечествен/, 'ru'],
  [/зарубеж|иностран|американ|западн/, 'foreign'],
];

const WEEKDAYS: [RegExp, number][] = [
  [/понедельник/, 1],
  [/вторник/, 2],
  [/сред[ау]/, 3],
  [/четверг/, 4],
  [/пятниц/, 5],
  [/суббот/, 6],
  [/воскресень/, 0],
];

const NUM: Record<string, number> = {
  один: 1, одну: 1, одна: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8,
  девять: 9, десять: 10, одиннадцать: 11, двенадцать: 12,
};
const TENS: Record<string, number> = {
  двадцать: 20, тридцать: 30, сорок: 40, пятьдесят: 50, шестьдесят: 60, семьдесят: 70, восемьдесят: 80, девяносто: 90,
};
const ORD: Record<string, number> = {
  первый: 1, второй: 2, третий: 3, четвёртый: 4, четвертый: 4, пятый: 5, шестой: 6, седьмой: 7, восьмой: 8, девятый: 9,
  десятый: 10, сороковой: 40, тридцатый: 30,
};

const hasStem = (text: string, stem: string) => (' ' + text).includes(' ' + stem);
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const clean = (s: string) => s.replace(/\s+/g, ' ').replace(/^[\s,.-]+|[\s,.-]+$/g, '').trim();

/** «сорок второй размер» → «42 размер» */
function numerals(s: string): string {
  return s
    .replace(/(двадцать|тридцать|сорок|пятьдесят|шестьдесят|семьдесят|восемьдесят|девяносто)\s+(первый|второй|третий|четв[её]ртый|пятый|шестой|седьмой|восьмой|девятый)/g,
      (_, t, o) => String(TENS[t] + ORD[o]))
    .replace(/(сороковой|тридцатый)/g, (w) => String(ORD[w]));
}

function findPerson(text: string, people: User[]): User | null {
  for (const p of people) {
    const stem = p.name.toLowerCase().slice(0, Math.max(3, p.name.length - 1));
    if (new RegExp(`(^|\\s)${stem}`).test(text)) return p;
  }
  return null;
}

function parseDate(text: string, now: Date): { date: string | null; time: string | null; rest: string } {
  let rest = text;
  let date: Date | null = null;
  let time: string | null = null;

  const take = (re: RegExp) => {
    const m = rest.match(re);
    if (m) rest = rest.replace(m[0], ' ');
    return m;
  };

  let m: RegExpMatchArray | null;
  if ((m = take(/послезавтра/))) date = addDays(now, 2);
  else if ((m = take(/завтра/))) date = addDays(now, 1);
  else if ((m = take(/сегодня/))) date = addDays(now, 0);
  else if ((m = take(/через\s+(\d+|\S+)?\s*(недел[июь]|дн[яей]|день)/))) {
    const n = m[1] ? (Number(m[1]) || NUM[m[1]] || 1) : 1;
    date = addDays(now, /недел/.test(m[2]) ? n * 7 : n);
  } else {
    for (const [re, wd] of WEEKDAYS) {
      const mm = rest.match(new RegExp(`(в|во)?\\s*(следующ\\S*\\s+)?${re.source}\\S*`));
      if (mm) {
        rest = rest.replace(mm[0], ' ');
        let diff = (wd - now.getDay() + 7) % 7 || 7;
        if (mm[2]) {
          // «в следующую субботу» — суббота следующей недели
          const dow = (now.getDay() + 6) % 7;
          const target = (wd + 6) % 7;
          diff = 7 - dow + target;
        }
        date = addDays(now, diff);
        break;
      }
    }
  }

  // Время: «в 19:00», «в 7 вечера», «в семь»
  const tm = rest.match(/(?:^|\s)(?:в|на)\s+(\d{1,2})(?::(\d{2}))?\s*(утра|вечера|дня|ночи)?|(?:^|\s)(?:в|на)\s+(один|два|три|четыре|пять|шесть|семь|восемь|девять|десять|одиннадцать|двенадцать)(?=\s|$)\s*(утра|вечера|дня|ночи)?/);
  if (tm) {
    let h = tm[1] ? Number(tm[1]) : NUM[tm[4]];
    const min = tm[2] ? Number(tm[2]) : 0;
    const part = tm[3] || tm[5];
    if (part === 'вечера' || part === 'дня') { if (h < 12) h += 12; }
    else if (!part && h >= 1 && h <= 8) h += 12;
    if (h >= 0 && h < 24) {
      time = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      rest = rest.replace(tm[0], ' ');
    }
  }

  return { date: date ? toISODate(date) : null, time, rest };
}

function taskTitle(s: string): string {
  let t = s
    .replace(/^(запиши|запомни|добавь|напомни|отметь)[, ]*(что|чтобы)?\s*/, '')
    .replace(/^(нам|мне)\s+/, '')
    .replace(/^(надо|нужно|необходимо)\s+/, '')
    .replace(/^(мы|я)\s+/, '')
    .replace(/\s*в дела(?=\s|$)/, ' ');
  t = t.replace(/^(едем|поедем|ед[её]м|поехать|съездить)\s+/, 'поездка ');
  return cap(clean(t));
}

function watchFrom(title: string): WatchDraft {
  const low = title.toLowerCase();
  const k = KNOWN.find((x) => x.stems.some((st) => hasStem(low, st)));
  if (k) {
    const { stems: _s, ...rest } = k;
    return rest;
  }
  return { title: cap(clean(title)), kind: null, genres: [], origin: null, year: null };
}

export function mockParse(raw: string, ctx: { me: User; people: User[]; now?: Date; existing?: Existing }): ParseResult {
  const now = ctx.now ?? new Date();
  const text = raw.toLowerCase().replace(/ё/g, 'е').replace(/[?!.]/g, '').trim();
  if (!text) return { type: 'unknown' };

  // Изменение существующих записей
  if (ctx.existing) {
    const ch = parseChange(text, ctx.existing, now);
    if (ch) return ch;
  }

  // Вопрос о планах: «какие у нас с Машей планы на выходные», «когда у нас дача»
  const plans = parsePlans(text, now);
  if (plans) return { type: 'queryPlans', plans };

  // Вопрос про подарок / хотелки
  if (/^что (я|мне) (хотел|хотела|хочу|хотелось)/.test(text)) return { type: 'queryWish', personId: ctx.me.id };
  const gift = text.match(/(что|чего)\s+(подарить|хочет|хотела?|хотел)\s*(.*)$/);
  if (gift) {
    if (/^(я|мне)(\s|$)/.test(gift[3]) || /что я хотел/.test(text)) return { type: 'queryWish', personId: ctx.me.id };
    const p = findPerson(gift[3], ctx.people);
    if (p) return { type: 'queryWish', personId: p.id };
    if (gift[3]) return { type: 'unknownPerson', name: cap(gift[3].split(' ')[0]) };
    return { type: 'queryWish', personId: ctx.me.id };
  }

  // Вопрос «что посмотреть»
  if (/(что|какой|какое|какую|что-нибудь|что-то|чего бы)(\s|$).*(посмотр|глян|смешн|фильм|сериал|мульт|шоу|стендап|страшн)|^что-нибудь|^что-то/.test(text)
    && !/^(сохрани|добавь|запиши)/.test(text)) {
    const f: WatchFilters = { ...emptyFilters, kind: [], genre: [], origin: [], fresh: [] };
    KIND_WORDS.forEach(([re, k]) => re.test(text) && f.kind.push(k));
    GENRE_WORDS.forEach(([re, g]) => re.test(text) && f.genre.push(g));
    ORIGIN_WORDS.forEach(([re, o]) => re.test(text) && f.origin.push(o));
    if (/нов|свеж/.test(text)) f.fresh.push('new');
    else if (/стар|классик/.test(text)) f.fresh.push('old');
    return { type: 'queryWatch', filters: f };
  }

  // Хотелка
  const wish = text.match(/^(хочу|добавь (в )?(мой )?(вишлист|список желаний|хотелки)|в вишлист)\s*(.*)$/);
  if (wish) {
    const body = numerals(wish[5]);
    const [title, ...noteParts] = body.split(',');
    const note = clean(noteParts.join(',')).replace(/^(\d+)\s+(размер)/, '$1 $2');
    if (!clean(title)) return { type: 'unknown' };
    return { type: 'items', items: [{ key: uid(), type: 'wish', data: { title: cap(clean(title)), note, link: '' } }] };
  }

  // «Смотреть»
  const watchCue = /(фильм|сериал|мульт|шоу|стендап|посмотреть|в смотреть|глянуть)/;
  const knownHit = KNOWN.some((k) => k.stems.some((st) => hasStem(text, st)));
  if (watchCue.test(text) || knownHit) {
    const body = text
      .replace(/^(сохрани|добавь|запиши)\s*/, '')
      .replace(/^было бы (круто|классно|неплохо)\s*/, '')
      .replace(/^(хочу|надо|давай)\s*/, '')
      .replace(/^посмотреть\s*/, '')
      .replace(/^(фильмы?|сериалы?|мультфильмы?|мультики?|шоу|стендап)\s*/, '')
      .replace(/\s*в (смотреть|список)$/, '');
    const titles = body.split(/\s+и\s+|,\s*/).map(clean).filter(Boolean);
    if (!titles.length) return { type: 'unknown' };
    return {
      type: 'items',
      items: titles.map((t) => {
        const w = watchFrom(t);
        return { key: uid(), type: 'watch' as const, data: w };
      }),
    };
  }

  // Дело
  const { date, time, rest } = parseDate(text, now);
  const rep = spokenRepeat(text, toISODate(now));
  const title = rep ? stripRepeat(taskTitle(rest).replace(/(^|\s)кажд\S*(?=\s|$)/gi, ' ').trim()) : taskTitle(rest);
  if (title.length < 4 || /^(.)\1*$/i.test(title)) return { type: 'unknown' };
  // «Баня каждую субботу» — повтор; первый раз — ближайший подходящий день
  // «Каждую среду» — с сегодняшнего дня, если он подходит; дата из фразы — только если начало названо явно
  const explicit = /(начиная|(^|\s)с\s+(завтра|понедельник|вторник|сред|четверг|пятниц|суббот|воскресен|\d)|завтра|послезавтра|через\s)/.test(text);
  const first = rep ? firstDate(rep, explicit ? date : null, toISODate(now)) : date;
  return { type: 'items', items: [{ key: uid(), type: 'task', data: { title, date: first, time, ...(rep && { repeat: rep }) } }] };
}

/** Фразы, которые заглушка «распознаёт» по очереди вместо настоящей записи */
export const SAMPLE_PHRASES = [
  'Перенеси дачу на воскресенье',
  'Мы посмотрели Интерстеллар',
  'Удали ужин у родителей',
  'Сделал оплату интернета',
  'Мне подарили наушники',
  'Переименуй лампочки в купить лампочки и батарейки',
  'Запиши, что мы едем на дачу в следующую субботу',
  'В субботу в семь ужин у родителей',
  'Добавь Дюну и Аватар',
  'Добавь в мой вишлист кроссовки, сорок второй размер',
  'Что-нибудь смешное зарубежное',
  'Через две недели забрать документы',
  'Было бы круто посмотреть Слово пацана',
  'Что подарить Маше?',
  'Надо позвонить в управляющую компанию',
  'Хочу новые наушники',
  'Какой сериал посмотреть из нового?',
  'Сохрани фильм Интерстеллар',
];

/* ================= Изменения: перенеси / переименуй / отметь / удали ================= */

const STOP = new Set([
  'на', 'в', 'во', 'из', 'что', 'мы', 'я', 'и', 'с', 'со', 'по', 'к', 'у', 'мне', 'нам', 'уже', 'это', 'эту', 'этот',
  'фильм', 'фильмы', 'сериал', 'мультфильм', 'дело', 'дела', 'список', 'списка', 'списке', 'дел', 'смотреть',
  'вишлист', 'вишлиста', 'хотелки', 'хотелку', 'выполненным', 'выполненное', 'посмотренным', 'подаренным', 'отметку',
]);

const words = (s: string) =>
  s.toLowerCase().replace(/ё/g, 'е').split(/[^а-яa-z0-9]+/).filter((w) => w.length >= 2 && !STOP.has(w));
const stemOf = (w: string) => (w.length <= 4 ? w.slice(0, 3) : w.slice(0, Math.max(4, w.length - 2)));

/** Сколько слов запроса нашлось в названии (по основе слова) */
function score(query: string, title: string): number {
  const t = words(title);
  let n = 0;
  for (const w of words(query)) {
    const s = stemOf(w);
    if (t.some((x) => x.startsWith(s) || w.startsWith(stemOf(x)))) n++;
  }
  return n;
}

function findTargets(query: string, ex: Existing, type: ItemType | null): { type: ItemType; ids: string[] } | null {
  const pool: { type: ItemType; id: string; title: string }[] = [
    ...(type === null || type === 'task' ? ex.tasks.map((t) => ({ type: 'task' as const, id: t.id, title: t.title })) : []),
    ...(type === null || type === 'watch' ? ex.watch.map((w) => ({ type: 'watch' as const, id: w.id, title: w.title })) : []),
    ...(type === null || type === 'wish' ? ex.wishes.map((w) => ({ type: 'wish' as const, id: w.id, title: w.title })) : []),
  ];
  let best = 0;
  const scored = pool.map((p) => {
    const sc = score(query, p.title);
    best = Math.max(best, sc);
    return { ...p, sc };
  });
  if (best === 0) return null;
  const top = scored.filter((p) => p.sc === best);
  // Все кандидаты — одного типа, как у лучшего
  const t = top[0].type;
  return { type: t, ids: top.filter((p) => p.type === t).slice(0, 3).map((p) => p.id) };
}

function typeHint(text: string): ItemType | null {
  if (/фильм|сериал|мульт|смотреть|посмотрел|шоу|стендап/.test(text)) return 'watch';
  if (/вишлист|хотелк|желани|подарил/.test(text)) return 'wish';
  if (/(^|\s)дел[аоу]?(\s|$)|сделал|выполнил/.test(text)) return 'task';
  return null;
}

function change(
  action: ChangeAction,
  query: string,
  ex: Existing,
  type: ItemType | null,
  patch?: ChangePatch,
): ParseResult {
  const q = clean(query);
  const found = findTargets(q, ex, type);
  if (!found) return { type: 'notFound', query: q };
  return {
    type: 'changes',
    changes: [{ key: uid(), action, type: found.type, candidates: found.ids, chosen: found.ids[0], patch }],
  };
}

function parseChange(text: string, ex: Existing, now: Date): ParseResult | null {
  let m: RegExpMatchArray | null;

  // Удалить: «удали ужин у родителей», «убери Дюну из списка»
  if ((m = text.match(/^(удали|удалить|убери|сотри)\s+(.+)$/))) {
    return change('delete', m[2].replace(/\s+из\s+.*$/, ''), ex, typeHint(m[2]));
  }

  // Переименовать: «переименуй лампочки в купить лампочки и батарейки»
  if ((m = text.match(/^(переименуй|переименовать)\s+(.+?)\s+в\s+(.+)$/))) {
    return change('update', m[2], ex, typeHint(m[2]), { title: cap(clean(m[3])) });
  }

  // Повтор существующего дела: «баню теперь каждое воскресенье», «больше не повторяй зарядку»
  if (changesRepeat(text)) {
    const today = toISODate(now);
    const name = text
      .replace(/(больше не повторя\S*|не повторя\S*|сделай|теперь|разов\S*|без повтора)/g, ' ')
      .replace(/(кажд\S*|по)\s+\S+(\s+и\s+\S+)?|ежедневн\S*|еженедельн\S*|через день/g, ' ');
    const rep = stopsRepeat(text) ? null : spokenRepeat(text, today);
    const patch: ChangePatch = { repeat: rep };
    if (rep) patch.date = firstDate(rep, null, today);
    return change('update', clean(name), ex, 'task', patch);
  }

  // Перенести: «перенеси дачу на воскресенье», «перенеси ужин на восемь»
  if ((m = text.match(/^(перенеси|перенести|передвинь|сдвинь)\s+(.+)$/))) {
    const { date, time, rest } = parseDate(m[2], now);
    if (!date && !time) return null;
    const patch: ChangePatch = {};
    if (date) patch.date = date;
    if (time) patch.time = time;
    return change('update', rest, ex, 'task', patch);
  }

  // Снять отметку: «верни дачу», «сними отметку с Дюны»
  if ((m = text.match(/^(верни|сними отметку(\s+с[о]?)?|отмени отметку(\s+с[о]?)?)\s+(.+)$/))) {
    return change('unmark', m[4], ex, typeHint(m[4]));
  }

  // Отметить: «отметь, что посмотрели Интерстеллар», «мы посмотрели …», «мне подарили …», «сделал …»
  const body = text.replace(/^(отметь|отметить)[, ]*(что\s+)?/, '');
  const marked = body !== text;
  if ((m = body.match(/^(мы\s+|я\s+)?(посмотрели|посмотрел|посмотрела)\s+(.+)$/))) return change('mark', m[3], ex, 'watch');
  if ((m = body.match(/^(мне\s+)?(подарили|купили мне)\s+(.+)$/))) return change('mark', m[3], ex, 'wish');
  if ((m = body.match(/^(мы\s+|я\s+)?(сделал|сделала|сделали|выполнил|выполнила|выполнили|закончил|закончили)\s+(.+)$/)))
    return change('mark', m[3], ex, 'task');
  if (marked && body) {
    // «отметь дачу выполненной», «отметь Дюну»
    const type = /посмотрен/.test(body) ? 'watch' : /подарен/.test(body) ? 'wish' : /выполнен|сделан/.test(body) ? 'task' : null;
    return change('mark', body.replace(/\s+(как\s+)?\S*(выполнен|посмотрен|подарен|сделан)\S*$/, ''), ex, type);
  }
  return null;
}

/* ================= Вопросы о планах ================= */

function parsePlans(text: string, now: Date): PlansQuery | null {
  if (/^(запиши|добавь|сохрани|удали|перенеси|отметь)/.test(text)) return null;
  const when = text.match(/^когда (у нас |у них |мы )?(.+)$/);
  const isPlans = /план|что у (нас|них|вас|друзей|родител)|чем (мы )?заняты|какие (у нас )?дела|что намечено|что делаем/.test(text);
  if (!when && !isPlans) return null;

  let scope: PlansQuery['scope'] = { kind: 'current' };
  const withWho = text.match(/(?:^|\s)(?:нас|мы) с (\S+)/);
  if (/друз/.test(text)) scope = { kind: 'category', category: 'friends' };
  else if (/родител/.test(text)) scope = { kind: 'category', category: 'parents' };
  else if (withWho) scope = { kind: 'people', names: [withWho[1]] };
  else if (/сем(ья|ьи|ье|ьей)/.test(text)) scope = { kind: 'groups', names: ['Семья'] };
  else if (/(^|\s)(у нас|мы|наши|нас)(\s|$)/.test(text)) scope = { kind: 'us' };

  if (when) {
    const today = toISODate(now);
    return { scope, from: today, to: toISODate(addDays(now, 365)), query: clean(when[2].replace(/^(будет|будут|была|у нас)\s+/, '')) };
  }
  const { from, to } = periodFromText(text, now);
  return { scope, from, to, query: '' };
}
