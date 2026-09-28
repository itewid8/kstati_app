/**
 * Сводка по журналу запросов (logs/*.jsonl).
 *   npm run stats            — за всё время
 *   npm run stats -- 7       — за последние 7 дней
 *   npm run stats -- 7 voice — только голос (voice | text | eval)
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from '../src/config.js';
import type { LogEntry } from '../src/log.js';

const [daysArg, sourceArg] = process.argv.slice(2);
const since = daysArg ? Date.now() - Number(daysArg) * 86400_000 : 0;

let files: string[] = [];
try {
  files = (await readdir(config.logDir)).filter((f) => f.endsWith('.jsonl')).sort();
} catch {
  console.log(`Журнала пока нет: ${config.logDir}`);
  process.exit(0);
}

const rows: LogEntry[] = [];
for (const f of files) {
  for (const line of (await readFile(join(config.logDir, f), 'utf8')).split('\n')) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line) as LogEntry;
      if (Date.parse(e.ts) >= since && (!sourceArg || e.source === sourceArg)) rows.push(e);
    } catch {
      /* битая строка — пропускаем */
    }
  }
}
if (!rows.length) {
  console.log('Записей за этот период нет.');
  process.exit(0);
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const avg = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};
const rub = (n: number) => `${n.toFixed(2)} ₽`;
const count = <T,>(xs: T[], key: (x: T) => string) => {
  const m = new Map<string, T[]>();
  for (const x of xs) m.set(key(x), [...(m.get(key(x)) ?? []), x]);
  return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
};

console.log(`\nЖурнал: ${rows.length} запросов · ${rows[0].ts.slice(0, 16).replace('T', ' ')} … ${rows.at(-1)!.ts.slice(0, 16).replace('T', ' ')} (UTC)\n`);

console.log('По источникам и моделям');
for (const [key, xs] of count(rows, (r) => `${r.source.padEnd(6)} ${r.model}`)) {
  const withTok = xs.filter((x) => x.tokens);
  console.log(
    `  ${key.padEnd(34)} ${String(xs.length).padStart(4)} шт · ${rub(sum(xs.map((x) => x.costRub ?? 0))).padStart(9)}` +
      ` · вход ${Math.round(avg(withTok.map((x) => x.tokens!.input)))} / выход ${Math.round(avg(withTok.map((x) => x.tokens!.output)))} ток. в среднем`,
  );
}
console.log(`  ${'Всего'.padEnd(34)} ${String(rows.length).padStart(4)} шт · ${rub(sum(rows.map((r) => r.costRub ?? 0))).padStart(9)}`);

console.log('\nРезультаты разбора');
for (const [type, xs] of count(rows, (r) => (r.error ? 'ОШИБКА' : r.result ?? '—'))) console.log(`  ${type.padEnd(14)} ${xs.length}`);

const retries = rows.filter((r) => (r.attempts ?? 0) > 1).length;
if (retries) console.log(`\nПовторных вызовов модели (невалидный JSON): ${retries}`);

const voice = rows.filter((r) => r.source === 'voice');
const secs = voice.map((r) => r.audioSec).filter((x): x is number => typeof x === 'number');
if (secs.length) {
  console.log(`\nГолос: запись в среднем ${avg(secs).toFixed(1)} с (макс ${Math.max(...secs)} с) · тишина ${voice.filter((r) => !r.transcript && !r.error).length}`);
}
const stt = rows.map((r) => r.sttMs).filter((x): x is number => !!x);
const llm = rows.map((r) => r.llmMs).filter((x): x is number => !!x);
console.log(`Время: распознавание ${median(stt)} мс, модель ${median(llm)} мс (медианы)`);

const ev = rows.filter((r) => r.source === 'eval');
if (ev.length) console.log(`Eval: ${ev.filter((r) => r.pass).length}/${ev.length} прошли (все прогоны вместе)`);

const bad = rows
  .filter((r) => r.error || (r.source === 'eval' ? r.pass === false : r.result === 'unknown' || r.result === 'notFound'))
  .slice(-15);
if (bad.length) {
  console.log('\nПоследние неудачные фразы');
  for (const r of bad) {
    const why = r.error ? `ошибка: ${r.error.slice(0, 80)}` : r.pass === false ? 'eval не прошёл' : r.result;
    console.log(`  ${r.ts.slice(5, 16).replace('T', ' ')} ${r.source.padEnd(5)} «${r.transcript || '…'}» → ${why}`);
  }
}
console.log('');
