// node shot-xite.js SITE_DIR OUT.png [hash] [waitMs]
// The reference: the page's own X_ITE build (vendor/x_ite in the Pages folder, 16.5.1), WebGL 2 on SwiftShader, same viewport as the WebGPU shot, lens off by the hash. Correctness only, no timings.
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
(async () => {
  const [, , site, out, hash = '', wait = '20000'] = process.argv;
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.x3d': 'model/x3d+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
  const srv = http.createServer((q, r) => { const f = path.join(site, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html')); if (!f.startsWith(site) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(0);
  const b = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 640, height: 360 }, acceptDownloads: true });
  p.on('pageerror', (e) => console.log('pageerror', e.message.slice(0, 400)));
  await p.goto(`http://localhost:${srv.address().port}/index.html${hash ? '#' + hash : ''}`);
  await p.waitForFunction(() => window.manifoldView && window.manifoldView().x3d, null, { timeout: 240000 }).catch(() => console.log('timeout waiting for the scene'));
  await p.waitForTimeout(+wait);   // let the hash settle (software GL needs about a minute a frame)
  // the page's own Save image button: it reads the canvas in the microtask right after a frame is drawn, which is the only reliable moment for a WebGL canvas
  const dl = p.waitForEvent('download', { timeout: 600000 });
  await p.evaluate(() => document.getElementById('snapshot').click());
  const d = await dl; await d.saveAs(out);
  console.log('view:', JSON.stringify(await p.evaluate(() => window.manifoldView ? { t: window.manifoldView().time, q: window.manifoldView().quality } : null)));
  fs.writeFileSync(out + '.json', JSON.stringify(await p.evaluate(() => { const v = window.manifoldView(); delete v.heightAt; v.vp = v.vp.map((x) => +x.toFixed(4)); return v; }), null, 1));
  await b.close(); srv.close();
})();
