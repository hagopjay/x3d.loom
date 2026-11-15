#!/usr/bin/env python3 -I
"""Build KANSEI ROAM for the browser: stage the patched game, then draw it with the WebGPU build of x3d.webgpu (build-drift.py).

  python3 -I tools/build.py --out OUTDIR [--stage STAGEDIR] [--babylon LOCAL_BABYLON_JS]

OUTDIR gets index.html, main.js, engine/, levels/, cars/, textures/, bundle.js: serve it over http. Without --babylon the page loads
Babylon from the CDN with the integrity hash build-drift.py pins. x3d.drift and kansei/v1, v1.1 are never touched.
"""
import argparse, os, shutil, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); LOOM = os.path.dirname(ROOT)
ap = argparse.ArgumentParser(); ap.add_argument('--out', required=True); ap.add_argument('--stage', default=''); ap.add_argument('--babylon', default='')
a = ap.parse_args()
stage = os.path.abspath(a.stage) if a.stage else tempfile.mkdtemp(prefix='roam-stage-')
out = os.path.abspath(a.out)
subprocess.check_call([sys.executable, '-I', os.path.join(HERE, 'stage.py'), '--game', os.path.join(LOOM, 'x3d.drift'), '--out', stage])
cmd = [sys.executable, '-I', os.path.join(LOOM, 'x3d.webgpu', 'demo', 'src', 'build-drift.py'), '--game', stage, '--out', out]
if a.babylon:
    shutil.copy(a.babylon, os.path.join(out, 'babylon.js')) if os.path.isdir(out) else (os.makedirs(out), shutil.copy(a.babylon, os.path.join(out, 'babylon.js')))
    cmd += ['--babylon', 'babylon.js']
subprocess.check_call(cmd)
p = os.path.join(out, 'index.html'); t = open(p, encoding='utf-8').read()
old = '<title>KANSEI · drift in X3D · WebGPU</title>'
assert t.count(old) == 1
open(p, 'w', encoding='utf-8').write(t.replace(old, '<title>KANSEI ROAM · drift in X3D · WebGPU</title>'))
print('built', out)
