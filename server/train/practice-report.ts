/**
 * Разбор попыток «Обучения» (страница /admin → «Обучение» → «Скачать»).
 *
 *   npx tsx train/practice-report.ts ~/Downloads/practice-2026-11-14.json
 *   npx tsx train/practice-report.ts ~/Downloads/practice-2026-11-14-audio.json   — ещё и записи голоса в private/practice-audio
 *
 * Печатает, где теряется точность: распознавание телефона или разбор модели, по видам команд и по голосам.
 * В ~/kstati/private пишет:
 *   practice-pairs.txt  — «сказано → услышано» по словам, частые первыми: материал для словаря исправлений
 *                         и для шума в обучающем наборе (train/generate.ts, asrNoise);
 *   practice-review.md  — фразы, которые телефон услышал верно, а модель разобрала не так: ошибки разбора.
 *   practice-wordings.txt — как люди говорят сами: задания своими словами и попытки с отметкой «сказал иначе»;
 *   practice-cards.md   — карточки с отметкой «плохая карточка»: кривая фраза или неверный образец, править генератор.
 *   practice-train.jsonl — готовые примеры для обучения (их подхватывает train/to-chat.ts): услышанный текст → образец.
 *                         Берутся попытки с оценкой человека, где образцу можно верить: «верно» при совпадении с образцом
 *                         (проверено человеком) и «неверно» без пояснения при несовпадении (ошибка модели — такие
 *                         примеры to-chat кладёт дважды). Только карточки из словаря обучения и не контрольные:
 *                         слова проверочного словаря в обучение не идут, иначе замер на незнакомых словах перестанет
 *                         что-либо показывать;
 * «Неверно» с пояснением и расхождения оценки со сверкой — в practice-review.md и practice-cards.md: их смотрит человек.
 * Отметки независимы. «Сказал иначе» — попытка считается как «своими словами»: текст не сверяется, разбор — без названий.
 * «Плохая карточка» без «сказал иначе» — попытка в счёт не идёт. Контрольные карточки в файлы не идут:
 * по ним проверяется, стала ли новая версия лучше.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Attempt, Card } from '../src/practice.js';
import { buildTunedMessages } from '../src/prompt.js';
import { cleanSpeech } from '../src/spoken.js';
import { textKey } from '../src/practiceCheck.js';

/** flag — отметка первой версии (одна из двух) */
type Row = Omit<Attempt, 'userId'> & { logId: string; speaker: string; ogg?: string; flag?: 'etalon' | 'said' };

const file = process.argv[2];
if (!file) {
  console.error('Укажите файл с попытками: npx tsx train/practice-report.ts ~/Downloads/practice-….json');
  process.exit(1);
}
const all = (JSON.parse(readFileSync(file, 'utf8')) as Row[]).map((r) => {
  const said = !!r.said || r.flag === 'said';
  return { ...r, said, card: !!r.card || r.flag === 'etalon', ...(said && { sttOk: null, parseOk: r.soft ?? r.parseOk }) };
});
const PRIVATE = join(process.cwd(), '..', 'private');
mkdirSync(PRIVATE, { recursive: true });

const pct = (n: number, of: number) => (of ? `${Math.round((100 * n) / of)}%` : '—');
const own = (r: Row) => r.mode === 'do' || !!r.said;
// Без оценки человека плохая карточка в счёт не идёт; с оценкой — решает оценка
const clean = all.filter((r) => r.good !== undefined || !(r.card && !r.said));
const say = clean.filter((r) => !own(r));
const todo = clean.filter(own);
const heardOk = say.filter((r) => r.sttOk);
const rated = all.filter((r) => r.good !== undefined);
/** Верно ли получилось: оценка человека, а без неё — сверка с образцом */
const right = (r: Row) => r.good ?? r.parseOk;

console.log(`Попыток ${all.length}: фраз слово в слово ${say.length}, своими словами ${todo.length} (из них «сказал иначе» ${todo.filter((r) => r.said).length}), на плохих карточках ${all.length - clean.length} (не считаются), голосов ${new Set(all.map((r) => r.speaker)).size}`);
console.log('');
console.log('Фразы с карточки');
console.log(`  телефон услышал слово в слово      ${pct(heardOk.length, say.length)} (${heardOk.length} из ${say.length})`);
console.log(`  услышано верно → разобрано верно   ${pct(heardOk.filter((r) => right(r)).length, heardOk.length)}   — ошибки здесь: модель`);
const misheard = say.filter((r) => !r.sttOk);
console.log(`  услышано с ошибкой → разобрано верно ${pct(misheard.filter((r) => right(r)).length, misheard.length)} (${misheard.length} фраз) — насколько модель терпит искажения`);
console.log(`  итог: верно от начала до конца     ${pct(say.filter((r) => right(r)).length, say.length)}`);
if (todo.length) console.log(`Своими словами: разобрано верно ${pct(todo.filter((r) => right(r)).length, todo.length)} (без сверки названий)`);
if (rated.length)
  console.log(
    `Оценено человеком ${rated.length}: верно ${rated.filter((r) => r.good).length}, неверно ${rated.filter((r) => !r.good).length}; оценка разошлась со сверкой по образцу — ${rated.filter((r) => r.good !== r.parseOk).length} (образцы под вопросом)`,
  );
const control = clean.filter((r) => r.control);
if (control.length) console.log(`Контрольные карточки: верно ${pct(control.filter((r) => right(r)).length, control.length)} из ${control.length}`);
const paths = new Map<string, number>();
for (const r of clean) paths.set(r.path ?? 'правила', (paths.get(r.path ?? 'правила') ?? 0) + 1);
console.log(`Кто разбирал: ${[...paths].map(([k, n]) => `${k} ${n}`).join(', ')}`);

const table = (title: string, keyOf: (r: Row) => string) => {
  const groups = new Map<string, Row[]>();
  for (const r of clean) groups.set(keyOf(r), [...(groups.get(keyOf(r)) ?? []), r]);
  console.log(`\n${title.padEnd(22)} попыток  услышано  разобрано`);
  for (const [k, rows] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
    const s = rows.filter((r) => !own(r));
    console.log(`${k.padEnd(22)} ${String(rows.length).padStart(7)}  ${pct(s.filter((r) => r.sttOk).length, s.length).padStart(8)}  ${pct(rows.filter((r) => right(r)).length, rows.length).padStart(9)}`);
  }
};
table('Вид команды', (r) => r.variant);
table('Голос', (r) => r.speaker);
table('Слова', (r) => (r.vocab === 'test' ? 'незнакомые модели' : 'из словаря обучения'));

/* ---------- сказано → услышано по словам ---------- */

/** Выравнивание двух фраз по словам: общие слова остаются на месте, между ними — замены, пропуски и вставки */
function diff(a: string[], b: string[]): [string, string][] {
  const n = a.length;
  const m = b.length;
  const lcs = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
  const out: [string, string][] = [];
  let i = 0;
  let j = 0;
  let from: string[] = [];
  let to: string[] = [];
  const flush = () => {
    if (from.length || to.length) out.push([from.join(' '), to.join(' ')]);
    from = [];
    to = [];
  };
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      flush();
      i++;
      j++;
    } else if (j < m && (i === n || lcs[i]![j + 1]! >= lcs[i + 1]![j]!)) to.push(b[j++]!);
    else from.push(a[i++]!);
  }
  flush();
  return out;
}

const learn = clean.filter((r) => !r.control);
const pairs = new Map<string, { n: number; example: string }>();
for (const r of learn.filter((x) => !own(x) && x.sttOk === false)) {
  for (const [from, to] of diff(textKey(r.phrase).split(' '), textKey(r.heard).split(' '))) {
    const k = `${from || '∅'} → ${to || '∅'}`;
    const p = pairs.get(k) ?? { n: 0, example: `«${r.phrase}» → «${r.heard}»` };
    pairs.set(k, { ...p, n: p.n + 1 });
  }
}
const sorted = [...pairs].sort((a, b) => b[1].n - a[1].n);
writeFileSync(join(PRIVATE, 'practice-pairs.txt'), sorted.map(([k, p]) => `${String(p.n).padStart(4)}  ${k}    ${p.example}`).join('\n') + '\n');

const review = ['# Услышано верно, разобрано не так', ''];
const misses = learn.filter((r) => !right(r) && (own(r) || r.sttOk));
for (const r of misses)
  review.push(`## «${r.heard}»`, '', `- вид: ${r.variant}${own(r) ? ' (своими словами)' : ''}, разбор: ${r.path ?? 'правила'}`, `- нужно: ${r.want}`, `- сделано: ${r.did}`, ...(r.note ? [`- что не так: ${r.note}`] : []), ...(r.good === false && r.parseOk ? ['- с образцом совпало: неверен и образец'] : []), `- ответ модели: \`${r.raw.slice(0, 300)}\``, '');
writeFileSync(join(PRIVATE, 'practice-review.md'), review.join('\n'));

const wordings = learn.filter(own).map((r) => `${r.variant}\t${r.heard}\t${r.mode === 'do' ? r.want : r.phrase}`);
writeFileSync(join(PRIVATE, 'practice-wordings.txt'), wordings.join('\n') + '\n');
const badCards = new Map<string, Row>();
for (const r of all.filter((x) => x.card)) badCards.set(r.cardId, r);
writeFileSync(
  join(PRIVATE, 'practice-cards.md'),
  ['# Плохие карточки', '', ...[...badCards.values()].flatMap((r) => [`## «${r.phrase}»`, '', `- карточка ${r.cardId}, вид: ${r.variant}`, `- образец: ${r.want}`, `- сказано: «${r.heard}»${r.said ? ' (иначе, чем на карточке)' : ''}`, `- получилось: ${r.did}`, ''])].join('\n'),
);

/* ---------- примеры для обучения ---------- */

const deckFile = join(process.cwd(), 'data', 'practice.ndjson');
const deck = new Map<string, Card>(
  existsSync(deckFile) ? readFileSync(deckFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as Card).map((c) => [c.id, c]) : [],
);
const examples = new Map<string, string>();
let fixes = 0;
for (const r of rated) {
  const card = deck.get(r.cardId);
  if (!card || card.control || card.vocab !== 'base' || r.mode === 'do' || r.said) continue;
  const verified = r.good === true && r.strict;
  const fix = r.good === false && !r.strict && !r.note;
  if (!verified && !fix) continue;
  const phrase = cleanSpeech(r.heard);
  const [system, user] = buildTunedMessages(phrase, card.ctx);
  const k = `${phrase.toLowerCase()}|${card.id}`;
  if (fix && !examples.has(k)) fixes++;
  examples.set(k, JSON.stringify({ request: [system, user], response: JSON.stringify({ actions: card.actions }), ctx: card.ctx, variant: card.variant, fix }));
}
writeFileSync(join(PRIVATE, 'practice-train.jsonl'), [...examples.values()].join('\n') + (examples.size ? '\n' : ''));

const withAudio = all.filter((r) => r.ogg);
if (withAudio.length) {
  const dir = join(PRIVATE, 'practice-audio');
  mkdirSync(dir, { recursive: true });
  for (const r of withAudio) writeFileSync(join(dir, `${r.id}.ogg`), Buffer.from(r.ogg!, 'base64'));
  // Список для сравнения систем распознавания: файл и что в нём сказано
  writeFileSync(join(dir, 'index.tsv'), withAudio.filter((r) => !own(r)).map((r) => `${r.id}.ogg\t${r.phrase}\t${r.heard}`).join('\n') + '\n');
  console.log(`\nЗаписей голоса: ${withAudio.length} → private/practice-audio (index.tsv: файл, фраза, что услышал телефон)`);
}
console.log(`\nИскажений распознавания: ${sorted.length} видов → private/practice-pairs.txt${sorted.length ? `; частые: ${sorted.slice(0, 5).map(([k]) => k).join('; ')}` : ''}`);
console.log(`Ошибок разбора при верно услышанной фразе: ${misses.length} → private/practice-review.md`);
console.log(`Примеров для обучения: ${examples.size} (из них ошибок модели ${fixes}) → private/practice-train.jsonl${examples.size >= 300 ? ' — набралось на переобучение' : ''}`);
console.log(`Своих формулировок: ${wordings.length} → private/practice-wordings.txt; плохих карточек: ${badCards.size} → private/practice-cards.md`);
