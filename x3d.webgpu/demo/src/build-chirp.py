#!/usr/bin/env python3 -I
"""Build the Chirp WebGPU page: the study's own index.html, src/app.js and cases drawn by Babylon WebGPU through the x3d reader (src/brain/ + src/drift/ + src/chirp/).

  python3 -I build-chirp.py --study PATH_TO_CHIRP_FOLDER --out OUTDIR [--single] [--babylon URL_OR_PATH] [--sri HASH]

--study  the Chirp study folder (index.html, src/, scenes/, cases/), for example docs/demos/stem/v1/chirp in hagopjay/x3d.demo.
--single also writes OUT/single.html: one offline file (scenes, cases, script and style inlined; Babylon from the pinned CDN tag).
--out    a new folder; it gets index.html, src/app.js, src/app.css, scenes/, cases/ and bundle.js. Serve it over http.
The study's app.js is copied byte for byte; only index.html changes (the script tags, which now load app.js after the Babylon body is up, and the title). Nothing in the study folder changes.
"""
import argparse, hashlib, os, re, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
BABYLON_VERSION = '9.32.0'
BABYLON_URL = f'https://cdn.jsdelivr.net/npm/babylonjs@{BABYLON_VERSION}/babylon.js'
BABYLON_SRI = 'sha384-1XDybi1454WehNQaPHwhcTlpJ6oDdq/L4KKyDu7JiWPOBUzoBC0yEcuKDzHpdXyo'
# one builder, two studies: both keep the study's own app.js byte for byte and draw it with Babylon through the reader and SAI shim
KINDS = {
    'chirp': dict(parts=[('chirp', 'chirp-pre.js'), ('brain', 'reader.js'), ('brain', 'wgsl.js'), ('brain', 'body.js'), ('brain', 'body-cam.js'), ('drift', 'drift-ext.js'), ('chirp', 'chirp-look.js'), ('brain', 'sai.js'), ('chirp', 'chirp-boot.js')],
                  title=('<title>Chirp · x3d.STEM</title>', '<title>Chirp · WebGPU</title>'), build='__chirpBuild', ready='__chirpReady'),
    'cloud': dict(parts=[('chirp', 'chirp-pre.js'), ('brain', 'reader.js'), ('brain', 'wgsl.js'), ('brain', 'body.js'), ('brain', 'body-cam.js'), ('drift', 'drift-ext.js'), ('cloud', 'cloud-look.js'), ('brain', 'sai.js'), ('cloud', 'cloud-boot.js')],
                  title=('<title>Electron Cloud Observatory · x3d.STEM</title>', '<title>Electron Cloud Observatory · WebGPU</title>'), build='__cloudBuild', ready='__cloudReady'),
}

def sub1(text, old, new):
    assert text.count(old) == 1, ('expected exactly one', old[:60], text.count(old))
    return text.replace(old, new)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--study', required=True); ap.add_argument('--out', required=True)
    ap.add_argument('--kind', default='chirp', choices=sorted(KINDS)); ap.add_argument('--single', action='store_true'); ap.add_argument('--babylon', default=''); ap.add_argument('--sri', default=os.environ.get('BABYLON_SRI', BABYLON_SRI))
    a = ap.parse_args()
    K = KINDS[a.kind]; PARTS = K['parts']
    study, out = os.path.abspath(a.study), os.path.abspath(a.out)
    os.makedirs(os.path.join(out, 'src'), exist_ok=True)
    for d in ('scenes', 'cases'):
        dst = os.path.join(out, d)
        if os.path.exists(dst): shutil.rmtree(dst)
        shutil.copytree(os.path.join(study, d), dst)
    for f in os.listdir(os.path.join(study, 'src')): shutil.copy(os.path.join(study, 'src', f), os.path.join(out, 'src', f))
    parts = '\n'.join(open(os.path.join(HERE, d, f), encoding='utf-8').read() for d, f in PARTS)
    tag = hashlib.sha256(parts.encode('utf-8')).hexdigest()[:12]
    open(os.path.join(out, 'bundle.js'), 'w', encoding='utf-8').write('(function () {\n"use strict";\nwindow.%s = "%s";\n' % (K['build'], tag) + parts + '\n})();\n')
    html = open(os.path.join(study, 'index.html'), encoding='utf-8').read()
    html = sub1(html, '<link rel="stylesheet" href="vendor/x_ite/x_ite.css">\n', '')
    html = sub1(html, '<script src="vendor/x_ite/x_ite.min.js"></script>',
                '<script src="%s"%s></script>\n<script src="bundle.js"></script>' % (a.babylon if a.babylon else BABYLON_URL,
                '' if a.babylon else ' integrity="%s" crossorigin="anonymous"' % (a.sri if a.sri.startswith('sha384-') else 'sha384-' + a.sri)))
    html = sub1(html, '<script src="src/app.js"></script>', '<script>(window.' + K['ready'] + ' || Promise.resolve()).then(function () { var s = document.createElement("script"); s.src = "src/app.js"; document.body.appendChild(s); });</script>')
    html = sub1(html, K['title'][0], K['title'][1])
    open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(html)
    if a.single:   # one offline file: the cases, the scene, the script and the style are inlined; fetch() answers them from window.__VFS
        import base64
        vfs = {}
        for d in ('cases', 'scenes'):
            for root, _, files in os.walk(os.path.join(out, d)):
                for f in files:
                    full = os.path.join(root, f); vfs[os.path.relpath(full, out).replace(os.sep, '/')] = base64.b64encode(open(full, 'rb').read()).decode()
        shim = ('window.__VFS=' + __import__('json').dumps(vfs) + ';(function(){var of=window.fetch;window.fetch=function(u,o){var k=String(u).replace(/^\\.\\//,\'\');'
                'if(window.__VFS[k]){var b=atob(window.__VFS[k]),n=b.length,a=new Uint8Array(n);for(var i=0;i<n;i++)a[i]=b.charCodeAt(i);'
                'return Promise.resolve(new Response(a,{status:200}));}return of.call(window,u,o);};})();')
        single = open(os.path.join(out, 'index.html'), encoding='utf-8').read()
        css = open(os.path.join(out, 'src', 'app.css'), encoding='utf-8').read()
        single = sub1(single, '<link rel="stylesheet" href="src/app.css">', '<style>' + css + '</style>')
        import re as _re
        for m_ in _re.findall(r'<script src="(src/[^"]+\.js)"></script>', single):   # classic scripts the study loads before app.js (nets.js)
            single = single.replace('<script src="%s"></script>' % m_, '<script>' + open(os.path.join(out, m_), encoding='utf-8').read().replace('</script', '<\\/script') + '</script>')
        single = sub1(single, '<script src="bundle.js"></script>', '<script>' + shim + '</script>\n<script>' + open(os.path.join(out, 'bundle.js'), encoding='utf-8').read().replace('</script', '<\\/script') + '</script>')
        single = sub1(single, 's.src = \"src/app.js\"; document.body.appendChild(s);', 's.textContent = window.__APPJS; document.body.appendChild(s);')
        single = sub1(single, '<script>(window.' + K['ready'], '<script>window.__APPJS = ' + __import__('json').dumps(open(os.path.join(out, 'src', 'app.js'), encoding='utf-8').read()).replace('</', '<\\/') + ';</script>\n<script>(window.' + K['ready'])
        open(os.path.join(out, 'single.html'), 'w', encoding='utf-8').write(single)
        print('wrote', os.path.join(out, 'single.html'), len(single) // 1024, 'KB')
    print('wrote', out, 'build', tag)

main()
