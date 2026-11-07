#!/usr/bin/env python3 -I
"""Build the Chirp WebGPU page: the study's own index.html, src/app.js and cases drawn by Babylon WebGPU through the x3d reader (src/brain/ + src/drift/ + src/chirp/).

  python3 -I build-chirp.py --study PATH_TO_CHIRP_FOLDER --out OUTDIR [--babylon URL_OR_PATH] [--sri HASH]

--study  the Chirp study folder (index.html, src/, scenes/, cases/), for example docs/demos/stem/v1/chirp in hagopjay/x3d.demo.
--out    a new folder; it gets index.html, src/app.js, src/app.css, scenes/, cases/ and bundle.js. Serve it over http.
The study's app.js is copied byte for byte; only index.html changes (the script tags, which now load app.js after the Babylon body is up, and the title). Nothing in the study folder changes.
"""
import argparse, hashlib, os, re, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
BABYLON_VERSION = '9.32.0'
BABYLON_URL = f'https://cdn.jsdelivr.net/npm/babylonjs@{BABYLON_VERSION}/babylon.js'
BABYLON_SRI = 'sha384-1XDybi1454WehNQaPHwhcTlpJ6oDdq/L4KKyDu7JiWPOBUzoBC0yEcuKDzHpdXyo'
PARTS = [('chirp', 'chirp-pre.js'), ('brain', 'reader.js'), ('brain', 'wgsl.js'), ('brain', 'body.js'), ('brain', 'body-cam.js'), ('drift', 'drift-ext.js'), ('chirp', 'chirp-look.js'), ('brain', 'sai.js'), ('chirp', 'chirp-boot.js')]

def sub1(text, old, new):
    assert text.count(old) == 1, ('expected exactly one', old[:60], text.count(old))
    return text.replace(old, new)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--study', required=True); ap.add_argument('--out', required=True)
    ap.add_argument('--babylon', default=''); ap.add_argument('--sri', default=os.environ.get('BABYLON_SRI', BABYLON_SRI))
    a = ap.parse_args()
    study, out = os.path.abspath(a.study), os.path.abspath(a.out)
    os.makedirs(os.path.join(out, 'src'), exist_ok=True)
    for d in ('scenes', 'cases'):
        dst = os.path.join(out, d)
        if os.path.exists(dst): shutil.rmtree(dst)
        shutil.copytree(os.path.join(study, d), dst)
    for f in ('app.js', 'app.css'): shutil.copy(os.path.join(study, 'src', f), os.path.join(out, 'src', f))
    parts = '\n'.join(open(os.path.join(HERE, d, f), encoding='utf-8').read() for d, f in PARTS)
    tag = hashlib.sha256(parts.encode('utf-8')).hexdigest()[:12]
    open(os.path.join(out, 'bundle.js'), 'w', encoding='utf-8').write('(function () {\n"use strict";\nwindow.__chirpBuild = "%s";\n' % tag + parts + '\n})();\n')
    html = open(os.path.join(study, 'index.html'), encoding='utf-8').read()
    html = sub1(html, '<link rel="stylesheet" href="vendor/x_ite/x_ite.css">\n', '')
    html = sub1(html, '<script src="vendor/x_ite/x_ite.min.js"></script>',
                '<script src="%s"%s></script>\n<script src="bundle.js"></script>' % (a.babylon if a.babylon else BABYLON_URL,
                '' if a.babylon else ' integrity="%s" crossorigin="anonymous"' % (a.sri if a.sri.startswith('sha384-') else 'sha384-' + a.sri)))
    html = sub1(html, '<script src="src/app.js"></script>', '<script>(window.__chirpReady || Promise.resolve()).then(function () { var s = document.createElement("script"); s.src = "src/app.js"; document.body.appendChild(s); });</script>')
    html = sub1(html, '<title>Chirp · x3d.STEM</title>', '<title>Chirp · WebGPU</title>')
    open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(html)
    print('wrote', out, 'build', tag)

main()
