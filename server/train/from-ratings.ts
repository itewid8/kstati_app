/**
 * Оценки голосовых команд (страница /admin → «Скачать») → фразы для дообучения своей модели.
 *
 *   npx tsx train/from-ratings.ts ~/Downloads/ratings-2026-11-13.json
 *
 * В оценках только сказанные фразы — без записей и людей человека. Поэтому сами оценки модель не учат:
 * 👍 — фраза добавляется в ~/kstati/private/phrases.txt, её размечает учитель (train/distill.ts) в учебном контексте;
 * 👎 — в ~/kstati/private/ratings-review.md: фраза, что сделало приложение и что человек хотел. Это ошибки —
 * их чинят правилами сервера или добавляют в phrases.txt, проверив разметку учителя (private/distill-review.txt).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Rating } from '../src/ratings.js';

const file = process.argv[2];
if (!file) {
  console.error('Укажите файл с оценками: npx tsx train/from-ratings.ts ~/Downloads/ratings-….json');
  process.exit(1);
}
const PRIVATE = join(process.cwd(), '..', 'private');
const PHRASES = join(PRIVATE, 'phrases.txt');
// Выгрузки до 13.11 хранили контекст разбора целиком — день берём из него, описание результата — сам результат
type Old = { context?: { today: string; now: string }; result?: unknown };
const ratings = (JSON.parse(readFileSync(file, 'utf8')) as (Rating & Old)[]).map((r) => ({
  ...r,
  today: r.today ?? r.context?.today ?? '',
  now: r.now ?? r.context?.now ?? '',
  did: r.did ?? JSON.stringify(r.result ?? null).slice(0, 300),
}));

const key = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[?!.,]/g, '').replace(/\s+/g, ' ').trim();
const have = existsSync(PHRASES) ? readFileSync(PHRASES, 'utf8') : '';
const known = new Set(have.split('\n').map(key));

// Последняя оценка фразы решает: сначала 👎, потом 👍 после исправления — значит, верно
const last = new Map<string, (typeof ratings)[number]>();
for (const r of [...ratings].sort((a, b) => a.ratedAt.localeCompare(b.ratedAt))) last.set(key(r.transcript), r);

const add: string[] = [];
const review: string[] = ['# Команды с оценкой «неверно»', ''];
let bad = 0;
for (const r of last.values()) {
  if (r.good) {
    if (!known.has(key(r.transcript))) add.push(r.transcript.trim());
    continue;
  }
  bad++;
  review.push(
    `## «${r.transcript}»`,
    '',
    `- когда: ${r.today} ${r.now}, разбор: ${r.model}`,
    `- хотели: ${r.wish || '—'}`,
    `- сделано: ${r.did}`,
    `- ответ модели: \`${r.raw.slice(0, 300)}\``,
    '',
  );
}
if (add.length) writeFileSync(PHRASES, `${have.replace(/\n*$/, '\n')}# из оценок ${new Date().toISOString().slice(0, 10)}\n${add.join('\n')}\n`);
writeFileSync(join(PRIVATE, 'ratings-review.md'), review.join('\n'));
console.log(`Оценок ${ratings.length} (фраз ${last.size}): верно ${last.size - bad}, из них новых в phrases.txt ${add.length}; неверно ${bad} → private/ratings-review.md`);
