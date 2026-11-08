#!/usr/bin/env python3 -I
"""Build the Dynasty Loom page with the hypersphere view drawn by Babylon.js on WebGPU.

  python3 -I build-dynasty.py --artifact ARTIFACT_DIR --out NEW_DIR [--local-babylon babylon.js] [--sri sha384-...]

--artifact  the file set that `dynasty-loom/tools/build_v2.py` writes (<out>/artifact: index.html, the family scenes, theme/, portraits/, lib/, x_ite/, ...).
--out       a NEW folder (the build refuses to overwrite one). It gets a copy of the artifact with babylon/bundle.js added and index.html patched.
What the patch does (the page's own code is not edited, only where it picks its engine):
  - Babylon (CDN with SRI, or --local-babylon) and the bundle are loaded before the page's script, which defines <x3d-babylon>
  - the shell makes the hypersphere view's canvas as <x3d-babylon> when a WebGPU adapter answers, and as X_ITE's <x3d-canvas> otherwise; the tapestry view is always X_ITE's
  - the CSS rules for x3d-canvas also name x3d-babylon
The build refuses to run if a scene carries a ComposedShader DEF that has no WGSL port.
"""
import argparse, hashlib, os, re, shutil, sys, glob

HERE = os.path.dirname(os.path.abspath(__file__))
BRAIN, GOB, DM, DL, SHARED = (os.path.join(HERE, d) for d in ('brain', 'gobbler', 'demiurge', 'dynasty', 'shared'))
BABYLON_VERSION = '9.32.0'
BABYLON_URL = f'https://cdn.jsdelivr.net/npm/babylonjs@{BABYLON_VERSION}/babylon.js'
BABYLON_SRI = 'sha384-1XDybi1454WehNQaPHwhcTlpJ6oDdq/L4KKyDu7JiWPOBUzoBC0yEcuKDzHpdXyo'
PARTS = [(SHARED, 'adapter.js'), (BRAIN, 'reader.js'), (GOB, 'reader-ext.js'), (DM, 'reader-ext-dm.js'), (DL, 'reader-ext-dl.js'), (BRAIN, 'wgsl.js'), (GOB, 'wgsl-core.js'),
         (GOB, 'wgsl-sky.js'), (GOB, 'wgsl-eye.js'), (GOB, 'wgsl-facet.js'), (GOB, 'wgsl-line.js'), (GOB, 'wgsl-point.js'), (DM, 'wgsl-dm.js'), (DL, 'wgsl-dl.js'),
         (BRAIN, 'body.js'), (BRAIN, 'body-cam.js'), (GOB, 'body-gob.js'), (DM, 'body-dm.js'), (DL, 'body-dl.js'), (BRAIN, 'sai.js'), (SHARED, 'timing.js'), (DL, 'boot-dl.js')]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--artifact', required=True); ap.add_argument('--out', required=True)
    ap.add_argument('--local-babylon', default=None); ap.add_argument('--sri', default=os.environ.get('BABYLON_SRI', BABYLON_SRI))
    a = ap.parse_args()
    art, out = os.path.abspath(a.artifact), os.path.abspath(a.out)
    if os.path.exists(out): sys.exit('refusing to overwrite ' + out)
    if not os.path.exists(os.path.join(art, 'index.html')): sys.exit('no index.html in ' + art)
    src = {n: open(os.path.join(d, n), encoding='utf-8').read() for d, n in PARTS}

    # 1. every ComposedShader DEF in the scenes needs a port
    ports = set(re.findall(r"(\w+): '(?:sky|ring|seedcore|seedglow|fiber|shell)'", re.search(r'const DL_BY_DEF = \{(.*?)\};', src['wgsl-dl.js'], re.S).group(0)))
    seen = {}
    for f in glob.glob(os.path.join(art, '**', '*.x3d'), recursive=True):
        for d in re.findall(r"<ComposedShader DEF='([^']*)'", open(f, encoding='utf-8').read()): seen.setdefault(d, 0); seen[d] += 1
    missing = sorted(set(seen) - ports)
    if missing: sys.exit('ComposedShader with no WGSL port: ' + ', '.join(missing))
    print('ComposedShader DEFs in the scenes:', ', '.join(f'{k}x{v}' for k, v in sorted(seen.items())), ' all ported')

    # 2. copy the artifact, add the bundle
    shutil.copytree(art, out, ignore=shutil.ignore_patterns('__pycache__'))
    parts = '\n'.join(src[n] for _, n in PARTS)
    tag = hashlib.sha256(parts.encode('utf-8')).hexdigest()[:12]
    bundle = '(function () {\n"use strict";\nwindow.__x3dBuild = "%s";\n' % tag + parts + '\n})();\n'
    os.makedirs(os.path.join(out, 'babylon'), exist_ok=True)
    open(os.path.join(out, 'babylon', 'bundle.js'), 'w', encoding='utf-8').write(bundle)

    # 3. the page
    html = open(os.path.join(out, 'index.html'), encoding='utf-8').read()
    if a.local_babylon:
        shutil.copy2(a.local_babylon, os.path.join(out, 'babylon', 'babylon.js')); bab = '<script src="babylon/babylon.js"></script>'
    else: bab = f'<script src="{BABYLON_URL}" integrity="{a.sri if a.sri.startswith("sha384-") else "sha384-" + a.sri}" crossorigin="anonymous"></script>'
    head = bab + '<script src="babylon/bundle.js"></script><!-- the Babylon WebGPU engine for the hypersphere view (x3d.webgpu); the tapestry view stays on X_ITE -->\n'
    html, n = re.subn(r'(<meta name="loom:xite"[^>]*>\n)', lambda m: m.group(1) + head, html, count=1); assert n == 1, 'loom:xite meta not found'
    html, n = re.subn(r"c = document\.createElement\('x3d-canvas'\); c\.id = 'x3d-' \+ v;",
                      "c = document.createElement(v === 'hyper' && window.__dlWebGPU ? 'x3d-babylon' : 'x3d-canvas'); c.id = 'x3d-' + v;", html); assert n == 1, 'canvas() not found'
    html, n = re.subn(r"(if \(!S\.xite\) \{ S\.pending = \[v, o\]; return; \}\n)",
                      lambda m: m.group(1) + "    if (v === 'hyper' && window.__dlProbe && !window.__dlProbed) { window.__dlProbe.then(function () { window.__dlProbed = true; ensure(v, o); }); return; }\n", html); assert n == 1, 'ensure() not found'
    html, n = re.subn(r'(?m)^(\s*)((?:body\[[^\]]*\]\s+)?)x3d-canvas(:active)?(\s*\{)', lambda m: f'{m.group(1)}{m.group(2)}x3d-canvas{m.group(3) or ""}, {m.group(2)}x3d-babylon{m.group(3) or ""}{m.group(4)}', html)
    assert n >= 3, 'css rules for x3d-canvas not found (%d)' % n
    html = html.replace('<noscript>This page needs JavaScript: the scenes are X3D drawn by X_ITE.</noscript>', '<noscript>This page needs JavaScript: the scenes are X3D drawn by Babylon.js or X_ITE.</noscript>')
    open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(html)
    print('wrote', os.path.join(out, 'index.html'), ' build', tag, ' bundle', len(bundle) // 1024, 'KB')

main()
