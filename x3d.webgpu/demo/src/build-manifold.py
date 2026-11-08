#!/usr/bin/env python3 -I
"""Build the Manifold of Emotion WebGPU page: the original page's own HUD, math and app.js, drawn by Babylon WebGPU through the x3d reader (src/brain/ + src/manifold/).

  python3 -I build-manifold.py --site SITE_FOLDER --out OUT_FOLDER [--sri SHA384]

--site  the manifold Pages folder (index.html, src/, scenes/manifold.x3d, cases/rest/case.json): the x3d.STEM studies/manifold build.
--out   a new folder (must not exist): index.html, src/ (page files + webgpu.bundle.js + webgpu.css), scenes/, cases/rest/. Serve it over http.
Babylon is pinned and loaded from the CDN with an integrity hash; nothing is downloaded at build time.
Exit code 1 if the scene carries GLSL with no WGSL port (law 40: a missing port must be known before publishing).

app.js is copied with ONE patch, recorded here as a finding: the Save-image path drew the 2D lens canvas when the lens was on; with Babylon's pipeline the
final frame (bloom included) is already in the WebGPU canvas, so it reads that canvas always. Text that named the old renderer is updated."""
import argparse, base64, hashlib, os, re, shutil, sys, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
BABYLON_VERSION = '9.32.0'
BABYLON_URL = f'https://cdn.jsdelivr.net/npm/babylonjs@{BABYLON_VERSION}/babylon.js'
BABYLON_SRI = 'sha384-1XDybi1454WehNQaPHwhcTlpJ6oDdq/L4KKyDu7JiWPOBUzoBC0yEcuKDzHpdXyo'   # of babylonjs@9.32.0/babylon.js, measured 7 Nov 2026
PARTS = [('brain', 'reader.js'), ('manifold', 'manifold-reader-ext.js'), ('brain', 'wgsl.js'), ('manifold', 'manifold-wgsl.js'),
         ('brain', 'body.js'), ('brain', 'body-cam.js'), ('manifold', 'body-manifold.js'), ('brain', 'sai.js'), ('manifold', 'boot-manifold.js'), ('manifold', 'manifold-timing.js')]

def fnv(s):
    h = 0x811c9dc5
    for ch in s: h ^= ord(ch); h = (h * 0x01000193) & 0xffffffff
    return '%08x' % h

def src_of(body):
    u = body.strip(); c = u.index(','); head, data = u[:c], u[c + 1:]
    return base64.b64decode(data).decode() if 'base64' in head.lower() else (urllib.parse.unquote(data) if re.search(r'%[0-9a-fA-F]{2}', data) else data)

def shader_keys(scene):
    out = {}
    for m in re.finditer(r"<ComposedShader DEF='([^']*)'[^>]*>(.*?)</ComposedShader>", scene, re.S):
        parts = {ty: src_of(s) for ty, s in re.findall(r"<ShaderPart type='(\w+)'><!\[CDATA\[(.*?)\]\]>", m.group(2), re.S)}
        n = lambda t: re.sub(r'\s+', ' ', t).strip()
        out[m.group(1)] = fnv(n(parts['VERTEX'])) + '-' + fnv(n(parts['FRAGMENT']))
    return out

def replace_once(text, old, new, what):
    if text.count(old) != 1: sys.exit(f'patch target not found exactly once: {what}')
    return text.replace(old, new)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--site', required=True); ap.add_argument('--out', required=True); ap.add_argument('--sri', default=BABYLON_SRI)
    a = ap.parse_args()
    site, out = os.path.abspath(a.site), os.path.abspath(a.out)
    if os.path.exists(out): sys.exit('output folder exists; never overwrite: ' + out)

    # 1. every ComposedShader in the scene must have a port, and every port key must be in the scene
    table = dict(re.findall(r"'([0-9a-f]{8}-[0-9a-f]{8})': '(\w+)'", open(os.path.join(HERE, 'manifold', 'manifold-wgsl.js')).read().split('const MF_BY_HASH')[1]))
    scene = open(os.path.join(site, 'scenes', 'manifold.x3d'), encoding='utf-8').read()
    seen = shader_keys(scene)
    missing = [d for d, k in seen.items() if k not in table]
    if missing: sys.exit('GLSL with no WGSL port: ' + ', '.join(missing))
    print('shader keys in the scene:', len(seen), 'all in the port table;', len(set(table) - set(seen.values())), 'unused ports')

    # 2. files
    os.makedirs(os.path.join(out, 'src')); os.makedirs(os.path.join(out, 'scenes')); os.makedirs(os.path.join(out, 'cases', 'rest'))
    for f in ('original.css', 'app.css', 'FONT-LICENSE.txt', 'math-core.js', 'field.js', 'labels.js'):
        shutil.copy(os.path.join(site, 'src', f), os.path.join(out, 'src', f))
    shutil.copy(os.path.join(site, 'scenes', 'manifold.x3d'), os.path.join(out, 'scenes', 'manifold.x3d'))
    shutil.copy(os.path.join(site, 'cases', 'rest', 'case.json'), os.path.join(out, 'cases', 'rest', 'case.json'))
    app = open(os.path.join(site, 'src', 'app.js'), encoding='utf-8').read()
    app = replace_once(app, 'const from = $("lensToggle").checked && lens ? $("lens") : src;', 'const from = src;   // WebGPU port: the final frame, bloom included, is in the canvas', 'snapshot source')
    open(os.path.join(out, 'src', 'app.js'), 'w', encoding='utf-8').write(app)
    open(os.path.join(out, 'src', 'webgpu.css'), 'w').write('canvas#scene{position:fixed;inset:0;width:100%;height:100%;touch-action:none;outline:none}\n')

    # 3. the bundle
    bundle = '(function () {\n"use strict";\n' + '\n'.join(open(os.path.join(HERE, d, f), encoding='utf-8').read() for d, f in PARTS) + '\n})();\n'
    bundle = bundle.replace('__BUILD_ID__', hashlib.sha256(bundle.encode()).hexdigest()[:12])   # the id the timing block carries
    open(os.path.join(out, 'src', 'webgpu.bundle.js'), 'w', encoding='utf-8').write(bundle)

    # 4. the page
    html = open(os.path.join(site, 'index.html'), encoding='utf-8').read()
    html = replace_once(html, '<script src="vendor/x_ite/x_ite.min.js"></script>\n', '', 'x_ite script')
    html = replace_once(html, '<link rel="stylesheet" href="src/app.css">', '<link rel="stylesheet" href="src/app.css">\n<link rel="stylesheet" href="src/webgpu.css">', 'css')
    html, n = re.subn(r'<x3d-canvas id="scene"[^>]*></x3d-canvas>', '<canvas id="scene" tabindex="0" role="application" aria-label="Interactive three-dimensional emotional manifold, drawn with WebGPU from an X3D scene. Drag to orbit, scroll to zoom, click to create a perturbation. Press H to hide controls."></canvas>', html)
    assert n == 1, 'x3d-canvas not found'
    html = replace_once(html, '<script src="src/lens.js"></script>\n<script src="src/app.js"></script>',
                        f'<script src="{BABYLON_URL}" integrity="{a.sri if a.sri.startswith("sha384-") else "sha384-" + a.sri}" crossorigin="anonymous"></script>\n<script src="src/webgpu.bundle.js"></script>', 'script tags')
    html = replace_once(html, 'X3D · X_ITE 16.5.1', 'X3D · Babylon WebGPU', 'stat label')
    html = replace_once(html, 'seven GLSL shaders that bring it to life in X_ITE', 'seven GLSL shaders that bring it to life (this page draws them with Babylon on WebGPU, hand-ported to WGSL)', 'about text')
    html = html.replace('<title>Manifold — an emotional field · X3D</title>', '<title>Manifold — an emotional field · X3D on WebGPU</title>')
    open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(html)
    print('wrote', out, '| bundle', len(bundle) // 1024, 'KB sha256', hashlib.sha256(bundle.encode()).hexdigest()[:16], '| index', len(html) // 1024, 'KB')

main()
