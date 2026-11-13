// node dl-views.js babylon|xite BASEURL OUTPREFIX shot1,shot2,... [settle ms]: the Dynasty Loom hypersphere at fixed shots, clocks frozen (A.freeze), ?ui=none.
// babylon: headless, WebGPU stubbed to an offscreen texture (correctness only, no timings); xite: the page with X_ITE for both, full Chromium, WebGL 2 on SwiftShader.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [, , eng, base, prefix, shots, settle] = process.argv, look = process.env.LOOK || '';
  const bab = eng === 'babylon';
  const b = await chromium.launch(bab ? { args: ['--enable-unsafe-webgpu', '--no-sandbox', '--use-angle=swiftshader', '--use-webgpu-adapter=swiftshader'] }
    : { executablePath: process.env.CHROME || undefined, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  p.on('console', (m) => { const t = m.text(); if (m.type() === 'error' || /BJS|WGSL|fallback/i.test(t)) console.log('console', m.type(), t.slice(0, 300)); });
  p.on('pageerror', (e) => console.log('pageerror', e.message.slice(0, 400)));
  if (bab) {
  await p.addInitScript(() => {
      window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 600);
      const o = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (t, op) { if (t !== 'webgpu') return o.call(this, t, op); const canvas = this;
        const ctx = { _t: null, _d: null, _f: 'bgra8unorm', canvas, configure(c) { this._d = c.device; this._f = c.format; window.__fmt = c.format; }, unconfigure() {},
          getCurrentTexture() { const w = canvas.width, h = canvas.height; if (!this._t || this._t.width !== w || this._t.height !== h) { this._t = this._d.createTexture({ size: [w, h], format: this._f, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.TEXTURE_BINDING }); window.__sc = this._t; } return this._t; } };
        window.__ctx = ctx; return ctx; };
    });
  }
  await p.goto(base + '/index.html?ui=none&tier=balanced' + (process.env.QS || ''));
  await p.waitForFunction(() => { const S = window.dynastyApi, E = S && S.engines && S.engines.hyper; return (E && E.api && E.api.ready); }, null, { timeout: 240000 });
  await p.evaluate((l) => { const A = dynastyApi.engines.hyper.api; if (l && dynastyApi.setLook) dynastyApi.setLook(l, true); A.freeze(0.25); dynastyNav.config({ idle: false }); }, look);
  await p.waitForTimeout(3000);
  for (const name of shots.split(',')) {
    await p.evaluate((n) => { const A = dynastyApi.engines.hyper.api; return A.flyTo(n, { dur: 0.05 }); }, name).catch((e) => console.log('flyTo', name, String(e).slice(0, 100)));
    await p.waitForTimeout(+settle || 4000);
    if (process.env.PRE) { console.log('pre', JSON.stringify(await p.evaluate(process.env.PRE).catch((e) => String(e))).slice(0, 200)); await p.waitForTimeout(+(process.env.PREWAIT || 5000)); }
    const file = prefix + '_' + name + '.png';
    if (bab) {
      const data = await p.evaluate(async () => { const t = window.__sc; if (!t) return null; const d = window.__ctx._d, w = t.width, h = t.height, bpr = Math.ceil(w * 4 / 256) * 256; const buf = d.createBuffer({ size: bpr * h, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }); const e = d.createCommandEncoder(); e.copyTextureToBuffer({ texture: t }, { buffer: buf, bytesPerRow: bpr }, [w, h]); d.queue.submit([e.finish()]); await buf.mapAsync(GPUMapMode.READ); const a = new Uint8Array(buf.getMappedRange().slice(0)); const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'), im = x.createImageData(w, h), bgra = window.__fmt.startsWith('bgra'); for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) { const s = y * bpr + i * 4, o = (y * w + i) * 4; im.data[o] = a[s + (bgra ? 2 : 0)]; im.data[o + 1] = a[s + 1]; im.data[o + 2] = a[s + (bgra ? 0 : 2)]; im.data[o + 3] = 255; } x.putImageData(im, 0, 0); return c.toDataURL('image/png').split(',')[1]; });
      if (data) fs.writeFileSync(file, Buffer.from(data, 'base64'));
    } else await p.screenshot({ path: file });
    console.log('shot', name, JSON.stringify(await p.evaluate(() => { const A = dynastyApi.engines.hyper.api; try { return { vp: A.pose && A.pose() } } catch (e) { return String(e) } })).slice(0, 200));
  }
  await b.close();
})();
