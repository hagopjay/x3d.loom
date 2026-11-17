// Headless Chrome under a page policy like the artifact host's: only inline script and the CDN, no other network.
// Run `node build.mjs` and `node test/gates.test.mjs` first. Set CHROME to a browser binary, or Playwright's Chrome channel is used.
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import fs from 'fs'; import crypto from 'crypto';
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const noEval = process.argv.includes('--noeval');
const browser = await chromium.launch({ ...(process.env.CHROME ? { executablePath: process.env.CHROME } : { channel: 'chrome' }), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1360, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push('pageerror: ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
const csp = "default-src 'none'; script-src 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com" + (noEval ? '' : " 'unsafe-eval'") + "; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; img-src data: blob:; connect-src 'none'";
await page.route('**/*', async (route) => {
  const u = new URL(route.request().url());
  if (u.hostname === 'flop.test') return route.fulfill({ status: 200, contentType: 'text/html', headers: { 'content-security-policy': csp }, body: fs.readFileSync(root + '/index.html') });
  if (u.hostname === 'cdn.jsdelivr.net' && u.pathname.startsWith('/npm/three@0.187.0/')) { const f = root + '/node_modules/three/' + u.pathname.slice('/npm/three@0.187.0/'.length); return fs.existsSync(f) ? route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(f) }) : route.fulfill({ status: 404, body: '' }); }
  return route.abort();
});
await page.goto('http://flop.test/'); await page.waitForFunction(() => window.__flop && window.__flop.S.sim, null, { timeout: 20000 });
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const ev = (f, a) => page.evaluate(f, a);
await page.waitForTimeout(1500);
ok(await ev(() => __flop.S.sim.W.frame > 5), 'the loop is stepping: frame ' + await ev(() => __flop.S.sim.W.frame));
ok(await ev(() => !!__flop.view.composer), 'bloom composer loaded through the import map');
// drive the sim directly (software GL is slow): run right, jump, flop
const sum = await ev(() => { const { S, tick } = __flop; S.paused = true; const k = (code, type) => dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
  const x0 = S.sim.hero.x; k('KeyD', 'keydown'); for (let i = 0; i < 40; i++) tick(); const ran = S.sim.hero.x - x0; k('Space', 'keydown'); tick(); let apex = 0; const y0 = S.sim.hero.y; for (let i = 0; i < 40; i++) { tick(); apex = Math.max(apex, S.sim.hero.y - y0); } k('Space', 'keyup'); k('KeyD', 'keyup');
  k('KeyF', 'keydown'); tick(); k('KeyF', 'keyup'); const limp = S.sim.mode; for (let i = 0; i < 300 && S.sim.mode === 'limp'; i++) tick(); return { ran, apex, limp, mode: S.sim.mode, stunt: S.sim.lastStunt, card: !document.getElementById('card').hidden }; });
ok(sum.ran > 3 && sum.apex > 2 && sum.limp === 'limp' && sum.mode === 'hero' && sum.card, 'keys: ran ' + sum.ran.toFixed(1) + ' m, jumped ' + sum.apex.toFixed(2) + ' m, went limp, stood up, stunt card shown (' + (sum.stunt && sum.stunt.score) + ' pts)');
// X3D round trip
const rt = await ev(() => { const { S, toX3D, fromX3D } = __flop; const t = toX3D(S.level), L = fromX3D(t), t2 = toX3D(L); return { same: t === t2, kb: t.length / 1024, b: L.bodies.length, j: L.joints.length, z: L.zones.length, p: L.parts.length, b0: S.level.bodies.length, j0: S.level.joints.length, z0: S.level.zones.length }; });
ok(rt.same && rt.b === rt.b0 && rt.j === rt.j0 && rt.z === rt.z0, `X3D out, in and out again is identical text: ${rt.b} bodies, ${rt.j} joints, ${rt.z} sensors, ${rt.p} parts, ${rt.kb.toFixed(0)} KB`);
fs.writeFileSync(root + '/level/default-level.x3d', await ev(() => __flop.toX3D(__flop.S.level)));
// apply X3D through the UI, with an edit; and a broken file
await page.click('[data-t="x3d"]');
const ap = await ev(() => { const t = document.getElementById('xText'); t.value = t.value.replace("gravity='0 -30 0'", "gravity='0 -12 0'"); document.getElementById('xApply').click(); const g = __flop.S.sim.W.P.gy; t.value = t.value.replace('</Scene>', '<Oops>'); document.getElementById('xApply').click(); return { g, stat: document.getElementById('xStat').textContent, cls: document.getElementById('xStat').className }; });
ok(ap.g === -12 && /bad/.test(ap.cls), 'X3D tab: edited gravity applied (' + ap.g + '); broken XML refused with: ' + ap.stat.slice(0, 70));
await ev(() => { document.getElementById('xFresh').click(); const t = document.getElementById('xText'); t.value = t.value.replace("gravity='0 -12 0'", "gravity='0 -30 0'"); document.getElementById('xApply').click(); });
// solver tab: stock applies; each break applies; a throwing kernel is refused; hash equality stock vs recompiled
await page.click('[data-t="solver"]');
const sv = await ev(() => { const { S, applyKernel, BREAKS, KERNEL_SOURCE } = __flop; const out = { breaks: [] };
  out.stock = applyKernel(KERNEL_SOURCE) && S.kernel === null;
  for (const [name, what, patch] of BREAKS) { let okk = false, differs = false; try { const src = patch(KERNEL_SOURCE); differs = src !== KERNEL_SOURCE; okk = applyKernel(src, what) && S.kernel !== null; } catch (e) { out.breaks.push(name + ' THREW ' + e.message); continue; } out.breaks.push(name + (okk && differs ? ' ok' : ' FAILED: ' + document.getElementById('kStat').textContent)); }
  out.bad = applyKernel(KERNEL_SOURCE.replace('W.detect();', 'W.detect(); throw new Error("boom");')); out.badMsg = document.getElementById('kStat').textContent;
  out.syntax = applyKernel('function integrate( {'); applyKernel(KERNEL_SOURCE); return out; });
ok(sv.stock && sv.breaks.every((b) => / ok$/.test(b)) && !sv.bad && !sv.syntax, `solver tab: stock ok, breaks [${sv.breaks.join('; ')}], throwing kernel refused (“${sv.badMsg.slice(0, 50)}”), syntax error refused`);
// the same through a real click, so the page's own policy applies (page.evaluate is exempt from the eval ban)
{ await ev(() => { const { BREAKS, KERNEL_SOURCE } = __flop; document.getElementById('kText').value = BREAKS[0][2](KERNEL_SOURCE); window.__evalSeen = null; });
  await ev(() => { setTimeout(() => { try { new Function('return 1')(); window.__evalSeen = 'allowed'; } catch (e) { window.__evalSeen = 'blocked'; } }, 0); }); await page.waitForFunction(() => window.__evalSeen);
  await page.click('#kApply'); const r = await ev(() => ({ custom: __flop.S.kernel !== null, stat: document.getElementById('kStat').textContent, seen: window.__evalSeen }));
  ok(r.custom && /^Applied/.test(r.stat), `Apply button with eval ${r.seen} for page scripts: edited solver ${r.custom ? 'is running' : 'NOT running'} (“${r.stat.slice(0, 40)}”)`);
  await page.click('#kReset'); }
// a kernel that fails later, in the live game, falls back
const fb = await ev(() => { const { S, applyKernel, KERNEL_SOURCE, tick } = __flop; applyKernel(KERNEL_SOURCE.replace("W.mark('fields');", "if (W.frame > 60) throw new Error('late'); W.mark('fields');")); const was = !!S.kernel; for (let i = 0; i < 80; i++) tick(); return { was, now: S.kernel === null, msg: document.getElementById('kStat').textContent, frame: S.sim.W.frame }; });
ok(fb.was && fb.now, 'a solver that throws mid-game is replaced by the stock one: ' + fb.msg.slice(0, 60));
// tools without a model: build, experiment, act; offline chips
const tl = await ev(async () => { const { S, runBuild, runExperiment, runAct } = __flop; const n0 = S.sim.W.bodies.length; const b = runBuild({ ops: [{ op: 'add', kind: 'dominoes', params: { x: 2, y: 0, count: 5 } }, { op: 'add', kind: 'nonsense', params: { x: 1, y: 1 } }, { op: 'physics', params: { gravity: 20 } }] });
  const n1 = S.sim.W.bodies.length, g = S.sim.W.P.gy; runBuild({ ops: [{ op: 'physics', params: { gravity: 30 } }] });
  const e = await runExperiment({ scenario: 'cannon', vary: 'cannon.angle', from: 25, to: 70, steps: 6 }); const a = runAct({ action: 'fire_cannon', angle: 35 }); return { b, n0, n1, g, rows: e.rows.map((r) => [r.value, r.goal_miss_m, r.hit_goal]), a, mode: S.sim.mode, charts: document.querySelectorAll('#log canvas').length }; });
ok(tl.b.done.length === 2 && tl.b.errors.length === 1 && tl.n1 === tl.n0 + 5 && tl.g === -20 && tl.rows.length === 6 && tl.mode === 'limp' && tl.charts === 1, `curator tools: build did ${tl.b.done.length}, refused ${tl.b.errors.length} (${tl.b.errors[0]}); sweep rows ${JSON.stringify(tl.rows)}; cannon fired`);
await page.click('[data-t="curator"]');
await ev(() => document.querySelector('#chips button').click()); await page.waitForFunction(() => !document.getElementById('send').disabled, null, { timeout: 60000 });
ok(await ev(() => /Built-in sweep/.test(document.getElementById('log').textContent) && /built-in commands/.test(document.getElementById('who').textContent)), 'with no Claude in the frame the curator says so and the chip still runs a sweep');
// profiler + determinism + replay
await page.click('[data-t="profile"]'); await ev(() => { __flop.S.paused = false; }); await page.waitForTimeout(1200);
const pf = await ev(() => { document.getElementById('bDet').click(); const s = document.getElementById('scrub'); const { S } = __flop; S.paused = true; const n = S.replay.length; s.value = Math.max(0, n - 30); s.dispatchEvent(new Event('input')); const sc = S.scrub; document.getElementById('bFrom').click(); return { det: document.getElementById('detStat').textContent, counts: document.getElementById('counts').textContent.slice(0, 120), n, sc, after: S.replay.length, scrub: S.scrub }; });
ok(/^240 of 240/.test(pf.det) && pf.sc >= 0 && pf.after === pf.n && pf.scrub === -1, 'profiler: ' + pf.det.slice(0, 60) + ' · replay scrubbed to frame ' + pf.sc + ' of ' + pf.n + ' and returned to retained live state without truncation');
// cross-host determinism: the same 300 step hashes in this browser as in Node (written by gates.test.mjs), and a control that must differ
{ const nodeH = JSON.parse(fs.readFileSync(root + '/receipts/hashes-node.json', 'utf8')), nodeN = JSON.parse(fs.readFileSync(root + '/dist/node-hashes-native.json', 'utf8'));
  const pg = await ev(() => { const { Sim, defaultLevel, NOINPUT } = __flop.lab; const go = (k) => { const s = new Sim(defaultLevel(), { headless: true }); if (k) s.W.kernel = k; s.launchFrom(s.W.zones.find((z) => z.kind === 'cannon')); const out = []; for (let i = 0; i < 300; i++) { s.step(NOINPUT, 1 / 60); out.push(s.W.hash()); } return out; };
    let nat = null; try { nat = go(__flop.compileKernel(__flop.KERNEL_SOURCE.replace(/\bsin\(/g, 'Math.sin(').replace(/\bcos\(/g, 'Math.cos('))); } catch (e) {} return { own: go(null), nat, model: JSON.stringify(defaultLevel()) }; });
  const cmp = (a, b) => { let diff = 0, first = -1; for (let i = 0; i < 300; i++) if (a[i] !== b[i]) { diff++; if (first < 0) first = i; } return { diff, first }; };
  const own = cmp(nodeH, pg.own), nat = pg.nat ? cmp(nodeN, pg.nat) : null; const ua = await ev(() => navigator.userAgent.match(/Chrome\/[\d.]+/)[0]);
  const gates = JSON.parse(fs.readFileSync(root + '/receipts/gates.json', 'utf8')), modelSha = crypto.createHash('sha256').update(pg.model).digest('hex');
  ok(modelSha === gates.model_sha256, 'the level built in the browser is the level built in Node (sha256 ' + modelSha.slice(0, 12) + ')');
  ok(own.diff === 0, `Node ${process.version} and ${ua}: ${300 - own.diff} of 300 step hashes agree` + (own.diff ? ', first difference at step ' + own.first : '') + ` (final ${pg.own[299]})`);
  if (nat) ok(nat.diff > 0, `control, solver using Math.sin and Math.cos: ${nat.diff} of 300 step hashes differ between the two hosts, first at step ${nat.first}`); else console.log('SKIP control with Math.sin: this run forbids eval');
  if (!noEval) fs.writeFileSync(root + '/receipts/crosshost.json', JSON.stringify({ node: process.version, v8: process.versions.v8, browser: ua, renderer: 'SwiftShader', steps: 300, model_sha256_browser: modelSha, hashes: pg.own, differing: own.diff, first_difference: own.first, final_hash: pg.own[299], browser_hashes_equal_node: own.diff === 0, control_native_trig: nat ? { differing: nat.diff, first_difference: nat.first } : 'not run' }, null, 1)); }
// screenshots: desktop mid-flight, phone width
await ev(() => { const { S, runAct, tick, view } = __flop; S.paused = true; runAct({ action: 'fire_cannon', angle: 35 }); for (let i = 0; i < 55; i++) tick(); view.overlay.contacts = true; });
await page.click('[data-t="curator"]'); await page.waitForTimeout(2500); await page.screenshot({ path: root + '/dist/shot-desktop.png' });
await ev(() => { __flop.view.overlay.contacts = false; __flop.S.sim.goTo(51, -3); for (let i = 0; i < 20; i++) __flop.tick(); }); await page.click('[data-t="profile"]'); await page.waitForTimeout(2500); await page.screenshot({ path: root + '/dist/shot-hall2.png' });
await page.setViewportSize({ width: 390, height: 800 }); await page.waitForTimeout(800);
const ov = await ev(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); ok(ov <= 0, 'no sideways scroll at 390 px (overflow ' + ov + ' px)'); await page.screenshot({ path: root + '/dist/shot-phone.png' });
const real = errs.filter((e) => !/fonts\.g|ERR_FAILED|net::/.test(e)); ok(real.length === 0, 'no page errors' + (real.length ? ': ' + real.slice(0, 4).join(' | ') : ''));
console.log(fails ? fails + ' FAILED' : 'all passed'); await browser.close(); process.exit(fails ? 1 : 0);
