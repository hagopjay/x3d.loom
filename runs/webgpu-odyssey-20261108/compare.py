#!/usr/bin/env python3 -I
"""python3 -I compare.py OUT_SHEET.jpg PREFIX_A PREFIX_B [PREFIX_C ...] TIME [TIME ...]
Stills named PREFIX-TTTTT.png (see odyssey-shot.js). Prints PSNR / mean luminance of every later prefix against the first (X_ITE), and writes a contact sheet:
one row per film time, one column per prefix, all resized to the first image's size. PSNR is a correctness log, not a target (the standing rule: no pixel perfection)."""
import sys, math
import numpy as np
from PIL import Image, ImageDraw
sheet, args = sys.argv[1], sys.argv[2:]
times = [a for a in args if a.replace('.', '', 1).isdigit()]
prefixes = [a for a in args if a not in times]
def load(p, t, size=None):
    im = Image.open('%s-%05.1f.png' % (p, float(t))).convert('RGB')
    if size and im.size != size: im = im.resize(size, Image.LANCZOS)
    return im
rows = []
for t in times:
    base = load(prefixes[0], t); size = base.size; row = [base]
    b = np.asarray(base, dtype=np.float64)
    print('t=%s  %-28s lum %.1f' % (t, prefixes[0].split('/')[-1], b.mean()))
    for p in prefixes[1:]:
        im = load(p, t, size); a = np.asarray(im, dtype=np.float64)
        mse = ((a - b) ** 2).mean(); psnr = 99 if mse == 0 else 10 * math.log10(255 ** 2 / mse)
        print('       %-28s lum %.1f  PSNR vs first %.1f dB' % (p.split('/')[-1], a.mean(), psnr)); row.append(im)
    rows.append(row)
w, h = rows[0][0].size
S = Image.new('RGB', (w * len(prefixes), h * len(rows)))
d = ImageDraw.Draw(S)
for r, row in enumerate(rows):
    for c, im in enumerate(row):
        S.paste(im, (c * w, r * h)); d.text((c * w + 6, r * h + 4), '%s  t=%s' % (prefixes[c].split('/')[-1], times[r]), fill=(255, 255, 255))
S.save(sheet, quality=88)
