import json, os, collections
D = json.load(open(os.path.expanduser('~/review/build/data.json')))
res = D['res']
# Сводки
pairs = collections.defaultdict(lambda: {'n': 0, 'screens': set(), 'v': '', 'ex': ''})
taps = collections.defaultdict(lambda: {'n': 0, 'screens': set(), 'ex': collections.Counter()})
for k, f in res.items():
    s, t = k.split('|')
    for x in f:
        if x['k'] == 'contrast':
            p = pairs[(t, x['pair'])]; p['n'] += 1; p['screens'].add(s); p['v'] = x['v']; p['ex'] = p['ex'] or x['what']
        if x['k'] == 'tap' and t == 'light':
            q = taps[x['v']]; q['n'] += 1; q['screens'].add(s); q['ex'][x['what']] += 1
TOK = {'#7c7c78': 'muted (тёмная)', '#e0281e': 'red (светлая)', '#a3a29c': 'faint (светлая)', '#4a4a47': 'faint (тёмная)',
       '#ffffff на #ff3b30': 'белый на red (тёмная)', '#1a1a1a на #e2407e': 'ink на pink', '#ffffff на #1f9d57': 'ink на green', '#5e5e58': 'muted (светлая)'}
def tok(p):
    for k, v in TOK.items():
        if p.startswith(k) or k in p: return v
    return ''
summary = {
 'contrast': sorted([dict(theme=t, pair=p, tok=tok(p), v=d['v'], n=d['n'], screens=len(d['screens']), ex=d['ex']) for (t, p), d in pairs.items()], key=lambda r: -r['n'])[:14],
 'taps': sorted([dict(size=s, n=d['n'], screens=len(d['screens']), ex=', '.join(w for w, _ in d['ex'].most_common(3))) for s, d in taps.items()], key=lambda r: -r['n'])[:12],
}
fonts = collections.Counter()
for ff, fs, fw, n in D['fonts']: fonts[fs] += n
summary['sizes'] = sorted(fonts.items())
summary['families'] = len(D['fonts'])
D['summary'] = summary
html = open(os.path.expanduser('~/review/build/template.html')).read().replace('__DATA__', json.dumps(D, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/'))
out = '/tmp/claude-0/-home-claude/1f98c273-6186-59b8-a0cd-58d2fc35bfeb/scratchpad/appmap/kstati-map.html'
open(out, 'w').write(html); print(out, os.path.getsize(out))
