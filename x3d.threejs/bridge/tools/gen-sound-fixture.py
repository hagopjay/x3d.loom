"""Writes fixtures/Sound.x3d and Sound.test.json of the three.js bridge. Expected levels are computed here from 19775-1 16.2.2.3 as X_ITE 16.6.0 reads it."""
import json, math, struct, base64, sys, os
out = sys.argv[1]
sr, n = 8000, 2000                      # 0.25 s of a 1 kHz sine at amplitude 0.5: 250 whole cycles, so the loop has no seam
pcm = bytes(int(round(128 + 0.5 * 127 * math.sin(2 * math.pi * 1000 * i / sr))) for i in range(n))
wav = b'RIFF' + struct.pack('<I', 36 + n) + b'WAVEfmt ' + struct.pack('<IHHIIHH', 16, 1, 1, sr, sr, 1, 8) + b'data' + struct.pack('<I', n) + pcm
uri = 'data:audio/wav;base64,' + base64.b64encode(wav).decode()
x3d = f'''<?xml version="1.0" encoding="UTF-8"?>
<X3D profile="Immersive" version="4.0" xmlns:xsd="http://www.w3.org/2001/XMLSchema-instance" xsd:noNamespaceSchemaLocation="https://www.web3d.org/specifications/x3d-4.0.xsd">
  <head><component name="Sound" level="2"/><meta name="title" content="Sound.x3d"/><meta name="description" content="three.js bridge fixture for Sound: loudness between the two ellipsoids, pan, intensity, an unspatialized sound and an AudioClip source"/></head>
  <Scene>
    <Viewpoint position="0 0 10"/>
    <Transform DEF="T" translation="0 0 9.5">
      <Sound DEF="N"><OscillatorSource DEF="SO" containerField="source" frequency="1000"><PeriodicWave type="SINE"/></OscillatorSource></Sound>
    </Transform>
    <Transform translation="-3 0 6">
      <Sound DEF="N2" spatialize="false"><OscillatorSource DEF="SO2" containerField="source" frequency="1000"><PeriodicWave type="SINE"/></OscillatorSource></Sound>
    </Transform>
    <Transform translation="0 0 9.5">
      <Sound DEF="N3"><AudioClip DEF="AC" loop="true" url='"{uri}"'/></Sound>
    </Transform>
  </Scene>
</X3D>
'''
open(os.path.join(out, 'Sound.x3d'), 'w').write(x3d)
EYE = (0, 0, 10); RMS = math.sqrt(0.5)
def level(pos, mn=1, mx=10):            # spheres (back = front): a straight line from 1 at the inner radius to 0 at the outer
    d = math.dist(pos, EYE); return 1 if d < mn else 0 if d >= mx else (mx - d) / (mx - mn)
def pan(pos):
    v = [pos[i] - EYE[i] for i in range(3)]; ln = math.hypot(*v); p = 1 - math.acos(max(-1, min(1, v[0] / ln))) / math.pi
    return 1 - p * p, 1 - (1 - p) ** 2
steps, agree = [], []
def E(d, f, v): steps.append({'expect': [d, f, v]})
for d in ('N',):
    E(d, 'intensity', 1); E(d, 'minBack', 1); E(d, 'minFront', 1); E(d, 'maxBack', 10); E(d, 'maxFront', 10); E(d, 'spatialize', True); E(d, 'enabled', True); E(d, 'location', [0, 0, 0]); E(d, 'direction', [0, 0, 1])
E('N2', 'spatialize', False)
steps += [{'tap': ['p', 'N', 'out', {'channels': 2}]}, {'tap': ['p2', 'N2', 'out', {'channels': 2}]}, {'tap': ['p3', 'N3', 'out', {'channels': 2}]},
          {'set': ['SO', 'startTime', '$now']}, {'set': ['SO2', 'startTime', '$now']}, {'set': ['AC', 'startTime', '$now']}]
def measure(tap, key, l, r, tol=0.012, agr=0.012, settle=1.3):
    steps.append({'settle': settle})
    for ch, nm, v in ((0, 'L', l), (1, 'R', r)):
        k = key + nm
        if v < 1e-6: steps.append({'sig': [tap, k, {'ch': ch, 'from': -0.3}, {'silent': True}]})
        else:
            steps.append({'sig': [tap, k, {'ch': ch, 'f0': 1000, 'from': -0.3}]}); steps.append({'amap': [repr(round(v, 5)), 'x.' + k]}); steps.append({'close': [k + '.rms', 'x.' + k, tol]})
        agree.append([k + '.rms', agr])
def move(pos): steps.append({'set': ['T', 'translation', list(pos), 'SFVec3f']})
def case(key, pos, scale=1.0, **kw):
    g = level(pos, **kw) * scale; pl, pr = pan(pos); measure('p', key, RMS * g * pl, RMS * g * pr)
case('inside', (0, 0, 9.5))                                   # inside the inner sphere: full level, straight ahead (0.75 each side)
move((0, 0, 4.5)); case('half', (0, 0, 4.5))                  # 5.5 away: (10 - 5.5) / 9 = 0.5
move((-3, 0, 6)); case('left', (-3, 0, 6))                    # 5 away, to the left
move((3, 0, 6)); case('right', (3, 0, 6))
move((0, 0, -5)); case('outside', (0, 0, -5))                 # 15 away: outside the outer sphere, silent
move((0, 0, 4.5)); steps.append({'set': ['N', 'intensity', 0.5]}); case('inten', (0, 0, 4.5), 0.5)
steps.append({'set': ['N', 'intensity', 5]}); case('clamp', (0, 0, 4.5), 1.0)          # intensity is held to 0..1
steps.append({'set': ['N', 'intensity', 1]})
# an ellipsoid: the sound 12 away, pointing at the listener, 20 long in front and 5 behind
move((0, 0, -2)); steps += [{'set': ['N', 'maxFront', 20]}, {'set': ['N', 'maxBack', 5]}]
measure('p', 'front', RMS * (20 - 12) / (20 - 1) * 0.75, RMS * (20 - 12) / (20 - 1) * 0.75)
steps.append({'set': ['N', 'direction', [0, 0, -1], 'SFVec3f']}); measure('p', 'back', 0, 0)   # turned away: the listener is behind it, 12 > 5
g2 = level((-3, 0, 6)); measure('p2', 'flat', RMS * g2, RMS * g2, settle=0.2)                   # spatialize FALSE: the level without the pan, the same in both ears
measure('p3', 'clip', 0.5 * RMS * 0.75, 0.5 * RMS * 0.75, tol=0.02, agr=0.03, settle=0.2)      # the AudioClip (amplitude 0.5) through a Sound, inside the inner sphere
steps += [{'set': ['N2', 'enabled', False]}, {'settle': 1.0}, {'sig': ['p2', 'off', {'ch': 0, 'from': -0.3}, {'silent': True}]}]
spec = {'node': 'Sound', 'mode': 'scene',
  'note': 'The classic Sound node of the three.js bridge against X_ITE 16.6.0, signal for signal on the page\'s real Web Audio clock. A 1 kHz sine (rms 0.7071) plays through a Sound (source field) that a Transform moves about a listener at 0 0 10: inside the inner sphere (full level; straight ahead each ear gets 1 - 0.5^2 = 0.75), half way between the spheres (0.5), to the left and to the right (pan from the direction in view space: left = 1 - pan^2, right = 1 - (1 - pan)^2), outside the outer sphere (silent), intensity 0.5 and 5 (held to 1), then an ellipsoid 20 long in front and 5 behind seen from in front ((20 - 12) / 19) and from behind (silent). A second Sound with spatialize FALSE gives the same level in both ears, and a third plays an AudioClip (a 0.25 s wave file in a data url, looped). Each expected number is computed in python from the formulas (tools/gen-sound-fixture.py writes this file and the scene), and the two engines must also agree with each other.',
  'steps': steps, 'agree': agree,
  'gaps': ['priority is held and not used (one voice per node, no voice stealing)',
           'with minBack, minFront, maxBack or maxFront of 0 X_ITE 16.6.0 reads a matrix left over from the last ellipsoid; the bridge treats such an ellipsoid as empty and measures to the sound\'s own place, so that case is not compared',
           'a Sound plays whenever it is enabled; in X_ITE it plays only while it is traversed (a Switch that hides it silences it)',
           'AudioClip: pauseTime and resumeTime stop and restart the buffer at the paused position; X_ITE plays a media element, so the loop point of a clip that is not a whole number of cycles differs by a few samples',
           'MovieTexture as a sound source is not played'],
  'scope': ['levels are the rms of the last 0.3 s of each ear at the node\'s output stage (ours: the out gain, X_ITE: getSoundDestination()); the rotation term (front and back gains) cannot be told apart with a mono source and is not measured; hearing is not tested, only the signal']}
json.dump(spec, open(os.path.join(out, 'Sound.test.json'), 'w'), indent=1)
print(len(steps), 'steps', len(agree), 'agree keys', len(uri), 'uri chars')
