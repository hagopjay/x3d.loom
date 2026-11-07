"""Build the standalone WebGPU viewer pages from src/viewer.tpl.html: the collider showpiece and First Light v1.1.
python3 -I src/build.py [collider|first-light]  ->  collider.html and first-light-v1.1.html next to their .x3d scenes."""
import json, pathlib, re, sys, urllib.parse
import xml.etree.ElementTree as ET

src = pathlib.Path(__file__).resolve().parent
d = src.parent
tpl = (src / 'viewer.tpl.html').read_text()

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
    src = {'VERTEX': '', 'FRAGMENT': ''}
    for part in cs.findall('ShaderPart'):
        src[(part.get('type') or 'VERTEX').upper()] = shader_source(mfstring(part.get('url') or ''))
    keys[role] = fnv1a(norm(src['VERTEX'])) + '-' + fnv1a(norm(src['FRAGMENT']))
assert set(keys) == set(ROLE.values()), keys

def chips(items):
    return ('    <div id="legend" aria-label="Track colours">' + ''.join(
        f'<span><i style="background:{c}{";opacity:.75;background-image:repeating-linear-gradient(90deg,transparent 0 3px,#000 3px 5px)" if dash else ""}"></i>{t}</span>'
        for t, c, dash in items) + '</div>')

PAGES = {
  'collider': dict(
    x3d='collider.x3d', std='collider.html',
    TITLE='Collider on WebGPU', H1='X3D Collider on WebGPU',
    SUB='One collider event written as X3D 4.0. This page parses it, runs its ROUTEs and draws it with WebGPU, its five GLSL shaders ported to WGSL.',
    ARIA='X3D scene drawn with WebGPU: a particle collision at the centre of a glass detector, with coloured tracks curling out and a crown of calorimeter towers',
    ABOUT='\n'.join('        <li>' + x + '</li>' for x in [
      'Two protons meet at the centre every 12 seconds. Tracks grow out from the vertex and curl in the magnetic field: colour is the particle kind, brightness and width its momentum. The calorimeter crown lights up with the energy each tower caught, blue to amber to red.',
      'The event is generated and drawn as a demo, not a measurement.',
      'Look switches the same five shaders between their WebGL form (each ends with its own tone curve, written straight to an 8-bit canvas) and HDR: light adds up in 16-bit float, then bloom and a filmic tone curve.',
      'Drag to orbit, scroll or pinch to zoom. Keys: 1 2 3 viewpoints, T tour, L look, M slow motion, C replay, Space pause, S source, H hide.',
      'Nothing here is timed for a benchmark, and nothing leaves this page.']),
    LEGEND=chips([('+ hadron', '#14c7ff', 0), ('− hadron', '#ff1f82', 0), ('electron', '#24ff66', 0), ('muon', '#cc9eff', 0), ('proton', '#ff5724', 0),
                  ('photon', '#ff850f', 1), ('neutral hadron', '#ffcc33', 1)]),
    LOGHINT='A TimeSensor feeds five shader fields through ROUTEs every frame. Viewpoint binds, slider moves and each new collision show here.',
    STANDALONE='x3d.webgpu/demo/collider.html',
    OPTS=dict(look='hdr', displayReferred=True, tonemap='exp', bloom=0.5, bloomThreshold=0.8, exposure=1.3, hdrGain=1.0, plainGain=1.0, floorY=None, zoomIn=0.08, zoomOut=4,
              particleLabel='Sparks', particleRange=[100, 250000], partGain=1.0, partGainHDR=1.6, startAtCycle=True, lineWidthPx=1.1, clock='clock', clockLabel='Event',
              cycleNote='clock: a new cycle, a new collision', slowMotion=True, slowRate=0.2, tourDwell=12, tourOnStart=False,
              resolutionScale=dict(field='u_resolutionScale', rows=900))),
  'first-light': dict(
    x3d='first-light.x3d', std='first-light-v1.1.html',
    TITLE='X3D First Light', H1='X3D First Light',
    SUB='An X3D 4.0 scene, parsed and run by this page, drawn with WebGPU on your GPU.',
    ARIA='X3D scene drawn with WebGPU: a gold orb above a pedestal inside a turning ring of steel monoliths, with a fountain of embers',
    ABOUT='\n'.join('        <li>' + x + '</li>' for x in [
      'Drag to orbit, scroll or pinch to zoom. Touch the orb: its TouchSensor starts a TimeSensor, and three interpolators drive the ember speed, a light and the orb\'s glow, all through ROUTEs.',
      'Renderer choices beyond the X3D spec: ambient light taken from the Background, bloom, ACES tone mapping and additive embers. X_ITE stays the reference renderer.',
      'Nothing here is timed for a benchmark, and nothing leaves this page.']),
    LEGEND='', LOGHINT='Touch the orb to watch a cascade go by.', STANDALONE='x3d.webgpu/demo/first-light-v1.1.html',
    OPTS=dict(look='hdr', displayReferred=False, bloom=0.12, exposure=1.0, floorY=0.15, zoomIn=0.16, zoomOut=7, particleLabel='Embers',
              particleRange=[10000, 250000], partGain=1.25, partGainHDR=1.25, slowMotion=False)),
}
for name, P in PAGES.items():
    if len(sys.argv) > 1 and name not in sys.argv[1:]: continue
    x3d = (d / P['x3d']).read_text().strip()
    assert '</script' not in x3d.lower()
    frag = tpl
    for k in ('TITLE', 'H1', 'SUB', 'ARIA', 'ABOUT', 'LEGEND', 'LOGHINT', 'STANDALONE'):
        frag = frag.replace('@@' + k + '@@', P[k])
    frag = frag.replace('@@OPTS@@', json.dumps(P['OPTS']))
    for role, key in keys.items():
        frag = frag.replace(f'@@KEY_{role}@@', key)
    frag = frag.replace('@@X3D@@', x3d)
    left = re.findall(r'@@[A-Z_a-z]+@@', frag.replace(x3d, ''))
    assert not left, left
    cut = frag.index('</style>') + len('</style>')
    head, body = frag[:cut], frag[cut:]
    std = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
           '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
           + head + '\n</head>\n<body>' + body + '\n</body>\n</html>\n')
    (d / P['std']).write_text(std)
    print(name, len(frag), len(std))
print(json.dumps(keys))
