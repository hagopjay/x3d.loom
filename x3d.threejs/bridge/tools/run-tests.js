// node tools/run-tests.js [--no-xite] [--shots DIR] NODE...   -> one JSON line {ok, env, results:{NODE:{ok, ours, xite, visual, gaps}}}
// The same fixture/test-spec format as the Babylon bridge (x3d.webgpu/bridge/tools/run-tests.js, whose RUNNER, verdict and judgeVisual this file imports unchanged),
// the same two engines through the SAI (ours = reader + three.js body, xite = X_ITE 16.6.0 on SwiftShader), a different body.
// Fixture lookup: ./fixtures first (scene fixtures written for the three.js body), then ../../x3d.webgpu/bridge/fixtures (event fixtures every body shares).
// How a result is read (owner's ruling 14 Nov: X_ITE match is a target, not a hard rule):
//   events-mode specs and every assertion about values are HARD: X_ITE is the oracle and a disagreement fails the node.
//   scene-mode "compare" numbers are REFERENCE bounds: they are measured and recorded in the receipt, and they guard against regressions, but a spec may widen them with a
//   written reason ("lookNote"), and a quality choice that moves away from X_ITE is logged, not failed.
const fs = require('fs'), path = require('path'), http = require('http'), crypto = require('crypto');
const BAB = path.resolve(__dirname, '..', '..', '..', 'x3d.webgpu', 'bridge'), HERE = path.resolve(__dirname, '..');
const BABYLON_RUNNER = require(path.join(BAB, 'tools', 'run-tests.js')), { verdict, judgeVisual } = BABYLON_RUNNER;
// the Babylon runner's value converter has no MFColor (X_ITE needs SFColor objects, the reader keeps a list of triples); added here, at read time, so the Babylon file stays the Babylon thread's
const RUNNER = BABYLON_RUNNER.RUNNER.replace("case 'MFFloat':", "case 'MFColor': return eng.name === 'ours' ? v : new X.MFColor(...v.map((a) => new X.SFColor(...a))); case 'MFFloat':");
const bundle = require('./bundle.js');
const args = process.argv.slice(2), noXite = args.includes('--no-xite');
const si = args.indexOf('--shots'); const shotsDir = si >= 0 ? args.splice(si, 2)[1] : process.env.BRIDGE_SHOTS || null;
const names = args.filter((a) => !a.startsWith('--'));
const rootOf = (m) => [path.join(HERE, 'node_modules', m), path.join(process.cwd(), 'node_modules', m), path.join('/tmp/tj/node_modules', m)].find((d) => fs.existsSync(path.join(d, 'package.json'))) || null;
const XITE_DIR = process.env.XITE_DIR || (rootOf('x_ite') && path.join(rootOf('x_ite'), 'dist')), THREE_DIR = process.env.THREE_DIR || (rootOf('three') && path.join(rootOf('three'), 'build'));

// METRICS (iou, mad, psnr, foreground mean) is read out of the Babylon runner's source and run in a page, so both bridges score a picture with the same code
const METRICS_SRC = (() => { const s = fs.readFileSync(path.join(BAB, 'tools', 'run-tests.js'), 'utf8'), a = s.indexOf('const METRICS = '), b = s.indexOf('\nconst SIDE', a); if (a < 0 || b < 0) throw new Error('METRICS not found in the Babylon run-tests.js'); return s.slice(a + 'const METRICS = '.length, b).replace(/;\s*$/, ''); })();

const THREE_BOOT = `<script type="module">import * as THREE from '/three/three.module.js'; window.THREE = THREE;
const add = (src) => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.body.appendChild(s); });
window.pageReady = add('/bundle-body.js').then(async () => { const body = new Body(document.getElementById('c'), { tone: window.__tone || 'none', fontBase: '/x_ite/assets/fonts/', onNote: (m) => (window.__notes = window.__notes || []).push(m) }); await body.init(); X3DSAI.setBody(body); window.__body = body; });</script>`;
const PAGE_OURS = `<!doctype html><meta charset=utf-8><body><script src="/bundle.js"></script><script>${RUNNER}
let ts = performance.timeOrigin / 1000 + performance.now() / 1000;
window.runOurs = async (spec, xml) => (window.__R && (__R.bridge.allowScripts = spec.scripts !== false), runSpec({ name: 'ours',
  open: async (x) => X3DSAI.B.createX3DFromString(x), now: () => ts,
  apply: async (fn) => { __events.begin(ts += 0.05); fn(); __events.drain(); },
  settle: async (dt) => { const steps = Math.max(1, Math.round((dt || 0.05) / 0.05)); for (let i = 0; i < steps; i++) { __events.begin(ts += 0.05); for (const n of (window.__worlds || [])) for (const t of n.nodes) if (t.type === 'TimeSensor') __R.tickTimeSensor(t, ts); __events.drain(); } },
}, spec, xml));</script>`;
const PAGE_XITE = (w, h) => `<!doctype html><meta charset=utf-8><link rel=stylesheet href="/x_ite/x_ite.css"><body style="margin:0"><x3d-canvas id=c style="width:${w}px;height:${h}px;display:block"></x3d-canvas><script src="/x_ite/x_ite.min.js"></script><script>${RUNNER}
window.runXite = async (spec, xml) => { const b = X3D.getBrowser('#c'); try { b.setBrowserOption('Notifications', false); b.setBrowserOption('Timings', false); } catch (e) {} await b.loadComponents?.(b.getProfile ? b.getProfile('Full') : undefined).catch(() => {});
  return runSpec({ name: 'xite', open: async (x) => { const sc = await b.createX3DFromString(x); await b.replaceWorld(sc); await b.nextFrame(); await b.nextFrame(); return sc; },
    apply: async (fn) => { fn(); await b.nextFrame(); await b.nextFrame(); }, settle: async (dt) => { await new Promise((r) => setTimeout(r, (dt || 0.05) * 1000)); await b.nextFrame(); } }, spec, xml); };
window.xiteInfo = () => ({ name: X3D.getBrowser('#c').name, version: X3D.getBrowser('#c').version });</script>`;
const PAGE_OURS_SCENE = `<!doctype html><meta charset=utf-8><body style="margin:0;background:#000"><canvas id=c width=320 height=240 style="width:320px;height:240px;display:block"></canvas>${THREE_BOOT}<script>${RUNNER}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
window.__bodyShot = async () => window.__body.shot();
window.runScene = async (spec, xml) => { await window.pageReady; if (window.__R) __R.bridge.allowScripts = spec.scripts !== false; window.__body.setTone(spec.tone === 'none' || !spec.tone ? 'none' : spec.tone); return runSpec({ name: 'ours',
  open: async (x) => { const sc = await X3DSAI.B.createX3DFromString(x); await X3DSAI.B.replaceWorld(sc); await X3DSAI.B.nextFrame(); await X3DSAI.B.nextFrame(); return sc; },
  apply: async (fn) => { fn(); await X3DSAI.B.nextFrame(); await X3DSAI.B.nextFrame(); }, settle: async (dt) => { await sleep((dt || 0.05) * 1000); await X3DSAI.B.nextFrame(); } }, spec, xml); };</script>`;

function serve(files) {
  const mime = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
  const dirs = { '/x_ite/': XITE_DIR, '/three/': THREE_DIR };
  return new Promise((res) => { const s = http.createServer((q, r) => {
    const u = decodeURIComponent(q.url.split('?')[0]);
    if (u === '/px.png' || u === '/slow.png') { const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'); r.setHeader('content-type', 'image/png'); r.setHeader('cache-control', 'no-store'); return u === '/px.png' ? r.end(png) : setTimeout(() => r.end(png), 2500); }   // the two images the LoadSensor fixture asks for, as in the Babylon rig
    if (files[u] !== undefined) { r.setHeader('content-type', mime[path.extname(u)] || 'text/html'); return r.end(files[u]); }
    for (const [pre, dir] of Object.entries(dirs)) if (dir && u.startsWith(pre)) { const f = path.join(dir, u.slice(pre.length)); if (f.startsWith(dir) && fs.existsSync(f) && fs.statSync(f).isFile()) { r.setHeader('content-type', mime[path.extname(f)] || 'application/octet-stream'); return fs.createReadStream(f).pipe(r); } }
    r.statusCode = 404; r.end('no');
  }).listen(0, () => res(s)); });
}
const find = (n, ext) => [path.join(HERE, 'fixtures', n + ext), path.join(BAB, 'fixtures', n + ext)].find((f) => fs.existsSync(f));

async function main() {
  if (!names.length) throw new Error('name at least one fixture to test');
  if (!THREE_DIR) throw new Error('three.js not found: npm ci in x3d.threejs/bridge, or set THREE_DIR to three/build');
  const { chromium } = require('playwright');
  const files = { '/bundle.js': bundle('reader'), '/bundle-body.js': bundle('body'), '/ours.html': PAGE_OURS, '/ours-scene.html': PAGE_OURS_SCENE, '/xite.html': PAGE_XITE(64, 64), '/xite-scene.html': PAGE_XITE(320, 240) };
  const server = await serve(files), base = 'http://localhost:' + server.address().port; let b;
  try {
    b = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE || undefined, args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
    const env = { chromium: b.version(), ours: 'x3d.threejs reader (shared with the Babylon bridge) + three.js body, bundle sha ' + crypto.createHash('sha256').update(files['/bundle-body.js']).digest('hex').slice(0, 12) };
    const errs = [], results = {}, newPage = async () => { const pg = await b.newPage(); pg.on('pageerror', (e) => errs.push(e.message.slice(0, 200))); return pg; };
    const haveX = !noXite && XITE_DIR && fs.existsSync(path.join(XITE_DIR, 'x_ite.min.js'));
    if (!haveX) env.xite = noXite ? 'skipped (--no-xite)' : 'not found (set XITE_DIR)';
    let po = null, px = null, pos = null, pxs = null, mp = null;
    const mouseKeyFns = async (pg) => {   // the pointer and key steps of the shared runner: real Playwright input on the page
      await pg.exposeFunction('__mouse', async (k, x, y) => { if (k === 'move') await pg.mouse.move(x, y, { steps: 6 }); else if (k === 'down') { await pg.mouse.move(x, y); await pg.mouse.down(); } else if (k === 'up') { await pg.mouse.move(x, y, { steps: 6 }); await pg.mouse.up(); } });
      await pg.exposeFunction('__key', async (k, a) => {
        if (k === 'focus') { await pg.evaluate(() => document.getElementById('c').focus()); if (!(await pg.evaluate(() => document.activeElement && document.activeElement.id === 'c'))) await pg.mouse.click(4, 4); }
        else if (k === 'down') await pg.keyboard.down(a); else if (k === 'up') await pg.keyboard.up(a); else if (k === 'press') await pg.keyboard.press(a); else if (k === 'type') await pg.keyboard.type(a); });
    };
    const shotFns = async (pg, ours) => { if (ours) await pg.exposeFunction('__noop', () => 0); else { await pg.exposeFunction('__shotraw', async () => (await pg.screenshot({ clip: { x: 0, y: 0, width: 320, height: 240 }, type: 'png' })).toString('base64')); await pg.exposeFunction('__pxraw', async (x, y) => (await pg.screenshot({ clip: { x, y, width: 1, height: 1 }, type: 'png' })).toString('base64')); } };
    for (const n of names) {
      const fx = find(n, '.x3d'), ts = find(n, '.test.json'); const errorStart = errs.length;
      if (!fx || !ts) { results[n] = { ok: false, msg: 'missing fixture or test spec' }; continue; }
      const xml = fs.readFileSync(fx, 'utf8'), spec = JSON.parse(fs.readFileSync(ts, 'utf8')), scene = spec.mode === 'scene';
      if (scene) { if (!pos) { pos = await newPage(); await shotFns(pos, true); await mouseKeyFns(pos); await pos.goto(base + '/ours-scene.html'); await pos.evaluate(() => window.pageReady); env.three = await pos.evaluate(() => THREE.REVISION); env.glRenderer = await pos.evaluate(() => { const g = __body.renderer.getContext(), e = g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); }); } if (haveX && spec.xite !== false && !pxs) { pxs = await newPage(); await shotFns(pxs, false); await mouseKeyFns(pxs); await pxs.goto(base + '/xite-scene.html'); await pxs.waitForFunction(() => window.X3D && X3D.getBrowser('#c')); env.xite = await pxs.evaluate(() => JSON.stringify(window.xiteInfo())); } }
      else { if (!po) { po = await newPage(); await po.goto(base + '/ours.html'); } if (haveX && spec.xite !== false && !px) { px = await newPage(); await px.goto(base + '/xite.html'); await px.waitForFunction(() => window.X3D && X3D.getBrowser('#c')); env.xite = await px.evaluate(() => JSON.stringify(window.xiteInfo())); } }
      const P = scene ? pos : po, PX = !haveX || spec.xite === false ? null : scene ? pxs : px;
      const r = { ok: false, ours: '?', xite: PX ? '?' : spec.xite === false ? 'not applicable (fixture)' : 'unavailable', mode: scene ? 'scene (look: reference bounds)' : 'events (hard)' };
      try { const o = await P.evaluate(([f, s, x]) => window[f](s, x), [scene ? 'runScene' : 'runOurs', spec, xml]); r.shotsOurs = o.shots; if (o.recorded && o.recorded.length) r.recordedOurs = o.recorded; r.ours = o.ok ? `pass ${o.steps}/${o.steps}` : 'FAIL ' + o.fails.join(' | '); r.oursOk = o.ok; r.map = o.map; } catch (e) { r.ours = 'ERROR ' + String(e).slice(0, 200); r.oursOk = false; }
      if (PX) { try { const o = await PX.evaluate(([f, s, x]) => window[f](s, x), ['runXite', spec, xml]); r.shotsXite = o.shots; r.xite = o.ok ? `pass ${o.steps}/${o.steps}` : 'FAIL ' + o.fails.join(' | '); r.xiteOk = o.ok; r.mapX = o.map; } catch (e) { r.xite = 'ERROR ' + String(e).slice(0, 200); r.xiteOk = false; r.xiteError = true; } }
      if (r.shotsOurs && Object.keys(r.shotsOurs).length) { r.visual = {};
        for (const name of Object.keys(r.shotsOurs)) {
          if (shotsDir) { fs.mkdirSync(shotsDir, { recursive: true }); const wr = (sfx, u) => fs.writeFileSync(path.join(shotsDir, `${n}.${name}${sfx}.png`), Buffer.from(u.split(',')[1], 'base64')); wr('.ours', r.shotsOurs[name]); if ((r.shotsXite || {})[name]) wr('.xite', r.shotsXite[name]); }
          const want = spec.compare && spec.compare[name];
          if ((r.shotsXite || {})[name]) {
            const m = await (mp ||= await newPage()).evaluate(`(${METRICS_SRC})(${JSON.stringify([r.shotsOurs[name], r.shotsXite[name], want || null])})`); r.visual[name] = m;
            if (want && m.error) { r.oursOk = false; r.ours += ` | compare ${name}: ${m.error}`; } else if (want) { const bad = judgeVisual(m, want); if (bad.length) { r.oursOk = false; r.ours += ` | compare ${name}: ${bad.join('; ')}`; } }
          }
        } if (!Object.keys(r.visual).length) delete r.visual; }
      delete r.shotsOurs; delete r.shotsXite; delete r.map; delete r.mapX;
      verdict(r, spec, noXite, errs.slice(errorStart));
      for (const k of ['gaps', 'scope', 'lookNote']) if (spec[k] && spec[k].length) r[k] = spec[k];
      results[n] = r;
    }
    if (errs.length) env.pageErrors = errs.slice(0, 5);
    const ok = Object.values(results).every((r) => r.ok);
    console.log(JSON.stringify({ ok, scope: noXite ? 'local-only' : 'reference-comparison', env, results })); if (!ok) process.exitCode = 1;
  } finally { if (b) await b.close(); await new Promise((r) => server.close(r)); }
}
if (require.main === module) main().catch((e) => { console.error(e); console.log(JSON.stringify({ ok: false, error: String(e) })); process.exitCode = 1; });
