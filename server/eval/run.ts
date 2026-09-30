/**
 * Прогон фраз через настоящую модель и проверка результата.
 *   npm run eval                                  — модель из .env
 *   YANDEX_MODEL=yandexgpt-lite/latest npm run eval — сравнить другую
 *   npm run eval -- дача                           — только фразы, где есть «дача»
 *   npm run eval -- --replay                       — бесплатно: прошлые ответы модели из журнала через новый код
 * Сегодня для тестов всегда пятница 25.09.2026, как в ТЗ.
 */
import { assertConfig, config } from '../src/config.js';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { costOf, writeLog, type LogEntry } from '../src/log.js';
import { extractJson, normalize, parseText, type ParseOutput } from '../src/parse.js';
import { addUsage, NO_USAGE } from '../src/yandex.js';
import type { Context, ParseResult } from '../src/types.js';

assertConfig();

const ctx: Context = {
  today: '2026-09-25',
  now: '12:00',
  me: { id: 'u1', name: 'Саша' },
  people: [
    { id: 'u2', name: 'Маша' },
    { id: 'u3', name: 'Дима' },
    { id: 'u7', name: 'Карина' },
  ],
  groups: [
    { name: 'Семья', category: 'couple' },
    { name: 'Друзья', category: 'friends' },
    { name: 'Футбол', category: 'friends' },
    { name: 'Родители', category: 'parents' },
  ],
  existing: {
    tasks: [
      { id: 't1', title: 'Оплатить интернет', date: '2026-09-23', time: null },
      { id: 't2', title: 'Забрать посылку', date: '2026-09-25', time: '18:30' },
      { id: 't3', title: 'Ужин у родителей', date: '2026-09-26', time: '19:00' },
      { id: 't4', title: 'Поездка на дачу', date: '2026-10-03', time: null },
      { id: 't5', title: 'Забрать документы', date: '2026-10-09', time: null },
      { id: 't7', title: 'Купить лампочки', date: null, time: null },
    ],
    watch: [
      { id: 'm1', title: 'Интерстеллар' },
      { id: 'm2', title: 'Слово пацана' },
      { id: 'm3', title: 'Тед Лассо' },
    ],
    wishes: [
      { id: 'w1', title: 'Новые наушники' },
      { id: 'w2', title: 'Кроссовки New Balance 574', done: false },
    ],
  },
};

type Check = (r: ParseResult) => string | true; // true — ок, строка — что не так

const task = (title: RegExp, d: string | null, t: string | null = null): Check => (r) => {
  if (r.type !== 'items' || r.items.length !== 1 || r.items[0].type !== 'task') return 'ожидалось одно дело';
  const x = r.items[0].data;
  if (!title.test(x.title)) return `название «${x.title}»`;
  if (x.date !== d) return `дата ${x.date}, нужна ${d}`;
  if (x.time !== t) return `время ${x.time}, нужно ${t}`;
  return true;
};
const wish = (title: RegExp, note?: RegExp): Check => (r) => {
  if (r.type !== 'items' || r.items[0]?.type !== 'wish') return 'ожидалась хотелка';
  const x = r.items[0].data;
  if (!title.test(x.title)) return `название «${x.title}»`;
  if (note && !note.test(x.note)) return `заметка «${x.note}»`;
  return true;
};
const watch = (...titles: [RegExp, Partial<{ kind: string; origin: string; year: number }>?][]): Check => (r) => {
  if (r.type !== 'items' || r.items.length !== titles.length) return `ожидалось ${titles.length} в «Смотреть»`;
  for (let i = 0; i < titles.length; i++) {
    const it = r.items[i];
    if (it.type !== 'watch') return 'не «Смотреть»';
    const [re, exp] = titles[i];
    if (!re.test(it.data.title)) return `название «${it.data.title}»`;
    for (const [k, v] of Object.entries(exp ?? {})) if ((it.data as any)[k] !== v) return `${k}=${(it.data as any)[k]}, нужно ${v}`;
  }
  return true;
};
const qWatch = (f: Partial<Record<'kind' | 'genre' | 'origin' | 'fresh', string[]>>): Check => (r) => {
  if (r.type !== 'queryWatch') return 'ожидался вопрос «что посмотреть»';
  for (const [k, v] of Object.entries(f)) {
    const got = (r.filters as any)[k] as string[];
    if (got.join() !== v.join()) return `${k}=[${got}] нужно [${v}]`;
  }
  return true;
};
const qWish = (id: string): Check => (r) => (r.type === 'queryWish' && r.personId === id ? true : `получено ${JSON.stringify(r)}`);
const change = (action: string, id: string, patch?: Record<string, unknown>): Check => (r) => {
  if (r.type !== 'changes') return `ожидалось изменение, получено ${r.type}`;
  const c = r.changes[0];
  if (c.action !== action) return `действие ${c.action}`;
  if (c.chosen !== id) return `запись ${c.chosen}, нужна ${id}`;
  for (const [k, v] of Object.entries(patch ?? {})) if ((c.patch as any)?.[k] !== v) return `${k}=${(c.patch as any)?.[k]}, нужно ${v}`;
  return true;
};
const plans = (scope: Record<string, unknown>, from: string, to: string, query = ''): Check => (r) => {
  if (r.type !== 'queryPlans') return `ожидался вопрос о планах, получено ${r.type}`;
  const p = r.plans;
  for (const [k, v] of Object.entries(scope)) {
    const got = (p.scope as any)[k];
    const ok = Array.isArray(v) ? JSON.stringify(got?.map((x: string) => x.toLowerCase())) === JSON.stringify(v) : got === v;
    if (!ok) return `scope.${k}=${JSON.stringify(got)}, нужно ${JSON.stringify(v)}`;
  }
  if (p.from !== from || p.to !== to) return `период ${p.from}…${p.to}, нужен ${from}…${to}`;
  if (query && !p.query.toLowerCase().includes(query)) return `query «${p.query}»`;
  return true;
};
/** Дело с повтором: название, первая дата, время и правило (частично: freq, weekdays…) */
const repeating = (title: RegExp, d: string, t: string | null, r: Record<string, unknown>): Check => (res) => {
  const base = task(title, d, t)(res);
  if (base !== true) return base;
  const x = (res as Extract<ParseResult, { type: 'items' }>).items[0].data as { repeat?: Record<string, unknown> | null };
  if (!x.repeat) return 'нет повтора';
  for (const [k, v] of Object.entries(r)) if (JSON.stringify(x.repeat[k]) !== JSON.stringify(v)) return `repeat.${k}=${JSON.stringify(x.repeat[k])}, нужно ${JSON.stringify(v)}`;
  return true;
};
const repeatChange = (id: string, r: Record<string, unknown> | null): Check => (res) => {
  if (res.type !== 'changes') return `ожидалось изменение, получено ${res.type}`;
  const c = res.changes[0];
  if (c.chosen !== id) return `запись ${c.chosen}, нужна ${id}`;
  const got = (c.patch as any)?.repeat;
  if (r === null) return got === null ? true : `repeat=${JSON.stringify(got)}, нужно null`;
  if (!got) return 'нет повтора в правке';
  for (const [k, v] of Object.entries(r)) if (JSON.stringify(got[k]) !== JSON.stringify(v)) return `repeat.${k}=${JSON.stringify(got[k])}, нужно ${JSON.stringify(v)}`;
  return true;
};
const is = (type: ParseResult['type']): Check => (r) => (r.type === type ? true : `получено ${r.type}`);

const CASES: [string, Check][] = [
  // Раздел 8 ТЗ
  ['Запиши, что мы едем на дачу в следующую субботу', task(/дач/i, '2026-10-03')],
  ['В субботу в семь ужин у родителей', task(/ужин у родителей/i, '2026-09-26', '19:00')],
  ['Через две недели забрать документы', task(/забрать документы/i, '2026-10-09')],
  // «Звонок в управляющую компанию» — тоже верно, проверяем смысл, а не формулировку
  ['Надо позвонить в управляющую компанию', task(/(позвонить|звонок) в управляющую компанию/i, null)],
  ['Хочу новые наушники', wish(/наушники/i)],
  ['Добавь в мой вишлист кроссовки, сорок второй размер', wish(/^кроссовки$/i, /42/)],
  // Интерстеллар уже есть в списке — важно, что это добавление (приложение покажет «уже есть»), а не отметка
  ['Сохрани фильм Интерстеллар', watch([/интерстеллар/i, { kind: 'movie' }])],
  ['Было бы круто посмотреть Слово пацана', watch([/слово пацана/i, { kind: 'series', origin: 'ru', year: 2023 }])],
  ['Добавь Дюну и Аватар', watch([/дюна/i], [/аватар/i])],
  ['Что посмотрим?', qWatch({ kind: [], genre: [], origin: [], fresh: [] })],
  ['Что-нибудь смешное зарубежное', qWatch({ genre: ['comedy'], origin: ['foreign'] })],
  ['Какой сериал посмотреть из нового?', qWatch({ kind: ['series'], fresh: ['new'] })],
  ['Что подарить Маше?', qWish('u2')],
  ['Что я хотел?', qWish('u1')],
  // Другие формулировки
  ['Завтра в 10 утра к стоматологу', task(/стоматолог/i, '2026-09-26', '10:00')],
  ['Послезавтра забрать машину из сервиса', task(/машин/i, '2026-09-27')],
  ['В воскресенье день рождения Димы', task(/день рождения/i, '2026-09-27')],
  ['Хочу посмотреть мультик Шрэк', watch([/шр[еэ]к/i, { kind: 'cartoon' }])],
  ['Что хочет Дима?', qWish('u3')],
  ['Что подарить Пете?', is('unknownPerson')],
  ['Какой-нибудь наш старый фильм', qWatch({ kind: ['movie'], origin: ['ru'], fresh: ['old'] })],
  // Изменения
  ['Перенеси дачу на воскресенье', change('update', 't4', { date: '2026-10-04' })],
  ['Перенеси ужин на восемь', change('update', 't3', { time: '20:00' })],
  ['Мы посмотрели Интерстеллар', change('mark', 'm1')],
  ['Сделал оплату интернета', change('mark', 't1')],
  ['Мне подарили наушники', change('mark', 'w1')],
  ['Удали ужин у родителей', change('delete', 't3')],
  ['Переименуй лампочки в купить лампочки и батарейки', change('update', 't7')],
  ['Верни посылку в невыполненные', change('unmark', 't2')],
  ['Удали слона', is('notFound')],
  // Повторы
  ['Баня каждую субботу', repeating(/^баня$/i, '2026-09-26', null, { freq: 'week', weekdays: [6] })],
  ['Каждую субботу в три баня', repeating(/^баня$/i, '2026-09-26', '15:00', { freq: 'week', weekdays: [6] })],
  ['По будням зарядка в 8 утра', repeating(/зарядк/i, '2026-09-25', '08:00', { freq: 'week', weekdays: [1, 2, 3, 4, 5] })],
  ['Каждый день пить витамины', repeating(/витамин/i, '2026-09-25', null, { freq: 'day', every: 1 })],
  ['Раз в две недели по средам уборка', repeating(/уборк/i, '2026-09-30', null, { freq: 'week', every: 2, weekdays: [3] })],
  ['Оплатить интернет каждое 20 число', repeating(/интернет/i, '2026-10-20', null, { freq: 'month', monthDays: [20] })],
  ['Каждый год 8 марта поздравить маму', repeating(/поздрав/i, '2027-03-08', null, { freq: 'year', months: [3], monthDays: [8] })],
  ['Ужин у родителей теперь каждое воскресенье', repeatChange('t3', { freq: 'week', weekdays: [7] })],
  ['Больше не повторяй ужин у родителей', repeatChange('t3', null)],
  // Вопросы о планах
  ['Какие у нас с Кариной планы на следующую субботу?', plans({ kind: 'people', names: ['карина'] }, '2026-10-03', '2026-10-03')],
  ['Какие у наших друзей планы на выходные?', plans({ kind: 'category', category: 'friends' }, '2026-09-26', '2026-09-27')],
  ['Что у нас на выходных?', plans({ kind: 'us' }, '2026-09-26', '2026-09-27')],
  ['Какие планы у родителей на следующей неделе?', plans({ kind: 'category', category: 'parents' }, '2026-09-28', '2026-10-04')],
  ['Что у нас в Футболе в воскресенье?', plans({ kind: 'groups', names: ['футбол'] }, '2026-09-27', '2026-09-27')],
  ['Когда у нас дача?', plans({ kind: 'us' }, '2026-09-25', '2027-09-25', 'дач')],
  ['Какие у нас планы на завтра?', plans({ kind: 'us' }, '2026-09-26', '2026-09-26')],
  // Мусор
  ['ммм', is('unknown')],
  ['Какая погода завтра', is('unknown')],
];

const args = process.argv.slice(2);
const replay = args.includes('--replay');
const filter = args.filter((a) => a !== '--replay').join(' ').toLowerCase();

/** Последние ответы модели на фразы eval из журнала — чтобы проверять правки кода без затрат на токены */
async function lastRaws(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let files: string[] = [];
  try {
    files = (await readdir(config.logDir)).filter((f) => f.endsWith('.jsonl')).sort();
  } catch {
    return map;
  }
  for (const f of files)
    for (const line of (await readFile(join(config.logDir, f), 'utf8')).split('\n')) {
      try {
        const e = JSON.parse(line) as LogEntry;
        if (e.source === 'eval' && e.model === config.model && e.raw) map.set(e.transcript, e.raw);
      } catch {
        /* пустая или битая строка */
      }
    }
  return map;
}
const raws = replay ? await lastRaws() : null;

async function run(phrase: string): Promise<ParseOutput | null> {
  if (!raws) return parseText(phrase, ctx);
  const raw = raws.get(phrase);
  if (!raw) return null;
  let result: ParseOutput['result'] = { type: 'unknown' };
  try {
    const actions = (extractJson(raw) as { actions?: unknown }).actions;
    if (Array.isArray(actions) && actions.length) result = normalize(actions as Parameters<typeof normalize>[0], ctx, phrase);
  } catch {
    /* не JSON — unknown, как на сервере */
  }
  return { result, raw, usage: NO_USAGE, attempts: 0 };
}
const cases = CASES.filter(([p]) => !filter || p.toLowerCase().includes(filter));

console.log(`Модель: ${config.model} · фраз: ${cases.length}${replay ? ' · повтор по журналу, без вызовов модели' : ''}\n`);
let skipped = 0;
let ok = 0;
let spent = NO_USAGE;
const times: number[] = [];
for (const [phrase, check] of cases) {
  const t0 = Date.now();
  try {
    const out = await run(phrase);
    if (!out) {
      skipped++;
      console.log(`·   нет в журнале  ${phrase}`);
      continue;
    }
    const { result, raw, usage, attempts } = out;
    const ms = Date.now() - t0;
    times.push(ms);
    spent = addUsage(spent, usage);
    const verdict = check(result);
    const tk = `${String(usage.total).padStart(5)} ток`;
    if (!replay) await writeLog({ source: 'eval', transcript: phrase, result: result.type, detail: result, raw, attempts, tokens: usage, llmMs: ms, pass: verdict === true });
    if (verdict === true) {
      ok++;
      console.log(`✓ ${String(ms).padStart(5)} мс ${tk}  ${phrase}`);
    } else {
      console.log(`✗ ${String(ms).padStart(5)} мс ${tk}  ${phrase}\n      ${verdict}\n      модель: ${raw.replace(/\s+/g, ' ').slice(0, 400)}`);
    }
  } catch (e) {
    const err = e as Error & { cause?: { code?: string; message?: string } };
    const cause = err.cause ? ` (${err.cause.code ?? ''} ${err.cause.message ?? ''})`.replace(/\s+\)/, ')') : '';
    console.log(`✗ ошибка  ${phrase}\n      ${err.message}${cause}`);
    if (err.message === 'fetch failed') {
      console.log('\nНет соединения с Яндексом — дальше проверять бессмысленно.');
      console.log('Проверьте: curl -sS -o /dev/null -w "%{http_code}\\n" https://llm.api.cloud.yandex.net/foundationModels/v1/completion');
      console.log('Ожидается 401 или 400 — значит сеть есть. Если ошибка/таймаут — мешает VPN или прокси.\n');
      process.exit(1);
    }
  }
}
times.sort((a, b) => a - b);
const median = times[Math.floor(times.length / 2)] ?? 0;
console.log(`\nИтог: ${ok}/${cases.length - skipped} верно${skipped ? ` (${skipped} нет в журнале)` : ''}${replay ? '' : ` · медиана ${median} мс`}`);
if (!replay)
console.log(`Токены: ${spent.input} вход + ${spent.output} выход = ${spent.total} · ≈ ${costOf(spent, config.model).toFixed(2)} ₽ · в среднем ${Math.round(spent.total / Math.max(1, cases.length))} на фразу`);
