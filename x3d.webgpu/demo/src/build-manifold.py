#!/usr/bin/env python3 -I
"""Build the Manifold of Emotion WebGPU page (SCAFFOLD: checks the shader key table and bundles the parts; the page template and SAI additions are not written yet).

  python3 -I build-manifold.py --site SITE_FOLDER --out OUT.html [--sri SHA384]

--site  the manifold Pages folder (index.html, src/, scenes/manifold.x3d, cases/): the x3d.STEM studies/manifold build.
Reuses brain/{reader,wgsl,body,body-cam,sai,boot}.js and adds manifold/*. Babylon is pinned and loaded from the CDN with an integrity hash; nothing is downloaded at build time.
Exit code 1 if the scene carries GLSL with no WGSL port (law 40: a missing port must be known before publishing)."""
import argparse, hashlib, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
BABYLON_VERSION = '9.32.0'
BABYLON_URL = f'https://cdn.jsdelivr.net/npm/babylonjs@{BABYLON_VERSION}/babylon.js'
BABYLON_SRI = 'sha384-1XDybi1454WehNQaPHwhcTlpJ6oDdq/L4KKyDu7JiWPOBUzoBC0yEcuKDzHpdXyo'   # of babylonjs@9.32.0/babylon.js, measured 7 Nov 2026
PARTS = [('brain', 'reader.js'), ('manifold', 'manifold-reader-ext.js'), ('brain', 'wgsl.js'), ('manifold', 'manifold-wgsl.js'),
         ('brain', 'body.js'), ('brain', 'body-cam.js'), ('manifold', 'body-manifold.js'), ('brain', 'sai.js'), ('manifold', 'boot-manifold.js')]

def fnv(s):
    h = 0x811c9dc5
    for ch in s: h ^= ord(ch); h = (h * 0x01000193) & 0xffffffff
    return '%08x' % h

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--site', required=True); ap.add_argument('--out', required=True); ap.add_argument('--sri', default=BABYLON_SRI)
    a = ap.parse_args()
    # 1. every key in MF_BY_HASH must exist in the scene, and every ComposedShader in the scene must have a key (census.py prints the same table)
    table = dict(re.findall(r"'([0-9a-f]{8}-[0-9a-f]{8})': '(\w+)'", open(os.path.join(HERE, 'manifold', 'manifold-wgsl.js')).read().split('const MF_BY_HASH')[1]))
    scene = open(os.path.join(a.site, 'scenes', 'manifold.x3d'), encoding='utf-8').read()
    seen = {}
    for m in re.finditer(r"<ComposedShader DEF='([^']*)'[^>]*>(.*?)</ComposedShader>", scene, re.S):
        import base64, urllib.parse
        def src(body):
            u = body.strip(); c = u.index(','); head, data = u[:c], u[c + 1:]
            return base64.b64decode(data).decode() if 'base64' in head.lower() else (urllib.parse.unquote(data) if re.search(r'%[0-9a-fA-F]{2}', data) else data)
        parts = {ty: src(s) for ty, s in re.findall(r"<ShaderPart type='(\w+)'><!\[CDATA\[(.*?)\]\]>", m.group(2), re.S)}
        n = lambda t: re.sub(r'\s+', ' ', t).strip()
        seen[m.group(1)] = fnv(n(parts['VERTEX'])) + '-' + fnv(n(parts['FRAGMENT']))
    missing = [d for d, k in seen.items() if k not in table]
    if missing: sys.exit('GLSL with no WGSL port: ' + ', '.join(missing))
    print('shader keys in the scene:', len(seen), 'all in the port table')
    # 2. bundle (the page template, the boot file and the SAI additions are still to write: see MANIFOLD-PORT-PLAN.md section 8)
    sys.exit('scaffold: page template and boot-manifold.js are not written yet; see x3d.webgpu/MANIFOLD-PORT-PLAN.md')

main()
