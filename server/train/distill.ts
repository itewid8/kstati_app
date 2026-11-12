/**
 * Живые фразы в набор для своей модели: каждую разбирает большая модель (учитель) тем же кодом сервера,
 * понятый ответ становится примером для обучения. Так модель учится на том, как говорят на самом деле.
 *
 *   ~/kstati/private/phrases.txt — по фразе в строке (файл вне репозитория)
 *   npx tsx train/distill.ts [файл] [модель-учитель]
 *   → ~/kstati/private/distill.jsonl (берёт train/to-chat.ts) и distill-review.txt — что понял учитель, для просмотра
 *
 * Правки записей («удали», «перенеси») зависят от того, что лежит в приложении, — их не берём: учить им надо
 * на генераторе, где записи известны. Фразы, которые сервер разбирает правилами без модели, тоже не нужны.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractJson, parseText, type ParseOutput } from '../src/parse.js';
import { buildTunedMessages } from '../src/prompt.js';
import type { Context } from '../src/types.js';

const PRIVATE = join(process.cwd(), '..', 'private');
const file = process.argv[2] ?? join(PRIVATE, 'phrases.txt');
const teacher = process.argv[3] ?? process.env.TEACHER_MODEL ?? 'aliceai-llm-flash/latest';
if (!existsSync(file)) {
  console.error(`Нет файла с фразами: ${file}`);
  process.exit(1);
}

const phrases = [...new Set(readFileSync(file, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')))];

// Два дня недели — чтобы «завтра», «в субботу», «на выходных» модель видела от разных «сегодня»
const ctxOf = (today: string, now: string): Context => ({
  today,
  now,
  me: { id: 'u1', name: 'Саша' },
  people: [
    { id: 'u2', name: 'Карина' },
    { id: 'u3', name: 'Дима' },
    { id: 'u4', name: 'Маша' },
  ],
  groups: [
    { name: 'Семья', category: 'couple' },
    { name: 'Друзья', category: 'friends' },
  ],
  topics: [{ id: 'p1', title: 'Подарки' }],
  existing: {
    tasks: [
      { id: 't1', title: 'Оплатить интернет', date: today, time: null },
      { id: 't2', title: 'Ужин у родителей', date: today, time: '19:00' },
    ],
    watch: [{ id: 'm1', title: 'Интерстеллар' }],
    wishes: [{ id: 'w1', title: 'Новые наушники' }],
    ideas: [],
  },
});
const contexts = [ctxOf('2026-11-12', '09:40'), ctxOf('2026-11-14', '21:15')];

const KEEP = new Set(['items', 'queryWatch', 'queryWish', 'queryPlans', 'unknown', 'queryIdeas']);
const rows: string[] = [];
const review: string[] = [];
let skipped = 0;

for (const [i, phrase] of phrases.entries()) {
  const ctx = contexts[i % contexts.length]!;
  let out: ParseOutput;
  try {
    out = await parseText(phrase, ctx, teacher);
  } catch (e) {
    review.push(`!  ${phrase}\n   ошибка: ${String(e)}`);
    skipped++;
    continue;
  }
  const kind = out.result.type;
  if (out.path === 'rules' || out.raw === '' || !KEEP.has(kind)) {
    review.push(`–  ${phrase}\n   пропущено: ${out.path === 'rules' ? 'разобрано правилами' : kind}`);
    skipped++;
    continue;
  }
  const json = extractJson(out.raw) as { actions?: unknown[] } | null;
  if (!json || !Array.isArray(json.actions)) {
    skipped++;
    continue;
  }
  const [system, user] = buildTunedMessages(phrase, ctx);
  rows.push(JSON.stringify({ request: [system, user], response: JSON.stringify({ actions: json.actions }) }));
  review.push(`✓  ${phrase}\n   ${kind}: ${JSON.stringify(json.actions)}`);
  process.stdout.write(`\r${i + 1}/${phrases.length}`);
}

writeFileSync(join(PRIVATE, 'distill.jsonl'), rows.join('\n') + (rows.length ? '\n' : ''));
writeFileSync(join(PRIVATE, 'distill-review.txt'), review.join('\n') + '\n');
console.log(`\nУчитель ${teacher}: в набор ${rows.length}, пропущено ${skipped} → private/distill.jsonl, private/distill-review.txt`);
