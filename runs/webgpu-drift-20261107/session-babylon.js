// node session-babylon.js URL CMDDIR [W H]: keeps one Babylon KANSEI page open (same stubbed swap chain as shot-babylon.js) and serves commands from CMDDIR:
//   write CMDDIR/NNN.json = {"eval": "js", "out": "file.png" (optional still), "frames": 3}  ->  CMDDIR/NNN.res holds the eval result (JSON) when done. {"quit":true} ends it.
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
(async () => {
  const [, , url, dir, W, H] = process.argv; fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--no-sandbox', '--use-angle=swiftshader', '--use-webgpu-adapter=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: +W || 640, height: +H || 360 } });
  const log = (...a) => fs.appendFileSync(path.join(dir, 'console.log'), a.join(' ') + '\n');
  p.on('console', m => log(m.type(), m.text().slice(0, 400))); p.on('pageerror', e => log('pageerror', e.message.slice(0, 500)));
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
  await p.waitForFunction(() => window.__ready || (window.KANSEI && window.KANSEI.ready) || window.__driftWebGPUError, null, { timeout: 280000 });
  fs.writeFileSync(path.join(dir, 'READY'), 'ok');
  const snap = async () => p.evaluate(async () => {
    const t = window.__sc; if (!t) return null; const d = window.__ctx._d, w = t.width, h = t.height, bpr = Math.ceil(w * 4 / 256) * 256;
    const buf = d.createBuffer({ size: bpr * h, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }); const e = d.createCommandEncoder();
    e.copyTextureToBuffer({ texture: t }, { buffer: buf, bytesPerRow: bpr }, [w, h]); d.queue.submit([e.finish()]); await buf.mapAsync(GPUMapMode.READ);
    const a = new Uint8Array(buf.getMappedRange().slice(0)); const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); const im = x.createImageData(w, h);
    const bgra = window.__fmt.startsWith('bgra');
    for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) { const s = y * bpr + i * 4, o = (y * w + i) * 4; im.data[o] = a[s + (bgra ? 2 : 0)]; im.data[o + 1] = a[s + 1]; im.data[o + 2] = a[s + (bgra ? 0 : 2)]; im.data[o + 3] = 255; }
    x.putImageData(im, 0, 0); return c.toDataURL('image/png').split(',')[1];
  });
  const done = new Set();
  for (;;) {
    const files = fs.readdirSync(dir).filter(f => /^\d+\.json$/.test(f) && !done.has(f)).sort();
    for (const f of files) {
      done.add(f); const cmd = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      if (cmd.quit) { await b.close(); return; }
      let res;
      if (cmd.goto) { await p.goto(cmd.goto); await p.waitForFunction(() => window.__ready || (window.KANSEI && window.KANSEI.ready) || window.__driftWebGPUError, null, { timeout: 280000 }); res = await p.evaluate(() => window.__driftWebGPUError || 'ready'); }
      try { if (cmd.eval) res = await p.evaluate(cmd.eval); } catch (e) { res = { error: String(e).slice(0, 600) }; }
      if (cmd.out) {
        const n0 = await p.evaluate(() => window.__driftWebGPU.body.stats.frames);
        await p.waitForFunction((n) => window.__driftWebGPU.body.stats.frames >= n, n0 + (cmd.frames || 3), { timeout: 280000 }).catch(() => log('frames timeout'));
        const d = await snap(); if (d) fs.writeFileSync(cmd.out, Buffer.from(d, 'base64'));
      }
      fs.writeFileSync(path.join(dir, f.replace('.json', '.res')), JSON.stringify(res === undefined ? null : res));
    }
    await new Promise(r => setTimeout(r, 400));
  }
})();
