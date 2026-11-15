// Run the SAME bridge + engines inside Chromium (SwiftShader build of Chromium 153, V8 differs from Node's): reader bundle, engines, Rapier WASM and cannon-es from node_modules.
const fs = require('fs'), path = require('path'), http = require('http');
const HERE = path.resolve(__dirname, '..'), BRIDGE = path.resolve(HERE, '..', '..', 'x3d.webgpu', 'bridge'), bundle = require(path.join(BRIDGE, 'tools', 'bundle.js'));
const PAGE = `<!doctype html><meta charset=utf-8><body><script type=module>
import RAPIER from '/lib/rapier.mjs'; import * as CANNON from '/lib/cannon-es.js';
await RAPIER.init(); window.__physLibs = { RAPIER, CANNON };
for (const f of ['/bundle.js', '/engines.js', '/engine-rapier.js', '/engine-cannon.js']) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = f; s.onload = res; s.onerror = rej; document.body.appendChild(s); });
const jit = (pattern, i, dt) => (pattern === 'jitter' && i >= 3 && i % 2 === 1 ? 1 / 40 : pattern === 'jitter' && i >= 3 ? 1 / 30 - 1 / 40 : dt);
window.runScene = async (xml, probes, T, engine, pattern, opts) => {
  const R = window.__R, BR = window.__bridge; BR.physEngines.use(engine, opts || {}); let ts = 1000; const sc = await window.X3DSAI.B.createX3DFromString(xml);
  const nodes = probes.map((d) => [d, R.bridge.worlds.flatMap((w) => w.nodes).find((n) => n.def === d)]), tr = {}; for (const [d] of nodes) tr[d] = { t: [], p: [], q: [] };
  const tick = (dt) => { R.events.begin(ts += dt); R.events.drain(); }; const snap = (t) => { for (const [d, n] of nodes) { tr[d].t.push(t); tr[d].p.push(n.f.position.slice()); tr[d].q.push(n.f.orientation.slice()); } };
  snap(0); const N = Math.round(T * 60); const t0 = performance.now();
  for (let i = 1; i <= N; i++) { tick(jit(pattern, i, 1 / 60)); snap(i / 60); }
  return { tr, ms: performance.now() - t0, notes: BR.physEngines.notes.slice() };
};
window.ready = true;
</script>`;
// withHost(async (run, chromiumVersion, errs) => ...): run(xml, probes, T, engine, pattern, opts) opens a FRESH page each time (a page keeps every world it ever opened ticking, and DEF names clash between scenes)
async function withHost(fn) {
  const { chromium } = require('playwright');
  const files = { '/': PAGE, '/bundle.js': bundle('reader'), '/engines.js': fs.readFileSync(path.join(HERE, 'src', 'engines.js'), 'utf8'), '/engine-rapier.js': fs.readFileSync(path.join(HERE, 'src', 'engine-rapier.js'), 'utf8'), '/engine-cannon.js': fs.readFileSync(path.join(HERE, 'src', 'engine-cannon.js'), 'utf8') };
  const libs = { '/lib/rapier.mjs': require.resolve('@dimforge/rapier3d-compat').replace(/rapier\.cjs$/, 'rapier.mjs'), '/lib/cannon-es.js': path.join(path.dirname(require.resolve('cannon-es')), 'cannon-es.js') };
  const srv = await new Promise((res) => { const s = http.createServer((q, r) => { const u = q.url.split('?')[0]; if (files[u] !== undefined) { r.setHeader('content-type', u === '/' ? 'text/html' : 'text/javascript'); return r.end(files[u]); } if (libs[u]) { r.setHeader('content-type', 'text/javascript'); return fs.createReadStream(libs[u]).pipe(r); } r.statusCode = 404; r.end('no'); }).listen(0, () => res(s)); });
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); const errs = [];
  const run = async (xml, probes, T, engine, pattern, opts) => {
    const pg = await b.newPage(); pg.on('pageerror', (e) => errs.push(e.message.slice(0, 300)));
    try { await pg.goto('http://localhost:' + srv.address().port + '/'); await pg.waitForFunction(() => window.ready, null, { timeout: 30000 }); return await pg.evaluate(([x, p, t, e, pa, o]) => window.runScene(x, p, t, e, pa, o), [xml, probes, T, engine, pattern || 'regular', opts || {}]); } finally { await pg.close(); }
  };
  try { return await fn(run, b.version(), errs); } finally { await b.close(); srv.close(); }
}
module.exports = { withHost };
