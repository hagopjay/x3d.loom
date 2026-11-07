#!/usr/bin/env python3 -I
"""Build the Neural Canvas WebGPU page: the brain page's own HUD and data, drawn by Babylon WebGPU through the x3d reader (src/brain/).

  python3 -I build-brain.py --page ../../../x3d.brain/page --out OUT.html [--single]

--page   the generated Neural Canvas page folder (index.html, data/, scenes/); tools/build_page.py in x3d.brain writes it.
--out    where to write. Without --single the page needs its folder next to it (data/, scenes/) and is served over http.
--single inline the scenes, data and textures as base64 (window.__VFS) so the file runs alone (private pages).
Nothing is fetched at build time except that the pinned Babylon bundle is NOT downloaded: the page loads it from the CDN with an integrity hash.
"""
import argparse, base64, gzip, hashlib, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'brain')
BABYLON_VERSION = '9.32.0'                      # published 2026-10-22, more than two weeks old
BABYLON_URL = f'https://cdn.jsdelivr.net/npm/babylonjs@{BABYLON_VERSION}/babylon.js'
BABYLON_SRI = 'sha384-1XDybi1454WehNQaPHwhcTlpJ6oDdq/L4KKyDu7JiWPOBUzoBC0yEcuKDzHpdXyo'  # of babylonjs@9.32.0/babylon.js as the CDN serves it; --sri overrides
PARTS = ['../shared/adapter.js', 'reader.js', 'wgsl.js', 'body.js', 'body-cam.js', 'sai.js', '../shared/timing.js', 'boot.js']

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
    ap.add_argument('--single', action='store_true'); ap.add_argument('--sri', default=os.environ.get('BABYLON_SRI', BABYLON_SRI))
    a = ap.parse_args()
    page = os.path.abspath(a.page)
    html = open(os.path.join(page, 'index.html'), encoding='utf-8').read()

    # 1. the port table must match the GLSL the page's own scenes carry
    ports = re.search(r"const WGSL_BY_HASH = \{(.*?)\};", open(os.path.join(SRC, 'wgsl.js')).read(), re.S).group(1)
    known = set(re.findall(r"'([0-9a-f]{8}-[0-9a-f]{8})'", ports))
    seen = set()
    for f in ('brain_hero_lite.x3dz', 'torso_ct_lite.x3dz'):
        p = os.path.join(page, 'scenes', f)
        if os.path.exists(p):
            seen |= set(shader_keys(gzip.open(p, 'rt', encoding='utf-8').read()).values())
    missing = seen - known
    if missing: sys.exit('GLSL with no WGSL port: ' + ', '.join(sorted(missing)))
    print('shader keys in the scenes:', len(seen), 'all ported')

    # 2. the canvas
    html, n = re.subn(r'<x3d-canvas class="stage" id="stage"[^>]*></x3d-canvas>', '<canvas class="stage" id="stage" tabindex="0" role="application" aria-label="Interactive 3D view. Drag to orbit, scroll or pinch to zoom, click a region to learn about it."></canvas>', html)
    assert n == 1, 'x3d-canvas not found'
    html, n = re.subn(r'<title>[^<]*</title>', '<title>Neural Canvas WebGPU - Brain Loom demo</title>', html); assert n == 1

    # 3. the bundle, placed before the page's own config and script so window.X3D exists first
    parts = '\n'.join(open(os.path.join(SRC, p), encoding='utf-8').read() for p in PARTS)
    tag = hashlib.sha256(parts.encode('utf-8')).hexdigest()[:12]  # names the build in the Timing panel, so a number is tied to the code that made it
    bundle = '(function () {\n"use strict";\nwindow.__x3dBuild = "%s";\n' % tag + parts + '\n})();\n'
    tags = ''
    if a.single:
        vfs = {}
        for root, _, files in os.walk(page):
            for f in files:
                rel = os.path.relpath(os.path.join(root, f), page).replace(os.sep, '/')
                if rel.startswith(('data/', 'scenes/')) and not rel.endswith('.md'):
                    vfs[rel] = base64.b64encode(open(os.path.join(root, f), 'rb').read()).decode()
        tags += '<script>window.__VFS = ' + json.dumps(vfs, separators=(',', ':')) + ';\n(function(){var f=window.fetch,rel=function(u){return String(u).replace(location.href.replace(/[?#].*$/,"").replace(/[^/]*$/,""),"")};window.fetch=function(u,o){var k=rel(u),v=window.__VFS[k];if(v&&/^data\\//.test(k)){var b=atob(v),a=new Uint8Array(b.length);for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return Promise.resolve(new Response(a,{headers:{"content-type":"application/json"}}))}return f.apply(this,arguments)}})();</script>\n'
        print('inlined', len(vfs), 'files,', sum(len(v) for v in vfs.values()) // 1024, 'KB base64')
    sri = f' integrity="{a.sri if a.sri.startswith("sha384-") else "sha384-" + a.sri}" crossorigin="anonymous"' if a.sri else ' crossorigin="anonymous"'
    tags += f'<script src="{BABYLON_URL}"{sri}></script>\n<script>\n{bundle}</script>\n'
    marker = '<script>window.PAGE_CONFIG ='
    assert html.count(marker) == 1
    html = html.replace(marker, tags + marker)
    open(a.out, 'w', encoding='utf-8').write(html)
    print('wrote', a.out, len(html) // 1024, 'KB sha256', hashlib.sha256(html.encode()).hexdigest()[:16])

main()
