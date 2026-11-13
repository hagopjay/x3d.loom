#!/usr/bin/env python3 -I
"""Build the KANSEI WebGPU page: the game's own index.html, main.js and engine/ drawn by Babylon WebGPU through the x3d reader (src/brain/ + src/drift/).

  python3 -I build-drift.py --game ../../../x3d.drift --out OUTDIR [--babylon URL_OR_PATH] [--sri HASH]

--game   the x3d.drift folder.
--out    an empty (or new) folder; it gets index.html, main.js, engine/, levels/, cars/, textures/, tapes/, garage.x3d and bundle.js. Serve it over http.
The game's source files are copied byte for byte except two text edits in the COPY of main.js and index.html (the version label and the script tag); nothing in x3d.drift changes.
Babylon is loaded from the CDN with an integrity hash unless --babylon names a local file (tools use that).
"""
import argparse, hashlib, os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
BABYLON_VERSION = '9.32.0'                      # published 2026-10-22, more than two weeks old
BABYLON_URL = f'https://cdn.jsdelivr.net/npm/babylonjs@{BABYLON_VERSION}/babylon.js'
BABYLON_SRI = 'sha384-1XDybi1454WehNQaPHwhcTlpJ6oDdq/L4KKyDu7JiWPOBUzoBC0yEcuKDzHpdXyo'
PARTS = [('shared', 'adapter.js'), ('brain', 'reader.js'), ('brain', 'wgsl.js'), ('brain', 'body.js'), ('brain', 'body-cam.js'), ('drift', 'drift-ext.js'), ('brain', 'sai.js'), ('shared', 'timing.js'), ('drift', 'drift-boot.js')]
COPY = ['engine', 'levels', 'cars', 'textures', 'tapes']

def sub1(text, old, new):
    assert text.count(old) == 1, ('expected exactly one', old[:60], text.count(old))
    return text.replace(old, new)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--game', required=True); ap.add_argument('--out', required=True)
    ap.add_argument('--babylon', default=''); ap.add_argument('--sri', default=os.environ.get('BABYLON_SRI', BABYLON_SRI))
    a = ap.parse_args()
    game, out = os.path.abspath(a.game), os.path.abspath(a.out)
    os.makedirs(out, exist_ok=True)
    for d in COPY:
        dst = os.path.join(out, d)
        if os.path.exists(dst): shutil.rmtree(dst)
        shutil.copytree(os.path.join(game, d), dst)
    shutil.copy(os.path.join(game, 'garage.x3d'), out)

    parts = '\n'.join(open(os.path.join(HERE, d, f), encoding='utf-8').read() for d, f in PARTS)
    tag = hashlib.sha256(parts.encode('utf-8')).hexdigest()[:12]  # names the build in the Timing panel, so a number is tied to the code that made it
    bundle = '(function () {\n"use strict";\nwindow.__x3dBuild = "%s";\n' % tag + parts + '\n})();\n'
    open(os.path.join(out, 'bundle.js'), 'w', encoding='utf-8').write(bundle)

    main_js = open(os.path.join(game, 'main.js'), encoding='utf-8').read()
    main_js = sub1(main_js, "${ENGINE_VERSION} · X_ITE ${S.browser.version || ''} · ${HZ} Hz", "${ENGINE_VERSION} · ${S.browser.version || ''} · ${HZ} Hz")
    open(os.path.join(out, 'main.js'), 'w', encoding='utf-8').write(main_js)

    html = open(os.path.join(game, 'index.html'), encoding='utf-8').read()
    html = re.sub(r'<script src="vendor/x_ite/x_ite\.min\.js"[^\n]*</script>',
                  lambda m: ('<script src="%s"%s></script>\n' % (a.babylon if a.babylon else BABYLON_URL,
                             '' if a.babylon else ' integrity="%s" crossorigin="anonymous"' % (a.sri if a.sri.startswith('sha384-') else 'sha384-' + a.sri)))
                            + '<script src="bundle.js"></script>', html, count=1)
    assert 'bundle.js' in html, 'x_ite script tag not found'
    html = sub1(html, '<title>KANSEI · drift in X3D</title>', '<title>KANSEI · drift in X3D · WebGPU</title>')
    html = html.replace('drawn by X_ITE and driven', 'drawn by Babylon WebGPU through an X3D reader and driven')
    open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(html)
    print('wrote', out, 'bundle', len(bundle) // 1024, 'KB sha256', hashlib.sha256(bundle.encode()).hexdigest()[:16])

main()
