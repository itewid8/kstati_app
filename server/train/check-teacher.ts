/**
 * Облачная модель (учитель) на той же проверке, что и своя: те же фразы, тот же код сервера целиком —
 * чистка фразы, простые команды правилами, модель, разбор ответа (parseText, как в проде).
 * Нужно, чтобы знать, сколько набирает сама облачная модель: без этого непонятно, далеко ли до неё своей.
 *
 *   npx tsx train/check-teacher.ts [сколько, по умолчанию 300] [набор: ood | valid] [модель]
 *
 * Запросы платные. MAX_RUB (по умолчанию 200) — предел расходов: дошли до него — останавливаемся и считаем по тому, что есть.
 * Итог — в train/out/chat/results.txt, промахи — в train/out/chat/misses-<набор>-teacher.txt.
 */
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Context } from '../src/types.js';

// Учитель — облачная модель с обычным промптом, даже если в .env включена своя (PROMPT_MODE=tuned, LLM_BASE_URL)
if (!process.env.TEACHER_KEEP_ENV) {
  process.env.PROMPT_MODE = 'compact';
  process.env.LLM_BASE_URL = '';
}
const { normalize, parseText } = await import('../src/parse.js');
const { costOf } = await import('../src/log.js');

type Msg = { role: string; content: string };
const limit = Number(process.argv[2] ?? 300);
const set = process.argv[3] === 'valid' ? 'valid' : 'ood';
const model = process.argv[4] ?? process.env.TEACHER_MODEL ?? 'aliceai-llm-flash/latest';
const maxRub = Number(process.env.MAX_RUB ?? 200);
const dir = join(process.cwd(), 'train', 'out', 'chat');
const lines = (f: string) => readFileSync(join(dir, f), 'utf8').split('\n').filter(Boolean);
const allRows = lines(`${set}.jsonl`).map((l) => (JSON.parse(l) as { messages: Msg[] }).messages);
const metas = lines(`${set}-ctx.jsonl`).map((l) => JSON.parse(l) as { ctx: Context | null; variant?: string });

// Те же фразы, что берёт train/check-valid.ts: каждая один раз, равномерно по набору
const phraseOf = (m: Msg[]) => /Фраза: «([\s\S]*)»\s*$/.exec(m[1]!.content)?.[1] ?? '';
const firstOf = new Map<string, number>();
allRows.forEach((m, i) => {
  const k = phraseOf(m).toLowerCase().replace(/[?!.,:]/g, '').trim();
  if (!firstOf.has(k)) firstOf.set(k, i);
});
const uniqIdx = [...firstOf.values()];
const step = Math.max(1, uniqIdx.length / limit);
const picked = Array.from({ length: Math.min(limit, uniqIdx.length) }, (_, k) => uniqIdx[Math.floor(k * step)]!);

const view = (r: unknown) => JSON.stringify(r, (k, v: unknown) => (k === 'key' ? undefined : typeof v === 'string' ? v.toLowerCase().replace(/ё/g, 'е').replace(/[.!]+$/, '') : v));
const byKind = new Map<string, { n: number; ok: number }>();
const misses: string[] = [];
let ok = 0;
let done = 0;
let rub = 0;
let byRules = 0;
let failed = 0;
for (const i of picked) {
  const m = allRows[i]!;
  const ctx = metas[i]?.ctx;
  if (!ctx) continue;
  const phrase = phraseOf(m);
  const want = normalize((JSON.parse(m[2]!.content) as { actions: never[] }).actions, ctx, phrase);
  let got: unknown = null;
  let raw = '';
  try {
    const out = await parseText(phrase, ctx, model);
    got = out.result;
    raw = out.raw;
    rub += costOf(out.usage, model);
    if (out.path === 'rules') byRules++;
  } catch (e) {
    failed++;
    raw = `ошибка: ${String(e).slice(0, 200)}`;
  }
  done++;
  const hit = !!got && view(got) === view(want);
  const kind = metas[i]?.variant || '—';
  const k = byKind.get(kind) ?? { n: 0, ok: 0 };
  k.n++;
  if (hit) {
    ok++;
    k.ok++;
  } else misses.push(`✗ ${phrase}\n   нужно: ${m[2]!.content}\n   модель: ${raw}\n   вышло: ${JSON.stringify(got)}`);
  byKind.set(kind, k);
  process.stdout.write(`\r${done}/${picked.length} · ${rub.toFixed(1)} ₽`);
  if (rub >= maxRub) {
    console.log(`\nПредел расходов ${maxRub} ₽ — останавливаемся`);
    break;
  }
}
const pct = (a: number, b: number) => `${Math.round((100 * a) / Math.max(1, b))}%`;
console.log(`\n[${set}] ${model}: верно ${ok}/${done} (${pct(ok, done)}) · правилами без модели ${byRules} · ошибок запроса ${failed} · потрачено ${rub.toFixed(2)} ₽`);
console.log('\nПо видам команд, от худших:');
for (const [name, v] of [...byKind].sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n)) console.log(`${pct(v.ok, v.n).padStart(5)}  ${String(v.ok).padStart(3)}/${String(v.n).padEnd(3)}  ${name}`);
writeFileSync(join(dir, `misses-${set}-teacher.txt`), misses.join('\n') + '\n');
appendFileSync(join(dir, 'results.txt'), `${new Date().toISOString().slice(0, 16)} ${model} (сервер целиком) [${set}] верно ${pct(ok, done)} · фраз ${done} · ${rub.toFixed(2)} ₽\n`);
console.log(`\nПромахи: train/out/chat/misses-${set}-teacher.txt`);
