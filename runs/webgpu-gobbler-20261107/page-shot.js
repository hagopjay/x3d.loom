// node page-shot.js out.png [wait ms] [js to eval before the shot] [url]: the built Gobbler page, headless, WebGPU stubbed to an offscreen texture
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [, , out, wait, pre, url] = process.argv;
  const b = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--no-sandbox', '--use-angle=swiftshader', '--use-webgpu-adapter=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('console', (m) => { const t = m.text(); if (m.type() === 'error' || m.type() === 'warning' || /note|fallback/i.test(t)) console.log('console', m.type(), t.slice(0, 400)); });
  p.on('pageerror', (e) => console.log('pageerror', e.message.slice(0, 500)));
  await p.addInitScript(() => {
    window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 600);
    const o = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (t, op) { if (t !== 'webgpu') return o.call(this, t, op); const canvas = this;
      const ctx = { _t: null, _d: null, _f: 'bgra8unorm', canvas, configure(c) { this._d = c.device; this._f = c.format; window.__fmt = c.format; }, unconfigure() {},
        getCurrentTexture() { const w = canvas.width, h = canvas.height; if (!this._t || this._t.width !== w || this._t.height !== h) { this._t = this._d.createTexture({ size: [w, h], format: this._f, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.TEXTURE_BINDING }); window.__sc = this._t; } return this._t; } };
      window.__ctx = ctx; return ctx; };
  });
  await p.goto(url || 'http://localhost:8124/gobbler3-webgpu.html');
  await p.waitForFunction(() => document.body.dataset.loaded === '1' || window.__gobWebGPUError, null, { timeout: 120000 }).catch(() => console.log('load timeout'));
  await p.waitForTimeout(+wait || 8000);
  if (pre) { console.log('pre', JSON.stringify(await p.evaluate(pre))); await p.waitForTimeout(+wait || 8000); }
  console.log('state', JSON.stringify(await p.evaluate(() => ({ err: window.__gobWebGPUError, loaded: document.body.dataset.loaded, hud: (document.getElementById('hud') || {}).textContent, gaps: window.__gobGaps }))));
  const data = await p.evaluate(async () => { const t = window.__sc; if (!t) return null; const d = window.__ctx._d, w = t.width, h = t.height, bpr = Math.ceil(w * 4 / 256) * 256; const buf = d.createBuffer({ size: bpr * h, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }); const e = d.createCommandEncoder(); e.copyTextureToBuffer({ texture: t }, { buffer: buf, bytesPerRow: bpr }, [w, h]); d.queue.submit([e.finish()]); await buf.mapAsync(GPUMapMode.READ); const a = new Uint8Array(buf.getMappedRange().slice(0)); const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'), im = x.createImageData(w, h), bgra = window.__fmt.startsWith('bgra'); for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) { const s = y * bpr + i * 4, o = (y * w + i) * 4; im.data[o] = a[s + (bgra ? 2 : 0)]; im.data[o + 1] = a[s + 1]; im.data[o + 2] = a[s + (bgra ? 0 : 2)]; im.data[o + 3] = 255; } x.putImageData(im, 0, 0); return c.toDataURL('image/png').split(',')[1]; });
  if (data) fs.writeFileSync(out, Buffer.from(data, 'base64'));
  await p.screenshot({ path: out.replace(/\.png$/, '-dom.png') });
  await b.close();
})();
