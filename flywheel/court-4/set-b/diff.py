#!/usr/bin/env python3
"""Combines harness raw output with pixel statistics -> witness.json
usage: diff.py raw.json shots_dir witness.json"""
import json, os, sys
from PIL import Image, ImageChops
raw, shots, outp = sys.argv[1:4]
r = json.load(open(raw))
def img(n): return Image.open(os.path.join(shots, n + '.png')).convert('RGB')
def nonbg(im):
    bg = im.getpixel((1, 1)); px = list(im.get_flattened_data())
    return sum(1 for p in px if max(abs(p[i]-bg[i]) for i in range(3)) > 12) / len(px)
def differ(a, b):
    d = list(ImageChops.difference(a, b).get_flattened_data())
    return sum(1 for p in d if max(p) > 12) / len(d)
out = {'tools': {'chromium': r['chromium']}, 'pairs': {}, 'decoys': {}, 'raw': r['files']}
for i in range(1, 21):
    f, t = 'fault-%02d.x3d' % i, 'twin-%02d.x3d' % i
    if f not in r['files'] or t not in r['files']: continue
    a, b = img(f), img(t)
    out['pairs']['%02d' % i] = {
        'pixels_differ_fraction': round(differ(a, b), 4),
        'fault_drawn_fraction': round(nonbg(a), 4), 'twin_drawn_fraction': round(nonbg(b), 4),
        'fault_console': [m['type'] + ': ' + m['text'] for m in r['files'][f]['console']],
        'twin_console': [m['type'] + ': ' + m['text'] for m in r['files'][t]['console']],
        'fault_probe': r['files'][f].get('probe'), 'twin_probe': r['files'][t].get('probe'),
        'twin_centre_pixel': b.getpixel((200, 150)), 'fault_centre_pixel': a.getpixel((200, 150))}
for i in range(1, 6):
    d = 'decoy-%02d.x3d' % i
    if d not in r['files']: continue
    a = img(d)
    out['decoys']['%02d' % i] = {'drawn_fraction': round(nonbg(a), 4), 'centre_pixel': a.getpixel((200, 150)),
        'mirror_asymmetry_fraction': round(differ(a, a.transpose(Image.FLIP_LEFT_RIGHT)), 4),
        'console': [m['type'] + ': ' + m['text'] for m in r['files'][d]['console']],
        'errors': r['files'][d]['errors'], 'warnings': r['files'][d]['warnings']}
if 'decoy-03.x3d' in r['files'] and 'twin-05.x3d' in r['files']:
    out['decoys']['03']['pixels_differ_from_twin_05_fraction'] = round(differ(img('decoy-03.x3d'), img('twin-05.x3d')), 4)
for k in list(r['files']):
    if k.startswith('tmp-'):
        out.setdefault('extra', {})[k] = {'drawn_fraction': round(nonbg(img(k)), 4)}
json.dump(out, open(outp, 'w'), indent=1)
for k, v in out['pairs'].items():
    print(k, v['pixels_differ_fraction'], v['fault_drawn_fraction'], v['twin_drawn_fraction'], 'F:', v['fault_console'], 'T:', v['twin_console'], v['fault_probe'], v['twin_probe'])
for k, v in out['decoys'].items(): print('decoy', k, v)
