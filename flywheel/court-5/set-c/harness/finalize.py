#!/usr/bin/env python3
"""Builds MANIFEST.json from harness/meta.json, harness/xsd.json, witness.json and screenshot statistics."""
import json, os
import numpy as np
from PIL import Image
H = os.path.dirname(os.path.abspath(__file__)); R = os.path.dirname(H)
meta = json.load(open(H + '/meta.json')); xsd = json.load(open(H + '/xsd.json')); wit = json.load(open(R + '/witness.json'))['scenes']
SEEN = {  # what the 400x300 X_ITE screenshots showed (fault | twin), read by eye from harness/shots
 1: "fault: table and floor black, only the bulb glows | twin: floor grey and table red-brown, lit",
 2: "fault: three pillars are black silhouettes | twin: pillars lit warm on the side facing the lantern",
 3: "fault: ball renders white-grey (X_ITE ignores the unknown attribute silently) | twin: ball renders copper",
 4: "fault: axes drawn, curve absent (black on black) | twin: yellow curve drawn",
 5: "fault: tile renders plain white, no pattern | twin: red and white 2x2 checker",
 6: "fault: one brick copy in the lower-left corner, the rest smeared with edge pixels | twin: 4x4 tiling",
 7: "fault: arrow points down, green strip on top | twin: arrow points up, green strip at the bottom",
 8: "fault: X_ITE warns 'Array length must be multiple of components size' and shows corners red, yellow-green, magenta, cyan-ish gradient | twin: red, green, blue, yellow corners",
 9: "fault: no pane, ball plain yellow on light grey | twin: translucent blue pane over a dimmed ball",
 10: "fault and twin render the same text; X_ITE accepts the unquoted value as one string and prints a console warning about MFString quoting",
 11: "fault: title starts at the door's centre line and runs right (origin x = 0) | twin: title centred over the door (origin x = -1.64)",
 12: "fault: all five posts saturated red | twin: posts fade towards the background colour with distance",
 13: "fault: horizon band deep blue, lighter above | twin: orange at the horizon turning blue-violet above",
 14: "fault: no shadow on the floor | twin: dark elliptical shadow on the floor beside the ball",
 15: "views are identical at load; the difference appears only while orbiting, which the harness does not drive",
 16: "fault: empty light-grey view, no blocks | twin: four blue blocks and the orange drum in plan",
 17: "fault: only the railing, towers missing | twin: railing and both towers",
 18: "fault: a flat-looking box at the starting distance | twin: a shaded sphere",
 19: "fault: plain box after arrival, level_changed = 2 | twin: tower with roof after arrival, level_changed = 0",
 20: "views are identical; the difference is audible only and the headless browser has no audio output to sample",
}
REASONED = {15, 20}; DISAGREE = {10}
man = {}
def stats(n):
    A = np.asarray(Image.open('%s/shots/fault-%02d.png' % (H, n)).convert('RGB')).astype(int)
    B = np.asarray(Image.open('%s/shots/twin-%02d.png' % (H, n)).convert('RGB')).astype(int)
    return float((np.abs(A - B).sum(axis=2) > 30).mean())
def ilines(w):
    return '; '.join('%s -> %s (got %s)' % (i['line'], 'holds' if i['holds'] else 'FAILS', i.get('got')) for i in w['intents']) or 'no testable intent line'
for n in range(1, 21):
    f, t = 'fault-%02d.x3d' % n, 'twin-%02d.x3d' % n
    m = meta[f]; d = stats(n)
    note = "%s. Pixels differing fault vs twin: %.1f%%. Intent on fault: %s. Console (fault): %s" % (
        SEEN[n], 100 * d, ilines(wit[f]), [c for c in wit[f]['console'] if 'GL Driver' not in c] or 'none')
    e = dict(category=m['category'], fault=m['fault'], viewer_sees=m['viewer_sees'], spec=m['spec'], xsd_valid=xsd[f]['xsd_valid'],
             witness='reasoned' if n in REASONED else 'x_ite-16.8.0', witness_note=note, twin=t, nearest_prior=m['nearest_prior'],
             engine_disagrees=n in DISAGREE, testable_intent=bool(m['intents']))
    if not xsd[f]['xsd_valid']:
        e['xsd_error'] = xsd[f]['errors'][0][:200]
    man[f] = e
    assert xsd[t]['xsd_valid'] and not xsd[t]['component_short']
    man[t] = dict(category=m['category'], intent=m['prose'], xsd_valid=True, witness='reasoned' if n in REASONED else 'x_ite-16.8.0',
                  witness_note="Loads in X_ITE; %s. Intent: %s." % (SEEN[n].split('| twin: ')[-1], ilines(wit[t])))
    assert all(i['holds'] for i in wit[t]['intents']), t
for n in range(1, 6):
    f = 'decoy-%02d.x3d' % n; m = meta[f]; w = wit[f]
    errs = [c for c in w['console'] if not c.startswith('warning: [.WebGL')]
    assert xsd[f]['xsd_valid'] and not errs and all(i['holds'] for i in w['intents']) and w['load'] == 'ok', f
    man[f] = dict(category=m['category'], intent=m['prose'], xsd_valid=True, witness='x_ite-16.8.0',
                  witness_note="Loads with zero console errors and renders as intended in the screenshot; intent: %s.%s" % (
                      ilines(w), ' (The first page of the run logged GL driver performance warnings about ReadPixels from the software renderer; these are not scene messages.)' if w['console'] else ''),
                  why_suspicious=m['why_suspicious'])
for h in sorted(x for x in os.listdir(R) if x.startswith('helper-')):
    man[h] = dict(category='helper', intent='media file used by a scene', witness='reasoned', witness_note='generated by harness/gen.py')
json.dump(man, open(R + '/MANIFEST.json', 'w'), indent=1)
F = [man['fault-%02d.x3d' % n] for n in range(1, 21)]
print('xsd invalid', sum(not x['xsd_valid'] for x in F), 'witnessed', sum(x['witness'] != 'reasoned' for x in F), 'reasoned', sum(x['witness'] == 'reasoned' for x in F),
      'testable', sum(x['testable_intent'] for x in F), 'disagree', sum(x['engine_disagrees'] for x in F), 'legal', sum(x['spec'].startswith('legal') for x in F))
for n in range(1, 21):
    a = open(R + '/fault-%02d.x3d' % n).read().split('</head>')[0]; b = open(R + '/twin-%02d.x3d' % n).read().split('</head>')[0]
    assert a == b, n
