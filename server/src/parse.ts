/**
 * Текст → ParseResult (тот же формат, что у заглушки в приложении).
 * ИИ только раскладывает фразу; всё, что можно проверить кодом, проверяется здесь.
 */
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { buildMessages } from './prompt.js';
import { changeTarget, hasChangeVerb, isUnmark, nearestWeekday, plainWeekday, spokenKind, spokenPeriod, spokenTime } from './spoken.js';
import { addUsage, complete, NO_USAGE, type Usage } from './yandex.js';
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

/* ---------- сборка результата ---------- */

export function normalize(input: RawAction[], ctx: Context, transcript: string): ParseResult {
  let actions = input;
  // 1. Вопросы — сразу переход на экран
  const qw = actions.find((a) => a.intent === 'query_watch');
  if (qw) {
    const filters: WatchFilters = {
      kind: manyOf(KINDS, qw.kind),
      genre: manyOf(GENRES, qw.genre ?? qw.genres),
      origin: manyOf(ORIGINS, qw.origin),
      fresh: manyOf(['new', 'old'] as const, qw.fresh),
    };
    return { type: 'queryWatch', filters };
  }
  const qp = actions.find((a) => a.intent === 'query_wish');
  if (qp) {
    const person = str(qp.person);
    const id = matchPerson(person || 'me', ctx);
    return id ? { type: 'queryWish', personId: id } : { type: 'unknownPerson', name: cap(person) };
  }

  // Вопрос о планах — какие группы и дела показать, решает приложение
  const qp2 = actions.find((a) => a.intent === 'query_plans');
  if (qp2) {
    const names = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean).slice(0, 5) : []);
    let scope: PlansScope = { kind: 'current' };
    const cat = oneOf<GroupCategory>(CATEGORIES, qp2.category);
    if (qp2.scope === 'us') scope = { kind: 'us' };
    else if (qp2.scope === 'people' && names(qp2.people).length) scope = { kind: 'people', names: names(qp2.people) };
    else if (qp2.scope === 'category' && cat) scope = { kind: 'category', category: cat };
    else if (qp2.scope === 'groups' && names(qp2.groups).length) scope = { kind: 'groups', names: names(qp2.groups) };
    let from = date(qp2.from) ?? ctx.today;
    let to = date(qp2.to) ?? addDaysIso(ctx.today, 6);
    // Период, названный во фразе, считаем сами — модель путается в календаре
    const said = spokenPeriod(transcript, ctx.today);
    if (said) ({ from, to } = said);
    if (to < from) [from, to] = [to, from];
    return { type: 'queryPlans', plans: { scope, from, to, query: str(qp2.query) } };
  }

  // Модель иногда принимает «Через две недели забрать документы» за перенос похожей записи,
  // а «Сохрани фильм Интерстеллар» — за отметку «посмотрели».
  // Без глагола изменения («перенеси», «удали», «отметь»…) это всегда добавление; дубль покажет приложение.
  if (!hasChangeVerb(transcript)) {
    actions = actions.map((a) => {
      if (!['update', 'mark', 'unmark'].includes(a.intent)) return a;
      const id = (Array.isArray(a.target) ? a.target : []).map((x) => String(x).replace(/^(task|watch|wish):/, ''))[0];
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
    const title = cap(str(a.title));
    if (!title) continue;
    const key = randomUUID();
    if (a.type === 'wish') items.push({ key, type: 'wish', data: { title, note: str(a.note), link: str(a.link) } });
    else if (a.type === 'watch') {
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
      const t = time(a.time);
      // Время без даты — значит, сегодня
      items.push({ key, type: 'task', data: { title, date: date(a.date) ?? (t ? ctx.today : null), time: t, note: str(a.note) } });
    }
  }
  // Одно дело — дату, сказанную словами («в следующую субботу»), считаем сами
  const tasks = items.filter((i) => i.type === 'task');
  if (tasks.length === 1 && tasks[0].type === 'task') {
    const said = spokenPeriod(transcript, ctx.today);
    const d = tasks[0].data;
    if (said && said.from === said.to) d.date = said.from;
    // «На выходных» — если модель дала дату вне периода, берём его начало
    else if (said && (!d.date || d.date < said.from || d.date > said.to) && addDaysIso(said.from, 1) >= said.to) d.date = said.from;
  }
  // Одна запись в «Смотреть» — тип по слову во фразе («фильм», «сериал», «мультик»), если модель его не дала
  const watches = items.filter((i) => i.type === 'watch');
  if (watches.length === 1 && watches[0].type === 'watch' && !watches[0].data.kind) watches[0].data.kind = spokenKind(transcript);
  if (items.length) return { type: 'items', items };

  // 3. Изменения существующих записей
  const index = new Map<string, ItemType>();
  ctx.existing.tasks.forEach((t) => index.set(t.id, 'task'));
  ctx.existing.watch.forEach((w) => index.set(w.id, 'watch'));
  ctx.existing.wishes.forEach((w) => index.set(w.id, 'wish'));

  const changes: ChangeDraft[] = [];
  let missing = '';
  for (const a of actions.filter((x) => ['update', 'mark', 'unmark', 'delete'].includes(x.intent))) {
    // Только реально существующие id; модель могла дописать префикс «task:»
    const ids = (Array.isArray(a.target) ? a.target : [])
      .map((x) => String(x).replace(/^(task|watch|wish):/, ''))
      .filter((id) => index.has(id));
    if (!ids.length) {
      missing ||= str(a.query) || transcript;
      continue;
    }
    const type = index.get(ids[0])!;
    const candidates = [...new Set(ids.filter((id) => index.get(id) === type))].slice(0, 3);
    const change: ChangeDraft = { key: randomUUID(), action: a.intent as ChangeAction, type, candidates, chosen: candidates[0] };

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
        // Новая дата — то, что сказано после последнего «на / к»: «с пятницы на субботу» → суббота
        const tail = transcript.split(/\s(?:на|к)\s/i).slice(1).at(-1) ?? transcript;
        const dow = plainWeekday(tail);
        const saidDate = spokenPeriod(tail, ctx.today);
        // День недели при переносе — ближайший к старой дате записи
        if (dow !== null && old?.date && patch.date !== undefined) patch.date = nearestWeekday(dow, old.date, ctx.today);
        else if (saidDate && saidDate.from === saidDate.to) patch.date = saidDate.from;
        // Модель вернула «перенос» без изменений по сути — убираем поля, совпадающие со старыми
        if (old && patch.time === old.time && said === null && !('date' in a)) delete patch.time;
      }
      if (!Object.keys(patch).length) continue;
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

export type ParseOutput = { result: ParseResult; raw: string; usage: Usage; attempts: number };

/** Полный разбор: модель → проверка схемы (один повтор) → нормализация */
export async function parseText(text: string, ctx: Context, model?: string): Promise<ParseOutput> {
  if (!text.trim()) return { result: { type: 'unknown' }, raw: '', usage: NO_USAGE, attempts: 0 };
  const messages = buildMessages(text, ctx);
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
