// node shot-babylon.js SITE_DIR OUT.png [hash] [waitMs] [BABYLON_JS]
// Serves a built manifold WebGPU page from SITE_DIR over http, runs it in headless Chromium on SwiftShader (correctness only, no timings), and writes the frame as a PNG.
// The pinned CDN Babylon tag is answered from a local copy (BABYLON_JS) so the run needs no network. The canvas context is stubbed with an offscreen texture because headless Chromium
// here cannot present a WebGPU swap chain, and requestAnimationFrame is slowed (1.2 s) so frames do not pile up on the software adapter (playbook section 3).
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
(async () => {
  const [, , site, out, hash = '', wait = '20000', babylon = '/tmp/w/serve/babylon.js'] = process.argv;
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.x3d': 'model/x3d+xml', '.png': 'image/png' };
  const srv = http.createServer((q, r) => { const f = path.join(site, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html')); if (!f.startsWith(site) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(0);
  const port = srv.address().port;
  const b = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--no-sandbox', '--use-angle=swiftshader', '--use-webgpu-adapter=swiftshader', '--enable-unsafe-swiftshader'] });
  const [vw, vh] = (process.env.VIEW || '640x360').split('x').map(Number);
  const p = await b.newPage({ viewport: { width: vw, height: vh } });
  p.on('console', (m) => console.log('console', m.type(), m.text().slice(0, 700)));
  p.on('pageerror', (e) => console.log('pageerror', e.message.slice(0, 700)));
  await p.route(/cdn\.jsdelivr\.net\/npm\/babylonjs@/, (r) => r.fulfill({ path: babylon, contentType: 'text/javascript' }));
  await p.addInitScript(() => {
    // surface WebGPU validation errors in the log (Babylon does not print every one)
    const rd = GPUAdapter.prototype.requestDevice;
    GPUAdapter.prototype.requestDevice = async function (d) { const dev = await rd.call(this, d); dev.addEventListener('uncapturederror', (e) => console.log('GPUERR', String(e.error && e.error.message).slice(0, 800))); return dev; };
    window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 1200);
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (t, o) {
      if (t !== 'webgpu') return orig.call(this, t, o);
      const canvas = this;
      const ctx = { _t: null, _d: null, _f: 'bgra8unorm', canvas,
        configure(c) { this._d = c.device; this._f = c.format; window.__fmt = c.format; }, unconfigure() {},
        getCurrentTexture() { const w = canvas.width, h = canvas.height; if (!this._t || this._t.width !== w || this._t.height !== h) { this._t = this._d.createTexture({ size: [w, h], format: this._f, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.TEXTURE_BINDING }); window.__sc = this._t; } return this._t; } };
      window.__ctx = ctx; return ctx;
    };
  });
  await p.goto(`http://localhost:${port}/index.html${hash ? '#' + hash : ''}`);
  await p.waitForFunction(() => window.__manifoldWebGPUError || (window.manifoldView && window.manifoldView().x3d), null, { timeout: 240000 }).catch(() => console.log('timeout waiting for the scene'));
  console.log('error:', await p.evaluate(() => window.__manifoldWebGPUError || null));
  if (process.env.EVAL) console.log('eval:', JSON.stringify(await p.evaluate(process.env.EVAL)));
  await p.waitForTimeout(+wait);
  if (process.env.EVAL2) console.log('eval2:', JSON.stringify(await p.evaluate(process.env.EVAL2)));
  if (process.env.DOMSHOT) await p.screenshot({ path: process.env.DOMSHOT });   // the page's own HUD (the WebGPU canvas is a stub here, so it shows black behind it)
  const data = await p.evaluate(async () => {
    const t = window.__sc; if (!t) return null; const d = window.__ctx._d, w = t.width, h = t.height, bpr = Math.ceil(w * 4 / 256) * 256;
    const buf = d.createBuffer({ size: bpr * h, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    const e = d.createCommandEncoder(); e.copyTextureToBuffer({ texture: t }, { buffer: buf, bytesPerRow: bpr }, [w, h]); d.queue.submit([e.finish()]);
    await buf.mapAsync(GPUMapMode.READ); const a = new Uint8Array(buf.getMappedRange().slice(0));
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'), im = x.createImageData(w, h), bgra = window.__fmt.startsWith('bgra');
    for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) { const s = y * bpr + i * 4, o = (y * w + i) * 4; im.data[o] = a[s + (bgra ? 2 : 0)]; im.data[o + 1] = a[s + 1]; im.data[o + 2] = a[s + (bgra ? 0 : 2)]; im.data[o + 3] = 255; }
    x.putImageData(im, 0, 0); return c.toDataURL('image/png').split(',')[1];
  });
  console.log('view:', JSON.stringify(await p.evaluate(() => window.manifoldView ? { t: window.manifoldView().time, quality: window.manifoldView().quality, x3d: window.manifoldView().x3d } : null)));
  fs.writeFileSync(out + '.json', JSON.stringify(await p.evaluate(() => { const v = window.manifoldView(); delete v.heightAt; v.vp = v.vp.map((x) => +x.toFixed(4)); return v; }), null, 1));
  if (data) fs.writeFileSync(out, Buffer.from(data, 'base64')); else console.log('no frame');
  await b.close(); srv.close();
})();
