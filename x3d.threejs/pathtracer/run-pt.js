// Path-trace an X3D scene with three-gpu-pathtracer, through the same reader + three.js body as the bridge, and photograph X_ITE on the same rig.
//   node run-pt.js --out DIR [--samples 64] [--bounces 6] [--size 320x240] [--xite] SCENE.x3d...
// Writes DIR/<scene>.pt.png (path traced, linear output, no tone map), DIR/<scene>.raster.png (the bridge's rasteriser), DIR/<scene>.xite.png, DIR/<scene>.json (timings, rig).
// Rig: Chromium on SwiftShader (--use-angle=swiftshader), three r187 (bridge), three-gpu-pathtracer 0.0.28, three-mesh-bvh 0.9.18, X_ITE 16.6.0.
const fs = require('fs'), path = require('path'), http = require('http');
const HERE = __dirname, BR = path.join(HERE, '..', 'bridge'), bundle = require(path.join(BR, 'tools', 'bundle.js'));
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args.splice(i, 2)[1]; }, flag = (k) => { const i = args.indexOf(k); if (i < 0) return false; args.splice(i, 1); return true; };
const OUT = opt('--out', '.pt-out'), SAMPLES = +opt('--samples', 64), BOUNCES = +opt('--bounces', 6), [W, H] = opt('--size', '320x240').split('x').map(Number), WITHX = flag('--xite'), TILES = +opt('--tiles', 2), LIGHTS = opt('--lights', 'pbr');   // pbr: light I (X_ITE PhysicalMaterial, rho/pi * I) ; classic: light I*PI (X_ITE Material, rho * I)
const scenes = args;
const nm = (m) => ['/tmp/w/pt', BR, HERE, process.cwd()].map((d) => path.join(d, 'node_modules', m)).find((d) => fs.existsSync(path.join(d, 'package.json')));
const THREE_ROOT = nm('three'), PT_ROOT = nm('three-gpu-pathtracer'), BVH_ROOT = nm('three-mesh-bvh'), XITE_DIST = path.join(nm('x_ite'), 'dist');
const { chromium } = require(nm('playwright'));
const MAP = { '/three/': THREE_ROOT + '/', '/pt/': path.join(PT_ROOT, 'build') + '/', '/bvh/': path.join(BVH_ROOT, 'build') + '/', '/x_ite/': XITE_DIST + '/' };
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png' };
const IMPORTMAP = JSON.stringify({ imports: { three: '/three/build/three.module.js', 'three/webgpu': '/three/build/three.webgpu.js', 'three/tsl': '/three/build/three.tsl.js', 'three/examples/jsm/': '/three/examples/jsm/', 'three-mesh-bvh': '/bvh/index.module.js', 'three-gpu-pathtracer': '/pt/index.module.js' } });
// Scene preparation (lights, materials, background) lives in src/pt-adapter.js, shared with the x3d.demo page.
const PAGE_PT = `<!doctype html><meta charset=utf-8><body style="margin:0"><canvas id=c width=${W} height=${H}></canvas>
<script type="importmap">${IMPORTMAP}</script>
<script type="module">
import * as THREE from 'three'; import { WebGLPathTracer } from 'three-gpu-pathtracer'; import { freeze, loadScene, preparePT } from '/src/pt-adapter.js'; window.THREE = THREE;
const add = (src) => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.body.appendChild(s); });
window.pageReady = add('/bundle-body.js').then(async () => { const body = new Body(document.getElementById('c'), { tone: 'none', fontBase: '/x_ite/assets/fonts/' }); await body.init(); X3DSAI.setBody(body); window.__body = body; });
window.runPT = async (xml, samples, bounces, tiles, lights) => {
  await window.pageReady; const body = window.__body, t0 = performance.now(); freeze(body); await loadScene(body, xml); const raster = body.renderer.domElement.toDataURL('image/png');
  const prep = preparePT(THREE, body, { lights });
  const pt = new WebGLPathTracer(body.renderer); pt.bounces = bounces; pt.tiles.set(tiles, tiles); pt.renderScale = 1; pt.dynamicLowRes = false; pt.filterGlossyFactor = 0.5; pt.minSamples = 0; pt.renderDelay = 0; pt.fadeDuration = 0; pt.rasterizeScene = false;
  const t1 = performance.now(); pt.setScene(body.scene, body.cam); const tBuild = performance.now() - t1;
  const t2 = performance.now(); let guard = 0; while (pt.samples < samples && guard++ < samples * 40) { pt.renderSample(); if (guard % 8 === 0) await new Promise((r) => setTimeout(r, 0)); }
  { const gl = body.renderer.getContext(); gl.finish(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); }
  const tTrace = performance.now() - t2, shot = body.renderer.domElement.toDataURL('image/png'), g = body.renderer.getContext(), e = g.getExtension('WEBGL_debug_renderer_info');
  return { shot, raster, samples: pt.samples, tBuild, tTrace, tTotal: performance.now() - t0, converted: prep.converted, lightLog: prep.log, sky: prep.sky, three: THREE.REVISION, gl: e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER) };
};
</script>`;
const PAGE_X = `<!doctype html><meta charset=utf-8><link rel=stylesheet href="/x_ite/x_ite.css"><body style="margin:0"><x3d-canvas id=c style="width:${W}px;height:${H}px;display:block" notifications="false" contextMenu="false"></x3d-canvas><script src="/x_ite/x_ite.min.js"></script>
<script>window.loadX = async (xml) => { const B = X3D.getBrowser('#c'); await B.loadURL(new X3D.MFString('data:model/x3d+xml;charset=utf-8,' + encodeURIComponent(xml))); await new Promise((r) => setTimeout(r, 1500)); return B.name; };</script>`;
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/pt.html') return res.writeHead(200, { 'content-type': 'text/html' }).end(PAGE_PT);
  if (u === '/x.html') return res.writeHead(200, { 'content-type': 'text/html' }).end(PAGE_X);
  if (u === '/src/pt-adapter.js') return res.writeHead(200, { 'content-type': 'text/javascript' }).end(fs.readFileSync(path.join(HERE, 'src', 'pt-adapter.js')));
  if (u === '/bundle-body.js') return res.writeHead(200, { 'content-type': 'text/javascript' }).end(bundle('body'));
  for (const [p, d] of Object.entries(MAP)) if (u.startsWith(p)) { const f = path.join(d, u.slice(p.length)); if (f.startsWith(d) && fs.existsSync(f) && fs.statSync(f).isFile()) return res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }).end(fs.readFileSync(f)); }
  res.writeHead(404).end('nf');
});
(async () => {
  fs.mkdirSync(OUT, { recursive: true }); await new Promise((r) => server.listen(0, '127.0.0.1', r)); const base = 'http://127.0.0.1:' + server.address().port;
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const save = (u, f) => fs.writeFileSync(f, Buffer.from(u.split(',')[1], 'base64'));
  try {
    for (const sc of scenes) {
      const name = path.basename(sc).replace(/\.x3d$/, ''), xml = fs.readFileSync(sc, 'utf8'), rec = { lights: LIGHTS, scene: name, samples_asked: SAMPLES, bounces: BOUNCES, size: [W, H] };
      const p = await b.newPage({ viewport: { width: W, height: H } }); const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 300))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
      await p.goto(base + '/pt.html'); const r = await p.evaluate(([x, s, bo, t, l]) => window.runPT(x, s, bo, t, l), [xml, SAMPLES, BOUNCES, TILES, LIGHTS]);
      save(r.shot, path.join(OUT, name + '.pt.png')); save(r.raster, path.join(OUT, name + '.raster.png')); delete r.shot; delete r.raster; Object.assign(rec, r, { errors: errs.slice(0, 5) }); await p.close();
      if (WITHX) { const q = await b.newPage({ viewport: { width: W, height: H } }); await q.goto(base + '/x.html'); await q.waitForFunction(() => window.X3D && X3D.getBrowser('#c')); await q.evaluate((x) => window.loadX(x), xml); await q.screenshot({ path: path.join(OUT, name + '.xite.png'), clip: { x: 0, y: 0, width: W, height: H } }); rec.xite = 'X_ITE 16.6.0'; await q.close(); }
      fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify(rec, null, 1)); console.log(JSON.stringify(rec));
    }
  } finally { await b.close(); server.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
