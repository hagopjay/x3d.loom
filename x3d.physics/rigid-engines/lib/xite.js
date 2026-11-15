// Record RigidBody trajectories in X_ITE 16.6.0 (its own Bullet/Ammo engine) with playwright + Chromium SwiftShader. Same scene XML as the bridge engines.
const fs = require('fs'), path = require('path'), http = require('http');
const BRIDGE3 = path.resolve(__dirname, '..', '..', '..', 'x3d.threejs', 'bridge');
const XITE = process.env.XITE_DIR || path.join(BRIDGE3, 'node_modules', 'x_ite', 'dist');
const PAGE = `<!doctype html><meta charset=utf-8><link rel=stylesheet href="/x_ite/x_ite.css"><body style="margin:0"><x3d-canvas id=c style="width:64px;height:64px;display:block" notifications=false contextMenu=false></x3d-canvas><script src="/x_ite/x_ite.min.js"></script>
<script>
window.rec = async (xml, probes, T) => {
  const B = X3D.getBrowser(document.getElementById('c')); await B.loadComponents(B.getProfile('Full'), B.getComponent('RigidBodyPhysics'));
  const sc = await B.createX3DFromString(xml); const nodes = probes.map((d) => [d, sc.getNamedNode(d)]);
  await B.replaceWorld(sc); const out = {}; for (const [d] of nodes) out[d] = { t: [], p: [], q: [] };
  let simT = 0, dtAvg = 0, n = 0; /* X_ITE steps Bullet by dt = 1 / max(10, fps), smoothed over 15 frames (RigidBodyCollection.getTimeStep): its simulation clock is rebuilt here with that formula */
  await new Promise((res) => { const loop = () => { const fr = B.currentFrameRate, dt = 1 / Math.max(10, fr); dtAvg = (14 * dtAvg + dt) / 15; simT += dtAvg; const t = simT; for (const [d, nd] of nodes) { const p = nd.getField('position').getValue(), q = nd.getField('orientation').getValue(); out[d].t.push(t); out[d].p.push([p.x, p.y, p.z]); const a = q.getAxisAngle ? q.getAxisAngle() : null; out[d].q.push(a ? [a.axis.x, a.axis.y, a.axis.z, a.angle] : [0, 0, 1, 0]); } n++; if (t >= T + 0.2) res(); else requestAnimationFrame(loop); }; requestAnimationFrame(loop); });
  return { out, version: X3D.getBrowser(document.getElementById('c')).version, frames: n, fps: B.currentFrameRate };
};
</script>`;
/* X_ITE 16.6.0 reads the friction parameter as FRICTION_COEFFICIENT_2 (underscore); the X3D XSD spells it with a hyphen, so the scenes keep the XSD spelling and only the copy sent to X_ITE is rewritten (docs H-PHY-17) */
const xiteXml = (x) => x.replace(/FRICTION_COEFFICIENT-2/g, 'FRICTION_COEFFICIENT_2');
function resample(raw, T, dt = 1 / 60) {
  const out = {}; for (const [d, r] of Object.entries(raw)) {
    const t = [], p = [], q = []; let j = 0;
    for (let k = 0; k * dt <= T + 1e-9; k++) { const tt = k * dt; while (j < r.t.length - 2 && r.t[j + 1] < tt) j++; const a = Math.min(j, r.t.length - 1), b = Math.min(j + 1, r.t.length - 1), f = r.t[b] > r.t[a] ? Math.min(1, Math.max(0, (tt - r.t[a]) / (r.t[b] - r.t[a]))) : 0;
      t.push(tt); p.push(r.p[a].map((v, i) => v + f * (r.p[b][i] - v))); q.push(r.q[a].slice()); }
    out[d] = { t, p, q };
  } return out;
}
async function withBrowser(fn) {
  const { chromium } = require('playwright');
  const srv = await new Promise((res) => { const s = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') { r.setHeader('content-type', 'text/html'); return r.end(PAGE); }
    if (u.startsWith('/x_ite/')) { const f = path.join(XITE, u.slice(7)); if (fs.existsSync(f) && fs.statSync(f).isFile()) { r.setHeader('content-type', f.endsWith('.css') ? 'text/css' : f.endsWith('.json') ? 'application/json' : 'text/javascript'); return fs.createReadStream(f).pipe(r); } }
    r.statusCode = 404; r.end('no'); }).listen(0, () => res(s)); });
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try { return await fn(b, 'http://localhost:' + srv.address().port + '/'); } finally { await b.close(); srv.close(); }
}
async function recordXite(scene, b, base) {
  const pg = await b.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message.slice(0, 200))); await pg.goto(base); await pg.waitForFunction(() => window.X3D && window.rec);
  const r = await pg.evaluate(([xml, probes, T]) => window.rec(xml, probes, T), [xiteXml(scene.xml), scene.probes, scene.T]); await pg.close();
  return { tr: resample(r.out, scene.T), version: r.version, frames: r.frames, errs, fps: +(r.frames / (scene.T + 0.2)).toFixed(1) };
}
module.exports = { withBrowser, recordXite, resample, xiteXml };
