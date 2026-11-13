// node shot-babylon.js URL OUT.png [W H] [frames] [STEPS.json]: (STEPS.json is a list of {eval, out}: run the snippet in the page, wait `frames` frames, write another still)
// first line was: node shot-babylon.js URL OUT.png [W H] [frames]: one still of the Babylon WebGPU KANSEI page (headless Chromium, SwiftShader WebGPU adapter).
// The swap chain is stubbed with an offscreen texture that is read back through a buffer copy; requestAnimationFrame is slowed to 1.2 s so the software adapter is not flooded.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [, , url, out, W, H, frames] = process.argv;
  const b = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--no-sandbox', '--use-angle=swiftshader', '--use-webgpu-adapter=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: +W || 640, height: +H || 360 } });
  const errs = [];
  p.on('console', m => { const t = m.text(); if (/error/i.test(m.type())) { errs.push(t); console.log('console', m.type(), t.slice(0, 300)); } else if (/x3d to babylon|reader/.test(t)) console.log('note', t.slice(0, 200)); });
  p.on('pageerror', e => { errs.push(e.message); console.log('pageerror', e.message.slice(0, 400)); });
  await p.addInitScript(() => {
    window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 1200);
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (t, o) {
      if (t !== 'webgpu') return orig.call(this, t, o);
      const canvas = this;
      const ctx = { _t: null, _d: null, _f: 'bgra8unorm', canvas, configure(c) { this._d = c.device; this._f = c.format; window.__fmt = c.format; }, unconfigure() {},
        getCurrentTexture() { const w = canvas.width, h = canvas.height; if (!this._t || this._t.width !== w || this._t.height !== h) { this._t = this._d.createTexture({ size: [w, h], format: this._f, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.TEXTURE_BINDING }); window.__sc = this._t; } return this._t; } };
      window.__ctx = ctx; return ctx;
    };
  });
  await p.goto(url);
  await p.waitForFunction(() => window.__ready || window.__driftWebGPUError, null, { timeout: 280000 }).catch(() => console.log('not ready'));
  const bootErr = await p.evaluate(() => window.__driftWebGPUError || null); console.log('error?', bootErr); if (bootErr) { await b.close(); return; }
  const f0 = await p.evaluate(() => window.__driftWebGPU ? window.__driftWebGPU.body.stats.frames : 0);
  await p.waitForFunction((n) => window.__driftWebGPU && window.__driftWebGPU.body.stats.frames >= n, f0 + (+frames || 3), { timeout: 280000 }).catch(() => console.log('frames timeout'));
  const snap = async () => {
  const data = await p.evaluate(async () => {
    const t = window.__sc; if (!t) return null; const d = window.__ctx._d, w = t.width, h = t.height, bpr = Math.ceil(w * 4 / 256) * 256;
    const buf = d.createBuffer({ size: bpr * h, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }); const e = d.createCommandEncoder();
    e.copyTextureToBuffer({ texture: t }, { buffer: buf, bytesPerRow: bpr }, [w, h]); d.queue.submit([e.finish()]); await buf.mapAsync(GPUMapMode.READ);
    const a = new Uint8Array(buf.getMappedRange().slice(0)); const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); const im = x.createImageData(w, h);
    const bgra = window.__fmt.startsWith('bgra');
    for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) { const s = y * bpr + i * 4, o = (y * w + i) * 4; im.data[o] = a[s + (bgra ? 2 : 0)]; im.data[o + 1] = a[s + 1]; im.data[o + 2] = a[s + (bgra ? 0 : 2)]; im.data[o + 3] = 255; }
    x.putImageData(im, 0, 0); return c.toDataURL('image/png').split(',')[1];
  });
  return data; };
  const data = await snap();
  if (data) fs.writeFileSync(out, Buffer.from(data, 'base64')); else console.log('no frame');
  if (process.argv[7]) for (const st of JSON.parse(fs.readFileSync(process.argv[7], 'utf8'))) {
    const fN = await p.evaluate(() => window.__driftWebGPU.body.stats.frames);
    try { console.log('eval', JSON.stringify(await p.evaluate(st.eval))); } catch (e) { console.log('eval error', String(e).slice(0, 300)); }
    await p.waitForFunction((n) => window.__driftWebGPU.body.stats.frames >= n, fN + (+frames || 3), { timeout: 280000 }).catch(() => console.log('frames timeout'));
    const d2 = await snap(); if (d2) fs.writeFileSync(st.out, Buffer.from(d2, 'base64')); console.log('wrote', st.out);
  }
  console.log('babylon', JSON.stringify(await p.evaluate(() => ({ ready: window.__ready, info: window.__driftWebGPU && { v: window.__driftWebGPU.babylon, via: window.__driftWebGPU.via } }))).slice(0, 300), 'errors', errs.length);
  await b.close();
})();
