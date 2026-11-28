// X_ITE live witness: serves the x3d.springbone folder, loads the example scenes in X_ITE in headless Chromium.
// XITE_DIR points at an X_ITE dist folder (x_ite.min.js + assets); default: x3d.demo's dance/v1 copy (16.8.1).
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const XITE = process.env.XITE_DIR || join(ROOT, '..', '..', 'x3d.demo', 'docs', 'demos', 'dance', 'v1', 'vendor', 'x_ite');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.x3d': 'model/x3d+xml', '.json': 'application/json', '.css': 'text/css', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.png': 'image/png' };
const server = createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const file = u.startsWith('/x_ite/') ? join(XITE, u.slice(7)) : join(ROOT, u);
  if (!existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); res.end(); missing.push(u); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }); res.end(readFileSync(file));
});
const missing = [];
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const page = (scene) => `<!doctype html><meta charset=utf-8><script src="/x_ite/x_ite.min.js"></script>
<x3d-canvas id=c src="${scene}" style="width:640px;height:480px" contextMenu=false notifications=false></x3d-canvas>`;
writeFileSync(join(ROOT, 'browser', '_page.html'), page('../x3d/examples/tail.x3d'));
writeFileSync(join(ROOT, 'browser', '_replay.html'), page('../x3d/examples/tail-replay.x3d'));

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const result = { xite: null, chromium: browser.version(), rows: [] };
const errors = [];
async function open(file) {
  const p = await browser.newPage({ viewport: { width: 700, height: 520 } });
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${file}: ${m.text()}`); });
  p.on('pageerror', (e) => errors.push(`${file}: ${e.message}`));
  await p.goto(`http://localhost:${port}/browser/${file}`);
  await p.waitForFunction(() => { try { const c = document.getElementById('c'); return !!c.browser.currentScene.getNamedNode('TailSpring'); } catch (e) { return false; } }, null, { timeout: 30000 });
  return p;
}

// L1: the clocked scene runs: the tip moves away from its rest place, the PROTO reports steps and no errors
{
  const p = await open('_page.html');
  await p.waitForTimeout(4000);
  const r = await p.evaluate(() => {
    const B = document.getElementById('c').browser, S = B.currentScene;
    const chain = S.getNamedNode('TailSpring');
    const rot = S.getNamedNode('Tail0').rotation; const rots = [0,1,2,3,4,5].map((k) => S.getNamedNode('Tail' + k).rotation.angle);
    return { version: B.version || X3D.getBrowser().version, steps: chain.steps, hash: chain.stateHash, angle: rot.angle, rots,
             positions: Array.from(chain.positions).map((v) => [v.x, v.y, v.z]), f: chain.equivalentFrequency, z: chain.equivalentDampingRatio };
  });
  result.xite = r.version;
  await p.screenshot({ path: join(ROOT, 'results', 'xite-tail.png') });
  result.rows.push({ id: 'L1', claim: 'tail.x3d runs in X_ITE: the solver steps, the root bone turns, particles are reported', value: { steps: r.steps, rootAngle: r.angle, angles: r.rots, particles: r.positions.length, equivalentFrequency: r.f, equivalentDampingRatio: r.z }, pass: r.steps > 100 && r.angle > 1e-4 && r.positions.length === 7 });
  await p.close();
}

// L2: replay: drive set_time with a fixed sequence through SAI; the state hash equals the Node core's for the same sequence
{
  const p = await open('_replay.html');
  const times = []; let t = 0; let seed = 5; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 300; i++) { t += i ? (1 / 60) * (0.6 + 0.8 * rnd()) : 0; times.push(t); }
  const live = { hashes: [] };
  for (let i = 0; i < times.length; i++) {
    const h = await p.evaluate((t) => new Promise((res) => {
      const S = document.getElementById('c').browser.currentScene, chain = S.getNamedNode('TailSpring');
      chain.set_time = t;
      requestAnimationFrame(() => requestAnimationFrame(() => res({ hash: chain.stateHash, steps: chain.steps })));
    }), times[i]);
    if (i % 50 === 49) live.hashes.push(h.hash);
    live.steps = h.steps;
  }
  // the same sequence through the core in Node, with the same bones read from the same file
  const SB = require('../src/springbone-core.js');
  const seg = 0.12, n = 6, I = [0, 0, 0, 1];
  const joints = [], pose = [];
  for (let i = 0; i < n; i++) { joints.push({ name: 'Tail' + i, parent: i - 1 }); pose.push({ translation: i ? [0, -seg, 0] : [0, 0, 0], center: [0, 0, 0], rotation: i ? I : SB.qFromAxisAngle([0, 0, 1], 1.0471975512), scale: [1, 1, 1], scaleOrientation: I }); }
  const ch = new SB.SpringChain([{ joints }], { damping: 0.08, elasticity: 0.04, stiffness: 0.05, radius: 0.03, endLength: 1, gravity: [0, -0.0006, 0], gravityRestCompensation: false });
  const node = []; let last = -1;
  const ball = { shape: 'SPHERE', bound: 'OUTSIDE', center: [0, 0, 0], radius: 0.1, radius2: 0, height: 0, direction: 'Y', world: { L: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0.12, -0.55, 0] } };
  for (let i = 0; i < times.length; i++) {
    const dt = last < 0 ? 0 : Math.max(0, Math.min(times[i] - last, 0.25)); last = times[i];
    const pw = { L: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] };
    ch.frame({ dt, time: times[i], trees: [{ parentWorld: pw, pose }], reference: pw, colliders: [ball] });
    if (i % 50 === 49) node.push(ch.stateHash());
  }
  const same = node.every((h, i) => h === live.hashes[i]);
  result.rows.push({ id: 'L2', claim: 'Replay through SAI set_time (300 jittered frames, one per drawn frame): X_ITE state hashes equal the Node core\'s at 6 checkpoints', value: { live: live.hashes, node }, pass: same });
  await p.close();
}
result.consoleErrors = errors; result.missing = missing;
mkdirSync(join(ROOT, 'results'), { recursive: true });
writeFileSync(join(ROOT, 'results', 'xite-live.json'), JSON.stringify(result, null, 1) + '\n');
for (const r of result.rows) console.log(r.pass ? 'PASS' : 'FAIL', r.id, JSON.stringify(r.value).slice(0, 300));
console.log('X_ITE', result.xite, 'Chromium', result.chromium, 'console', errors.length, 'missing', missing.length);
errors.slice(0, 10).forEach((e) => console.log('  ', e.slice(0, 300)));
await browser.close(); server.close();
