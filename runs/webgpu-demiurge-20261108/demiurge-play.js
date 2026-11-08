// node demiurge-play.js BASE_URL > play-result.json: drives the Babylon demiurge page like a visitor (zoom ladder keys 2 to 8 and back to 1, the tour, UI cycling, a hover) and reports page errors.
// Software adapter, stubbed swap chain, rAF slowed: correctness only, no timings.
const { chromium } = require('playwright');
(async () => {
  const base = process.argv[2];
  const b = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--no-sandbox', '--use-angle=swiftshader', '--use-webgpu-adapter=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; p.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && /WGSL|shader|pipeline/i.test(m.text()))) errs.push(m.type() + ' ' + m.text().slice(0, 240)); }); p.on('pageerror', (e) => errs.push('pageerror ' + e.message.slice(0, 240)));
  await p.addInitScript(() => {
    window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 400);
    const o = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (t, op) { if (t !== 'webgpu') return o.call(this, t, op); const canvas = this;
      return { _t: null, _d: null, _f: 'bgra8unorm', canvas, configure(c) { this._d = c.device; this._f = c.format; }, unconfigure() {}, getCurrentTexture() { const w = canvas.width, h = canvas.height; if (!this._t || this._t.width !== w || this._t.height !== h) this._t = this._d.createTexture({ size: [w, h], format: this._f, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.TEXTURE_BINDING }); return this._t; } }; };
  });
  const out = {};
  await p.goto(base + '/gobbler-demiurge/index.html?seed=0');
  await p.waitForFunction(() => window.gdBoot && (window.gdBoot.done || window.gdBoot.failed), null, { timeout: 600000 });
  out.boot = await p.evaluate(() => ({ done: window.gdBoot.done, failed: window.gdBoot.failed, log: window.gdBoot.log.slice(-4) }));
  const where = () => p.evaluate(() => { const b = window.__dmBody, q = b.pose; return { pos: q.pos.map((x) => +x.toFixed(4)), zones: b.prox.filter((s) => s.node.f.size[0] < 1e6).map((s) => (s.node.def || '?') + ':' + (s.inside ? 1 : 0)).join(' '), near: +b.cam.minZ.toPrecision(2), hud: (document.getElementById('hud') || {}).textContent }; });
  out.ladder = {};
  await p.mouse.move(480, 300);
  for (const k of ['2', '3', '4', '5', '6', '7', '8', '1']) {
    await p.keyboard.press(k); await p.waitForTimeout(16000); out.ladder[k] = await where();
  }
  await p.keyboard.press('t'); await p.waitForTimeout(9000); out.tour = await where(); await p.keyboard.press('t');
  await p.keyboard.press('u'); out.ui = await p.evaluate(() => document.getElementById('gv4').dataset.ui);
  out.errors = errs.filter((e) => !/WebGPU uncaptured|Instance dropped|popErrorScope/.test(e));
  out.notes = await p.evaluate(() => window.__gobGaps);
  console.log(JSON.stringify(out, null, 1)); await b.close();
})();
