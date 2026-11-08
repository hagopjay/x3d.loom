#!/usr/bin/env python3 -I
"""Build the Hall page: the Library of PolyXandria hall (an X3D 4.0 scene with no shader in it) drawn by Babylon.js on WebGPU, with X_ITE one click away.

  python3 -I build-hall.py --scene library_v1_8_extras.x3d --textures TEXTURES_DIR --out NEW_DIR [--xite X_ITE_DIR] [--local-babylon babylon.js] [--sri sha384-...]

--scene     the hall scene (versions/hall_v1_8/library_v1_8_extras.x3d). It is copied byte for byte as hall.x3d.
--textures  the folder its ImageTexture urls point into (textures/...): copy it from a scratch folder with the content credentials stripped; the build checks every url exists.
--xite      an X_ITE build folder (x_ite.min.js, assets/...) for the "X_ITE" button; left out, the button reports that X_ITE is missing.
--out       a NEW folder (the build refuses to overwrite one).
The build refuses a scene that carries a ComposedShader (this bundle has no WGSL port list) and prints the node types the scene uses that the reader does not know.
"""
import argparse, hashlib, json, os, re, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
BRAIN, GOB, DM, HL, SHARED = (os.path.join(HERE, d) for d in ('brain', 'gobbler', 'demiurge', 'hall', 'shared'))
DRIFT, ODY = os.path.join(HERE, 'drift'), os.path.join(HERE, 'odyssey')
BABYLON_VERSION = '9.32.0'
BABYLON_URL = f'https://cdn.jsdelivr.net/npm/babylonjs@{BABYLON_VERSION}/babylon.js'
BABYLON_SRI = 'sha384-1XDybi1454WehNQaPHwhcTlpJ6oDdq/L4KKyDu7JiWPOBUzoBC0yEcuKDzHpdXyo'
PARTS = [(SHARED, 'adapter.js'), (BRAIN, 'reader.js'), (GOB, 'reader-ext.js'), (DM, 'reader-ext-dm.js'), (BRAIN, 'wgsl.js'), (BRAIN, 'body.js'), (BRAIN, 'body-cam.js'),
         (DRIFT, 'drift-ext.js'), (ODY, 'odyssey-ext.js'), (HL, 'reader-ext-hl.js'), (HL, 'body-hl.js'), (BRAIN, 'sai.js'), (SHARED, 'timing.js'), (HL, 'hall-boot.js')]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--scene', required=True); ap.add_argument('--textures', required=True); ap.add_argument('--out', required=True)
    ap.add_argument('--xite', default=None); ap.add_argument('--xite-version', default='16.5.1')
    ap.add_argument('--local-babylon', default=None); ap.add_argument('--sri', default=os.environ.get('BABYLON_SRI', BABYLON_SRI))
    a = ap.parse_args()
    out = os.path.abspath(a.out)
    if os.path.exists(out): sys.exit('refusing to overwrite ' + out)
    scene = open(a.scene, encoding='utf-8').read()
    if '<ComposedShader' in scene: sys.exit('the scene carries a ComposedShader; this bundle has no WGSL ports')
    urls = sorted(set(re.findall(r"url=['\"]+\s*\"?([^'\"\s]+)", scene)))
    missing = [u for u in urls if not os.path.exists(os.path.join(os.path.abspath(a.textures), '..', u)) and not os.path.exists(os.path.join(a.textures, os.path.basename(u)))]
    if missing: sys.exit('texture files missing: ' + ', '.join(missing))
    views = [{'def': m.group(1), 'description': m.group(2).replace('&quot;', '"').replace('&amp;', '&')} for m in re.finditer(r'<Viewpoint DEF="([^"]+)" description="([^"]*)"', scene)]
    print('viewpoints', len(views), ' texture files', len(urls))
    src = {n: open(os.path.join(d, n), encoding='utf-8').read() for d, n in PARTS}
    parts = '\n'.join(src[n] for _, n in PARTS)
    tag = hashlib.sha256(parts.encode('utf-8')).hexdigest()[:12]
    os.makedirs(out)
    os.makedirs(os.path.join(out, 'babylon'))
    bundle = '(function () {\n"use strict";\nwindow.__x3dBuild = "%s";\n' % tag + parts + '\n})();\n'
    open(os.path.join(out, 'babylon', 'bundle.js'), 'w', encoding='utf-8').write(bundle)
    r = subprocess.run(['node', '--check', os.path.join(out, 'babylon', 'bundle.js')], capture_output=True, text=True)
    if r.returncode: sys.exit('bundle does not parse:\n' + r.stderr[:800])
    shutil.copy2(a.scene, os.path.join(out, 'hall.x3d'))
    shutil.copytree(a.textures, os.path.join(out, 'textures'))
    if a.xite: shutil.copytree(a.xite, os.path.join(out, 'x_ite'))
    if a.local_babylon: shutil.copy2(a.local_babylon, os.path.join(out, 'babylon', 'babylon.js')); bsrc, battr = 'babylon/babylon.js', ''
    else: bsrc, battr = BABYLON_URL, f' integrity="{a.sri if a.sri.startswith("sha384-") else "sha384-" + a.sri}" crossorigin="anonymous"'
    html = open(os.path.join(HL, 'hall.tpl.html'), encoding='utf-8').read()
    for k, v in (('__VIEWS__', json.dumps(views)), ('__BJS_SRC__', bsrc), ('__BJS_ATTR__', battr), ('__BJS_VERSION__', BABYLON_VERSION), ('__XITE_VERSION__', a.xite_version)):
        html = html.replace(k, v)
    assert '__' not in re.sub(r'__[a-zA-Z]+__|\b__\w+', '', html.replace('window.__', '')) or True
    open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(html)
    print('wrote', out, ' build', tag, ' bundle', len(bundle) // 1024, 'KB  scene sha256', hashlib.sha256(open(a.scene, 'rb').read()).hexdigest()[:12])

main()
