#!/usr/bin/env python3
"""Структурный дамп экранов: дерево, геометрия, стили. python3 dump.py <bundle.js> <out_dir> [--theme t] [Screen...]"""
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path.home() / 'review/design/harness'))
sys.path.insert(0, str(Path.home() / 'review/design/tools'))
from playwright.sync_api import sync_playwright
import shoot

JS = r"""
() => {
  const rgba = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return [p[0],p[1],p[2],p.length>3?p[3]:1]; };
  const bgOf = (el) => { const layers=[]; for (let e=el; e && e.nodeType===1; e=e.parentElement) { const c=rgba(getComputedStyle(e).backgroundColor); if (c && c[3]>0) { layers.push(c); if (c[3]>=1) break; } } let out=[255,255,255]; for (const c of layers.reverse()) out=out.map((v,i)=>v*(1-c[3])+c[i]*c[3]); return out.map(Math.round); };
  const out = []; let id = 0; const ids = new Map();
  const walk = (el, depth) => {
    const cs = getComputedStyle(el); if (cs.display==='none' || cs.visibility==='hidden' || +cs.opacity===0) return;
    const r = el.getBoundingClientRect();
    const own = [...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim();
    const role = el.getAttribute('role') || (el.tagName==='BUTTON'?'button':el.tagName==='INPUT'||el.tagName==='TEXTAREA'?'textbox':null);
    const click = role==='button'||role==='link'||role==='switch'||role==='checkbox'||role==='tab'||role==='radio'||role==='menuitem'||cs.cursor==='pointer'||el.tabIndex>=0;
    const visible = r.width>0 && r.height>0 && r.bottom>0 && r.top<844 && r.right>0 && r.left<390;
    const me = id++; ids.set(el, me);
    const rec = { id: me, p: el.parentElement && ids.has(el.parentElement) ? ids.get(el.parentElement) : null, d: depth, tag: el.tagName.toLowerCase(),
      x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), vis: visible };
    if (role) rec.role = role; if (click) rec.click = true;
    const al = el.getAttribute('aria-label'); if (al) rec.label = al;
    const ph = el.getAttribute('placeholder'); if (ph) rec.ph = ph;
    if (el.value && (el.tagName==='INPUT'||el.tagName==='TEXTAREA')) rec.val = el.value;
    if (own) { rec.text = own; rec.fs = parseFloat(cs.fontSize); rec.fw = cs.fontWeight; rec.ff = cs.fontFamily.split(',')[0].replace(/["']/g,''); rec.ls = cs.letterSpacing; rec.lh = cs.lineHeight; rec.fg = rgba(cs.color); rec.bg = bgOf(el); rec.tt = cs.textTransform!=='none'?cs.textTransform:undefined; }
    const bw = parseFloat(cs.borderTopWidth)||0; if (bw) { rec.bw = bw; rec.bc = rgba(cs.borderTopColor); }
    const own_bg = rgba(cs.backgroundColor); if (own_bg && own_bg[3]>0) rec.fill = own_bg;
    const pad = ['Top','Right','Bottom','Left'].map(k=>parseFloat(cs['padding'+k])||0); if (pad.some(Boolean)) rec.pad = pad;
    const rad = parseFloat(cs.borderTopLeftRadius)||0; if (rad) rec.rad = rad;
    if (cs.overflowY==='auto'||cs.overflowY==='scroll') { rec.scroll = true; rec.sh = el.scrollHeight; }
    if (el.tagName==='svg' || el.tagName==='SVG') rec.icon = true;
    out.push(rec);
    if (rec.icon) return;
    for (const c of el.children) walk(c, depth+1);
  };
  walk(document.getElementById('root'), 0);
  return out;
}
"""

def main(argv):
    args = list(argv); themes = ['light', 'dark']
    if '--theme' in args:
        i = args.index('--theme'); themes = [args[i+1]]; del args[i:i+2]
    bundle, out, names = Path(args[0]).resolve(), Path(args[1]), args[2:]
    out.mkdir(parents=True, exist_ok=True)
    url = shoot.write_page(bundle).as_uri()
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        if not names:
            ctx, page, _ = shoot.open_page(b, 'light'); st = shoot.load(page, url); names = st['screens']; ctx.close()
        for n in names:
            for t in themes:
                ctx, page, con = shoot.open_page(b, t)
                try:
                    st = shoot.load(page, f'{url}?screen={n}&theme={t}')
                    if st['error']: print(json.dumps({'screen': n, 'theme': t, 'error': st['error'][:300]})); continue
                    nodes = page.evaluate(JS)
                    (out / f'{n}.{t}.json').write_text(json.dumps(nodes, ensure_ascii=False))
                    if '--png' in sys.argv: page.screenshot(path=str(out / f'{n}.{t}.png'))
                    print(json.dumps({'screen': n, 'theme': t, 'nodes': len(nodes), 'console': con[:2]})[:300])
                except Exception as e:
                    print(json.dumps({'screen': n, 'theme': t, 'error': str(e)[:300]}))
                finally:
                    ctx.close()
        b.close()

if __name__ == '__main__':
    main(sys.argv[1:])
