#!/usr/bin/env python3 -I
"""Build the Gobbler 3 WebGPU page: the knowledge-graph page's own HTML, CSS and common.js, drawn by Babylon WebGPU through the x3d reader (src/brain/ plus src/gobbler/).

  python3 -I build-gobbler.py --page ../../../../x3d.ml/gobbler-v3/build-public-candidate --out OUT.html [--single] [--local-babylon babylon.js]

--page   a Gobbler 3 build folder (gobbler3.html, common.js, common.css, gobbler3.x3d, graph-v3.json) from hagopjay/x3d.ml gobbler-v3/.
--out    where to write. Without --single the page needs its folder next to it and is served over http.
--single inline the scene, the graph json, common.js and common.css so the file runs alone (private pages).
--local-babylon  load Babylon from this relative path instead of the CDN (the headless harness serves a local copy).
The build refuses to run if the scene carries GLSL that has no WGSL port. The scene, the page and the graph are NOT committed to the public repository:
the public candidate names two outside maintainers and waits for its owner's "publish".
"""
import argparse, base64, hashlib, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
BRAIN, GOB, SHARED = os.path.join(HERE, 'brain'), os.path.join(HERE, 'gobbler'), os.path.join(HERE, 'shared')
BABYLON_VERSION = '9.32.0'                      # same pin as the brain and KANSEI ports
BABYLON_URL = f'https://cdn.jsdelivr.net/npm/babylonjs@{BABYLON_VERSION}/babylon.js'
BABYLON_SRI = 'sha384-1XDybi1454WehNQaPHwhcTlpJ6oDdq/L4KKyDu7JiWPOBUzoBC0yEcuKDzHpdXyo'
PARTS = [(SHARED, 'adapter.js'), (BRAIN, 'reader.js'), (GOB, 'reader-ext.js'), (BRAIN, 'wgsl.js'), (GOB, 'wgsl-core.js'),
         (GOB, 'wgsl-sky.js'), (GOB, 'wgsl-eye.js'), (GOB, 'wgsl-facet.js'), (GOB, 'wgsl-line.js'), (GOB, 'wgsl-point.js'),
         (BRAIN, 'body.js'), (BRAIN, 'body-cam.js'), (GOB, 'body-gob.js'), (BRAIN, 'sai.js'), (SHARED, 'timing.js'), (GOB, 'boot-gob.js')]

def fnv(s):
    h = 0x811c9dc5
    for ch in s:
        h ^= ord(ch); h = (h * 0x01000193) & 0xffffffff
    return '%08x' % h

def shader_keys(scene_text):
    out = {}
    for m in re.finditer(r"<ComposedShader DEF='([^']*)'[^>]*>(.*?)</ComposedShader>", scene_text, re.S):
        parts = {ty: src[src.index(',') + 1:] for ty, src in re.findall(r"<ShaderPart type='(\w+)'><!\[CDATA\[(.*?)\]\]>", m.group(2), re.S)}
        norm = lambda s: re.sub(r'\s+', ' ', s).strip()
        out[m.group(1)] = fnv(norm(parts['VERTEX'])) + '-' + fnv(norm(parts['FRAGMENT']))
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--page', required=True); ap.add_argument('--out', required=True)
    ap.add_argument('--single', action='store_true'); ap.add_argument('--local-babylon', default=None)
    ap.add_argument('--sri', default=os.environ.get('BABYLON_SRI', BABYLON_SRI))
    a = ap.parse_args()
    page = os.path.abspath(a.page)
    html = open(os.path.join(page, 'gobbler3.html'), encoding='utf-8').read()
    scene = open(os.path.join(page, 'gobbler3.x3d'), encoding='utf-8').read()

    # 1. every GLSL program in the scene needs a port
    src = {n: open(os.path.join(d, n), encoding='utf-8').read() for d, n in PARTS}
    known = set(re.findall(r"key: '([0-9a-f]{8}-[0-9a-f]{8})'", ''.join(src[n] for _, n in PARTS if n.startswith('wgsl-'))))
    keys = shader_keys(scene)
    missing = {k: v for k, v in keys.items() if v not in known}
    if missing: sys.exit('GLSL with no WGSL port: ' + ', '.join(f'{k} {v}' for k, v in sorted(missing.items())))
    print('ComposedShaders in the scene:', len(re.findall(r'<ComposedShader ', scene)), ' distinct programs:', len(set(keys.values())), ' all ported')

    # 2. the page: Babylon in place of X_ITE
    html, n = re.subn(r'<link rel="stylesheet" href="vendor/x_ite/x_ite\.css">', '', html); assert n == 1, 'x_ite.css link not found'
    html, n = re.subn(r'<title>[^<]*</title>', '<title>Gobbler 3 on WebGPU · PolyXandria</title>', html); assert n == 1
    html, n = re.subn(r'Demo · Gobbler 3 · scriptless X3D 4\.0 knowledge graph', 'Demo · Gobbler 3 · the same scriptless X3D 4.0 scene, drawn by Babylon.js on WebGPU', html); assert n == 1
    html = html.replace('x3d-canvas', 'x3d-canvas')   # the element stays: boot-gob.js defines it

    parts = '\n'.join(src[n] for _, n in PARTS)
    tag = hashlib.sha256(parts.encode('utf-8')).hexdigest()[:12]
    bundle = '(function () {\n"use strict";\nwindow.__x3dBuild = "%s";\n' % tag + parts + '\n})();\n'
    if a.local_babylon: bab = f'<script src="{a.local_babylon}"></script>\n'
    else: bab = f'<script src="{BABYLON_URL}" integrity="{a.sri if a.sri.startswith("sha384-") else "sha384-" + a.sri}" crossorigin="anonymous"></script>\n'
    tags = ''
    if a.single:
        vfs = {'gobbler3.x3d': base64.b64encode(scene.encode('utf-8')).decode()}
        tags += '<script>window.__VFS = ' + json.dumps(vfs, separators=(',', ':')) + ';\n(function(){var f=window.fetch;window.fetch=function(u,o){var k=String(u).replace(/^.*\\//,"");if(k==="graph-v3.json")return Promise.resolve(new Response(' + json.dumps(open(os.path.join(page, 'graph-v3.json'), encoding='utf-8').read()) + ',{headers:{"content-type":"application/json"}}));return f.apply(this,arguments)}})();</script>\n'
        css = open(os.path.join(page, 'common.css'), encoding='utf-8').read(); js = open(os.path.join(page, 'common.js'), encoding='utf-8').read()
        html, n = re.subn(r'<link rel="stylesheet" href="common\.css">', lambda m: '<style>' + css + '</style>', html); assert n == 1
        html, n = re.subn(r'<script src="common\.js"></script>', lambda m: '<script>' + js.replace('</script', '<\\/script') + '</script>', html); assert n == 1
    html, n = re.subn(r'<script src="vendor/x_ite/x_ite\.min\.js"></script>', lambda m: tags + bab + '<script>\n' + bundle + '</script>', html); assert n == 1, 'x_ite script not found'
    open(a.out, 'w', encoding='utf-8').write(html)
    print('wrote', a.out, len(html) // 1024, 'KB  build', tag, ' sha256', hashlib.sha256(html.encode()).hexdigest()[:16])

main()
