// The three.js bridge (x3d.threejs reader + body, read at bundle time from ../x3d.threejs, nothing copied) in headless Chromium, with the same
// loadScene / sweep / shot surface as xite.js, so one verifier can drive both engines.
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), require = createRequire(import.meta.url);
const BUNDLE = process.env.BRIDGE_BUNDLE_JS || path.resolve(HERE, '..', 'x3d.threejs', 'bridge', 'tools', 'bundle.js'), THREE = process.env.THREE_DIR || path.join(HERE, 'node_modules', 'three', 'build');
const { chromium } = require('playwright');
export async function withBridge(fn) {
  const bundle = require(BUNDLE)('body'), srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]);
    if (u === '/') { r.setHeader('content-type', 'text/html'); return r.end(`<!doctype html><meta charset=utf-8><body style="margin:0;background:#000"><canvas id=c width=320 height=240 style="width:320px;height:240px;display:block"></canvas><script type="module">import * as THREE from '/three/three.module.js'; window.THREE = THREE;
const s = document.createElement('script'); s.src = '/bundle-body.js'; window.pageReady = new Promise((ok, no) => { s.onload = ok; s.onerror = no; document.body.appendChild(s); }).then(async () => { const body = new Body(document.getElementById('c'), { tone: 'none', fontBase: '/x_ite/assets/fonts/', onNote: (m) => (window.__notes = window.__notes || []).push(m) }); await body.init(); X3DSAI.setBody(body); window.__body = body; window.__br = X3DSAI.B; });</script>`); }
    if (u === '/bundle-body.js') { r.setHeader('content-type', 'text/javascript'); return r.end(bundle); }
    if (u.startsWith('/three/')) { const f = path.join(THREE, u.slice(7)); if (f.startsWith(THREE) && fs.existsSync(f)) { r.setHeader('content-type', 'text/javascript'); return fs.createReadStream(f).pipe(r); } }
    r.statusCode = 404; r.end('no'); });
  await new Promise((ok) => srv.listen(0, ok));
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try { const pg = await b.newPage({ viewport: { width: 320, height: 240 } }); pg.on('pageerror', (e) => { (pg._errs ||= []).push(e.message.slice(0, 200)); });
    await pg.goto('http://localhost:' + srv.address().port + '/'); await pg.evaluate(() => window.pageReady);
    const env = { chromium: b.version(), three: await pg.evaluate(() => THREE.REVISION), body: 'x3d.threejs reader (shared with the Babylon bridge) + three.js body' };
    return await fn(pg, env); } finally { await b.close(); srv.close(); }
}
