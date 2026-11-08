// node hl-shot.js babylon|xite BASEURL OUTPREFIX "View@t,View@t,..." [settle ms]
// The Hall at fixed viewpoints and film times (paused). babylon: headless, WebGPU on SwiftShader with the swap chain stubbed to an offscreen texture (correctness only, no timings);
// xite: full Chromium, WebGL 2 on SwiftShader. Env: QS = extra query string, W/H = size (default 960x540).
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [, , eng, base, prefix, shots, settle] = process.argv, bab = eng === 'babylon';
  const W = +(process.env.W || 960), H = +(process.env.H || 540);
  const b = await chromium.launch(bab ? { args: ['--enable-unsafe-webgpu', '--no-sandbox', '--use-angle=swiftshader', '--use-webgpu-adapter=swiftshader'] }
    : { executablePath: process.env.CHROME || undefined, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: W, height: H } });
  p.on('console', (m) => { const t = m.text(); if (m.type() === 'error' || /BJS|WGSL|fallback|x3d to babylon/i.test(t)) console.log('console', m.type(), t.slice(0, 300)); });
  p.on('pageerror', (e) => console.log('pageerror', e.message.slice(0, 400)));
  if (bab) {
    await p.addInitScript(() => {
      window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), +(window.__raf || 500));
      const o = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (t, op) { if (t !== 'webgpu') return o.call(this, t, op); const canvas = this;
        const ctx = { _t: null, _d: null, _f: 'bgra8unorm', canvas, configure(c) { this._d = c.device; this._f = c.format; window.__fmt = c.format; }, unconfigure() {},
          getCurrentTexture() { const w = canvas.width, h = canvas.height; if (!this._t || this._t.width !== w || this._t.height !== h) { this._t = this._d.createTexture({ size: [w, h], format: this._f, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.TEXTURE_BINDING }); window.__sc = this._t; } return this._t; } };
        window.__ctx = ctx; return ctx; };
    });
  }
  await p.goto(base + '/index.html?engine=' + (bab ? 'babylon' : 'xite') + '&timing=0' + (process.env.QS || ''));
  await p.waitForFunction(() => (window.__hall && window.__hall.ready) || window.__hallError, null, { timeout: 600000 });
  const err = await p.evaluate(() => window.__hallError); if (err) { console.log('hall error', err); await b.close(); process.exit(1); }
  console.log('ready', JSON.stringify(await p.evaluate(() => ({ engine: window.__hall.engine, notes: window.__hall.notes }))).slice(0, 600));
  if (!bab) await p.addStyleTag({ content: 'body > *:not(#stage){display:none!important}' });   // the page chrome is not part of the comparison
  await p.evaluate(() => window.__hall.pause());
  for (const spec of shots.split(',')) {
    const [def, ts] = spec.split('@'), t = +ts || 0;
    await p.evaluate(async ([d, tt]) => { await window.__hall.seek(tt); window.__hall.setView(d); }, [def, t]);
    await p.waitForTimeout(+settle || 4000);
    const file = prefix + '_' + def + '_' + t + '.png';
    if (bab) {
      const data = await p.evaluate(async () => { const t = window.__sc; if (!t) return null; const d = window.__ctx._d, w = t.width, h = t.height, bpr = Math.ceil(w * 4 / 256) * 256; const buf = d.createBuffer({ size: bpr * h, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }); const e = d.createCommandEncoder(); e.copyTextureToBuffer({ texture: t }, { buffer: buf, bytesPerRow: bpr }, [w, h]); d.queue.submit([e.finish()]); await buf.mapAsync(GPUMapMode.READ); const a = new Uint8Array(buf.getMappedRange().slice(0)); const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'), im = x.createImageData(w, h), bgra = window.__fmt.startsWith('bgra'); for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) { const s = y * bpr + i * 4, o = (y * w + i) * 4; im.data[o] = a[s + (bgra ? 2 : 0)]; im.data[o + 1] = a[s + 1]; im.data[o + 2] = a[s + (bgra ? 0 : 2)]; im.data[o + 3] = 255; } x.putImageData(im, 0, 0); return c.toDataURL('image/png').split(',')[1]; });
      if (data) fs.writeFileSync(file, Buffer.from(data, 'base64')); else console.log('no frame for', spec);
    } else await p.screenshot({ path: file, timeout: 600000 });
    console.log('shot', spec, JSON.stringify(await p.evaluate(() => { try { const f = window.__hall.film(); return { frac: +f.fraction_changed, notes: window.__hall.notes.length }; } catch (e) { return String(e); } })));
  }
  await b.close();
})();
