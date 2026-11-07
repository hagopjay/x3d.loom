// node chirp-shot.js babylon|xite URL OUT_PREFIX [W H] [times, comma separated, fractions of the run]
// One still per time of the Chirp study, 3D stage only (page chrome hidden with the study's own 'hide' class). Software adapters (SwiftShader), correctness only, no timings.
// babylon: WebGPU swap chain stubbed with an offscreen texture and read back (headless cannot present one); requestAnimationFrame slowed to 1.2 s.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [, , mode, url, prefix, W, H, times] = process.argv; const ts = (times || '0,0.5,0.9,0.99').split(',');
  const bab = mode === 'babylon';
  const b = await chromium.launch({ args: bab ? ['--enable-unsafe-webgpu', '--no-sandbox', '--use-angle=swiftshader', '--use-webgpu-adapter=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: +W || 1100, height: +H || 700 } });
  p.on('console', m => { const t = m.text(); if (/error|warn/i.test(m.type())) console.log('console', m.type(), t.slice(0, 300)); else if (/x3d to babylon|x3d reader/.test(t)) console.log('note', t.slice(0, 200)); });
  p.on('pageerror', e => console.log('pageerror', e.message.slice(0, 400)));
  if (bab) await p.addInitScript(() => {
    window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 1200);
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (t, o) {
      if (t !== 'webgpu') return orig.call(this, t, o);
      const canvas = this;
      const ctx = { _t: null, _d: null, _f: 'bgra8unorm', canvas, configure(c) { this._d = c.device; this._f = c.format; window.__fmt = c.format; }, unconfigure() {},
        getCurrentTexture() { const w = canvas.width, h = canvas.height; if (!this._t || this._t.width !== w || this._t.height !== h) { this._t = this._d.createTexture({ size: [w, h], format: this._f, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.TEXTURE_BINDING }); } window.__sc = this._t; return this._t; } };
      window.__ctx = ctx; return ctx;
    };
    window.__snap = async () => {
      const t = window.__sc, d = window.__ctx._d, w = t.width, h = t.height, bpr = Math.ceil(w * 4 / 256) * 256;
      const buf = d.createBuffer({ size: bpr * h, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }); const e = d.createCommandEncoder();
      e.copyTextureToBuffer({ texture: t }, { buffer: buf, bytesPerRow: bpr }, [w, h]); d.queue.submit([e.finish()]); await buf.mapAsync(GPUMapMode.READ);
      const a = new Uint8Array(buf.getMappedRange().slice(0)); const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); const im = x.createImageData(w, h);
      const bgra = window.__fmt.startsWith('bgra');
      for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) { const s = y * bpr + i * 4, o = (y * w + i) * 4; im.data[o] = a[s + (bgra ? 2 : 0)]; im.data[o + 1] = a[s + 1]; im.data[o + 2] = a[s + (bgra ? 0 : 2)]; im.data[o + 3] = 255; }
      x.putImageData(im, 0, 0); return c.toDataURL('image/png').split(',')[1];
    };
  });
  await p.goto(url + '#equal');
  await p.waitForFunction(() => window.chirpView && window.chirpView().case && !window.chirpView().loading, null, { timeout: 280000 }).catch(() => console.log('not ready'));
  await p.evaluate(() => document.body.classList.add('hide')); await p.addStyleTag({ content: '#caption,#wave,#clock,#banner{display:none!important}' });
  console.log('view', JSON.stringify(await p.evaluate(() => window.chirpView())).slice(0, 300));
  if (process.env.EVAL) console.log('eval', JSON.stringify(await p.evaluate(process.env.EVAL)).slice(0, 1500));
  for (const t of ts) {
    await p.evaluate((t) => { location.hash = '#equal/t=' + t + '/view=Close'; }, t);
    await p.waitForFunction((t) => Math.abs(window.chirpView().t_fraction - +t) < 1e-6, t, { timeout: 60000 });
    if (bab) {
      const n0 = await p.evaluate(() => window.__chirpWebGPU.body.stats.frames);
      await p.waitForFunction((n) => window.__chirpWebGPU.body.stats.frames >= n, n0 + 3, { timeout: 280000 }).catch(() => console.log('frames timeout'));
      fs.writeFileSync(`${prefix}-${t}.png`, Buffer.from(await p.evaluate(() => window.__snap()), 'base64'));
    } else { await p.waitForTimeout(2500); await p.locator('#canvas').screenshot({ path: `${prefix}-${t}.png` }); }
    console.log('shot', t);
  }
  if (process.env.EVAL2) { console.log('eval2', JSON.stringify(await p.evaluate(process.env.EVAL2)).slice(0, 1500)); if (bab) { const n0 = await p.evaluate(() => window.__chirpWebGPU.body.stats.frames); await p.waitForFunction((n) => window.__chirpWebGPU.body.stats.frames >= n, n0 + 3, { timeout: 280000 }); fs.writeFileSync(`${prefix}-after.png`, Buffer.from(await p.evaluate(() => window.__snap()), 'base64')); } }
  await b.close();
})();
