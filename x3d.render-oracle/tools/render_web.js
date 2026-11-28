// Render a list of .x3d files in X_ITE and in the three.js bridge body, one fixed rig, to PNG.
// usage: node render_web.js OUTDIR SCENE.x3d...    (OUTDIR/xite/NAME.png, OUTDIR/three/NAME.png, OUTDIR/web-env.json)
// Rig: 128x128 canvas, no antialias request, no tone mapping, scene's own Viewpoint, 6 frames of settling.
const fs = require('fs'), path = require('path'), http = require('http');
const BRIDGE = path.resolve(process.env.BRIDGE || path.join(__dirname, '..', '..', 'x3d.threejs', 'bridge'));
const req = (m) => require(path.join(BRIDGE, 'node_modules', m));
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return req('playwright'); } })();
const bundle = require(path.join(BRIDGE, 'tools', 'bundle.js'));
const root = (m) => path.join(BRIDGE, 'node_modules', m);
const XITE = path.join(root('x_ite'), 'dist'), THREE = path.join(root('three'), 'build');
const [out, ...scenes] = process.argv.slice(2), W = 128, H = 128;
const mime = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json' };
const files = {
  '/bundle-body.js': bundle('body'),
  '/three.html': `<!doctype html><meta charset=utf-8><body style="margin:0;background:#000"><canvas id=c width=${W} height=${H} style="width:${W}px;height:${H}px;display:block"></canvas>
<script type="importmap">{"imports":{"three":"/three/three.module.js"}}</script><script type="module">import * as THREE from '/three/three.module.js'; window.THREE = THREE;
const add = (s) => new Promise((ok, no) => { const e = document.createElement('script'); e.src = s; e.onload = ok; e.onerror = no; document.body.appendChild(e); });
window.pageReady = add('/bundle-body.js').then(async () => { const b = new Body(document.getElementById('c'), { tone: 'none', fontBase: '/x_ite/assets/fonts/', onNote: (m) => (window.__notes = window.__notes || []).push(m) }); await b.init(); X3DSAI.setBody(b); window.__body = b; });
window.load = async (xml) => { await window.pageReady; const sc = await X3DSAI.B.createX3DFromString(xml); await X3DSAI.B.replaceWorld(sc); for (let i = 0; i < 6; i++) await X3DSAI.B.nextFrame(); };</script>`,
  '/xite.html': `<!doctype html><meta charset=utf-8><link rel=stylesheet href="/x_ite/x_ite.css"><body style="margin:0"><x3d-canvas id=c style="width:${W}px;height:${H}px;display:block" notifications=false timings=false></x3d-canvas><script src="/x_ite/x_ite.min.js"></script>
<script>window.load = async (xml) => { const b = X3D.getBrowser('#c'); try { b.setBrowserOption('Notifications', false); b.setBrowserOption('Timings', false); } catch (e) {} const sc = await b.createX3DFromString(xml); await b.replaceWorld(sc); for (let i = 0; i < 6; i++) await b.nextFrame(); };
window.info = () => ({ name: X3D.getBrowser('#c').name, version: X3D.getBrowser('#c').version });</script>`,
};
const dirs = { '/x_ite/': XITE, '/three/': THREE };
const srv = http.createServer((q, r) => {
  const u = q.url.split('?')[0];
  if (files[u]) { r.writeHead(200, { 'content-type': mime[path.extname(u)] || 'text/html' }); return r.end(files[u]); }
  for (const [p, d] of Object.entries(dirs)) if (u.startsWith(p)) { const f = path.join(d, u.slice(p.length)); if (fs.existsSync(f)) { r.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' }); return r.end(fs.readFileSync(f)); } }
  const sf = path.join(path.dirname(path.resolve(scenes[0])), path.basename(u)); // files the scenes name (x.png, x.wav) sit beside the scenes
  if (path.basename(u) && fs.existsSync(sf) && fs.statSync(sf).isFile()) { r.writeHead(200, { 'content-type': mime[path.extname(sf)] || 'application/octet-stream' }); return r.end(fs.readFileSync(sf)); }
  r.writeHead(404); r.end();
}).listen(0, '127.0.0.1');
(async () => {
  await new Promise((r) => srv.once('listening', r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const env = { chromium: b.version(), three: JSON.parse(fs.readFileSync(path.join(root('three'), 'package.json'))).version, rig: { w: W, h: H, antialias: 'engine default', tone: 'none' }, failures: {} };
  for (const eng of ['xite', 'three']) {
    fs.mkdirSync(path.join(out, eng), { recursive: true });
    const pg = await b.newPage({ viewport: { width: W, height: H } });
    const log = []; pg.on('pageerror', (e) => log.push(String(e)));
    await pg.goto(base + '/' + eng + '.html');
    if (eng === 'xite') { await pg.waitForFunction(() => window.X3D && X3D.getBrowser('#c')); env.xite = await pg.evaluate(() => window.info()); }
    else { await pg.evaluate(() => window.pageReady); env.glRenderer = await pg.evaluate(() => { const g = __body.renderer.getContext(), e = g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); }); }
    for (const s of scenes) {
      const name = path.basename(s, '.x3d');
      try { await pg.evaluate((x) => window.load(x), fs.readFileSync(s, 'utf8')); await pg.waitForTimeout(150);
        fs.writeFileSync(path.join(out, eng, name + '.png'), await pg.screenshot({ clip: { x: 0, y: 0, width: W, height: H }, type: 'png' })); }
      catch (e) { (env.failures[eng] = env.failures[eng] || {})[name] = String(e).slice(0, 200); }
    }
    await pg.close();
  }
  fs.writeFileSync(path.join(out, 'web-env.json'), JSON.stringify(env, null, 1));
  await b.close(); srv.close();
  console.log(JSON.stringify(env));
})().catch((e) => { console.error(e); process.exit(1); });
