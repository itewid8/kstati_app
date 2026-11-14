/**
 * Карточки для «Обучения» в приложении (src/practice.ts): data/practice.jsonl.gz.
 *
 *   npx tsx train/practice-deck.ts
 *
 * Карточка — фраза, как её говорит человек (без искажений распознавания), учебный набор записей и образец ответа.
 * Берутся свежие выгрузки генератора: из словаря обучения — только фразы, которые по правилу train/to-chat.ts
 * уходят в проверку и в обучение не попадают; из словаря train/catalog-test.ts — все. Так по карточкам честно видно,
 * как модель понимает, а не как помнит. К простым командам добавляется задание «своими словами».
 * Каждая десятая карточка — контрольная: её попытки не идут ни в обучение, ни в словарь исправлений.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { normalize } from '../src/parse.js';
import { dayLabel, type Card } from '../src/practice.js';
import { resultKey } from '../src/practiceCheck.js';
import { cleanSpeech, normalizeTimes } from '../src/spoken.js';
import type { Context, ParseResult } from '../src/types.js';

type Row = { request: { role: string; text: string }[]; response: string; ctx: Context; variant: string; said?: string };

const PER_VARIANT = { base: 110, test: 50 };
const tsx = process.env.TSX ?? join(process.cwd(), 'node_modules', '.bin', 'tsx');
const tmp = mkdtempSync(join(tmpdir(), 'kstati-deck-'));
const generate = (seed: number, vocab: 'train' | 'test'): Row[] => {
  const dir = join(tmp, `${vocab}${seed}`);
  execFileSync(tsx, [join('train', 'generate.ts'), String(seed)], { encoding: 'utf8', env: { ...process.env, TRAIN_ROOT: dir, TRAIN_VOCAB: vocab } });
  return ['train.jsonl', 'valid.jsonl'].flatMap((f) => {
    const file = join(dir, 'out', f);
    return existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as Row) : [];
  });
};

// То же правило, что в train/to-chat.ts: фраза с таким хэшем в обучение не идёт
const phraseOf = (r: Row) => /Фраза: «([\s\S]*)»\s*$/.exec(r.request.at(-1)?.text ?? '')?.[1]?.toLowerCase() ?? '';
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const held = (r: Row) => hash(phraseOf(r)) % 10 === 0;

/* ---------- задание своими словами ---------- */

const when = (date: string | null | undefined, time: string | null | undefined) =>
  date ? `${dayLabel(date)}${time ? ` в ${time}` : ''}` : time ? `в ${time}, день не важен` : 'без даты';
const empty = (v: unknown) => v == null || v === '' || (Array.isArray(v) && !v.length);

/** Задание по итогу разбора; null — команду коротко не описать (повторы, участники, списки), карточка только с фразой */
function briefOf(r: ParseResult, ctx: Context): string[] | null {
  const titleOf = (id: string) => [...ctx.existing.tasks, ...ctx.existing.watch, ...ctx.existing.wishes].find((x) => x.id === id)?.title;
  if (r.type === 'items') {
    if (r.items.length !== 1) return null;
    const it = r.items[0]!;
    if (it.type === 'task') {
      const d = it.data;
      if (![d.note, d.repeat, d.endDate, d.endTime, d.people, d.parentId, d.kind].every(empty)) return null;
      return [`Записать дело: ${d.title}`, `Когда: ${when(d.date, d.time)}`];
    }
    if (it.type === 'wish') return empty(it.data.note) && empty(it.data.link) ? [`Добавить в «Хочу»: ${it.data.title}`] : null;
    if (it.type === 'watch') return empty(it.data.kind) && empty(it.data.genres) ? [`Добавить в «Смотреть»: ${it.data.title}`] : null;
    if (it.type === 'idea') {
      const topic = ctx.topics?.find((t) => t.id === it.data.topicId)?.title;
      if (it.data.topicId && !topic) return null;
      return [`Записать заметку: ${it.data.title.replace(/\.$/, '')}`, ...(topic ? [`В тему: ${topic}`] : []), ...(it.data.newTopic ? [`В новую тему: ${it.data.newTopic}`] : [])];
    }
    // Тема или список: новый — с пунктами; правка — что поменять
    const lines = (it.data.body ?? '').split('\n').map((l) => l.replace(/^- \[[ x]\] /, '').trim()).filter(Boolean);
    if (!it.id) return lines.length ? [`Создать список: ${it.data.title}`, `Пункты: ${lines.join(', ')}`] : [`Создать тему: ${it.data.title}`];
    const changes = (it.data.changes ?? []).map((c) =>
      c.startsWith('✓ ') ? `Отметить готовым: ${c.slice(2)}` : c.startsWith('+ ') ? `Добавить: ${c.slice(2)}` : /^[−-] /.test(c) ? `Убрать: ${c.slice(2)}` : `Изменить: ${c}`,
    );
    return changes.length ? [`В списке: ${it.data.title}`, ...changes] : null;
  }
  if (r.type === 'changes') {
    if (r.changes.length !== 1) return null;
    const c = r.changes[0]!;
    const title = titleOf(c.chosen);
    if (!title || c.occ || c.type === 'idea') return null;
    const what = c.type === 'task' ? 'дело' : c.type === 'wish' ? 'хотелку' : 'запись в «Смотреть»';
    if (c.action === 'delete') return [`Удалить ${what}: ${title}`];
    if (c.action === 'mark') return [`Отметить ${c.type === 'task' ? 'сделанным' : c.type === 'wish' ? 'полученным' : 'просмотренным'}: ${title}`];
    if (c.action === 'unmark') return [`Снять отметку: ${title}`];
    const p = c.patch ?? {};
    const keys = Object.keys(p).filter((k) => !empty((p as Record<string, unknown>)[k]));
    if (!keys.length || keys.some((k) => !['title', 'date', 'time'].includes(k))) return null;
    return [
      `Изменить ${what}: ${title}`,
      ...(p.title ? [`Новое название: ${p.title}`] : []),
      ...(p.date ? [`Новый день: ${dayLabel(p.date)}`] : []),
      ...(p.time ? [`Новое время: ${p.time}`] : []),
    ];
  }
  if (r.type === 'queryPlans') {
    const s = r.plans.scope.kind;
    if ((s !== 'me' && s !== 'us') || r.plans.who?.length) return null;
    const period = r.plans.from === r.plans.to ? dayLabel(r.plans.from) : `${dayLabel(r.plans.from)} — ${dayLabel(r.plans.to)}`;
    return r.plans.query ? [`Спросить, когда: ${r.plans.query}`] : [`Спросить о планах: ${s === 'me' ? 'мои' : 'наши'}`, `Период: ${period}`];
  }
  if (r.type === 'queryWatch') return Object.values(r.filters).every((f) => !f.length) ? ['Спросить, что посмотреть'] : null;
  if (r.type === 'queryWish') {
    if (r.personId === ctx.me.id) return ['Открыть свои хотелки'];
    const name = ctx.people.find((p) => p.id === r.personId)?.name;
    return name ? [`Спросить, что подарить: ${name}`] : null;
  }
  if (r.type === 'queryIdeas') {
    if (r.topicId === null) return ['Открыть список тем'];
    const topic = ctx.topics?.find((t) => t.id === r.topicId)?.title;
    return topic ? [`Открыть тему: ${topic}`] : null;
  }
  return null;
}

/* ---------- сборка ---------- */

const cards = new Map<string, Card>();
const drop = { noSaid: 0, differs: 0, dup: 0 };
const add = (rows: Row[], vocab: Card['vocab']) => {
  for (const r of rows) {
    const said = r.said?.trim();
    if (!said) {
      drop.noSaid++;
      continue;
    }
    const actions = (JSON.parse(r.response) as { actions: unknown[] }).actions;
    let want: ParseResult;
    try {
      // Образец по чистой фразе должен давать то же, что по фразе генератора (с искажениями распознавания)
      want = normalize(actions as never, r.ctx, cleanSpeech(normalizeTimes(said)));
      if (resultKey(want) !== resultKey(normalize(actions as never, r.ctx, phraseOf(r) && r.request.at(-1)!.text.match(/Фраза: «([\s\S]*)»\s*$/)![1]!))) {
        drop.differs++;
        continue;
      }
    } catch {
      drop.differs++;
      continue;
    }
    const key = said.toLowerCase().replace(/ё/g, 'е').replace(/[?!.,]/g, '');
    if (cards.has(key)) {
      drop.dup++;
      continue;
    }
    const id = `c${createHash('sha1').update(`${key}|${r.ctx.today}`).digest('hex').slice(0, 10)}`;
    cards.set(key, { id, variant: r.variant, vocab, phrase: said, brief: briefOf(want, r.ctx), ctx: r.ctx, actions, control: parseInt(id.slice(-2), 16) % 10 === 0 });
  }
};
add([301, 302, 303, 304].flatMap((s) => generate(s, 'train')).filter(held), 'base');
add(generate(311, 'test'), 'test');

// Поровну по видам команд — иначе частые виды вытеснят редкие; порядок по id — сборка воспроизводима
const out: Card[] = [];
const count = new Map<string, number>();
for (const c of [...cards.values()].sort((a, b) => a.id.localeCompare(b.id))) {
  const k = `${c.vocab}|${c.variant}`;
  const n = count.get(k) ?? 0;
  if (n >= PER_VARIANT[c.vocab]) continue;
  count.set(k, n + 1);
  out.push(c);
}
mkdirSync(join(process.cwd(), 'data'), { recursive: true });
const file = join(process.cwd(), 'data', 'practice.jsonl.gz');
writeFileSync(file, gzipSync(out.map((c) => JSON.stringify(c)).join('\n') + '\n'));
const variants = [...new Set(out.map((c) => c.variant))].sort();
console.log(`Карточек ${out.length}: словарь обучения ${out.filter((c) => c.vocab === 'base').length}, незнакомые слова ${out.filter((c) => c.vocab === 'test').length}`);
console.log(`С заданием своими словами ${out.filter((c) => c.brief).length}, контрольных ${out.filter((c) => c.control).length}`);
console.log(`Отброшено: без чистой фразы ${drop.noSaid}, образец по чистой фразе другой ${drop.differs}, повторов ${drop.dup}`);
console.log(variants.map((v) => `${v} ${out.filter((c) => c.variant === v).length}`).join(' · '));
console.log(`→ ${file}`);
