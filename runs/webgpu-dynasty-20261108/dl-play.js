// node dl-play.js BASEURL OUT.json: a visitor's path through the built Dynasty Loom page (hypersphere on Babylon, tapestry on X_ITE), headless full Chromium, WebGPU stubbed to an offscreen texture.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [, , base, outFile] = process.argv, res = { steps: [], errors: [], consoleErrors: [] };
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--enable-unsafe-webgpu', '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-webgpu-adapter=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', (e) => res.errors.push(e.message.slice(0, 300)));
  p.on('console', (m) => { if (m.type() === 'error') res.consoleErrors.push(m.text().slice(0, 200)); });
  await p.addInitScript(() => {
    window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 600);
    const o = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (t, op) { if (t !== 'webgpu') return o.call(this, t, op); const canvas = this;
      const ctx = { _t: null, _d: null, _f: 'bgra8unorm', canvas, configure(c) { this._d = c.device; this._f = c.format; window.__fmt = c.format; }, unconfigure() {},
        getCurrentTexture() { const w = canvas.width, h = canvas.height; if (!this._t || this._t.width !== w || this._t.height !== h) { this._t = this._d.createTexture({ size: [w, h], format: this._f, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.TEXTURE_BINDING }); window.__sc = this._t; } return this._t; } };
      window.__ctx = ctx; return ctx; };
  });
  const step = async (name, fn) => { const t0 = Date.now(); let out; try { out = await fn(); } catch (e) { out = 'FAILED ' + String(e).slice(0, 200); } res.steps.push({ name, ms: Date.now() - t0, out }); console.log(name, JSON.stringify(out).slice(0, 160)); };
  const hyperReady = () => p.waitForFunction(() => { const E = dynastyApi.engines.hyper; return E && E.api && E.api.ready && !E.api.loading; }, null, { timeout: 240000 });
  await p.goto(base + '/index.html?tier=balanced');
  await step('hypersphere ready', async () => { await hyperReady(); return await p.evaluate(() => ({ view: dynastyApi.view, family: dynastyApi.family, canvas: document.getElementById('x3d-hyper').tagName, tag: window.__x3dBuild })); });
  await step('flight to stop 3 (Crown)', async () => { await p.evaluate(() => dynastyApi.engines.hyper.api.goStop(3)); await p.waitForTimeout(9000); return await p.evaluate(() => dynastyApi.engines.hyper.api.pose().shot); });
  await step('select a person, then clear', async () => { await p.evaluate(() => dynastyNav.select('Q1557224')); await p.waitForTimeout(3000); await p.keyboard.press('Escape'); await p.waitForTimeout(1500); return 'ok'; });
  await step('lens on, off', async () => { await p.evaluate(() => dynastyNav.setLens(true)); await p.waitForTimeout(4000); const on = await p.evaluate(() => dynastyNav.state().lens.on); await p.evaluate(() => dynastyNav.setLens(false)); await p.waitForTimeout(3000); return { on }; });
  await step('tour starts and moves', async () => { const s0 = await p.evaluate(() => dynastyApi.engines.hyper.api.stop); await p.keyboard.press('t'); await p.waitForTimeout(25000); const s1 = await p.evaluate(() => dynastyApi.engines.hyper.api.stop); await p.keyboard.press('t'); return { s0, s1 }; });
  await step('quality tiers fast, ultra', async () => { await p.evaluate(() => { const A = dynastyApi.engines.hyper.api; A.setTier(0); }); await p.waitForTimeout(2500); await p.evaluate(() => dynastyApi.engines.hyper.api.setTier(2)); await p.waitForTimeout(2500); return 'ok'; });
  await step('family Habsburg', async () => { await p.click('#fams button[data-key="habsburg"]'); await p.waitForFunction(() => dynastyApi.family === 'habsburg' && dynastyApi.engines.hyper.api.ready && !dynastyApi.engines.hyper.api.loading, null, { timeout: 240000 }); await p.waitForTimeout(3000); return await p.evaluate(() => dynastyApi.family); });
  await step('night look', async () => { await p.click('#look-t'); await p.waitForFunction(() => dynastyApi.look === 'documentary-night' && dynastyApi.engines.hyper.api.ready && !dynastyApi.engines.hyper.api.loading, null, { timeout: 240000 }); await p.waitForTimeout(3000); return await p.evaluate(() => dynastyApi.look); });
  await step('switch to the tapestry (X_ITE)', async () => { await p.evaluate(() => dynastyApi.setView('loom')); await p.waitForFunction(() => { const E = dynastyApi.engines.loom; return E && E.api && E.api.ready; }, null, { timeout: 240000 }).catch(() => {}); await p.waitForTimeout(4000); return await p.evaluate(() => ({ view: dynastyApi.view, canvas: (document.getElementById('x3d-loom') || {}).tagName, xite: dynastyApi.xite, status: document.getElementById('status').textContent })); });
  await p.screenshot({ path: outFile.replace(/\.json$/, '-loom.png') });
  await step('back to the hypersphere', async () => { await p.evaluate(() => dynastyApi.setView('hyper')); await p.waitForTimeout(5000); return await p.evaluate(() => ({ view: dynastyApi.view, ready: dynastyApi.engines.hyper.api.ready, hidden: document.getElementById('x3d-hyper').hidden })); });
  await p.screenshot({ path: outFile.replace(/\.json$/, '-hyper.png') });
  res.gaps = await p.evaluate(() => window.__gobGaps || []);
  fs.writeFileSync(outFile, JSON.stringify(res, null, 1));
  console.log('errors', res.errors.length, 'console errors', res.consoleErrors.length);
  await b.close();
})();
