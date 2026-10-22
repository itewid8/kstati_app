// Tiny offline CommonJS bundler for rendering RN components with react-native-web.
//
//   node design/harness/bundle.mjs <entry.tsx> <out.js>
//
// - TS/TSX (and ESM .js) are transpiled with `typescript` (transpileModule, jsx: react-jsx).
// - Resolution: relative paths, tsconfig `paths` (nearest tsconfig.json above the entry),
//   node_modules walking up from the importer, then the offline kit (KIT_NODE_MODULES).
// - `react-native` -> `react-native-web`; platform files `*.web.*` win.
// - Native-only modules are replaced by stubs from design/harness/stubs/
//   (`<name>.js`, subpaths as `<name>__<sub>.js`); anything else that cannot be resolved
//   gets stubs/_auto.js (a permissive Proxy) and a warning.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const KIT_NODE_MODULES = process.env.KIT_NODE_MODULES || '/home/claude/webkit/node_modules';
const STUBS = path.join(HERE, 'stubs');
const ts = createRequire(path.join(KIT_NODE_MODULES, 'x.js'))('typescript');

const EXTS = ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js', '.jsx', '.mjs', '.cjs', '.json'];
const ASSET_EXTS = new Set(['.ttf', '.otf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.mp3', '.wav', '.m4a']);
const ALIASES = { 'react-native': 'react-native-web' };
// Always stubbed even if a real package were resolvable (native-only on device).
const FORCE_STUB = new Set([
  'expo', 'expo-router', 'expo-haptics', 'expo-audio', 'expo-font', 'expo-status-bar', 'expo-file-system',
  'expo-clipboard', 'expo-constants', 'expo-linking', 'expo-notifications', 'expo-web-browser',
  'expo-splash-screen', 'expo-system-ui', 'expo-task-manager', 'expo-background-task', 'expo-widgets',
  'react-native-reanimated', 'react-native-gesture-handler', 'react-native-worklets',
  'react-native-safe-area-context', 'react-native-screens', '@expo/ui', '@expo/vector-icons',
]);

const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
const pkgName = (spec) => spec.split('/').slice(0, spec.startsWith('@') ? 2 : 1).join('/');

function resolveFile(p) {
  if (isFile(p)) return p;
  for (const e of EXTS) if (isFile(p + e)) return p + e;
  if (isDir(p)) {
    const pj = path.join(p, 'package.json');
    if (isFile(pj)) {
      const main = JSON.parse(fs.readFileSync(pj, 'utf8')).main;
      if (main) { const r = resolveFile(path.join(p, main)); if (r) return r; }
    }
    for (const e of EXTS) if (isFile(path.join(p, 'index' + e))) return path.join(p, 'index' + e);
  }
  return null;
}

function readTsPaths(entry) {
  for (let d = path.dirname(entry); ; d = path.dirname(d)) {
    const tc = path.join(d, 'tsconfig.json');
    if (isFile(tc)) {
      const cfg = ts.parseConfigFileTextToJson(tc, fs.readFileSync(tc, 'utf8')).config || {};
      const paths = cfg.compilerOptions?.paths || {};
      const base = path.resolve(d, cfg.compilerOptions?.baseUrl || '.');
      return Object.entries(paths).map(([k, v]) => [k.replace(/\*$/, ''), v.map((t) => path.resolve(base, t.replace(/\*$/, '')))]);
    }
    if (d === path.dirname(d)) return [];
  }
}

function stubFor(spec) {
  const exact = path.join(STUBS, spec.replace(/\//g, '__') + '.js');
  if (isFile(exact)) return exact;
  const pkg = path.join(STUBS, pkgName(spec).replace(/\//g, '__') + '.js');
  return isFile(pkg) ? pkg : null;
}

export function bundle(entry, { stubs = {}, warn = console.warn } = {}) {
  entry = path.resolve(entry);
  const tsPaths = readTsPaths(entry);
  const autoStub = path.join(STUBS, '_auto.js');

  function resolveBare(spec, fromDir) {
    for (let d = fromDir; ; d = path.dirname(d)) {
      const r = isDir(path.join(d, 'node_modules', pkgName(spec))) && resolveFile(path.join(d, 'node_modules', spec));
      if (r) return r;
      if (d === path.dirname(d)) break;
    }
    return resolveFile(path.join(KIT_NODE_MODULES, spec));
  }

  function resolve(spec, fromFile) {
    const fromDir = path.dirname(fromFile);
    if (spec === '__entry__') return entry;
    if (stubs[spec]) return path.resolve(stubs[spec]);
    const pkg = pkgName(spec);
    if (ALIASES[pkg]) {
      if (spec === pkg) spec = ALIASES[pkg];
      else return stubFor(spec) || autoStub; // react-native/Libraries/... internals
    }
    if (spec.startsWith('.') || path.isAbsolute(spec)) return resolveFile(path.resolve(fromDir, spec));
    for (const [prefix, targets] of tsPaths) {
      if (spec.startsWith(prefix)) {
        for (const t of targets) { const r = resolveFile(path.join(t, spec.slice(prefix.length))); if (r) return r; }
      }
    }
    if (FORCE_STUB.has(pkg)) return stubFor(spec) || autoStub;
    const r = stubFor(spec) || resolveBare(spec, fromDir);
    if (r) return r;
    warn(`[bundle] ${spec} (from ${path.relative(process.cwd(), fromFile)}) not found -> auto stub`);
    return autoStub;
  }

  function load(file) {
    const ext = path.extname(file);
    if (ASSET_EXTS.has(ext)) return `module.exports = ${JSON.stringify(pathToFileURL(file).href)};`;
    const src = fs.readFileSync(file, 'utf8');
    if (ext === '.json') return `module.exports = ${src};`;
    const isTs = /\.(tsx?|jsx)$/.test(file);
    const isEsm = /^\s*(import\s|import\{|export\s|export\{)/m.test(src);
    if (!isTs && !isEsm) return src;
    return ts.transpileModule(src, {
      fileName: file.endsWith('.js') ? file + 'x' : file,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true, allowJs: true, isolatedModules: true,
      },
      reportDiagnostics: false,
    }).outputText;
  }

  const ids = new Map();
  const chunks = [];
  const queue = [path.join(HERE, 'boot.tsx')];
  ids.set(queue[0], 0);
  while (queue.length) {
    const file = queue.shift();
    const code = load(file);
    const deps = {};
    for (const m of code.matchAll(/\brequire\(\s*(['"])([^'"\n]+)\1\s*\)/g)) {
      const spec = m[2];
      if (spec in deps) continue;
      const r = resolve(spec, file);
      if (!r) { deps[spec] = -1; continue; } // resolved lazily -> throws only if executed
      if (!ids.has(r)) { ids.set(r, ids.size); queue.push(r); }
      deps[spec] = ids.get(r);
    }
    chunks.push(`${ids.get(file)}: [function (module, exports, require) {\n${code}\n}, ${JSON.stringify(deps)}, ${JSON.stringify(path.relative(process.cwd(), file))}]`);
  }
  return `(function () {
var global = window; window.global = window; window.__DEV__ = true;
window.process = window.process || { env: { NODE_ENV: 'development' }, platform: 'web', nextTick: function (f) { Promise.resolve().then(f); } };
var defs = {\n${chunks.join(',\n')}\n};
var cache = {};
function load(id) {
  if (cache[id]) return cache[id].exports;
  var def = defs[id], module = cache[id] = { exports: {} };
  def[0].call(module.exports, module, module.exports, function (spec) {
    var dep = def[1][spec];
    if (dep === undefined || dep < 0) throw new Error('Cannot find module "' + spec + '" from ' + def[2]);
    return load(dep);
  });
  return module.exports;
}
load(0);
})();\n`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [entry, out] = process.argv.slice(2);
  if (!entry || !out) { console.error('usage: node bundle.mjs <entry.tsx> <out.js>'); process.exit(2); }
  fs.writeFileSync(out, bundle(entry));
  console.log(`bundled ${entry} -> ${out}`);
}
