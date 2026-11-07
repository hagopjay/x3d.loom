// node port-test.js [only=name,name] [files=wgsl-sky,...] [png=out.png] : compile-and-draw check of Gobbler WGSL ports (see port-test.html). Needs the scratch server on :8124 and playwright.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => a.split('=')));
  const qs = new URLSearchParams({ stub: 1, ...args }).toString();
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--enable-unsafe-webgpu', '--no-sandbox', '--use-angle=swiftshader', '--use-webgpu-adapter=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 640, height: 360 } });
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('console', m.type(), m.text().slice(0, 1200)); });
  p.on('pageerror', (e) => console.log('pageerror', e.message.slice(0, 600)));
  await p.goto('http://localhost:8124/gob/port-test.html?' + qs);
  await p.waitForFunction(() => window.__done, null, { timeout: 120000 }).catch(() => console.log('timeout'));
  console.log(JSON.stringify(await p.evaluate(() => ({ err: window.__err, result: window.__result })), null, 1));
  if (args.png) {
    const data = await p.evaluate(async () => { const t = window.__sc; if (!t) return null; const d = window.__ctx._d, w = t.width, h = t.height, bpr = Math.ceil(w * 4 / 256) * 256; const buf = d.createBuffer({ size: bpr * h, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }); const e = d.createCommandEncoder(); e.copyTextureToBuffer({ texture: t }, { buffer: buf, bytesPerRow: bpr }, [w, h]); d.queue.submit([e.finish()]); await buf.mapAsync(GPUMapMode.READ); const a = new Uint8Array(buf.getMappedRange().slice(0)); const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'), im = x.createImageData(w, h), bgra = window.__fmt.startsWith('bgra'); for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) { const s = y * bpr + i * 4, o = (y * w + i) * 4; im.data[o] = a[s + (bgra ? 2 : 0)]; im.data[o + 1] = a[s + 1]; im.data[o + 2] = a[s + (bgra ? 0 : 2)]; im.data[o + 3] = 255; } x.putImageData(im, 0, 0); return c.toDataURL('image/png').split(',')[1]; });
    if (data) fs.writeFileSync(args.png, Buffer.from(data, 'base64'));
  }
  await b.close();
})();
