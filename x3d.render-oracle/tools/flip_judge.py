#!/usr/bin/env python3
"""Second judge: FLIP (flip-evaluator, LDR, default 67 ppd) of every engine against X_ITE, plus Spearman rank agreement with the primary MAE_obj judge.
FLIP is another metric on the same pictures, not an independent measurement: it can contradict the primary judge's grading, it cannot confirm a cause.
usage: flip_judge.py RUNDIR OUTDIR(oracle.json) -> OUTDIR/flip.json, flip.md"""
import sys, json, pathlib
import numpy as np
import flip_evaluator as fe
run, out = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]); r = json.loads((out / 'oracle.json').read_text())
ld = lambda e, s: (np.asarray(__import__('PIL.Image', fromlist=['x']).open(run / e / f'{s}.png').convert('RGB'), dtype=np.float32) / 255.0)
F = {}; M = {}
for s in r['scenes']:
    for e in r['engines']:
        if e == 'xite': continue
        _, mean, _ = fe.evaluate(ld('xite', s), ld(e, s), 'LDR'); F[(s, e)] = float(mean)
        p = r['pairs'].get(f'{e}|xite') or r['pairs'][f'xite|{e}']; M[(s, e)] = p[s]['mae_obj']
def rank(v): o = np.argsort(v); x = np.empty(len(v)); x[o] = np.arange(len(v)); return x
keys = list(F); a, b = rank([F[k] for k in keys]), rank([M[k] for k in keys]); rho = float(np.corrcoef(a, b)[0, 1])
res = {'flip_mean_vs_xite': {f'{s}|{e}': round(v, 4) for (s, e), v in F.items()}, 'spearman_vs_mae_obj': round(rho, 3), 'n': len(keys)}
(out / 'flip.json').write_text(json.dumps(res, indent=1))
E = [e for e in r['engines'] if e != 'xite']
L = [f'# FLIP mean vs X_ITE (LDR, 67 ppd, flip-evaluator {fe.__version__ if hasattr(fe, "__version__") else "?"}); Spearman rank agreement with MAE_obj over {len(keys)} (scene, engine) cells: {rho:.3f}', '', '| scene | ' + ' | '.join(E) + ' |', '|---|' + '--:|' * len(E)]
for s in r['scenes']: L.append(f'| {s} | ' + ' | '.join(f'{F[(s, e)]:.3f}' for e in E) + ' |')
(out / 'flip.md').write_text('\n'.join(L) + '\n'); print('\n'.join(L))
