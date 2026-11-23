#!/usr/bin/env python3
"""Majority vote: per scene, each engine's MEDIAN object-pixel MAE to the other engines. The engine with the largest median is the outlier;
an engine whose median is AGREE (<= 2) sits in the majority. usage: vote.py RUNDIR OUTDIR(oracle.json) -> OUTDIR/vote.md, vote.json"""
import sys, json, pathlib, statistics
import oracle
out = pathlib.Path(sys.argv[2]); r = json.loads((out / 'oracle.json').read_text()); E = r['engines']; V = {}
def pair(a, b, s): return r['pairs'].get(f'{a}|{b}', r['pairs'].get(f'{b}|{a}'))[s]['mae_obj']
for s in r['scenes']:
    V[s] = {e: round(statistics.median(pair(e, o, s) for o in E if o != e), 2) for e in E}
(out / 'vote.json').write_text(json.dumps(V, indent=1))
L = ['# Median distance to the other engines (object-pixel MAE, 0-255); **bold** = the outlier (largest median, and above 8)', '', '| scene | ' + ' | '.join(E) + ' |', '|---|' + '--:|' * len(E)]
cnt = {e: 0 for e in E}
for s, d in V.items():
    mx = max(d, key=d.get); cells = []
    for e in E:
        c = str(d[e]); 
        if e == mx and d[e] > 8: c = f'**{c}**'; cnt[e] += 1
        cells.append(c)
    L.append(f'| {s} | ' + ' | '.join(cells) + ' |')
L += ['', '| outlier count (scenes) | ' + ' | '.join(f'{e}: {cnt[e]}' for e in E) + ' |']
(out / 'vote.md').write_text('\n'.join(L) + '\n'); print('\n'.join(L))
