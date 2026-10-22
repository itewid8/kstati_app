// Bundle -> screenshot -> compare in one go.
//
//   node design/harness/run.mjs <registry.tsx> [Screen ...] [--theme light|dark] [--crop y0,y1] [--tol N]
//
// No screen names -> all screens exported by the registry.
// Renders go to design/out/<Screen>.<theme>.png, compare images to design/out/<Screen>.<theme>.compare.png.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { bundle } from './bundle.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DESIGN = path.dirname(HERE);
// KSTATI_HARNESS_OUT — своя папка для параллельных прогонов (иначе бандлы и снимки затирают друг друга)
const OUT = process.env.KSTATI_HARNESS_OUT ? path.resolve(process.env.KSTATI_HARNESS_OUT) : path.join(DESIGN, 'out');
const WORK = path.join(OUT, '.harness');

function parseArgs(argv) {
  const opts = { entry: null, screens: [], passShoot: [], passCompare: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--theme') { opts.passShoot.push(a, argv[i + 1]); opts.passCompare.push(a, argv[++i]); }
    else if (a === '--crop' || a === '--tol') opts.passCompare.push(a, argv[++i]);
    else if (!opts.entry) opts.entry = a;
    else opts.screens.push(a);
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
if (!opts.entry) {
  console.error('usage: node design/harness/run.mjs <registry.tsx> [Screen ...] [--theme light|dark] [--crop y0,y1] [--tol N]');
  process.exit(2);
}

fs.mkdirSync(WORK, { recursive: true });
const bundlePath = path.join(WORK, 'bundle.js');
fs.writeFileSync(bundlePath, bundle(opts.entry));

const shoot = spawnSync('python3', [path.join(HERE, 'shoot.py'), bundlePath, OUT, ...opts.passShoot, ...opts.screens], { encoding: 'utf8' });
if (shoot.stderr.trim()) console.error(shoot.stderr.trim());
const shots = shoot.stdout.split('\n').filter(Boolean).map((l) => JSON.parse(l));
let failed = shoot.status !== 0;
for (const s of shots) {
  for (const msg of s.console ?? []) console.error(`[${s.screen}.${s.theme}] console: ${msg.split('\n')[0]}`);
  if (s.error) console.error(`[${s.screen}.${s.theme}] RENDER ERROR: ${s.error}`);
}
const rendered = [...new Set(shots.filter((s) => s.png).map((s) => s.screen))];
if (rendered.length) {
  const cmp = spawnSync('python3', [path.join(DESIGN, 'tools', 'compare.py'), ...rendered, ...opts.passCompare], { stdio: 'inherit', env: { ...process.env, KSTATI_HARNESS_OUT: OUT } });
  failed ||= cmp.status !== 0;
}
process.exit(failed ? 1 : 0);
