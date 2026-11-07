"""Build one Collider-v2 page per HEP event scene (look v3) from src/viewer-v2.tpl.html.
python3 -I src/build-events.py OUTDIR [SCENEDIR]
SCENEDIR holds the five look-v3 scenes; default: regenerate them from kit/examples/hep/fixtures with
kit/examples/hep/build_event_scene.py --look v3 (pythia-dijet-hero, pythia-qcd-demo and pythia-zmumu reproduce the
sha256 values in runs/hep-demo-v3-20261106/scenes.sha256). The viewer template and the five hash-matched WGSL ports are
those of collider-v2; every scene's ComposedShader keys are checked against the collider's, and a scene whose GLSL differs
would fall back to no shader, so the build fails instead."""
import json, pathlib, re, sys, urllib.parse, hashlib
import xml.etree.ElementTree as ET

here = pathlib.Path(__file__).resolve().parent
d = here.parent
tpl = (here / 'viewer-v2.tpl.html').read_text()

def mfstring(s):
    out = [re.sub(r'\\(.)', r'\1', m) for m in re.findall(r'"((?:[^"\\]|\\.)*)"', s)]
    return out if out or not s.strip() else [s.strip()]

def shader_source(urls):
    for u in urls:
        if re.match(r'^\s*data:', u, re.I):
            c = u.index(','); head, body = u[:c], u[c + 1:]
            if re.search(r';base64', head, re.I):
                import base64; body = base64.b64decode(body).decode('latin-1')
            elif re.search(r'%[0-9a-f]{2}', body, re.I):
                body = urllib.parse.unquote(body)
            return body
        if re.search(r'void\s+main', u):
            return u
    return ''

def fnv1a(s):
    h = 0x811c9dc5
    for ch in s.encode('utf-16-le').decode('utf-16-le'):
        for unit in ([ord(ch)] if ord(ch) < 0x10000 else [0xD800 + ((ord(ch) - 0x10000) >> 10), 0xDC00 + ((ord(ch) - 0x10000) & 0x3FF)]):
            h ^= unit; h = (h * 0x01000193) & 0xFFFFFFFF
    return f'{h:08x}'

norm = lambda s: re.sub(r'\s+', ' ', s).strip()
ROLE = {'trk': 'tracks', 'twr': 'towers', 'shell': 'shells', 'flash': 'flash', 'haze': 'haze'}
keys = {}
root = ET.parse(d / 'collider.x3d').getroot()
for cs in root.iter('ComposedShader'):
    name = cs.get('DEF')
    if not name: continue
    role = next((v for k, v in ROLE.items() if name.startswith(k)), None)
    parts = {'VERTEX': '', 'FRAGMENT': ''}
    for part in cs.findall('ShaderPart'):
        parts[(part.get('type') or 'VERTEX').upper()] = shader_source(mfstring(part.get('url') or ''))
    keys[role] = fnv1a(norm(parts['VERTEX'])) + '-' + fnv1a(norm(parts['FRAGMENT']))
assert set(keys) == set(ROLE.values()), keys

def chips(items):
    return ('    <div id="legend" aria-label="Track colours">' + ''.join(
        f'<span><i style="background:{c}{";opacity:.75;background-image:repeating-linear-gradient(90deg,transparent 0 3px,#000 3px 5px)" if dash else ""}"></i>{t}</span>'
        for t, c, dash in items) + '</div>')


import subprocess, tempfile
repo = d.parent.parent  # x3d.loom
out = pathlib.Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
if len(sys.argv) > 2: sdir = pathlib.Path(sys.argv[2])
else:
    sdir = pathlib.Path(tempfile.mkdtemp())
    for f in sorted((repo / 'kit/examples/hep/fixtures').glob('*.event.json')):
        subprocess.run([sys.executable, '-I', str(repo / 'kit/examples/hep/build_event_scene.py'), str(f), str(sdir), '--look', 'v3'], check=True, capture_output=True)

def scene_keys(path):
    k = {}
    for cs in ET.parse(path).getroot().iter('ComposedShader'):
        name = cs.get('DEF'); role = next((v for p, v in ROLE.items() if name and name.startswith(p)), None)
        if not role: continue
        parts = {'VERTEX': '', 'FRAGMENT': ''}
        for part in cs.findall('ShaderPart'):
            parts[(part.get('type') or 'VERTEX').upper()] = shader_source(mfstring(part.get('url') or ''))
        k[role] = fnv1a(norm(parts['VERTEX'])) + '-' + fnv1a(norm(parts['FRAGMENT']))
    return k

EVENTS = [
  ('pythia-dijet-hero', 'Dijet', 'A hard-scatter dijet: two back-to-back jets of hadrons, the hero event of the Collider.'),
  ('pythia-qcd-demo', 'QCD event', 'A busy QCD event with many soft hadrons around the jets.'),
  ('pythia-zmumu', 'Z to two muons', 'A Z boson decaying to two muons (violet-white), inside the usual hadronic debris.'),
  ('pythia-qcd-inflight', 'QCD in flight', 'A QCD event drawn while its tracks are still growing out.'),
  ('exact-zmumu', 'Exact Z to two muons', 'One hand-computed Z to mu mu decay: no shower, just the two muons, so every track can be checked by eye.'),
]
ABOUT_COMMON = [
  'Every particle in the event is one track; the calorimeter crown lights up with the energy each tower caught. The event is generated and drawn as a demo, not a measurement.',
  'Look switches the same five shaders between their WebGL form and cinematic HDR (16-bit light, bloom, a tone curve that lets hot colours run to amber). As authored shows the shaders exactly as written.',
  'Drag to orbit, scroll or pinch to zoom. Keys: 1 2 3 viewpoints, T tour, L look, M slow motion, C replay, Space pause, S source, H hide.',
  'Nothing here is timed for a benchmark, and nothing is sent.']
LEGEND = chips([('+ hadron', '#14c7ff', 0), ('− hadron', '#ff1f82', 0), ('electron', '#24ff66', 0), ('muon', '#cc9eff', 0), ('proton', '#ff5724', 0), ('photon', '#ff850f', 1), ('neutral hadron', '#ffcc33', 1)])
OPTS = dict(look='hdr', displayReferred=True, tonemap='exp', bloom=0.45, bloomThreshold=0.8, exposure=1.35, glare=0.0, saturation=1.0, contrast=1.0, grade='luminance', quality='balanced',
            hdrGain=1.0, plainGain=1.0, floorY=None, zoomIn=0.08, zoomOut=4, particleLabel='Sparks', particleRange=[100, 250000], partGain=1.0, partGainHDR=1.6, startAtCycle=True, lineWidthPx=1.1,
            clock='clock', clockLabel='Event', cycleNote='clock: a new cycle, a new collision', slowMotion=True, slowRate=0.2, tourDwell=12, tourOnStart=False,
            resolutionScale=dict(field='u_resolutionScale', rows=900))
for stem, label, blurb in EVENTS:
    p = sdir / f'{stem}.x3d'
    k = scene_keys(p)
    assert k == keys, (stem, k, keys)
    x3d = p.read_text().strip(); assert '</script' not in x3d.lower()
    frag = tpl
    for kk, v in dict(TITLE=f'Collider on WebGPU: {label}', H1=f'X3D Collider on WebGPU · {label}',
                      SUB=blurb + ' Written as X3D 4.0; this page parses it, runs its ROUTEs and draws it with WebGPU, its five GLSL shaders ported to WGSL.',
                      MARQUE='', ARIA=f'X3D scene drawn with WebGPU: the collision event {label}', ABOUT='\n'.join('        <li>' + x + '</li>' for x in ABOUT_COMMON),
                      LEGEND=LEGEND, LOGHINT='A TimeSensor feeds five shader fields through ROUTEs every frame. Viewpoint binds and each new collision show here.',
                      STANDALONE=f'x3d.webgpu/demo/events/{stem}.html').items():
        frag = frag.replace('@@' + kk + '@@', v)
    frag = frag.replace('@@OPTS@@', json.dumps(OPTS))
    for role, key in keys.items(): frag = frag.replace(f'@@KEY_{role}@@', key)
    frag = frag.replace('@@X3D@@', x3d)
    left = re.findall(r'@@[A-Z_a-z]+@@', frag.replace(x3d, '')); assert not left, left
    cut = frag.index('\n<div id="stage">'); head, bd = frag[:cut], frag[cut:]
    (out / f'{stem}.html').write_text('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' + head + '\n</head>\n<body>' + bd + '\n</body>\n</html>\n')
    print(stem, len(frag), hashlib.sha256(p.read_bytes()).hexdigest()[:12])
