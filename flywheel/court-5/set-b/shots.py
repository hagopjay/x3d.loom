#!/usr/bin/env python3
"""Pixel statistics of the witness screenshots: lit fraction per file and fault/twin difference."""
import json, os
from PIL import Image, ImageChops
H = os.path.dirname(os.path.abspath(__file__)); S = os.path.join(H, 'witness-shots')
def lit(im):
    g = im.convert('L').point(lambda v: 255 if v > 8 else 0); return round(sum(1 for v in g.getdata() if v) / (im.width * im.height), 4)
out = {}
for f in sorted(os.listdir(S)):
    out[f] = {'lit_fraction': lit(Image.open(os.path.join(S, f)).convert('RGB'))}
for n in range(1, 21):
    a = Image.open(os.path.join(S, 'fault-%02d.png' % n)).convert('RGB'); b = Image.open(os.path.join(S, 'twin-%02d.png' % n)).convert('RGB')
    d = ImageChops.difference(a, b).convert('L').point(lambda v: 255 if v > 8 else 0)
    out['pair-%02d' % n] = {'differing_fraction': round(sum(1 for v in d.getdata() if v) / (a.width * a.height), 4),
                            'fault_lit': out['fault-%02d.png' % n]['lit_fraction'], 'twin_lit': out['twin-%02d.png' % n]['lit_fraction']}
    print('pair-%02d' % n, out['pair-%02d' % n])
for k, v in out.items():
    if k.startswith('decoy'): print(k, v)
json.dump(out, open(os.path.join(H, 'shots.json'), 'w'), indent=1)
