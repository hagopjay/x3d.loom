#!/usr/bin/env python3 -I
"""Build the Gobbler demiurge WebGPU page: the page's own HTML, CSS, boot.js, sound.js, the v4 hover layer and common.js, drawn by Babylon WebGPU through the x3d reader
(src/brain/, src/gobbler/ and src/demiurge/).

  python3 -I build-demiurge.py --repo ../../../../x3d.onto --out NEW_DIR [--local-babylon babylon.js] [--sri sha384-...]

--repo   a checkout of hagopjay/x3d.onto after `make v4-data demiurge-data` (gobbler-demiurge/data/bird/ and gobbler-v4/data/ and engine/ must exist).
--out    a NEW folder (the build refuses to overwrite one). The page is OUT/gobbler-demiurge/index.html, with OUT/gobbler-v4/ beside it as the page expects.
--flat    also write a flat copy (OUT-flat) for a private host that adds its own document skeleton and cannot serve ../ paths or .gz (CDN Babylon with SRI, scene and graph as
         base64 text of their gzip, the AAC beds as .mp4). Prints the published paths; the .x3d files must be sent as text/plain.
--local-babylon  copy of babylon.js to serve from OUT/babylon/ instead of the CDN (the headless harness).
The build refuses to run if the bird scene carries GLSL that has no WGSL port. Nothing from x3d_ML's private Deep build is committed to the public loom repository: the built
folder stays in scratch or in a private page. X_ITE is not shipped; the reference renderer is run from the repo's own vendor folder by the harness.
"""
import argparse, hashlib, os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
BRAIN, GOB, DM, SHARED = (os.path.join(HERE, d) for d in ('brain', 'gobbler', 'demiurge', 'shared'))
BABYLON_VERSION = '9.32.0'
BABYLON_URL = f'https://cdn.jsdelivr.net/npm/babylonjs@{BABYLON_VERSION}/babylon.js'
BABYLON_SRI = 'sha384-1XDybi1454WehNQaPHwhcTlpJ6oDdq/L4KKyDu7JiWPOBUzoBC0yEcuKDzHpdXyo'
PARTS = [(SHARED, 'adapter.js'), (BRAIN, 'reader.js'), (GOB, 'reader-ext.js'), (DM, 'reader-ext-dm.js'), (BRAIN, 'wgsl.js'), (GOB, 'wgsl-core.js'),
         (GOB, 'wgsl-sky.js'), (GOB, 'wgsl-eye.js'), (GOB, 'wgsl-facet.js'), (GOB, 'wgsl-line.js'), (GOB, 'wgsl-point.js'), (DM, 'wgsl-dm.js'),
         (BRAIN, 'body.js'), (BRAIN, 'body-cam.js'), (GOB, 'body-gob.js'), (DM, 'body-dm.js'), (BRAIN, 'sai.js'), (SHARED, 'timing.js'), (DM, 'boot-dm.js')]
SCENES = ['gobbler4-bird.x3d.gz', 'gobbler4-bird-gold.x3d.gz', 'earth-planet.x3d', 'earth-clouds.x3d', 'earth-moon.x3d', 'village.x3d', 'villagers.x3d']

def fnv(s):
    h = 0x811c9dc5
    for ch in s:
        h ^= ord(ch); h = (h * 0x01000193) & 0xffffffff
    return '%08x' % h

def shader_keys(text):
    out = {}
    for m in re.finditer(r"<ComposedShader DEF='([^']*)'[^>]*>(.*?)</ComposedShader>", text, re.S):
        parts = {ty: src[src.index(',') + 1:] for ty, src in re.findall(r"<ShaderPart (?:DEF='\w+' )?type='(\w+)'><!\[CDATA\[(.*?)\]\]>", m.group(2), re.S)}
        if 'VERTEX' not in parts: continue          # the weave programs share parts by USE; the first carries them
        norm = lambda s: re.sub(r'\s+', ' ', s).strip()
        out[m.group(1)] = fnv(norm(parts['VERTEX'])) + '-' + fnv(norm(parts['FRAGMENT']))
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--repo', required=True); ap.add_argument('--out', required=True)
    ap.add_argument('--flat', action='store_true'); ap.add_argument('--local-babylon', default=None); ap.add_argument('--sri', default=os.environ.get('BABYLON_SRI', BABYLON_SRI))
    a = ap.parse_args()
    repo, out = os.path.abspath(a.repo), os.path.abspath(a.out)
    if os.path.exists(out): sys.exit('refusing to overwrite ' + out)
    gd, g4 = os.path.join(repo, 'gobbler-demiurge'), os.path.join(repo, 'gobbler-v4')
    bird = os.path.join(gd, 'data', 'bird')
    for f in SCENES + ['anchors.json', 'graph-v3.json.gz', 'world.json', 'receipt.json']:
        if not os.path.exists(os.path.join(bird, f)): sys.exit('missing ' + f + ' in ' + bird + ' (run make v4-data demiurge-data)')

    # 1. every GLSL program in the bird scene needs a port
    src = {n: open(os.path.join(d, n), encoding='utf-8').read() for d, n in PARTS}
    known = set(re.findall(r"key: '([0-9a-f]{8}-[0-9a-f]{8})'", ''.join(src[n] for _, n in PARTS if n.startswith('wgsl-'))))
    import gzip
    scene = gzip.open(os.path.join(bird, 'gobbler4-bird.x3d.gz'), 'rt', encoding='utf-8').read()
    keys = shader_keys(scene)
    missing = {k: v for k, v in keys.items() if v not in known}
    if missing: sys.exit('GLSL with no WGSL port: ' + ', '.join(f'{k} {v}' for k, v in sorted(missing.items())))
    print('ComposedShaders in the scene:', len(re.findall(r'<ComposedShader ', scene)), ' distinct programs:', len(set(keys.values())), ' all ported')

    # 2. stage the site: the page and everything it asks for, laid out as the repo has it
    def cp(rel, base=repo):
        s, d = os.path.join(base, rel), os.path.join(out, rel)
        os.makedirs(os.path.dirname(d), exist_ok=True)
        if os.path.isdir(s): shutil.copytree(s, d, ignore=shutil.ignore_patterns('__pycache__', 'frames'))
        else: shutil.copy2(s, d)
    for rel in ['gobbler-demiurge/src', 'gobbler-demiurge/assets', 'gobbler-demiurge/data/bird', 'gobbler-demiurge/data/heartbeat',
                'gobbler-v4/src', 'gobbler-v4/engine/common.js', 'gobbler-v4/data/deep/common.css', 'gobbler-v4/data/onto-hover.json']:
        if os.path.exists(os.path.join(repo, rel)): cp(rel)
    for junk in ('gobbler4-bird.x3d', 'gobbler4-bird-gold.x3d'):      # the uncompressed twins of the .gz files are not requested by the page
        p = os.path.join(out, 'gobbler-demiurge', 'data', 'bird', junk)
        if os.path.exists(p): os.remove(p)

    # 3. the page: Babylon in place of X_ITE
    html = open(os.path.join(gd, 'index.html'), encoding='utf-8').read()
    html, n = re.subn(r'<link rel="stylesheet" href="\.\./gobbler-v4/vendor/x_ite/x_ite\.css">', '', html); assert n == 1, 'x_ite.css link not found'
    html, n = re.subn(r'<title>[^<]*</title>', '<title>Gobbler on WebGPU · bird first</title>', html); assert n == 1
    parts = '\n'.join(src[n] for _, n in PARTS)
    tag = hashlib.sha256(parts.encode('utf-8')).hexdigest()[:12]
    bundle = '(function () {\n"use strict";\nwindow.__x3dBuild = "%s";\n' % tag + parts + '\n})();\n'
    os.makedirs(os.path.join(out, 'babylon'), exist_ok=True)
    open(os.path.join(out, 'babylon', 'bundle.js'), 'w', encoding='utf-8').write(bundle)
    if a.local_babylon:
        shutil.copy2(a.local_babylon, os.path.join(out, 'babylon', 'babylon.js')); bab = '<script src="../babylon/babylon.js"></script>'
    else: bab = f'<script src="{BABYLON_URL}" integrity="{a.sri if a.sri.startswith("sha384-") else "sha384-" + a.sri}" crossorigin="anonymous"></script>'
    html, n = re.subn(r'<script src="\.\./gobbler-v4/vendor/x_ite/x_ite\.min\.js"></script>', lambda m: bab + '<script src="../babylon/bundle.js"></script>', html); assert n == 1, 'x_ite script not found'
    open(os.path.join(out, 'gobbler-demiurge', 'index.html'), 'w', encoding='utf-8').write(html)
    print('wrote', os.path.join(out, 'gobbler-demiurge', 'index.html'), ' build', tag, ' bundle', len(bundle) // 1024, 'KB')
    if a.flat: flat(out, repo, bundle, a.sri)

def flat(out, repo, bundle, sri):
    import base64, json
    fd = out + '-flat'
    if os.path.exists(fd): sys.exit('refusing to overwrite ' + fd)
    gd = os.path.join(out, 'gobbler-demiurge')
    cfg = "window.GD_CFG={bird:'data/bird/bird.b64.txt',enc:'b64gz',graph:'data/bird/graph.b64.txt',graphEnc:'b64gz',onto:'data/onto-hover.json',audioExt:'mp4'};"
    s = open(os.path.join(repo, 'gobbler-demiurge', 'index.html'), encoding='utf-8').read()
    s = re.sub(r'<!doctype html><html[^>]*><head>', '', s, count=1, flags=re.I)
    s = re.sub(r'<meta charset="utf-8">|<meta name="viewport"[^>]*>', '', s)
    s = re.sub(r'<title>.*?</title>', '', s, count=1, flags=re.S)
    s = s.replace('</head>\n<body>', '').replace('</body></html>', '')
    s = re.sub(r'<link rel="stylesheet" href="\.\./gobbler-v4/vendor/x_ite/x_ite\.css">', '', s)
    s = s.replace('../gobbler-v4/', '')
    sri_ = sri if sri.startswith('sha384-') else 'sha384-' + sri
    s = re.sub(r'<script src="vendor/x_ite/x_ite\.min\.js"></script>', lambda m: f'<script src="{BABYLON_URL}" integrity="{sri_}" crossorigin="anonymous"></script><script src="babylon/bundle.js"></script>', s)
    s = s.replace('<script src="src/boot.js" defer></script>', '<script>' + cfg + '</script><script src="src/boot.js" defer></script>')
    assert 'x_ite' not in s and 'GD_CFG' in s and 'babylon/bundle.js' in s, 'page rewrite failed'
    assert not re.search(r'<head[\s>]|<body[\s>]|</html|</head>|</body>', s)
    os.makedirs(fd)
    open(os.path.join(fd, 'index.html'), 'w', encoding='utf-8').write('<title>Gobbler on WebGPU</title>\n' + s.strip() + '\n')
    pub = ['index.html']
    def put(src, dst, b64=False):
        d = os.path.join(fd, dst); os.makedirs(os.path.dirname(d), exist_ok=True)
        if b64: open(d, 'w').write(base64.b64encode(open(src, 'rb').read()).decode())
        else: shutil.copyfile(src, d)
        pub.append(dst)
    put(os.path.join(out, 'babylon', 'bundle.js'), 'babylon/bundle.js')
    bird = os.path.join(gd, 'data', 'bird')
    put(os.path.join(bird, 'gobbler4-bird.x3d.gz'), 'data/bird/bird.b64.txt', True); put(os.path.join(bird, 'graph-v3.json.gz'), 'data/bird/graph.b64.txt', True)
    for f in ['anchors.json', 'heart.json', 'receipt.json', 'world.json'] + [x for x in SCENES if x.endswith('.x3d')]: put(os.path.join(bird, f), 'data/bird/' + f)
    put(os.path.join(out, 'gobbler-v4', 'data', 'onto-hover.json'), 'data/onto-hover.json'); put(os.path.join(out, 'gobbler-v4', 'engine', 'common.js'), 'engine/common.js')
    put(os.path.join(out, 'gobbler-v4', 'data', 'deep', 'common.css'), 'data/deep/common.css')
    for f in sorted(os.listdir(os.path.join(out, 'gobbler-v4', 'src'))): put(os.path.join(out, 'gobbler-v4', 'src', f), 'src/' + f)
    for f in sorted(os.listdir(os.path.join(gd, 'src'))): put(os.path.join(gd, 'src', f), 'src/' + f)
    for f in ('cosmos', 'village'): put(os.path.join(gd, 'assets', 'audio', f + '.m4a'), 'assets/audio/' + f + '.mp4')
    print(json.dumps({'flat': fd, 'files': pub, 'count': len(pub), 'bytes': sum(os.path.getsize(os.path.join(fd, p)) for p in pub)}))

main()
