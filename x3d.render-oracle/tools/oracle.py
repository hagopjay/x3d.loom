#!/usr/bin/env python3
"""Cross-engine render oracle: differ, planted controls, held-out judge, matrix.
usage: oracle.py RUNDIR [--repeat RUNDIR2] --expected conformance/expected.json --out OUT
RUNDIR/<engine>/<scene>.png, 8-bit sRGB, same size for every engine.

PRE-REGISTERED (fixed before any engine pair was scored; do not tune after):
  primary judge   MAE_obj  mean |a-b| over RGB, 0-255, on object pixels (pixel differs from its picture's corner colour by > 8, in either picture)
                  (v1 used the whole frame; the control run showed it hides defects on white furnace backgrounds, so v2 = object pixels, thresholds unchanged)
  AGREE  MAE_obj <= 2.0   (8-bit rounding + encode slack)
  NEAR   MAE_obj <= 8.0
  FAR    MAE_obj  > 8.0
  whole-frame MAE is still reported
  secondary       IoU of foreground masks (pixel differs from its own top-left corner colour by > 8), centre-5x5 mean delta, PSNR
  HELD-OUT judge  centre-5x5 pixel of each engine vs the X_ITE 16.7.1 record in x3d.wgpu conformance/expected.json (never used to pick thresholds)
"""
import sys, json, itertools, pathlib, argparse
import numpy as np
from PIL import Image

AGREE, NEAR = 2.0, 8.0

def load(p): return np.asarray(Image.open(p).convert('RGB'), dtype=np.float32)

def fg(a):
    return (np.abs(a - a[0, 0]).max(axis=2) > 8)

def metrics(a, b):
    d = np.abs(a - b)
    fa, fb = fg(a), fg(b)
    mae = float(d.mean())
    mse = float(((a - b) ** 2).mean())
    psnr = 99.0 if mse == 0 else float(10 * np.log10(255 ** 2 / mse))
    u = (fa | fb).sum()
    iou = 1.0 if u == 0 else float((fa & fb).sum() / u)
    c = d[62:67, 62:67].mean()
    m = fa | fb
    mo = float(d[m].mean()) if m.any() else 0.0
    return dict(mae_obj=round(mo, 3), mae=round(mae, 3), psnr=round(psnr, 2), iou=round(iou, 3), centre=round(float(c), 2), bad8=round(float((d.max(axis=2) > 8).mean()), 4))

def grade(m): return 'AGREE' if m['mae_obj'] <= AGREE else 'NEAR' if m['mae_obj'] <= NEAR else 'FAR'

def controls(base):
    """Known-bad variants of one picture. Each must be caught (grade != AGREE) unless marked 'expect_pass'."""
    o = {}
    o['bright+4'] = np.clip(base + 4, 0, 255)
    o['bright+12'] = np.clip(base + 12, 0, 255)
    o['gain x1.10'] = np.clip(base * 1.10, 0, 255)
    o['shift 1px'] = np.roll(base, 1, axis=1)
    o['shift 3px'] = np.roll(base, 3, axis=1)
    o['swap R<->B'] = base[:, :, ::-1]
    o['flip vertical'] = base[::-1]
    o['noise sd1 (expect_pass)'] = np.clip(base + np.random.default_rng(7).normal(0, 1, base.shape), 0, 255)
    return o

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('run'); ap.add_argument('--repeat'); ap.add_argument('--expected'); ap.add_argument('--out', required=True)
    a = ap.parse_args(); run = pathlib.Path(a.run); out = pathlib.Path(a.out); out.mkdir(parents=True, exist_ok=True)
    engines = sorted(p.name for p in run.iterdir() if p.is_dir())
    scenes = sorted(set.intersection(*[{f.stem for f in (run / e).glob('*.png')} for e in engines]))
    img = {(e, s): load(run / e / f'{s}.png') for e in engines for s in scenes}
    res = {'engines': engines, 'scenes': scenes, 'pairs': {}, 'controls': {}, 'determinism': {}, 'heldout': {}}
    for e1, e2 in itertools.combinations(engines, 2):
        res['pairs'][f'{e1}|{e2}'] = {s: metrics(img[(e1, s)], img[(e2, s)]) for s in scenes}
    for ps in res['pairs'].values():
        for m in ps.values(): m['grade'] = grade(m)
    # controls: planted defects on every scene of the first engine; differ must flag all but the expect_pass one
    e0 = engines[0]; cres = {}
    for s in scenes:
        for k, v in controls(img[(e0, s)]).items():
            m = metrics(img[(e0, s)], v); caught = grade(m) != 'AGREE'
            c = cres.setdefault(k, {'n': 0, 'observable': 0, 'caught': 0, 'mae': []}); c['n'] += 1; c['mae'].append(m['mae_obj'])
            if m['mae_obj'] > 0.25: c['observable'] += 1; c['caught'] += caught
    # a planted-defect scene whose picture does not change under the defect (uniform furnace) cannot be caught by any differ: report, do not hide
    for k, c in cres.items(): c['mae_median'] = round(float(np.median(c.pop('mae'))), 3)
    res['controls'] = cres
    if a.repeat:
        rr = pathlib.Path(a.repeat)
        for e in engines:
            ms = [metrics(img[(e, s)], load(rr / e / f'{s}.png'))['mae_obj'] for s in scenes]
            res['determinism'][e] = {'max_mae': max(ms), 'n': len(ms)}
    if a.expected:
        ex = json.loads(pathlib.Path(a.expected).read_text())
        rows = {r['id']: r for r in ex['rows']}
        for e in engines:
            d = {}
            for s in scenes:
                if s in rows:
                    px = img[(e, s)][62:67, 62:67].reshape(-1, 3).mean(axis=0)
                    d[s] = dict(got=[round(float(x)) for x in px], expected=rows[s]['expected'], delta=round(float(np.abs(px - np.array(rows[s]['expected'])).max()), 1), tol=rows[s]['max_delta'])
            res['heldout'][e] = d
        res['heldout_source'] = ex['sources']['xite-furnace-colour']['short']
    (out / 'oracle.json').write_text(json.dumps(res, indent=1))
    print(json.dumps({k: res[k] for k in ('controls', 'determinism')}, indent=1))
    for p, ps in res['pairs'].items():
        g = [m['grade'] for m in ps.values()]; print(p, {x: g.count(x) for x in ('AGREE', 'NEAR', 'FAR')})

if __name__ == '__main__': main()
