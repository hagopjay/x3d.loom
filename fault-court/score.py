import json, sys, hashlib, math
from math import comb
sys.path.insert(0, 'rules')
import loom_rules_x3d as RX, loom_rules_gltf as RG, loom_rules_usd as RU
from run import half
OUT = 'out/cases'
man = json.load(open(f'{OUT}/cases.json'))
blob = open(f'{OUT}/held-base.json', 'rb').read()
print('held-out sha256', hashlib.sha256(blob).hexdigest())
base = {**json.load(open(f'{OUT}/learn-base.json')), **json.loads(blob)}
RULES = {'x3d': RX, 'gltf': RG, 'usd': RU}
F3 = ('x3d', 'gltf', 'usd')
res = {}
for cid, c in man.items():
    res[cid] = {}
    for f in F3:
        b = base[cid][f]
        if 'status' in b:
            res[cid][f] = {'base': b['status'], 'loom': b['status']}; continue
        caught = (not b['loaded']) or bool(b['findings'])
        where = 'load' if not b['loaded'] else (sorted({x['tool'].split(':')[0] for x in b['findings']}) if b['findings'] else [])
        try:
            r = RULES[f].rules(c['files'][f])
        except Exception as e:
            r = [f'CRASH {e!r}']
        res[cid][f] = {'base': 'caught' if caught else 'miss', 'loom': 'caught' if (caught or r) else 'miss', 'where': where, 'rules': r[:3],
                       'first': (b['findings'][0]['msg'][:160] if b['findings'] else '')}
faults = [k for k in man if k != 'clean' and not man[k]['decoy']]
def rate(ids, f, arm):
    xs = [res[i][f][arm] for i in ids if res[i][f][arm] in ('caught', 'miss')]
    return sum(x == 'caught' for x in xs), len(xs)
def mcnemar(b, c):
    n = b + c
    if n == 0: return 1.0
    k = min(b, c)
    return min(1.0, 2 * sum(comb(n, i) for i in range(k + 1)) / 2 ** n)
S = {}
for f in F3:
    S[f] = {'stateable': sum(res[i][f]['base'] not in ('NE', 'NA') for i in faults),
            'base_all': rate(faults, f, 'base'),
            'decoy_flags_base': sum(res[i][f]['base'] == 'caught' for i in man if man[i]['decoy']),
            'decoy_flags_loom': sum(res[i][f]['loom'] == 'caught' for i in man if man[i]['decoy']),
            'clean_flag': res['clean'][f]['base'] == 'caught',
            'held_base': rate([i for i in faults if half(i) == 'held'], f, 'base'),
            'held_loom': rate([i for i in faults if half(i) == 'held'], f, 'loom'),
            'learn_base': rate([i for i in faults if half(i) == 'learn'], f, 'base'),
            'learn_loom': rate([i for i in faults if half(i) == 'learn'], f, 'loom')}
H1 = {}
for g in ('gltf', 'usd'):
    both = [i for i in faults if res[i]['x3d']['base'] in ('caught', 'miss') and res[i][g]['base'] in ('caught', 'miss')]
    xc = sum(res[i]['x3d']['base'] == 'caught' for i in both); gc = sum(res[i][g]['base'] == 'caught' for i in both)
    b = sum(res[i]['x3d']['base'] == 'caught' and res[i][g]['base'] == 'miss' for i in both)
    c = sum(res[i]['x3d']['base'] == 'miss' and res[i][g]['base'] == 'caught' for i in both)
    diff = 100 * (xc - gc) / len(both)
    p = mcnemar(b, c)
    H1[g] = {'paired_n': len(both), 'x3d_caught': xc, 'other_caught': gc, 'diff_points': round(diff, 1), 'x3d_only': b, 'other_only': c,
             'mcnemar_p': round(p, 4), 'pass': diff >= 15 and p < 0.05}
fam = {}
for fm in 'ABCDEF':
    ids = [i for i in faults if i[0] == fm]
    fam[fm] = {f: rate(ids, f, 'base') for f in F3}
H3 = {f: round(100 * (S[f]['held_loom'][0] - S[f]['held_base'][0]) / max(1, S[f]['held_base'][1]), 1) for f in F3}
H3pass = sum(H3[f] >= 10 and S[f]['decoy_flags_loom'] - S[f]['decoy_flags_base'] <= 1 for f in F3) >= 2
out = {'summary': S, 'H1': H1, 'H2_pass': (not S['x3d']['clean_flag']) and S['x3d']['decoy_flags_base'] <= 1, 'H3_gain_points': H3, 'H3_pass': H3pass,
       'families': fam, 'cases': res}
json.dump(out, open(f'{OUT}/score.json', 'w'), indent=1)
print(json.dumps({k: out[k] for k in ('summary', 'H1', 'H2_pass', 'H3_gain_points', 'H3_pass', 'families')}, indent=1))
