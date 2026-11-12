/**
 * Набор для дообучения своей модели (mlx-lm, llama.cpp, Hugging Face): из выгрузок train/generate.ts
 * с разными зёрнами — один набор в формате чата {"messages":[system, user, assistant]}.
 *
 *   npm run train:build                          — всё одной командой (train/build.ts), вручную:
 *   TRAIN_ROOT=/tmp/s1 npm run train:data -- 1   (и так для нескольких зёрен)
 *   npx tsx train/to-chat.ts /tmp/s1 /tmp/s2 …   — train/out/chat/train.jsonl и valid.jsonl
 *   npx tsx train/to-chat.ts --ood /tmp/t1 …     — train/out/chat/ood.jsonl: проверка на незнакомых словах
 *                                                  (выгрузки с TRAIN_VOCAB=test), в обучение не идёт
 *
 * Одинаковые запросы — один раз. Фраза, попавшая в проверку, в обучение не идёт ни в каком контексте:
 * иначе проверка покажет заучивание, а не понимание.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type Row = { request: { role: string; text: string }[]; response: string; ctx?: unknown; variant?: string };
const ood = process.argv.includes('--ood');
const dirs = process.argv.slice(2).filter((a) => a !== '--ood');
if (!dirs.length) {
  console.error('Укажите папки выгрузок: npx tsx train/to-chat.ts /tmp/s1 /tmp/s2');
  process.exit(1);
}
const read = (file: string): Row[] =>
  existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as Row) : [];
const phraseOf = (r: Row) => /Фраза: «([\s\S]*)»\s*$/.exec(r.request.at(-1)?.text ?? '')?.[1]?.toLowerCase() ?? '';
const chat = (r: Row) =>
  JSON.stringify({ messages: [...r.request.map((m) => ({ role: m.role, content: m.text })), { role: 'assistant', content: r.response }] });

const uniq = (rows: Row[]) => {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const k = r.request.map((m) => m.text).join('\n');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};
// Проверка — каждая десятая фраза (по хэшу текста, одинаково при каждой сборке). Фраза из проверки в обучение
// не идёт ни в каком контексте: иначе проверка покажет заучивание. Деление по фразам, а не по строкам выгрузок:
// иначе у действий с небольшим словарём («привет, как дела») в проверку уходили все фразы и в обучении их не было
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const all = uniq(dirs.flatMap((d) => [...read(join(d, 'out', 'train.jsonl')), ...read(join(d, 'out', 'valid.jsonl'))]));
const out = join(process.cwd(), 'train', 'out', 'chat');
mkdirSync(out, { recursive: true });
// Контекст и вид команды проверочных примеров — для train/check-valid.ts: ответ модели разбирается кодом сервера,
// как в проде, а итог раскладывается по видам команд
const meta = (r: Row) => JSON.stringify({ ctx: r.ctx ?? null, variant: r.variant ?? '' });
if (ood) {
  // Проверка на незнакомых словах: каждая фраза один раз
  const seenPhrase = new Set<string>();
  const rows = all.filter((r) => !seenPhrase.has(phraseOf(r)) && seenPhrase.add(phraseOf(r)));
  writeFileSync(join(out, 'ood.jsonl'), rows.map(chat).join('\n') + '\n');
  writeFileSync(join(out, 'ood-ctx.jsonl'), rows.map(meta).join('\n') + '\n');
  console.log(`Проверка на незнакомых словах: ${rows.length} фраз → train/out/chat/ood.jsonl`);
  process.exit(0);
}
const isHeld = (r: Row) => hash(phraseOf(r)) % 10 === 0;
const valid = all.filter(isHeld);
const held = new Set(valid.map(phraseOf));
// Живые фразы, разобранные моделью-учителем (train/distill.ts), — только в обучение, дважды: их мало, а они важнее
// и команды, которые пользователи оценили как верные (train/from-ratings.ts)
const live = [...read(join(process.cwd(), '..', 'private', 'distill.jsonl')), ...read(join(process.cwd(), '..', 'private', 'ratings-train.jsonl'))];
const train = all.filter((r) => !isHeld(r)).concat(live, live);

writeFileSync(join(out, 'train.jsonl'), train.map(chat).join('\n') + '\n');
writeFileSync(join(out, 'valid.jsonl'), valid.map(chat).join('\n') + '\n');
writeFileSync(join(out, 'valid-ctx.jsonl'), valid.map(meta).join('\n') + '\n');
console.log(`Обучение: ${train.length} (живых фраз ${live.length}), проверка: ${valid.length} (фраз в проверке: ${held.size}) → train/out/chat`);
