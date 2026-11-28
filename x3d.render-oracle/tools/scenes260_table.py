#!/usr/bin/env python3
"""Per-node grade table for scenes-260. usage: scenes260_table.py RUNDIR INDEX.json OUT.md
Visible nodes only; each engine vs X_ITE (object-pixel MAE). BLANK = both pictures draw nothing."""
import sys, json, pathlib, collections as C
import oracle
R = pathlib.Path(sys.argv[1]); idx = json.load(open(sys.argv[2])); E = ['three', 'babylon', 'wgpu']
rows = []; summ = {e: C.Counter() for e in E}; xblank = 0
for node, v in sorted(idx.items()):
    if v.get('kind') != 'visible': continue
    x = R / 'xite' / f'{node}.png'
    if not x.exists(): rows.append((node, v.get('component'), v.get('valid'), {e: 'X_ITE no render' for e in E})); continue
    a = oracle.load(x); blank = not oracle.fg(a).any(); xblank += blank; cells = {}
    for e in E:
        p = R / e / f'{node}.png'
        if not p.exists(): cells[e] = 'no render'; summ[e]['no render'] += 1; continue
        b = oracle.load(p); m = oracle.metrics(a, b); g = oracle.grade(m)
        if blank and not oracle.fg(b).any(): g = 'BLANK'
        cells[e] = f"{g} {m['mae_obj']}"; summ[e][g] += 1
    rows.append((node, v.get('component'), v.get('valid'), cells))
L = ['# scenes-260, visible nodes: engine vs X_ITE (object-pixel MAE, 0-255)', '',
     'Judge AGREE<=2, NEAR<=8, FAR>8. BLANK = X_ITE and the engine both draw nothing (no content compared).', '',
     '| node | component | xsd | ' + ' | '.join(E) + ' |', '|---|---|---|' + '---|' * len(E)]
for n, c, val, cells in rows:
    L.append(f"| {n} | {c} | {'ok' if val else 'INVALID'} | " + ' | '.join(('**' + cells[e] + '**' if cells[e].startswith('FAR') or 'no render' in cells[e] else cells[e]) for e in E) + ' |')
K = ['AGREE', 'NEAR', 'FAR', 'BLANK', 'no render']
L += ['', f'X_ITE blank in {xblank} of {len(rows)} visible scenes.', '', '| engine | ' + ' | '.join(K) + ' |', '|---|' + '---|' * len(K)]
for e in E: L.append(f'| {e} | ' + ' | '.join(str(summ[e][g]) for g in K) + ' |')
pathlib.Path(sys.argv[3]).write_text('\n'.join(L) + '\n'); print('\n'.join(L[-6:]))
