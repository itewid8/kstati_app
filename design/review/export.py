import json, os
from graph import N, E
from checks import load
FD = json.load(open('findings.json'))
hx = lambda c: None if not c else '#%02x%02x%02x' % tuple(round(v) for v in c[:3]) + ('' if len(c) < 4 or c[3] >= 1 else '%02x' % round(c[3] * 255))
def wire(s, t):
    out = []
    for n in load(s, t):
        if not n['vis']: continue
        if not (n.get('fill') or n.get('bw') or n.get('text') or n.get('icon') or n.get('ph') or n.get('val')): continue
        r = [n['x'], n['y'], n['w'], n['h']]
        o = {'r': r}
        if n.get('fill'): o['f'] = hx(n['fill'])
        if n.get('bw'): o['b'] = [n['bw'], hx(n['bc'])]
        if n.get('rad'): o['rad'] = n['rad']
        tx = n.get('text') or n.get('val') or n.get('ph')
        if tx: o['t'] = tx.replace('­', ''); o['fs'] = n.get('fs', 13); o['c'] = hx(n.get('fg')) or '#888'; o['m'] = 1 if 'Mono' in (n.get('ff') or '') else 0; o['bold'] = 1 if any(w in (n.get('ff') or '') for w in ('Bold', 'SemiBold')) else 0
        if n.get('icon'): o['i'] = 1
        out.append(o)
    return out
data = {'nodes': [dict(id=a, title=b, group=c, route=d, screens=e) for a, b, c, d, e in N],
        'edges': [dict(a=a, b=b, why=w, kind=k, src=s) for a, b, w, k, s in E],
        'wire': {f'{s}|{t}': wire(s, t) for n in N for s in n[4] for t in ('light', 'dark')},
        'res': FD['res'], 'flow': FD['flow'], 'fonts': FD['fonts'], 'labels': FD['labels']}
json.dump(data, open('data.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(os.path.getsize('data.json'))
