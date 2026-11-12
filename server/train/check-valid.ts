/**
 * Проверка своей модели на отложенных примерах набора (train/out/chat/valid.jsonl) — фразах, которых она не видела.
 * Экзамен eval/run.ts почти весь закрыт правилами сервера; здесь видно, как модель понимает сама.
 *
 *   mlx_lm.server … --port 8080   (в другом окне)
 *   npx tsx train/check-valid.ts [сколько, по умолчанию 300] [набор: valid | ood] [пометка, например v6]
 *
 * valid — отложенные фразы из тех же слов, что в обучении; ood — фразы из слов, которых в обучении нет
 * (train/catalog-test.ts). Вторая цифра честнее: живые люди говорят то, чего в словаре не было.
 * Ответы модели сохраняются в train/out/chat/raw-<набор>-<пометка>.jsonl. REPLAY=1 с той же пометкой — пересчёт по
 * сохранённым ответам без модели: так правки сервера (src/parse.ts) проверяются за секунды.
 *   REPLAY=1 npx tsx train/check-valid.ts 800 ood v7
 * Модель в облачном контейнере: LLM_BASE_URL=<адрес контейнера> и OWN_LLM_KEY=<ключ> перед командой.
 * Итог дописывается в train/out/chat/results.txt — версии модели сравниваются по одному и тому же набору ood.
 *
 * Каждая фраза проверяется один раз, фразы берутся равномерно по набору.
 * «Точно» — ответ модели совпал с образцом слово в слово; «после сервера» — ответ, разобранный кодом сервера
 * (даты по сказанному, сверка цели и т. п.), дал то же, что образец, — это и видит человек в приложении;
 * «то же действие» — совпали намерения и типы записей.
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractJson, normalize, onlyFiller } from '../src/parse.js';
import type { Context } from '../src/types.js';

type Msg = { role: string; content: string };
const url = (process.env.LLM_BASE_URL || 'http://127.0.0.1:8080').replace(/\/+$/, '') + '/v1/chat/completions';
const limit = Number(process.argv[2] ?? 300);
const set = process.argv[3] === 'ood' ? 'ood' : 'valid';
const label = process.argv[4] ?? '';
const allRows = readFileSync(join(process.cwd(), 'train', 'out', 'chat', `${set}.jsonl`), 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => (JSON.parse(l) as { messages: Msg[] }).messages);
let allCtx: (Context | null)[] = [];
let allKind: string[] = [];
try {
  // Строка — {ctx, variant}; в старых наборах — просто контекст
  const metas = readFileSync(join(process.cwd(), 'train', 'out', 'chat', `${set}-ctx.jsonl`), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as { ctx?: Context | null; variant?: string } | Context | null);
  allCtx = metas.map((m) => (m && 'ctx' in m ? (m.ctx ?? null) : (m as Context | null)));
  allKind = metas.map((m) => (m && 'variant' in m ? (m.variant ?? '') : ''));
} catch {
  // старый набор без контекста — считаем только «точно»
}
// Каждая фраза — один раз (в наборе она встречается в разных контекстах, и один промах иначе считается многократно);
// фразы берём равномерно по всему набору, чтобы в выборку попали все виды команд
const phraseKey = (m: Msg[]) => (/Фраза: «([\s\S]*)»\s*$/.exec(m[1]!.content)?.[1] ?? '').toLowerCase().replace(/[?!.,:]/g, '').trim();
const firstOf = new Map<string, number>();
allRows.forEach((m, i) => {
  if (!firstOf.has(phraseKey(m))) firstOf.set(phraseKey(m), i);
});
const uniqIdx = [...firstOf.values()];
const step = Math.max(1, uniqIdx.length / limit);
const picked = Array.from({ length: Math.min(limit, uniqIdx.length) }, (_, k) => uniqIdx[Math.floor(k * step)]!);
const rows = picked.map((i) => allRows[i]!);
const ctxs = picked.map((i) => allCtx[i] ?? null);
const kinds = picked.map((i) => allKind[i] ?? '');
const byKind = new Map<string, { n: number; ok: number }>();

// Ключи правок случайные — при сравнении не нужны
const served = (acts: Act[] | null, ctx: Context | null, phrase: string) => {
  if (!acts || !ctx) return null;
  try {
    // «ё» распознавание речи обычно отдаёт как «е» — вернуть её модель не может; регистр и точка в конце человеку не видны как ошибка
    return JSON.stringify(normalize(acts as never, ctx, phrase), (k, v: unknown) => (k === 'key' ? undefined : typeof v === 'string' ? v.toLowerCase().replace(/ё/g, 'е').replace(/[.!]+$/, '') : v));
  } catch {
    return 'ошибка';
  }
};

type Act = Record<string, unknown>;
const actsOf = (text: string): Act[] | null => {
  // Модель могла ответить не JSON — это промах, а не остановка проверки
  try {
    const j = extractJson(text) as { actions?: Act[] } | null;
    return j && Array.isArray(j.actions) ? j.actions : null;
  } catch {
    return null;
  }
};
const canon = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, canon(x)])) : typeof v === 'string' ? v.toLowerCase().replace(/ё/g, 'е').trim() : v;
const shape = (a: Act[]) => a.map((x) => `${String(x.intent)}:${String(x.type ?? '')}`).sort().join(',');
const phraseOf = (m: Msg[]) => /Фраза: «([\s\S]*)»\s*$/.exec(m[1]!.content)?.[1] ?? '';

const rawFile = join(process.cwd(), 'train', 'out', 'chat', `raw-${set}-${label || 'last'}.jsonl`);
const replay = !!process.env.REPLAY;
const saved = new Map<string, string>();
if (replay) {
  if (!existsSync(rawFile)) {
    console.error(`Нет сохранённых ответов: ${rawFile}. Сначала замер с моделью и той же пометкой.`);
    process.exit(1);
  }
  for (const l of readFileSync(rawFile, 'utf8').split('\n').filter(Boolean)) {
    const r = JSON.parse(l) as { user: string; text: string };
    saved.set(r.user, r.text);
  }
}
const raw: string[] = [];
try {
  if (!replay) await fetch(url.replace(/\/chat\/completions$/, '/models'));
} catch {
  console.error(`Сервер модели не отвечает (${url}). Запустите в другом окне: mlx_lm.server --model … --adapter-path … --port 8080`);
  process.exit(1);
}

let exact = 0;
let same = 0;
let server = 0;
const misses: string[] = [];
const t0 = Date.now();
for (const [i, m] of rows.entries()) {
  let text = saved.get(m[1]!.content) ?? '';
  if (!replay) {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...(process.env.OWN_LLM_KEY && { 'x-api-key': process.env.OWN_LLM_KEY }) }, body: JSON.stringify({ messages: m.slice(0, 2), temperature: 0, max_tokens: 400 }) });
    text = ((await res.json()) as { choices: { message: { content: string } }[] }).choices[0]!.message.content.replace(/<think>[\s\S]*?<\/think>/g, '');
  }
  raw.push(JSON.stringify({ user: m[1]!.content, text }));
  const want = actsOf(m[2]!.content)!;
  const got = actsOf(text);
  const ok = !!got && JSON.stringify(canon(got)) === JSON.stringify(canon(want));
  const okShape = !!got && shape(got) === shape(want);
  const ctx = ctxs[i] ?? null;
  // Посторонние фразы («какой курс доллара») сервер отсекает до модели — как в проде
  const gotServed = onlyFiller(phraseOf(m)) ? [{ intent: 'unknown' }] : got;
  const okServer = !!ctx && served(gotServed, ctx, phraseOf(m)) === served(want, ctx, phraseOf(m));
  const k = byKind.get(kinds[i] || '—') ?? { n: 0, ok: 0 };
  k.n++;
  if (okServer) k.ok++;
  byKind.set(kinds[i] || '—', k);
  if (okServer) server++;
  if (ok) exact++;
  if (okShape) same++;
  if (!okServer) misses.push(`${okShape ? '~' : '✗'} ${phraseOf(m)}\n   нужно: ${JSON.stringify(want)}\n   модель: ${text.trim()}`);
  process.stdout.write(`\r${i + 1}/${rows.length}`);
}
const pct = (n: number) => `${Math.round((100 * n) / rows.length)}%`;
if (!replay) writeFileSync(rawFile, raw.join('\n') + '\n');
const missFile = set === 'ood' ? 'misses-ood.txt' : 'misses.txt';
writeFileSync(join(process.cwd(), 'train', 'out', 'chat', missFile), misses.join('\n') + '\n');
console.log(`\n[${set}] Точно: ${exact}/${rows.length} (${pct(exact)}) · после сервера: ${allCtx.length ? `${server}/${rows.length} (${pct(server)})` : 'нет контекста, пересоберите набор'} · то же действие: ${same}/${rows.length} (${pct(same)}) · ${Math.round((Date.now() - t0) / rows.length)} мс на фразу`);
const total = `Точно ${pct(exact)} · после сервера ${pct(server)} · то же действие ${pct(same)} · фраз ${rows.length}`;
if (allKind.some(Boolean)) {
  console.log('\nПо видам команд (после сервера), от худших:');
  for (const [name, v] of [...byKind].sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n)) console.log(`${String(Math.round((100 * v.ok) / v.n)).padStart(4)}%  ${String(v.ok).padStart(3)}/${String(v.n).padEnd(3)}  ${name}`);
}
appendFileSync(join(process.cwd(), 'train', 'out', 'chat', 'results.txt'), `${new Date().toISOString().slice(0, 16)} ${label || '—'}${replay ? ' (пересчёт)' : ''} [${set}] ${total}\n`);
console.log(`\nПромахи (после сервера): train/out/chat/${missFile} · история замеров: train/out/chat/results.txt`);
