/**
 * Оценки голосовых команд (страница /admin → «Скачать») → материал для дообучения своей модели.
 *
 *   npx tsx train/from-ratings.ts ~/Downloads/ratings-2026-11-12.json
 *
 * 👍 с ответом модели → ~/kstati/private/ratings-train.jsonl (его берёт train/to-chat.ts вместе с живыми фразами).
 * 👎 → ~/kstati/private/ratings-review.md: фраза, что получилось и что человек хотел — разметить вручную или через
 * учителя и добавить фразу в private/phrases.txt. Команды, разобранные правилами без модели, модели не учат — только в обзор.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractJson } from '../src/parse.js';
import { buildTunedMessages } from '../src/prompt.js';
import type { Rating } from '../src/ratings.js';

const file = process.argv[2];
if (!file) {
  console.error('Укажите файл с оценками: npx tsx train/from-ratings.ts ~/Downloads/ratings-….json');
  process.exit(1);
}
const PRIVATE = join(process.cwd(), '..', 'private');
const ratings = JSON.parse(readFileSync(file, 'utf8')) as Rating[];

const actionsOf = (raw: string): unknown[] | null => {
  try {
    const j = extractJson(raw) as { actions?: unknown[] } | null;
    return j && Array.isArray(j.actions) ? j.actions : null;
  } catch {
    return null;
  }
};

const rows: string[] = [];
const review: string[] = ['# Команды с оценкой «неверно»', ''];
let rules = 0;
for (const r of ratings) {
  const acts = r.path === 'rules' ? null : actionsOf(r.raw);
  if (r.good) {
    if (!acts) {
      rules++;
      continue;
    }
    const [system, user] = buildTunedMessages(r.transcript, r.context);
    rows.push(JSON.stringify({ request: [system, user], response: JSON.stringify({ actions: acts }) }));
    continue;
  }
  review.push(
    `## «${r.transcript}»`,
    '',
    `- когда: ${r.ts.slice(0, 16).replace('T', ' ')}, модель: ${r.model}`,
    `- хотели: ${r.wish || '—'}`,
    `- получилось: \`${JSON.stringify(r.result).slice(0, 400)}\``,
    `- ответ модели: \`${r.raw.slice(0, 400)}\``,
    '',
  );
}
const bad = ratings.filter((r) => !r.good).length;
writeFileSync(join(PRIVATE, 'ratings-train.jsonl'), rows.join('\n') + (rows.length ? '\n' : ''));
writeFileSync(join(PRIVATE, 'ratings-review.md'), review.join('\n'));
console.log(`Оценок ${ratings.length}: верно ${ratings.length - bad} (в обучение ${rows.length}, разобраны правилами ${rules}), неверно ${bad} → private/ratings-review.md`);
