#!/usr/bin/env python3
"""usage: report.py RUNDIR OUTDIR  -> OUTDIR/{sheet.png, top5.png, matrix.md}; reads OUTDIR/oracle.json"""
import sys, json, pathlib
import numpy as np
from PIL import Image, ImageDraw
run, out = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]); r = json.loads((out / 'oracle.json').read_text())
E = ['xite', 'three', 'wgpu']; S = r['scenes']; T = 96
def im(e, s): return Image.open(run / e / f'{s}.png').convert('RGB').resize((T, T), Image.NEAREST)
def diff(a, b):
    d = np.abs(np.asarray(Image.open(run / a / f'{b[0]}.png').convert('RGB'), float) - np.asarray(Image.open(run / b[1] / f'{b[0]}.png').convert('RGB'), float)).max(axis=2)
    d = np.clip(d * 4, 0, 255).astype(np.uint8); return Image.fromarray(d).convert('RGB').resize((T, T), Image.NEAREST)
def sheet(scenes, path, cols_pair=(('three', 'xite'), ('wgpu', 'xite'))):
    LW = 190; W = LW + T * (3 + len(cols_pair)); H = 16 + (T + 2) * len(scenes)
    c = Image.new('RGB', (W, H), (14, 16, 24)); d = ImageDraw.Draw(c)
    for i, h in enumerate(E + [f'|{a}-{b}| x4' for a, b in cols_pair]): d.text((LW + i * T + 4, 3), h, fill=(180, 190, 210))
    for j, s in enumerate(scenes):
        y = 16 + j * (T + 2); d.text((4, y + T // 2 - 6), s, fill=(210, 220, 235))
        for i, e in enumerate(E): c.paste(im(e, s), (LW + i * T, y))
        for i, (a, b) in enumerate(cols_pair): c.paste(diff(b, (s, a)), (LW + (3 + i) * T, y))
    c.save(path)
sheet(S, out / 'sheet.png')
pw = r['pairs']; top = {}
for p, ps in pw.items():
    top[p] = sorted(ps.items(), key=lambda kv: (-kv[1]['mae_obj'], kv[0]))[:5]
tw = sorted(pw['wgpu|xite'].items(), key=lambda kv: -kv[1]['mae_obj'])[:5]
sheet([k for k, _ in tw], out / 'top5_wgpu_vs_xite.png', (('wgpu', 'xite'),))
L = ['# Disagreement matrix (MAE on object pixels, 0-255; grade AGREE <=2, NEAR <=8, FAR >8)', '', '| scene | xite|three | xite|wgpu | three|wgpu | three centre px | xite | wgpu |', '|---|--:|--:|--:|---|---|---|']
for s in S:
    g = lambda p: pw[p][s]; c = lambda e: ','.join(str(x) for x in r['heldout'][e][s]['got']) if s in r['heldout'][e] else ''
    L.append(f"| {s} | {g('three|xite')['mae_obj']} {g('three|xite')['grade']} | {g('wgpu|xite')['mae_obj']} {g('wgpu|xite')['grade']} | {g('three|wgpu')['mae_obj']} {g('three|wgpu')['grade']} | {c('three')} | {c('xite')} | {c('wgpu')} |")
(out / 'matrix.md').write_text('\n'.join(L) + '\n'); print('ok')
