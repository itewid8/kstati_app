/**
 * Текст → ParseResult (тот же формат, что у заглушки в приложении).
 * ИИ только раскладывает фразу; всё, что можно проверить кодом, проверяется здесь.
 */
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { commaItems, faithful, groundTexts, noteTail, spanTitle } from './ground.js';
import { applyListEdit, listBody, spokenList } from './lists.js';
import { buildCompactMessages, buildMessages, buildTunedMessages, pickBlocks } from './prompt.js';
import { occurrences } from './recur.js';
import { changesRepeat, firstDate, spokenRepeat, stopsRepeat, stripRepeat } from './repeat.js';
import {
  sameStem,
  spokenFresh,
  spokenGenres,
  spokenOrigin,
  titleStems,
  asksWhatToWatch,
  changeTarget,
  hasChangeVerb,
  isUnmark,
  nearestWeekday,
  cleanSpeech,
  normalizeTimes,
  plainWeekday,
  spokenDateRange,
  spokenDuration,
  spokenKind,
  spokenPeriod,
  spokenSpan,
  spokenTime,
  spokenUntil,
} from './spoken.js';
import { addUsage, complete, NO_USAGE, type Msg, type Usage } from './yandex.js';
import { quickParse } from './quick.js';
import { config } from './config.js';
import {
  GENRES,
  KINDS,
  ORIGINS,
  type ChangeAction,
  type ChangeDraft,
  type Context,
  type DraftItem,
  type Genre,
  type ItemType,
  type Kind,
  type Origin,
  type ParseResult,
  type PlansScope,
  type TaskDraft,
  CATEGORIES,
  type GroupCategory,
  type WatchFilters,
} from './types.js';

const Action = z.object({ intent: z.string() }).passthrough();
const Reply = z.object({ actions: z.array(Action).min(1) });
type RawAction = z.infer<typeof Action> & Record<string, unknown>;

/* ---------- мелкие проверки ---------- */

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const date = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const time = (v: unknown) => {
  if (typeof v !== 'string') return null;
  const m = v.match(/^(\d{1,2}):(\d{2})$/);
  if (!m || +m[1] > 23 || +m[2] > 59) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
};
const oneOf = <T extends string>(list: readonly T[], v: unknown): T | null => (list.includes(v as T) ? (v as T) : null);
const manyOf = <T extends string>(list: readonly T[], v: unknown, max = 10): T[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is T => list.includes(x as T)))].slice(0, max) : [];

const addDaysIso = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** JSON из ответа модели: снимаем ```-обёртку, берём от первой { до последней } */
export function extractJson(text: string): unknown {
  const t = text.replace(/```(?:json)?/g, '');
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('В ответе нет JSON');
  return JSON.parse(t.slice(a, b + 1));
}

/** Сравнение имён по основе: «Маше», «Машу» → «Маша» */
function matchPerson(name: string, ctx: Context): string | null {
  const n = name.toLowerCase().replace(/ё/g, 'е');
  if (!n) return null;
  if (n === 'me' || n === 'я' || n === 'мне') return ctx.me.id;
  const all = [ctx.me, ...ctx.people];
  const stem = (s: string) => s.toLowerCase().replace(/ё/g, 'е').slice(0, Math.max(3, s.length - 1));
  return all.find((p) => stem(p.name) === stem(n) || n.startsWith(stem(p.name)))?.id ?? null;
}

/** «я», «me», «мне» — сам говорящий */
const norm3 = (s: string) => s.toLowerCase().replace(/ё/g, 'е').slice(0, Math.max(3, Math.min(4, s.length - 1)));
const isMe = (name: string) => /^(me|я|мне|меня|мой|мои|моя|у меня)$/i.test(name.trim());

type ExistingTask = Context['existing']['tasks'][number];

/**
 * S3: какой раз повторяющегося дела назван во фразе. Нет повтора или дня — undefined.
 * delete / update — ближайший раз с сегодня в названный день недели или дату («удали йогу в субботу»);
 * mark / unmark — последний прошедший такой раз (за неделю), иначе ближайший будущий («сделали йогу в субботу»).
 * У update день ищем до первого «на / к»: «перенеси йогу в субботу на воскресенье» → суббота.
 */
function occOf(task: ExistingTask, action: ChangeAction, transcript: string, today: string): string | undefined {
  if (!task.repeat || !task.date) return undefined;
  const text = action === 'update' ? transcript.split(/\s(?:на|к)\s/i)[0] : transcript;
  const past = action === 'mark' || action === 'unmark';
  const list = occurrences(task, past ? addDaysIso(today, -7) : today, addDaysIso(today, 400), 500);
  const dow = plainWeekday(text);
  let pick: string[];
  if (dow !== null) pick = list.filter((d) => new Date(`${d}T00:00:00Z`).getUTCDay() === dow);
  else {
    const p = spokenPeriod(text, today);
    if (!p) return undefined;
    pick = list.filter((d) => d >= p.from && d <= p.to);
  }
  if (past) {
    const before = pick.filter((d) => d <= today);
    if (before.length) return before.at(-1);
  }
  return pick.find((d) => d >= today);
}

/** Дело из списка по названию во фразе: «баню» → «Баня» (по основе первого значимого слова) */
function findTask(text: string, ctx: Context) {
  const n = (s: string) => s.toLowerCase().replace(/ё/g, 'е');
  const words = n(text)
    .split(/[^а-яa-z0-9]+/)
    .filter((w) => w.length >= 3 && !/^(теперь|больше|каждое|каждую|каждый|каждые|повторяй|повторять|сделай|пусть|будет)$/.test(w));
  for (const w of words) {
    const stem = w.slice(0, Math.max(3, w.length - 2));
    const hit = ctx.existing.tasks.find((t) => n(t.title).split(/[^а-яa-z0-9]+/).some((x) => x.startsWith(stem)));
    if (hit) return hit;
  }
  return null;
}

/* ---------- длительность, участники, план ---------- */

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Конец по началу и длительности: «18:00 + 150 мин» → 20:30; через полночь — на следующий день */
export function endFrom(day: string, start: string, minutes: number): { endDate: string | null; endTime: string } {
  const [h, m] = start.split(':').map(Number);
  const total = h * 60 + m + Math.round(minutes);
  const days = Math.floor(total / 1440);
  const mm = total % 1440;
  return { endDate: days ? addDaysIso(day, days) : null, endTime: `${pad2(Math.floor(mm / 60))}:${pad2(mm % 60)}` };
}

/** Конец дела из ответа модели: дата конца позже начала, время конца позже начала (иначе — следующий день) */
function endFields(day: string | null, start: string | null, endD: string | null, endT: string | null, minutes: number | null) {
  if (minutes && minutes > 0 && day && start) return endFrom(day, start, minutes);
  const endDate = endD && day && endD > day ? endD : null;
  if (endT && start && day && !endDate && endT <= start) return { endDate: addDaysIso(day, 1), endTime: endT };
  return { endDate, endTime: endT && (endDate || (start && endT > start)) ? endT : null };
}

/** Кто занят: «me», «all» (вся текущая группа) и имена → id участников текущей группы */
function resolvePeople(v: unknown, ctx: Context): string[] {
  if (!Array.isArray(v)) return [];
  const members = ctx.groupMembers;
  const out = new Set<string>();
  for (const x of v) {
    const n = str(x);
    if (!n) continue;
    if (n === 'all') (members ?? [ctx.me.id]).forEach((id) => out.add(id));
    else {
      const id = matchPerson(n, ctx);
      if (id) out.add(id);
    }
  }
  return [...out].filter((id) => !members || members.includes(id));
}

/** План, в который попадает подзадача: названный моделью (из существующих дел, не сам подзадача) или открытый на экране */
function resolveParent(v: unknown, ctx: Context) {
  const id = str(v).replace(/^task:/, '');
  const named = id ? ctx.existing.tasks.find((t) => t.id === id && !t.parentId) : null;
  const cur = ctx.currentParentId ? ctx.existing.tasks.find((t) => t.id === ctx.currentParentId) : null;
  return named ?? cur ?? null;
}

const minutesOf = (v: unknown) => (typeof v === 'number' && v > 0 && v <= 60 * 24 * 14 ? v : null);

/* ---------- идеи: темы по названию ---------- */

const normName = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[^а-яa-z0-9]+/g, ' ').trim();
// Слова, по которым темы не различаются: «идеи для подарков» и «подарки» — одна тема
const TOPIC_STOP = new Set(['идея', 'идеи', 'идей', 'идею', 'для', 'тема', 'тему', 'темы', 'мои', 'мой', 'моя', 'наши', 'наш', 'список', 'заметки', 'мысли', 'мысль', 'про']);
const topicStems = (s: string) =>
  normName(s)
    .split(' ')
    .filter((w) => w.length >= 3 && !TOPIC_STOP.has(w))
    .map((w) => w.slice(0, Math.max(3, Math.min(5, w.length - 1))));
const stemHit = (a: string, b: string) => a.startsWith(b) || b.startsWith(a);

/** Тема из списка по названию, как его сказали или переписала модель: сначала точное совпадение, потом по основам слов */
export function findTopic<T extends { id: string; title: string }>(name: string, topics: T[]): T | null {
  const n = normName(name);
  if (!n) return null;
  const exact = topics.find((t) => normName(t.title) === n);
  if (exact) return exact;
  const want = topicStems(name);
  let best: T | null = null;
  let bestScore = 0;
  for (const t of topics) {
    const have = topicStems(t.title);
    const score = want.filter((w) => have.some((h) => stemHit(w, h))).length;
    if (score > bestScore) {
      best = t;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Цели правки, сверенные с фразой. Названная модель запись подходит, если её название звучит во фразе
 * (или во фразе нет слов-названий: «удали это»). Не звучит — берём запись, чьё название звучит; нет такой — пусто (notFound)
 */
export function checkTarget(ids: string[], titles: Map<string, string>, transcript: string): string[] {
  const said = titleStems(transcript);
  if (!said.length) return ids;
  const hits = (title: string) => titleStems(title).filter((w) => said.some((x) => sameStem(w, x))).length;
  const ok = ids.filter((id) => hits(titles.get(id) ?? '') > 0);
  if (ok.length) return ok;
  let best = 0;
  let found: string[] = [];
  for (const [id, title] of titles) {
    const h = hits(title);
    if (h > best) [best, found] = [h, [id]];
    else if (h === best && h > 0) found.push(id);
  }
  return found.slice(0, 3);
}

/** Прозвучало ли название темы во фразе (модель иногда сама придумывает тему, которую человек не называл) */
function mentioned(title: string, transcript: string) {
  if (normName(transcript).includes(normName(title))) return true;
  const said = topicStems(transcript);
  const want = topicStems(title);
  return want.length > 0 && want.some((w) => said.some((x) => stemHit(w, x)));
}

/**
 * Куда положить идею. Названа существующая тема — в неё; названа новая — создастся при сохранении;
 * не названа (или не прозвучала во фразе) — тема, открытая на экране, иначе «Без темы».
 */
function resolveTopic(name: string, ctx: Context, transcript: string): { topicId: string | null; newTopic: string | null } {
  const topics = ctx.topics ?? [];
  const cur = ctx.currentTopicId && topics.some((t) => t.id === ctx.currentTopicId) ? ctx.currentTopicId : null;
  if (!name || /^без тем/i.test(name)) return { topicId: cur, newTopic: null };
  const hit = findTopic(name, topics);
  if (hit) {
    // Тема должна прозвучать во фразе: подобранная моделью «по смыслу» часто чужая
    if (hit.id !== cur && !mentioned(hit.title, transcript)) return { topicId: cur, newTopic: null };
    return { topicId: hit.id, newTopic: null };
  }
  if (mentioned(name, transcript)) return { topicId: null, newTopic: cap(name) };
  return { topicId: cur, newTopic: null };
}


/* ---------- заметки-списки ---------- */

const strs = (v: unknown, max = 40) => (Array.isArray(v) ? v.map(str).filter(Boolean).slice(0, max) : []);

/**
 * Продиктованный перечень: пункты от модели (items), строки чек-листа в тексте или «Название: а, б и в».
 * Меньше двух пунктов — не список.
 */
function dictatedList(a: RawAction, text: string): { title: string; items: string[] } | null {
  const given = strs(a.items);
  if (given.length >= 2) return { title: cap(str(a.title) || str(a.list)), items: given };
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const checks = lines.flatMap((l) => {
    const m = /^(?:[-*•] ?(?:\[[ xX]\])?|\d{1,3}[.)]) ?(.+)$/.exec(l);
    return m ? [m[1]] : [];
  });
  if (checks.length >= 2) return { title: cap(lines.find((l) => !/^(?:[-*•]|\d{1,3}[.)])/.test(l))?.replace(/:$/, '') ?? ''), items: checks };
  return spokenList(text);
}

/** Тема-список: есть тема с таким названием — пункты дописываются в неё, иначе новая тема с чек-листом */
function listTopic(key: string, list: { title: string; items: string[] }, ctx: Context): DraftItem {
  const title = list.title || 'Список';
  const same = (ctx.topics ?? []).find((t) => normName(t.title) === normName(title));
  if (same) {
    const r = applyListEdit(same.body ?? '', { add: list.items });
    return { key, type: 'topic', id: same.id, data: { title: same.title, body: r.body, changes: r.changes } };
  }
  return { key, type: 'topic', data: { title, body: listBody(list.items) } };
}

/** «Добавь в список продуктов сыр, убери хлеб» — правка пунктов темы (названной или открытой на экране) */
function listEdit(a: RawAction, ctx: Context): DraftItem | null {
  const topics = ctx.topics ?? [];
  const name = str(a.topic);
  const named = name ? findTopic(name, topics) : null;
  let t = named ?? topics.find((x) => x.id === ctx.currentTopicId) ?? null;
  const replace = (Array.isArray(a.replace) ? a.replace : []).flatMap((r) => {
    const o = r && typeof r === 'object' ? (r as Record<string, unknown>) : {};
    return str(o.from) && str(o.to) ? [{ from: str(o.from), to: str(o.to) }] : [];
  });
  const edit = { add: strs(a.add), remove: strs(a.remove), replace, check: strs(a.check), uncheck: strs(a.uncheck) };
  // Тема не названа или названа чужая («шапка взял»): берём список, в котором такие пункты есть, если он один
  if (!named) {
    const touched = [...edit.remove, ...edit.check, ...edit.uncheck, ...replace.map((r) => r.from)].map(normName).filter(Boolean);
    const holders = touched.length ? topics.filter((x) => x.body && touched.every((i) => normName(x.body ?? '').includes(i))) : [];
    if (holders.length === 1) t = holders[0]!;
  }
  if (!t) return name && edit.add.length ? listTopic(randomUUID(), { title: cap(name), items: edit.add }, ctx) : null;
  const r = applyListEdit(t.body ?? '', edit);
  return r.changes.length ? { key: randomUUID(), type: 'topic', id: t.id, data: { title: t.title, body: r.body, changes: r.changes } } : null;
}

/**
 * Группа из «Моих групп», названная во фразе с предлогом: «в Футболе», «у Родителей» (по основе названия).
 * Названия-местоимения и общие слова («Мы», «Семья», «Друзья») не считаем: «у нас в семье» — это категория
 */
function groupInText(text: string, ctx: Context): string | null {
  const t = text.toLowerCase().replace(/ё/g, 'е');
  const common = /^(мы|мы с .*|семья|друзья|родители|наши|наша|мои|моя)$/i;
  for (const g of ctx.groups ?? []) {
    const name = g.name.trim();
    if (!name || common.test(name)) continue;
    const stem = name.toLowerCase().replace(/ё/g, 'е').slice(0, Math.max(4, name.length - 2));
    if (new RegExp(`(^|\\s)(в|во|у|для|из)\\s+${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(t)) return name;
  }
  return null;
}

/* ---------- сборка результата ---------- */

/** Название, заметка, текст и пункты добавляемой записи — сверка с фразой (src/ground.ts) */
function grounded(a: RawAction, transcript: string): RawAction {
  if (a.intent !== 'add') return a;
  const keys = (['title', 'text', 'note'] as const).filter((k) => str(a[k]));
  let items = strs(a.items);
  const fixed = groundTexts([...keys.map((k) => str(a[k])), ...items], transcript, [...keys.map((k) => k === 'text'), ...items.map(() => true)]);
  const out: RawAction = { ...a };
  keys.forEach((k, i) => (out[k] = fixed[i]!));
  if (items.length) {
    if (str(out.title)) out.title = spanTitle(str(out.title), transcript);
    items = fixed.slice(keys.length);
    out.items = commaItems(str(out.title), items, transcript) ?? items;
  }
  return out;
}

/** «Убери цемент из стройматериалов» — пункт списка, а не запись: тема названа во фразе и пункт в ней есть */
function listRemoval(a: RawAction, ctx: Context, transcript: string): RawAction {
  const what = str(a.query);
  if (a.intent !== 'delete' || !what) return a;
  const said = normName(what);
  const topic = (ctx.topics ?? []).find((t) => t.body && mentioned(t.title, transcript) && normName(t.body).split(' ').some((w) => w.length >= 3 && (w.startsWith(said.slice(0, Math.max(3, said.length - 2))))));
  return topic ? ({ intent: 'list_edit', topic: topic.title, remove: [what] } as RawAction) : a;
}

export function normalize(input: RawAction[], ctx: Context, transcript: string): ParseResult {
  let actions = input.map((a) => listRemoval(grounded(a, transcript), ctx, transcript));
  // «Что бы сегодня посмотреть?» модель принимала за вопрос о планах на сегодня (баг 08.11) — это выбор фильма
  if (!actions.some((a) => a.intent === 'query_watch') && asksWhatToWatch(transcript))
    actions = actions.map((a) => (a.intent === 'query_plans' ? ({ intent: 'query_watch' } as RawAction) : a));
  // 1. Вопросы — сразу переход на экран
  const qw = actions.find((a) => a.intent === 'query_watch');
  if (qw) {
    // «Наш старый фильм» — вид названный во фразе берём сами, если модель его пропустила (eval 05.11)
    // Вид, чьё кино и новизна — только названные во фразе: модель их додумывала («что посмотрим» → сериал) или теряла
    const saidKind = spokenKind(transcript);
    const saidOrigin = spokenOrigin(transcript);
    const saidFresh = spokenFresh(transcript);
    const filters: WatchFilters = {
      kind: saidKind ? [saidKind] : [],
      // Жанр, названный во фразе, надёжнее ответа модели; не назван — что сказала модель
      genre: spokenGenres(transcript).length ? manyOf(GENRES, spokenGenres(transcript)) : manyOf(GENRES, qw.genre ?? qw.genres),
      origin: saidOrigin ? [saidOrigin] : [],
      fresh: saidFresh ? [saidFresh] : [],
    };
    return { type: 'queryWatch', filters };
  }
  const qp = actions.find((a) => a.intent === 'query_wish');
  if (qp) {
    let person = str(qp.person);
    // «Что я хотел?» — модель подставляла имя из контекста, которое во фразе не звучало
    const heard = (n: string) => titleStems(transcript).some((x) => sameStem(x, norm3(n)));
    if (person && !isMe(person) && !heard(person) && /(^|[^а-я])(я|мне|меня|мой|мои|моя|мое|у меня)([^а-я]|$)/i.test(transcript.replace(/ё/g, 'е'))) person = 'me';
    const id = matchPerson(person || 'me', ctx);
    return id ? { type: 'queryWish', personId: id } : { type: 'unknownPerson', name: cap(person) };
  }

  // Вопрос о планах — какие группы и дела показать, решает приложение
  const qp2 = actions.find((a) => a.intent === 'query_plans');
  if (qp2) {
    const names = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean).slice(0, 5) : []);
    let scope: PlansScope = { kind: 'current' };
    const cat = oneOf<GroupCategory>(CATEGORIES, qp2.category);
    // «Я» среди людей — это сам говорящий, а не человек из групп
    const people = names(qp2.people);
    const others = people.filter((n) => !isMe(n));
    const meOnly = qp2.scope === 'me' || (qp2.scope === 'people' && people.length > 0 && !others.length);
    let who: string[] | undefined;
    if (meOnly) {
      // «Что я делаю на выходных» — все мои группы, только мои дела
      scope = { kind: 'me' };
      who = [ctx.me.id];
    } else if (qp2.scope === 'us') scope = { kind: 'us' };
    else if (qp2.scope === 'people' && others.length) scope = { kind: 'people', names: others };
    else if (qp2.scope === 'category' && cat) scope = { kind: 'category', category: cat };
    else if (qp2.scope === 'groups' && names(qp2.groups).length) scope = { kind: 'groups', names: names(qp2.groups) };
    // Модель назвала категорию или группу, но не тот scope («people» без имён и с category: friends) — верим полю
    else if (cat && !others.length) scope = { kind: 'category', category: cat };
    else if (names(qp2.groups).length && !others.length) scope = { kind: 'groups', names: names(qp2.groups) };
    // Группа из «Моих групп» названа во фразе («что у нас в Футболе») — это она, что бы ни ответила модель
    const said = groupInText(transcript, ctx);
    if (said && scope.kind !== 'groups' && scope.kind !== 'people' && !meOnly) scope = { kind: 'groups', names: [said] };
    let from = date(qp2.from) ?? ctx.today;
    let to = date(qp2.to) ?? addDaysIso(ctx.today, 6);
    // Период, названный во фразе, считаем сами — модель путается в календаре
    const period = spokenPeriod(transcript, ctx.today);
    if (period) ({ from, to } = period);
    if (to < from) [from, to] = [to, from];
    // «Когда у нас дача?» — ищем по названию на год вперёд; что ищут, берём из фразы, если модель не сказала
    let query = str(qp2.query);
    const when = /^когда\s+(?:у\s+(?:нас|меня|него|нее|них|\S+)\s+|будет\s+|мы\s+|я\s+)?(.+?)[?!.]*$/i.exec(transcript.trim());
    if (when) {
      if (!query) query = when[1]!.toLowerCase();
      if (!period) [from, to] = [ctx.today, addDaysIso(ctx.today, 365)];
    } else if (!period && from === to && !/(\d|вчера|назад|прошл|было|делал|сегодн|завтра|выходн|недел|месяц|праздн|январ|феврал|март|апрел|ма[яй]|июн|июл|август|сентябр|октябр|ноябр|декабр|понедел|вторн|сред|четверг|пятниц|суббот|воскрес)/i.test(transcript))
      // Срок не назван («какие планы у родителей?»), а модель дала один день — неделя с сегодня, как в правилах
      [from, to] = [ctx.today, addDaysIso(ctx.today, 6)];
    // Чьи дела показывать, если модель назвала («что Карина делает в субботу» → who: ["Карина"])
    if (!who) {
      const ids = names(qp2.who).map((n) => matchPerson(n, ctx)).filter((x): x is string => !!x);
      if (ids.length) who = [...new Set(ids)];
    }
    return { type: 'queryPlans', plans: { scope, from, to, query, ...(who && { who }) } };
  }

  // «Покажи идеи для подарков» — открыть тему
  const qi = actions.find((a) => a.intent === 'query_ideas');
  if (qi) {
    const name = str(qi.topic);
    if (!name) return { type: 'queryIdeas', topicId: null };
    if (/^без тем/i.test(name)) return { type: 'queryIdeas', topicId: 'inbox' };
    const hit = findTopic(name, ctx.topics ?? []);
    return hit ? { type: 'queryIdeas', topicId: hit.id } : { type: 'notFound', query: name };
  }

  // «Баню теперь каждое воскресенье», «больше не повторяй зарядку» — правка повтора существующего дела,
  // даже если модель решила, что это новое дело
  if (changesRepeat(transcript)) {
    actions = actions.map((a) => {
      // «Больше не повторяй ужин» — это не удаление дела, а снятие повтора
      if (a.intent === 'delete' && stopsRepeat(transcript)) return { ...a, intent: 'update' };
      if (a.intent !== 'add' || (a.type && a.type !== 'task')) return a;
      const t = findTask(str(a.title) || transcript, ctx);
      return t ? ({ intent: 'update', target: [t.id], query: t.title } as RawAction) : a;
    });
  }

  // Модель иногда принимает «Через две недели забрать документы» за перенос похожей записи,
  // а «Сохрани фильм Интерстеллар» — за отметку «посмотрели».
  // Без глагола изменения («перенеси», «удали», «отметь»…) это всегда добавление; дубль покажет приложение.
  if (!hasChangeVerb(transcript) && !changesRepeat(transcript)) {
    actions = actions.map((a) => {
      if (!['update', 'mark', 'unmark'].includes(a.intent)) return a;
      // «Добавь Карину в футбол» — это правка участников существующего дела, а не новое дело
      if (a.intent === 'update' && Array.isArray(a.people) && a.people.length && !str(a.title)) return a;
      const id = (Array.isArray(a.target) ? a.target : []).map((x) => String(x).replace(/^(task|watch|wish|idea):/, ''))[0];
      const idea = ctx.existing.ideas?.find((x) => x.id === id);
      if (idea) return { intent: 'add', type: 'idea', text: str(a.text) || str(a.query), topic: a.topic } as RawAction;
      const w = ctx.existing.watch.find((x) => x.id === id);
      if (w) return { intent: 'add', type: 'watch', title: w.title } as RawAction;
      const wi = ctx.existing.wishes.find((x) => x.id === id);
      if (wi) return { intent: 'add', type: 'wish', title: wi.title } as RawAction;
      const t = ctx.existing.tasks.find((x) => x.id === id);
      return { intent: 'add', type: 'task', title: str(a.title) || t?.title || str(a.query), date: a.date, time: a.time, note: '' } as RawAction;
    });
  }

  // «Верни посылку в невыполненные» — снятие отметки, даже если модель решила, что это правка
  if (isUnmark(transcript)) actions = actions.map((a) => (a.intent === 'update' || a.intent === 'mark' ? { ...a, intent: 'unmark' } : a));

  // 2. Добавление
  const items: DraftItem[] = [];
  for (const a of actions.filter((x) => x.intent === 'add')) {
    const key = randomUUID();
    // Идея: текст как сказали, тема — по названию или по смыслу
    if (a.type === 'idea') {
      let text = cap(str(a.text) || str(a.title));
      const topic = resolveTopic(str(a.topic), ctx, transcript);
      // Заметку записываем дословно: модель её пересказывает и теряет слова («в субботу на рынке свежая рыба» →
      // «На рынке свежая рыба»). Разошлось со сказанным — берём текст из фразы
      if (str(a.text) && !dictatedList(a, text)) {
        const named = topic.newTopic ?? (ctx.topics ?? []).find((t) => t.id === topic.topicId)?.title ?? '';
        const said = noteTail(transcript, mentioned(named, transcript) ? named : '');
        if (said && !faithful(text, said)) text = cap(said);
      }
      // Перечень без названной темы — отдельная заметка-список (тема с чек-листом)
      const list = dictatedList(a, text);
      if (list && !topic.topicId && !topic.newTopic) items.push(listTopic(key, list, ctx));
      else if (list) {
        // Перечень в названную тему — заметка в ней: название заголовком, пункты чек-листом
        const body = listBody(list.items);
        items.push({ key, type: 'idea', data: { title: list.title ? `# ${list.title}\n${body}` : body, ...topic } });
      } else if (text) items.push({ key, type: 'idea', data: { title: text, ...topic } });
      continue;
    }
    if (a.type === 'topic') {
      const list = dictatedList(a, '');
      if (list) items.push(listTopic(key, { ...list, title: list.title || cap(str(a.title)) }, ctx));
      else if (cap(str(a.title))) items.push({ key, type: 'topic', data: { title: cap(str(a.title)) } });
      continue;
    }
    const title = cap(str(a.title));
    if (!title) continue;
    // «Добавь сегодня в 18:00 футбол» — модель может принять за передачу в «Смотреть».
    // Есть дата или время и нет слов про фильм/сериал/«посмотреть» — это дело
    const looksLikeTask =
      a.type === 'watch' &&
      (spokenTime(transcript) !== null || spokenPeriod(transcript, ctx.today) !== null) &&
      !/(фильм|сериал|мульт|кино|посмотр|смотреть|глянуть|шоу|стендап|передач)/i.test(transcript);
    if (a.type === 'wish') items.push({ key, type: 'wish', data: { title, note: str(a.note), link: str(a.link) } });
    else if (a.type === 'watch' && !looksLikeTask) {
      const year = typeof a.year === 'number' && a.year > 1880 && a.year < 2100 ? Math.round(a.year) : null;
      items.push({
        key,
        type: 'watch',
        data: {
          title,
          kind: oneOf<Kind>(KINDS, a.kind),
          genres: manyOf<Genre>(GENRES, a.genres, 3),
          origin: oneOf<Origin>(ORIGINS, a.origin),
          year,
        },
      });
    } else {
      const t = time(a.time) ?? (looksLikeTask ? spokenTime(transcript) : null);
      const parent = resolveParent(a.parent, ctx);
      // Время без даты — значит, сегодня (а у подзадачи плана — первый день плана)
      const day = date(a.date) ?? (t ? (parent?.date ?? ctx.today) : null);
      const data: TaskDraft = { title, date: day, time: t, note: str(a.note) };
      const end = endFields(day, t, date(a.end_date), time(a.end_time), minutesOf(a.duration_min));
      if (end.endDate) data.endDate = end.endDate;
      if (end.endTime) data.endTime = end.endTime;
      const people = resolvePeople(Array.isArray(a.people) && a.people.length ? a.people : spokenPeople(transcript, ctx), ctx);
      if (people.length) data.people = people;
      if (parent) data.parentId = parent.id;
      // Тип: день рождения — весь день и каждый год (если повтор не сказан)
      const kind = oneOf<'birthday' | 'important' | 'trip'>(['birthday', 'important', 'trip'], a.kind);
      if (kind) data.kind = kind;
      if (kind === 'birthday' && data.date) {
        data.time = null;
        delete data.endTime;
        delete data.endDate;
      }
      items.push({ key, type: 'task', data });
    }
  }
  // Одно дело — дату, сказанную словами («в следующую субботу»), считаем сами
  const tasks = items.filter((i) => i.type === 'task');
  if (tasks.length === 1 && tasks[0].type === 'task') {
    const d = tasks[0].data;
    // «С 7 по 9 октября», «с пятницы по воскресенье» — многодневное дело
    const range = spokenDateRange(transcript, ctx.today);
    const said = range ? null : spokenPeriod(transcript, ctx.today);
    if (range) {
      d.date = range.from;
      if (range.to > range.from) d.endDate = range.to;
      else delete d.endDate;
    } else if (said && said.from === said.to) d.date = said.from;
    // «На выходных» — если модель дала дату вне периода, берём его начало
    else if (said && (!d.date || d.date < said.from || d.date > said.to) && addDaysIso(said.from, 1) >= said.to) d.date = said.from;
    // Время, названное во фразе, надёжнее ответа модели («в 21:00» модель писала как 19:00)
    const saidTime = spokenTime(transcript);
    if (saidTime) d.time = saidTime;
    // «С 18 до 20» и «на два часа» считаем сами
    const span = spokenSpan(transcript);
    if (span) {
      d.time = span.start;
      d.endTime = span.end;
      d.date ??= ctx.today;
    } else {
      const dur = spokenDuration(transcript);
      if (dur && d.time && d.date) Object.assign(d, endFrom(d.date, d.time, dur));
    }
    if (d.endDate === null) delete d.endDate;
    if (d.endDate && d.date && d.endDate <= d.date) delete d.endDate;
    // Повтор («каждую субботу», «по будням») считаем сами; первый раз — ближайший подходящий день
    const rep = spokenRepeat(transcript, ctx.today);
    if (rep) {
      d.repeat = rep;
      // «Каждую среду» — начиная с сегодняшнего дня, если он подходит (а не «со следующей среды»).
      // Дату берём из фразы, только если начало названо явно: «с понедельника», «с 5 октября», «завтра», «через неделю»
      const explicit = /(начиная|(^|\s)с\s+(завтра|понедельник|вторник|сред|четверг|пятниц|суббот|воскресен|\d)|завтра|послезавтра|через\s)/i.test(transcript);
      const span0 = d.endDate && d.date ? Math.round((Date.parse(d.endDate) - Date.parse(d.date)) / 86400000) : 0;
      d.date = firstDate(rep, explicit ? d.date : null, ctx.today);
      if (span0 && d.date) d.endDate = addDaysIso(d.date, span0);
      d.title = stripRepeat(d.title);
    }
  }
  for (const a of actions.filter((x) => x.intent === 'list_edit')) {
    const it = listEdit(a, ctx);
    if (it) items.push(it);
  }
  // День рождения повторяется каждый год, если повтор не сказан иначе
  for (const i of items) if (i.type === 'task' && i.data.kind === 'birthday' && i.data.date && !i.data.repeat) i.data.repeat = { freq: 'year', every: 1 };
  // Одна запись в «Смотреть» — тип по слову во фразе («фильм», «сериал», «мультик»), если модель его не дала
  const watches = items.filter((i) => i.type === 'watch');
  if (watches.length === 1 && watches[0].type === 'watch' && !watches[0].data.kind) watches[0].data.kind = spokenKind(transcript);
  // Вопрос не про приложение («какая погода завтра», «сколько времени») модель записывала делом
  if (items.length && /^(как(ая|ой|ое|ие|ов)|сколько|кто|почему|зачем|который)\s/i.test(transcript.trim()) && items.every((i) => i.type === 'task')) return { type: 'unknown' };
  if (items.length) return { type: 'items', items };

  // 3. Изменения существующих записей
  const index = new Map<string, ItemType>();
  ctx.existing.tasks.forEach((t) => index.set(t.id, 'task'));
  ctx.existing.watch.forEach((w) => index.set(w.id, 'watch'));
  ctx.existing.wishes.forEach((w) => index.set(w.id, 'wish'));
  ctx.existing.ideas?.forEach((i) => index.set(i.id, 'idea'));

  const changes: ChangeDraft[] = [];
  let missing = '';
  const titles = new Map<string, string>();
  ctx.existing.tasks.forEach((t) => titles.set(t.id, t.title));
  ctx.existing.watch.forEach((w) => titles.set(w.id, w.title));
  ctx.existing.wishes.forEach((w) => titles.set(w.id, w.title));
  ctx.existing.ideas?.forEach((i) => titles.set(i.id, i.text));
  for (const a of actions.filter((x) => ['update', 'mark', 'unmark', 'delete'].includes(x.intent))) {
    // Только реально существующие id; модель могла дописать префикс «task:»
    const ids = (Array.isArray(a.target) ? a.target : [])
      .map((x) => String(x).replace(/^(task|watch|wish|idea):/, ''))
      .filter((id) => index.has(id));
    // Небольшая модель путает запись: название цели должно прозвучать во фразе, иначе ищем по словам сами
    const sure = checkTarget(ids, titles, transcript);
    ids.splice(0, ids.length, ...sure);
    if (!ids.length) {
      missing ||= str(a.query) || transcript;
      continue;
    }
    const type = index.get(ids[0])!;
    // Идеи не отмечаются — только переносятся и удаляются
    if (type === 'idea' && (a.intent === 'mark' || a.intent === 'unmark')) continue;
    const candidates = [...new Set(ids.filter((id) => index.get(id) === type))].slice(0, 3);
    const change: ChangeDraft = { key: randomUUID(), action: a.intent as ChangeAction, type, candidates, chosen: candidates[0] };
    if (type === 'task') {
      const t = ctx.existing.tasks.find((x) => x.id === candidates[0]);
      const occ = t && occOf(t, change.action, transcript, ctx.today);
      if (occ) change.occ = occ;
    }

    if (a.intent === 'update' && type === 'idea') {
      // Перенос идеи в другую тему (существующую, новую или «Без темы»)
      const name = str(a.topic);
      if (!name) continue;
      const hit = /^без тем/i.test(name) ? null : findTopic(name, ctx.topics ?? []);
      change.patch = hit ? { topicId: hit.id } : /^без тем/i.test(name) ? { topicId: null } : { topicId: null, newTopic: cap(name) };
      changes.push(change);
      continue;
    }
    if (a.intent === 'update') {
      const patch: ChangeDraft['patch'] = {};
      if (str(a.title)) patch.title = cap(str(a.title));
      if (type === 'task') {
        const old = ctx.existing.tasks.find((t) => t.id === candidates[0]);
        if ('date' in a) patch.date = date(a.date);
        if ('time' in a) patch.time = time(a.time);
        // Время, названное во фразе, надёжнее ответа модели («перенеси ужин на восемь» → 20:00)
        const said = spokenTime(transcript);
        if (said) patch.time = said;
        // Новая дата — то, что сказано после последнего «на / к» с днём или датой: «с пятницы на субботу» → суббота;
        // «на пятницу на два» — день из «на пятницу», а не из «на два»
        const segs = transcript.split(/\s(?:на|к)\s/i).slice(1);
        const tail = [...segs].reverse().find((s) => plainWeekday(s) !== null || spokenPeriod(s, ctx.today) !== null) ?? segs.at(-1) ?? transcript;
        const dow = plainWeekday(tail);
        const saidDate = spokenPeriod(tail, ctx.today);
        // День недели при переносе — ближайший к старой дате записи.
        // Названный раз серии считаем от него: «перенеси йогу в субботу на воскресенье» → следующий день
        const ref = change.occ ?? old?.date;
        if (dow !== null && ref && patch.date !== undefined) patch.date = nearestWeekday(dow, ref, ctx.today);
        else if (saidDate && saidDate.from === saidDate.to) patch.date = saidDate.from;
        // Модель вернула «перенос» без изменений по сути — убираем поля, совпадающие со старыми
        if (old && patch.time === old.time && said === null && !('date' in a)) delete patch.time;
        // Длительность: «футбол теперь с 19 до 21», «продли до 21», «сделай баню на 3 часа»
        const span = spokenSpan(transcript);
        const start = () => (patch.time !== undefined ? patch.time : (old?.time ?? null));
        const day = () => (patch.date !== undefined ? patch.date : (old?.date ?? null)) ?? ctx.today;
        if (span) {
          patch.time = span.start;
          patch.endTime = span.end;
          patch.endDate = null;
        } else {
          const until = spokenUntil(transcript);
          const dur = spokenDuration(transcript) ?? minutesOf(a.duration_min);
          if (until && start()) {
            // «Продли футбол (19:00) до девяти» — 21:00, а не 9 утра следующего дня
            const [uh, um] = until.split(':').map(Number);
            const fixed = until <= start()! && uh < 12 && `${pad2(uh + 12)}:${pad2(um)}` > start()! ? `${pad2(uh + 12)}:${pad2(um)}` : until;
            const e = endFields(day(), start(), null, fixed, null);
            patch.endTime = e.endTime;
            patch.endDate = e.endDate;
          } else if (dur && start()) Object.assign(patch, endFrom(day(), start()!, dur));
          else if ('end_time' in a || 'end_date' in a) {
            const e = endFields(day(), start(), date(a.end_date), time(a.end_time), null);
            patch.endTime = e.endTime;
            patch.endDate = e.endDate;
          }
        }
        const people = resolvePeople(a.people, ctx);
        if (people.length) {
          // «Добавь Карину в футбол» — к тем, кто уже участвует; иначе — новый состав
          const before = /добав/i.test(transcript) ? (old?.people ?? []).map((n) => matchPerson(n, ctx)).filter((x): x is string => !!x) : [];
          patch.people = [...new Set([...before, ...people])];
        }
        // Повтор: «теперь каждое воскресенье» — новый; «больше не повторяй» — снять
        if (stopsRepeat(transcript)) {
          patch.repeat = null;
          delete patch.date;
        } else {
          const rep = spokenRepeat(transcript, ctx.today);
          if (rep) {
            patch.repeat = rep;
            // Первый раз новой серии — ближайший подходящий день (не раньше сегодня)
            patch.date = firstDate(rep, patch.date ?? null, ctx.today);
          }
        }
      }
      if (!Object.keys(patch).length) continue;
      // Новый повтор или снятие повтора — правка всей серии, не одного раза
      if ('repeat' in patch) delete change.occ;
      change.patch = patch;
    }
    changes.push(change);
  }
  if (changes.length) return { type: 'changes', changes };
  if (missing) return { type: 'notFound', query: missing };

  // Модель не поняла, но фраза явно про изменение («удали слона») — значит, такой записи нет
  const target = changeTarget(transcript);
  if (target) return { type: 'notFound', query: target };

  return { type: 'unknown' };
}

/**
 * path — как разобрали (для статистики расходов): rules — правилами без модели; compact — короткий промпт;
 * fallback — короткий, затем полный («непонятно» с первого раза); full — сразу полный (PROMPT_MODE=full)
 */
export type ParsePath = 'rules' | 'compact' | 'fallback' | 'full' | 'tuned';
export type ParseOutput = { result: ParseResult; raw: string; usage: Usage; attempts: number; path?: ParsePath };

/**
 * Стоит ли переспрашивать полным промптом после «непонятно» по короткому. Нет: в фразе меньше трёх слов
 * (обрывок, шум — полный промпт тоже не поймёт) и если модель уже дважды не дала JSON. Так повтор,
 * самый дорогой путь (короткий + полный промпт), остаётся только для настоящих фраз
 */
export const worthFullRetry = (text: string, first: Pick<ParseOutput, 'attempts' | 'raw'>): boolean =>
  text.trim().split(/\s+/).filter((w) => /[а-яёa-z0-9]/i.test(w)).length >= 3 && first.attempts < 2;

const FILLER = /^(м+|мм+|э+|а+|у+|о+|хм+|ну|ой|ай|ага|угу|так|вот|ладно|короче|блин|алло|эй|да|нет)$/;
/** Во фразе одни междометия («ммм», «ну это…») — разбирать нечего, модель не зовём */
export const onlyFiller = (text: string) =>
  text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .split(/[^а-яa-z0-9]+/)
    .filter(Boolean)
    .every((w) => FILLER.test(w) || w === 'это') || OFF_TOPIC.test(text.toLowerCase().replace(/ё/g, 'е'));
// Вопросы и просьбы не про приложение: отвечаем «не понял» сразу
const OFF_TOPIC = /^(какая погода|какой прогноз погоды|будет ли дождь|сколько градусов|который час|сколько (сейчас )?времени|расскажи (анекдот|шутку|сказку)|включи (музыку|песню|радио)|поставь (песню|музыку)|какой курс|как тебя зовут|ты кто|кто ты|что ты умеешь|привет,? как дела|проверка связи|переведи|какие новости|что нового в мире|кто выиграл|вызови такси|открой (ютуб|youtube|браузер))/;

/** Кто участвует, если модель не сказала: «у нас», «мы» — все в группе; «у меня» — я; «мы с Кариной» — я и Карина */
function spokenPeople(text: string, ctx: Context): string[] {
  const t = text.toLowerCase().replace(/ё/g, 'е').trim();
  // «Жене в четверг забрать документы» — дело для человека, названного первым словом
  const first = /^[а-я]+/.exec(t)?.[0] ?? '';
  if (first.length >= 3 && ctx.people.some((p) => matchPerson(first, { ...ctx, me: { ...ctx.me, name: '\u0000' } }) === p.id)) return [first];
  const pair = /(^|\s)мы с\s+([а-я]+)/.exec(t);
  if (pair) return ['me', pair[2]!];
  if (/^(у нас|мы)\s/.test(t)) return ['all'];
  if (/^у меня\s/.test(t)) return ['me'];
  return [];
}

/** Сколько раз спрашиваем свою модель, когда кроме неё некому: первый запрос будит контейнер (холодный старт дольше таймаута) */
const OWN_TRIES = 3;

/**
 * Только своя модель: без правил сервера, без отсева посторонних фраз и без страховки облачной моделью.
 * Так видно и исправляется именно она. Ответ модели дальше, как всегда, разбирает код сервера (normalize)
 */
async function parseOwn(input: string, ctx: Context): Promise<ParseOutput> {
  const text = cleanSpeech(normalizeTimes(input)) || input.trim();
  let last: unknown;
  for (let i = 0; i < OWN_TRIES; i++) {
    try {
      return { ...(await ask(buildTunedMessages(text, ctx), text, ctx, config.tunedModel)), path: 'tuned' };
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

/**
 * Полный разбор: модель → проверка схемы (один повтор) → нормализация.
 * opts.ownOnly (и OWN_ONLY=1 для всего сервера) — только своя модель, см. parseOwn
 */
export async function parseText(input: string, ctx: Context, model?: string, opts: { ownOnly?: boolean } = {}): Promise<ParseOutput> {
  if ((opts.ownOnly || config.ownOnly) && config.tunedModel && input.trim()) return parseOwn(input, ctx);
  if (!input.trim() || onlyFiller(input)) return { result: { type: 'unknown' }, raw: '', usage: NO_USAGE, attempts: 0 };
  // «в 18 0 0» → «в 18:00»: время, записанное распознаванием через пробел
  const text = cleanSpeech(normalizeTimes(input)) || input.trim();
  // Простые команды («завтра в 7 йога», «хочу наушники») — без модели: бесплатно и мгновенно
  if (config.quickRules) {
    const quick = quickParse(text, ctx);
    if (quick) {
      const result = normalize(quick as RawAction[], ctx, text);
      if (result.type === 'items') return { result, raw: 'rules', usage: NO_USAGE, attempts: 0, path: 'rules' };
    }
  }
  // Сначала короткий промпт (только нужные фразе правила); «непонятно» — повтор с полным
  // Дообученная модель: правила в ней, в запросе только контекст. «Не понял» — страховка коротким промптом
  if (config.promptMode === 'tuned' && config.tunedModel) {
    // Своя модель не ответила (холодный старт, сбой) — не ошибка для человека: спрашиваем облачную
    const tuned = await ask(buildTunedMessages(text, ctx), text, ctx, config.tunedModel).catch((e: unknown) => {
      console.error('Своя модель не ответила:', String(e).slice(0, 200));
      return null;
    });
    if (tuned && (tuned.result.type !== 'unknown' || !worthFullRetry(text, tuned))) return { ...tuned, path: 'tuned' };
    const compact = await ask(buildCompactMessages(text, ctx), text, ctx, model);
    return { ...compact, usage: addUsage(tuned?.usage ?? NO_USAGE, compact.usage), attempts: (tuned?.attempts ?? 0) + compact.attempts, path: 'fallback' };
  }
  if (config.promptMode !== 'full') {
    const first = await ask(buildCompactMessages(text, ctx), text, ctx, model);
    // Вопрос («какая погода завтра»): правила вопросов в коротком промпте и так есть — полный не поможет
    const question = [...pickBlocks(text, ctx).blocks].every((b) => b === 'qwatch' || b === 'qwish' || b === 'plans' || b === 'ideas');
    if (first.result.type !== 'unknown' || question || !worthFullRetry(text, first)) return { ...first, path: 'compact' };
    const full = await ask(buildMessages(text, ctx), text, ctx, model);
    return { ...full, usage: addUsage(first.usage, full.usage), attempts: first.attempts + full.attempts, path: 'fallback' };
  }
  return { ...(await ask(buildMessages(text, ctx), text, ctx, model)), path: 'full' };
}

/** Один разбор моделью: не JSON — один повтор */
async function ask(messages: Msg[], text: string, ctx: Context, model?: string): Promise<ParseOutput> {
  let raw = '';
  let usage = NO_USAGE;
  let attempts = 0;
  while (attempts < 2) {
    attempts++;
    const r = await complete(messages, model);
    raw = r.text;
    usage = addUsage(usage, r.usage);
    let json: unknown;
    try {
      json = extractJson(raw);
    } catch {
      continue; // не JSON вовсе — один повтор
    }
    const parsed = Reply.safeParse(json);
    // JSON есть, но не по схеме — повтор обычно даёт то же самое, не тратим токены
    if (!parsed.success) break;
    return { result: normalize(parsed.data.actions as RawAction[], ctx, text), raw, usage, attempts };
  }
  return { result: { type: 'unknown' }, raw, usage, attempts };
}
