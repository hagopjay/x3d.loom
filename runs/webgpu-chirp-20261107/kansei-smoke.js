const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--no-sandbox', '--use-angle=swiftshader', '--use-webgpu-adapter=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 640, height: 360 } }); const errs = [];
  p.on('console', m => { if (/error/i.test(m.type())) errs.push(m.text().slice(0, 200)); }); p.on('pageerror', e => errs.push('pageerror ' + e.message.slice(0, 200)));
  await p.addInitScript(() => { window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 1200);
    const orig = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, o) { if (t !== 'webgpu') return orig.call(this, t, o); const canvas = this;
      return { _t: null, _d: null, _f: 'bgra8unorm', canvas, configure(c) { this._d = c.device; this._f = c.format; }, unconfigure() {}, getCurrentTexture() { const w = canvas.width, h = canvas.height; if (!this._t || this._t.width !== w || this._t.height !== h) this._t = this._d.createTexture({ size: [w, h], format: this._f, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.TEXTURE_BINDING }); return this._t; } }; }; });
  await p.goto('http://localhost:8151/index.html?hud=0');
  await p.waitForFunction(() => (window.KANSEI && window.KANSEI.ready) || window.__driftWebGPUError, null, { timeout: 280000 }).catch(() => console.log('not ready'));
  console.log(JSON.stringify({ ready: await p.evaluate(() => !!(window.KANSEI && window.KANSEI.ready)), err: await p.evaluate(() => window.__driftWebGPUError || null), errs }));
  await b.close();
})();
