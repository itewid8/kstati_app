const fs = require('fs');
const file = process.argv[2], out = process.argv[3];
const src = fs.readFileSync(file, 'utf8');
const js = src.match(/data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1];
const vals = new Function('class DCLogic{}\n' + js + '\nreturn new Component().renderVals();')();
let tpl = src.match(/<x-dc>([\s\S]*?)<\/x-dc>/)[1].replace(/<helmet>[\s\S]*?<\/helmet>/, '');
const get = (ctx, path) => path.trim().split('.').reduce((o, k) => (o == null ? undefined : o[k]), ctx);
function findClose(s, tag, from) {
  let depth = 1, re = new RegExp('<' + tag + '\\b|</' + tag + '>', 'g'); re.lastIndex = from;
  let m; while ((m = re.exec(s))) { if (m[0][1] === '/') { if (--depth === 0) return m.index; } else depth++; }
  throw new Error('unclosed ' + tag);
}
function expand(s, ctx) {
  let res = '';
  for (;;) {
    const m = /<(sc-for|sc-if)\b([^>]*)>/.exec(s);
    if (!m) { res += sub(s, ctx); break; }
    res += sub(s.slice(0, m.index), ctx);
    const tag = m[1], start = m.index + m[0].length, end = findClose(s, tag, start);
    const inner = s.slice(start, end);
    if (tag === 'sc-for') {
      const list = get(ctx, m[2].match(/list="\{\{(.*?)\}\}"/)[1]) || [];
      const as = m[2].match(/as="(\w+)"/)[1];
      list.forEach((item) => { res += expand(inner, { ...ctx, [as]: item }); });
    } else {
      const v = get(ctx, m[2].match(/value="\{\{(.*?)\}\}"/)[1]);
      if (v) res += expand(inner, ctx);
    }
    s = s.slice(end + tag.length + 3);
  }
  return res;
}
const sub = (s, ctx) => s.replace(/\{\{(.*?)\}\}/g, (_, p) => { const v = get(ctx, p); return v == null ? '' : String(v); });
const html = '<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;font-family:Arial,sans-serif}</style></head><body>' + expand(tpl, vals) + '</body></html>';
fs.writeFileSync(out, html);
