/**
 * Сверка с фразой (src/ground.ts) не должна портить верные ответы: прогоняем через неё образцы набора
 * и считаем, где она что-то поменяла.  npx tsx train/ground-check.ts [train|valid|ood]
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { commaItems, faithful, groundTexts, noteTail } from '../src/ground.js';

const set = process.argv[2] ?? 'ood';
const rows = readFileSync(join(process.cwd(), 'train', 'out', 'chat', `${set}.jsonl`), 'utf8').split('\n').filter(Boolean).map((l) => (JSON.parse(l) as { messages: { content: string }[] }).messages);
const same = (a: string, b: string) => a.toLowerCase().replace(/ё/g, 'е') === b.toLowerCase().replace(/ё/g, 'е');
let changed = 0;
let total = 0;
const shown: string[] = [];
for (const m of rows) {
  const phrase = /Фраза: «([\s\S]*)»\s*$/.exec(m[1]!.content)?.[1] ?? '';
  for (const a of (JSON.parse(m[2]!.content) as { actions: Record<string, unknown>[] }).actions) {
    if (a.intent !== 'add') continue;
    const fields = [[a.title, false], [a.text, true], [a.note, false], ...(Array.isArray(a.items) ? a.items.map((x) => [x, true]) : [])].filter((x): x is [string, boolean] => typeof x[0] === 'string' && !!x[0]);
    const texts = fields.map((x) => x[0]);
    if (!texts.length) continue;
    total++;
    const fixed = groundTexts(texts, phrase, fields.map((x) => x[1]));
    const items = Array.isArray(a.items) ? (a.items as string[]) : [];
    const byComma = items.length ? commaItems(String(a.title ?? ''), items, phrase) : null;
    // Заметка: текст из фразы подставляется, только если образец с ней расходится — на верных образцах не должен
    const tail = typeof a.text === 'string' && !items.length ? noteTail(phrase, typeof a.topic === 'string' ? a.topic : '') : null;
    if (tail && !faithful(a.text as string, tail)) {
      changed++;
      if (shown.length < 12) shown.push(`«${phrase}»\n   было:  ${String(a.text)}\n   стало: ${tail}`);
      continue;
    }
    const bad = fixed.some((x, i) => !same(x, texts[i]!)) || (byComma && byComma.some((x, i) => !same(x, items[i]!)));
    if (bad) {
      changed++;
      if (shown.length < 12) shown.push(`«${phrase}»\n   было:  ${JSON.stringify(texts)}\n   стало: ${JSON.stringify(byComma ?? fixed)}`);
    }
  }
}
console.log(`[${set}] изменено верных ответов: ${changed} из ${total}`);
if (shown.length) console.log(shown.join('\n'));
