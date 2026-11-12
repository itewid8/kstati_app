/**
 * Набор для своей модели одной командой: выгрузки генератора с разными зёрнами → train/out/chat.
 *
 *   npm run train:build            — 7 зёрен обучения
 *   npm run train:build -- 10      — больше примеров (обучение дольше)
 *
 * Получается: train.jsonl и valid.jsonl (их берёт mlx_lm.lora), ood.jsonl — проверка на словах, которых
 * в обучении нет (train/catalog-test.ts). Набор ood собирается один раз и дальше не трогается: по нему сравниваются
 * версии модели, а генератор меняется. Нужен новый — удалите train/out/chat/ood.jsonl (прежние замеры станут несравнимы).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as base from './catalog.js';
import * as test from './catalog-test.js';

// Слова проверки не должны встречаться в обучении — иначе проверка на незнакомом ничего не показывает
const low = (a: string[]) => new Set(a.map((x) => x.toLowerCase()));
const pairs: [string, string[], string[]][] = [
  ['дела', base.TASKS.map((x) => x.title), test.TASKS.map((x) => x.title)],
  ['имена', base.PEOPLE.map((x) => x.nom), test.PEOPLE.map((x) => x.nom)],
  ['фильмы', [...base.FILMS.map((x) => x.title), ...base.UNKNOWN_FILMS], [...test.FILMS.map((x) => x.title), ...test.UNKNOWN_FILMS]],
  ['хотелки', base.WISHES.map((x) => x.title), test.WISHES.map((x) => x.title)],
  ['заметки', base.IDEAS, test.IDEAS],
  ['списки', base.LISTS.map((x) => x[1]), test.LISTS.map((x) => x[1])],
  ['темы', base.TOPICS.map((x) => x.title), test.TOPICS.map((x) => x.title)],
];
const both = pairs.flatMap(([name, a, b]) => b.filter((x) => low(a).has(x.toLowerCase())).map((x) => `${name}: ${x}`));
if (both.length) {
  console.error(`Слова есть и в обучении, и в проверке на незнакомом — уберите из одного словаря:\n${both.join('\n')}`);
  process.exit(1);
}

const seeds = Math.max(1, Number(process.argv[2] ?? 7));
const tsx = join(process.cwd(), 'node_modules', '.bin', 'tsx');
const tmp = mkdtempSync(join(tmpdir(), 'kstati-train-'));
const run = (script: string, args: string[], env: Record<string, string> = {}) =>
  execFileSync(tsx, [join('train', script), ...args], { encoding: 'utf8', env: { ...process.env, ...env } });
const generate = (seed: number, vocab: string) => {
  const dir = join(tmp, `${vocab}${seed}`);
  const first = run('generate.ts', [String(seed)], { TRAIN_ROOT: dir, TRAIN_VOCAB: vocab }).split('\n')[0];
  console.log(`зерно ${seed}${vocab === 'test' ? ' (незнакомые слова)' : ''}: ${first}`);
  return dir;
};

const trainDirs = Array.from({ length: seeds }, (_, i) => generate(i + 1, 'train'));
process.stdout.write(run('to-chat.ts', trainDirs));
if (existsSync(join(process.cwd(), 'train', 'out', 'chat', 'ood.jsonl'))) console.log('Проверка на незнакомых словах: набор ood оставлен прежним');
else process.stdout.write(run('to-chat.ts', ['--ood', ...[101, 102].map((s) => generate(s, 'test'))]));
