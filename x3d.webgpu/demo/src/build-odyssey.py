#!/usr/bin/env python3 -I
"""Build the Material Odyssey page with a third engine: Babylon.js 9 on WebGPU, drawing the film's own odyssey.x3d through the x3d reader (src/brain/ + src/drift/ + src/odyssey/).

  python3 -I build-odyssey.py --site PATH_TO_ODYSSEY_SITE --out OUTDIR [--babylon URL_OR_PATH] [--sri HASH]

--site  the film page folder (index.html, film.json, odyssey.x3d, materials/, engine/, vendor/, poster.jpg): the Material Odyssey site.
--out   a new folder: a copy of the site with index.html patched (a Babylon engine button, a Look switch, the adapter) and babylon/bundle.js added.
        Serve it over http, or publish the folder as a multi-file private page. Nothing in --site changes.
--babylon  load Babylon from this URL or relative path instead of the pinned CDN copy (the headless harness serves a local copy). The page loads it only when the Babylon engine starts.

The film plays by the same means in both X3D engines: the page writes to the Film TimeSensor and the 124 interpolators, and the file's ROUTEs do the rest. The X_ITE and three.js
engines, their code and their vendor folders are kept byte for byte; only index.html changes, and every edit is one exact string replaced once (the build stops if the page drifts).
"""
import argparse, hashlib, os, re, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
BABYLON_VERSION = '9.32.0'
BABYLON_URL = f'https://cdn.jsdelivr.net/npm/babylonjs@{BABYLON_VERSION}/babylon.js'
BABYLON_SRI = 'sha384-1XDybi1454WehNQaPHwhcTlpJ6oDdq/L4KKyDu7JiWPOBUzoBC0yEcuKDzHpdXyo'
PARTS = [('brain', 'reader.js'), ('brain', 'wgsl.js'), ('brain', 'body.js'), ('brain', 'body-cam.js'), ('drift', 'drift-ext.js'), ('odyssey', 'odyssey-ext.js'), ('brain', 'sai.js'), ('odyssey', 'odyssey-boot.js')]

def sub1(text, old, new):
    assert text.count(old) == 1, ('expected exactly one', old[:70], text.count(old))
    return text.replace(old, new)

ABOUT = '''<h3>The Babylon engine</h3>
      <p>The third engine reads the same <b>odyssey.x3d</b> with our own X3D reader and draws it with Babylon.js ''' + BABYLON_VERSION + ''' on WebGPU. It is not a copy of the other two: it keeps the file's rules and lets Babylon do the rest.</p>
      <dl>
        <dt>Light scope</dt><dd>59 of the 60 lights are <b>global="false"</b>, so each lights only the group it sits in (X3D 4.0, 17.2.1). Each is given the meshes under its parent (<b>includedOnlyMeshes</b>): a shape answers to the 3 to 5 lights of its own set instead of all 60, and the material light cap is never reached.</dd>
        <dt>Light units</dt><dd>intensity in candela, radius as a hard range, the glTF punctual-light falloff, spot cone from cutOffAngle and beamWidth.</dd>
        <dt>Materials</dt><dd>35 PBR materials with base colour, metallic-roughness (glTF packing) and normal maps; data maps are read as linear.</dd>
        <dt>Look</dt><dd>The <b>Look</b> switch adds what the file does not say: reflections from a generated gold hall, bloom, grain, vignette, dust, and shadows from three key lights. Off, it draws the file as authored.</dd>
        <dt>Not exact</dt><dd>Matching X_ITE pixel for pixel was not the aim; the gaps are listed in the run's GAPS.md.</dd>
      </dl>

      <h3>Intensity against the source gift</h3>'''

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--site', required=True); ap.add_argument('--out', required=True)
    ap.add_argument('--babylon', default=''); ap.add_argument('--sri', default=os.environ.get('BABYLON_SRI', BABYLON_SRI))
    a = ap.parse_args()
    site, out = os.path.abspath(a.site), os.path.abspath(a.out)
    assert not os.path.exists(out), 'the output folder must be new'
    shutil.copytree(site, out)
    parts = '\n'.join(open(os.path.join(HERE, d, f), encoding='utf-8').read() for d, f in PARTS)
    tag = hashlib.sha256(parts.encode('utf-8')).hexdigest()[:12]
    os.makedirs(os.path.join(out, 'babylon'), exist_ok=True)
    open(os.path.join(out, 'babylon', 'bundle.js'), 'w', encoding='utf-8').write('(function () {\n"use strict";\nwindow.__odysseyBuild = "%s";\n' % tag + parts + '\n})();\n')
    html = open(os.path.join(site, 'index.html'), encoding='utf-8').read()
    sri = '' if a.babylon else (a.sri if a.sri.startswith('sha384-') else 'sha384-' + a.sri)
    adapter = open(os.path.join(HERE, 'odyssey', 'babylon-adapter.js'), encoding='utf-8').read()
    adapter = adapter.replace('__BJS_URL__', a.babylon or BABYLON_URL).replace('__BJS_SRI__', sri).replace('__BJS_VERSION__', BABYLON_VERSION)
    # --- the buttons
    html = sub1(html, '#stage canvas{outline:none}', '#stage canvas{outline:none}\n#stage canvas.bjs{position:absolute;left:var(--px);top:var(--py);width:var(--pw);height:var(--ph);display:block;background:#000}')
    html = sub1(html, '<meta name="description" content="A 138-second film carried by one X3D 4.0 file: the set, 35 materials, 60 lights and the director\'s camera. Two engines perform it: X_ITE natively, and a WebGPU cinema engine.">',
                '<meta name="description" content="A 138-second film carried by one X3D 4.0 file: the set, 35 materials, 60 lights and the director\'s camera. Three engines perform it: X_ITE natively, a three.js WebGPU cinema engine, and Babylon.js on WebGPU through our own X3D reader.">')
    html = sub1(html, '<button type="button" data-eng="x3d" aria-pressed="false" title="X_ITE plays the X3D file natively">X3D</button>\n',
                '<button type="button" data-eng="x3d" aria-pressed="false" title="X_ITE plays the X3D file natively">X3D</button>\n        <button type="button" data-eng="babylon" aria-pressed="false" title="Babylon.js on WebGPU, through our own X3D reader">Babylon</button>\n')
    html = sub1(html, '<button type="button" data-eng="x3d" aria-pressed="false">X3D in X_ITE<small>the file, played natively</small></button>\n',
                '<button type="button" data-eng="x3d" aria-pressed="false">X3D in X_ITE<small>the file, played natively</small></button>\n        <button type="button" data-eng="babylon" aria-pressed="true">Babylon.js<small>WebGPU, through our reader</small></button>\n')
    html = sub1(html, '<button class="tb" id="bFly" type="button"', '<button class="tb" id="bLook" type="button" aria-pressed="true" hidden title="Look (L): reflections, bloom, grain, vignette, dust and key-light shadows that the file does not carry. Off draws the file as authored.">Look</button>\n      <button class="tb" id="bFly" type="button"')
    html = sub1(html, '<span class="wide-only">One X3D file · two engines · </span>', '<span class="wide-only">One X3D file · three engines · </span>')
    # --- the page's state and its engine lifecycle
    html = sub1(html, "kind: navigator.gpu ? 'webgpu' : 'x3d', adapter: null", "kind: navigator.gpu ? 'babylon' : 'x3d', adapter: null")
    html = sub1(html, "if (Q.get('engine') === 'x3d' || Q.get('engine') === 'webgpu') S.kind = Q.get('engine');", "if (Q.get('engine') === 'x3d' || Q.get('engine') === 'webgpu' || Q.get('engine') === 'babylon') S.kind = Q.get('engine');")
    html = sub1(html, "const label = kind === 'x3d' ? 'X3D in X_ITE' : (navigator.gpu ? 'WebGPU' : 'the WebGL2 fallback');", "const label = kind === 'x3d' ? 'X3D in X_ITE' : kind === 'babylon' ? 'Babylon.js on WebGPU' : (navigator.gpu ? 'WebGPU' : 'the WebGL2 fallback');")
    html = sub1(html, "const ad = kind === 'x3d' ? X3DAdapter() : WebGPUAdapter();", "const ad = kind === 'x3d' ? X3DAdapter() : kind === 'babylon' ? BabylonAdapter() : WebGPUAdapter();")
    html = sub1(html, "const other = kind === 'x3d' ? 'webgpu' : 'x3d';", "const other = kind === 'x3d' || kind === 'babylon' ? 'webgpu' : 'x3d';")
    html = sub1(html, "const shade = S.kind === 'x3d' && S.started", "const shade = (S.kind === 'x3d' || S.kind === 'babylon') && S.started")
    html = sub1(html, "if (ad.kind === 'x3d') ad.flyApply();", "if (ad.kind === 'x3d' || ad.kind === 'babylon') ad.flyApply();")
    html = sub1(html, "  syncEngineButtons();\n  $('#engBadge').textContent = ad.badge();", "  syncEngineButtons(); syncLookButton();\n  $('#engBadge').textContent = ad.badge();")
    html = sub1(html, "  } else {\n    rows.push(['Engine', `X_ITE ${d.x_ite || ''} (WebGL2)`]",
                "  } else if (d.engine === 'Babylon') {\n    const a = d.adapter || {}, sc = d.scope || {};\n"
                "    rows.push(['Engine', `Babylon.js ${d.babylon} · WebGPU`], ['Adapter', [a.vendor, a.architecture, a.description].filter(Boolean).join(' / ') || 'not exposed'],\n"
                "      ['Size', `${d.size[0]}×${d.size[1]} px · look ${d.look ? 'on' : 'off (as authored)'} · ${d.shadowLights} shadow lights`], ['Load', `${(S.loadTimes.babylon / 1000).toFixed(2)} s to first frame (loadURL ${d.load_ms} ms, compile ${d.ready_ms} ms)`],\n"
                "      ['Scene', `${d.meshes} meshes · ${d.materials} materials · ${d.textures} textures · ${d.lights} lights`], ['Light scope', `${sc.scoped} scoped · ${sc.global} global · ${sc.empty} empty · at most ${sc.perMeshMax} on any one shape`]);\n"
                "  } else {\n    rows.push(['Engine', `X_ITE ${d.x_ite || ''} (WebGL2)`]")
    # --- text
    html = sub1(html, '<h3>Intensity against the source gift</h3>', ABOUT)
    html = sub1(html, '<dt>X_ITE 16.4.3</dt><dd>loaded only for the X3D engine</dd>', '<dt>X_ITE 16.4.3</dt><dd>loaded only for the X3D engine</dd>\n        <dt>Babylon.js ' + BABYLON_VERSION + '</dt><dd>loaded only for the Babylon engine, with babylon/bundle.js (our reader, body and look)</dd>')
    html = sub1(html, 'three.js 0.186.1 (MIT, vendor/three-0.186.1/LICENSE.txt).', 'three.js 0.186.1 (MIT, vendor/three-0.186.1/LICENSE.txt); Babylon.js ' + BABYLON_VERSION + ' (Apache-2.0), loaded from a pinned, integrity-checked copy only when the Babylon engine starts.')
    # --- the adapter itself, and the Look switch (before xScale, so every helper it calls is in scope)
    look = '''function syncLookButton() { const b = $('#bLook'); if (!b) return; const on = !!(S.adapter && S.adapter.kind === 'babylon'); b.hidden = !on; if (on) b.setAttribute('aria-pressed', String(S.adapter.look())); }
$('#bLook').addEventListener('click', () => { if (!S.adapter || S.adapter.kind !== 'babylon') return; S.adapter.setLook(!S.adapter.look()); syncLookButton(); $('#engBadge').textContent = S.adapter.badge(); updateLive(); poke(); });
addEventListener('keydown', (e) => { if ((e.key === 'l' || e.key === 'L') && !e.ctrlKey && !e.metaKey && !e.altKey && S.adapter && S.adapter.kind === 'babylon' && !/INPUT|SELECT|TEXTAREA/.test((e.target && e.target.tagName) || '')) $('#bLook').click(); });
'''
    html = sub1(html, 'function xScale(q) {', adapter + look + 'function xScale(q) {')
    open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(html)
    print('built', out, 'bundle', tag, 'babylon', a.babylon or BABYLON_URL)

main()
