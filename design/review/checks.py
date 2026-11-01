import json, glob, os, re, collections
from graph import N, E, TABS
OUT = os.path.expanduser('~/review/out')
W = 390

def lum(c):
    def ch(v):
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2])
def contrast(fg, bg):
    a = fg[3] if len(fg) > 3 else 1
    f = [fg[i] * a + bg[i] * (1 - a) for i in range(3)]
    l1, l2 = sorted([lum(f), lum(bg)], reverse=True)
    return (l1 + 0.05) / (l2 + 0.05)

def load(name, theme):
    nodes = json.load(open(f'{OUT}/{name}.{theme}.json'))
    # react-native-web сжимает часть заголовков с flex:1 до ширины 0 — на телефоне они видны; считаем видимыми
    for n in nodes:
        if n.get('text') and not n['vis'] and n['w'] == 0 and n['h'] > 0 and 0 <= n['y'] < 844 and 0 <= n['x'] < 390:
            n['vis'] = True; n['w'] = max(10, 374 - n['x']); n['zw'] = True
    return nodes

def subtree_text(nodes, kids, i):
    t = []; st = [i]
    while st:
        j = st.pop(); n = nodes[j]
        if n.get('text'): t.append(n['text'])
        st += kids[j]
    return ' '.join(t)

def screen_checks(name, theme):
    nodes = load(name, theme); byid = {n['id']: n for n in nodes}
    kids = collections.defaultdict(list)
    for n in nodes:
        if n['p'] is not None: kids[n['p']].append(n['id'])
    idx = {n['id']: k for k, n in enumerate(nodes)}
    kids2 = collections.defaultdict(list)
    for n in nodes:
        if n['p'] is not None: kids2[idx[n['p']]].append(idx[n['id']])
    def anc_click(n):
        p = n['p']
        while p is not None:
            if byid[p].get('click'): return True
            p = byid[p]['p']
        return False
    f = []
    # 1. зоны нажатия (внешний кликабельный элемент)
    for n in nodes:
        if not n.get('click') or not n['vis'] or anc_click(n): continue
        if n['tag'] in ('input', 'textarea'): continue
        m = min(n['w'], n['h'])
        if m < 44 and n['w'] * n['h'] > 0:
            txt = subtree_text(nodes, kids2, idx[n['id']]) or n.get('label') or '(иконка)'
            f.append({'k': 'tap', 'sev': 2 if m < 32 else 1, 'v': f"{n['w']}×{n['h']}", 'what': txt[:40], 'y': n['y']})
    # 2. кнопки без текста и без подписи для диктора
    for n in nodes:
        if not n.get('click') or not n['vis'] or anc_click(n): continue
        if n['tag'] in ('input', 'textarea'): continue
        if 16 <= min(n['w'], n['h']) and max(n['w'], n['h']) <= 64 and not subtree_text(nodes, kids2, idx[n['id']]) and not n.get('label'):
            f.append({'k': 'label', 'sev': 2, 'v': f"{n['w']}×{n['h']} @ {n['x']},{n['y']}", 'what': 'кнопка без подписи'})
    # 3. контраст
    for n in nodes:
        if not n.get('text') or not n['vis'] or not n.get('fg'): continue
        r = contrast(n['fg'], n['bg'])
        big = n['fs'] >= 18 or (n['fs'] >= 14 and re.search('Bold|SemiBold', n['ff'] or ''))
        need = 3 if big else 4.5
        if r < need and not (name.startswith('C-Widget') and n['y'] < 40):
            f.append({'k': 'contrast', 'sev': 2 if r < 3 else 1, 'v': f"{r:.2f} (нужно {need})", 'what': n['text'][:40], 'fs': n['fs'], 'pair': '#%02x%02x%02x на #%02x%02x%02x' % (*[round(v) for v in n['fg'][:3]], *n['bg']) + (f" α{n['fg'][3]:.2f}" if n['fg'][3] < 1 else '')})
    # 4. текст за краем экрана / обрезан шириной родителя
    for n in nodes:
        if n.get('text') and n['vis'] and (n['x'] < 0 or n['x'] + n['w'] > W + 1):
            f.append({'k': 'overflow', 'sev': 1, 'v': f"x={n['x']} w={n['w']}", 'what': n['text'][:40]})
    # 5. наложение текстов
    ts = [n for n in nodes if n.get('text') and n['vis'] and not n.get('zw') and n['w'] > 2 and n['h'] > 2]
    for i, a in enumerate(ts):
        for b in ts[i + 1:]:
            ox = min(a['x'] + a['w'], b['x'] + b['w']) - max(a['x'], b['x'])
            oy = min(a['y'] + a['h'], b['y'] + b['h']) - max(a['y'], b['y'])
            if ox > 3 and oy > 3 and a['text'] != b['text']:
                # предок–потомок не считаем
                p = b['p']; rel = False
                while p is not None:
                    if p == a['id']: rel = True; break
                    p = byid[p]['p']
                if not rel:
                    f.append({'k': 'overlap', 'sev': 1, 'v': f"{ox}×{oy}px", 'what': f"«{a['text'][:20]}» и «{b['text'][:20]}»"})
    return f, nodes

def run():
    res = {}; fonts = collections.Counter(); labels = collections.defaultdict(set); pads = collections.Counter(); small = collections.Counter()
    for nd in N:
        for s in nd[4]:
            for t in ('light', 'dark'):
                f, nodes = screen_checks(s, t)
                res[(s, t)] = f
                if t != 'light': continue
                for n in nodes:
                    if n.get('text') and n['vis']:
                        fonts[(n['ff'], n['fs'], str(n['fw']))] += 1
                        if n['fs'] < 11: small[s] += 1
                    if n.get('click') and n['vis']:
                        pass
                    for v in n.get('pad', []):
                        if v: pads[v] += 1
                # подписи кнопок
                byid = {n['id']: n for n in nodes}
                for n in nodes:
                    if n.get('text') and n['vis']:
                        p = n['id']; c = False
                        while p is not None:
                            if byid[p].get('click'): c = True; break
                            p = byid[p]['p']
                        if c and re.search('[А-Яа-я]', n['text']) and len(n['text']) < 30:
                            labels[n['text'].strip().upper()].add(s)
    return res, fonts, labels, pads, small

def flow():
    out = collections.defaultdict(list); inc = collections.defaultdict(list)
    for a, b, why, kind, src in E:
        out[a].append((b, why, kind)); inc[b].append((a, why, kind))
    # глубина от вкладок
    depth = {t: 0 for t in TABS}; q = list(TABS)
    while q:
        a = q.pop(0)
        for b, _, k in out[a]:
            d = depth[a] + (0 if k in ('view', 'tab') else 1)
            if b not in depth or d < depth[b]:
                depth[b] = d; q.append(b)
    ids = [n[0] for n in N]
    return {'depth': depth, 'unreached': [i for i in ids if i not in depth],
            'single': [i for i in ids if len({a for a, _, _ in inc[i]}) == 1 and i not in TABS],
            'dead': [i for i in ids if not out[i]]}

if __name__ == '__main__':
    res, fonts, labels, pads, small = run()
    fl = flow()
    agg = collections.Counter(); per = {}
    for (s, t), f in res.items():
        for x in f: agg[(x['k'], t)] += 1
        per[(s, t)] = collections.Counter(x['k'] for x in f)
    print('ИТОГО по видам:', dict(agg))
    print('шрифтов (семейство,размер,вес):', len(fonts)); print(fonts.most_common(40))
    print('паддинги:', sorted(pads.items()))
    print('flow:', fl)
    json.dump({'res': {f'{s}|{t}': f for (s, t), f in res.items()}, 'fonts': [[*k, v] for k, v in fonts.items()],
               'labels': {k: sorted(v) for k, v in labels.items()}, 'pads': dict(pads), 'small': dict(small), 'flow': fl},
              open(os.path.expanduser('~/review/build/findings.json'), 'w'), ensure_ascii=False)
