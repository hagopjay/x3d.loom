// node odyssey-shot.js babylon|xite|three BASE_URL OUT_PREFIX [W H] [times, comma separated e.g. 10.2,33,62] [quality]
// One still per film time of the Material Odyssey page, picture only (page chrome, cards and fades hidden). Software adapters (SwiftShader), correctness only, no timings.
// babylon: the WebGPU swap chain is stubbed with an offscreen texture and read back (headless cannot present one); requestAnimationFrame is slowed to 1.2 s.
// xite / three: the page's own engine buttons (?engine=x3d, ?engine=webgpu), stage screenshot cropped to the 2.39:1 picture rectangle.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [, , mode, base, prefix, W, H, times, quality] = process.argv; const ts = (times || '33').split(',').map(Number);
  const bab = mode === 'babylon';
  const eng = { babylon: 'babylon', xite: 'x3d', three: 'webgpu' }[mode];
  const q = quality || 'low';
  const b = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--no-sandbox', '--use-angle=swiftshader', '--use-webgpu-adapter=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: +W || 1280, height: +H || 536 } });
  const logs = [];
  p.on('console', m => { const t = m.text(); if (/error|warn/i.test(m.type())) { logs.push(m.type() + ' ' + t.slice(0, 300)); console.log('console', m.type(), t.slice(0, 300)); } else if (/x3d to babylon|x3d reader|dbg/.test(t)) console.log('note', t.slice(0, 200)); });
  p.on('pageerror', e => console.log('pageerror', e.message.slice(0, 400)));
  if (bab) await p.addInitScript(() => {
    window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), +(window.__rafMs || 1200));
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
  const look = process.env.LOOK; // 0 or 1
  const url = `${base}/index.html?engine=${eng}&quality=${q}` + (look != null ? `&look=${look}` : '') + (process.env.QS || '');
  await p.goto(url);
  await p.addStyleTag({ content: '#ctl,#topline,#card,#caption,#shade,#status,#progress,#hud,#toast,#poster{display:none!important}' });
  const t0 = Date.now();
  await p.evaluate(() => window.__odyssey.begin());
  await p.waitForFunction(() => window.__odyssey && window.__odyssey.S.adapter && !window.__odyssey.S.busy, null, { timeout: 900000 }).catch(() => console.log('not ready'));
  console.log('ready after', ((Date.now() - t0) / 1000).toFixed(1), 's', JSON.stringify(await p.evaluate(() => { const a = window.__odyssey.S.adapter; return a ? { kind: a.kind, d: (a.describe && a.describe()) } : null; })).slice(0, 900));
  if (process.env.EVAL) console.log('eval', JSON.stringify(await p.evaluate(process.env.EVAL)).slice(0, 2500));
  for (const t of ts) {
    await p.evaluate((t) => window.__odyssey.still(t, +(window.__nStill || 4)), t);
    const name = String(t.toFixed(1)).padStart(5, '0');
    if (bab) {
      const n0 = await p.evaluate(() => window.__odyssey.adapter ? 0 : 0);
      fs.writeFileSync(`${prefix}-${name}.png`, Buffer.from(await p.evaluate(() => window.__snap()), 'base64'));
    } else {
      await p.waitForTimeout(mode === 'xite' ? 2500 : 4000);
      const bb = await p.evaluate(() => { const c = document.querySelector('#stage canvas, #stage x3d-canvas'); const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
      await p.screenshot({ path: `${prefix}-${name}.png`, clip: bb });
    }
    console.log('shot', t, Date.now() - t0);
  }
  fs.writeFileSync(`${prefix}-console.txt`, logs.join('\n'));
  await b.close();
})();
