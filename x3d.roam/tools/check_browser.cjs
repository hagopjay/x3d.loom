// Browser gate for KANSEI ROAM: open the built page in headless Chromium, drive a free-roam session, open the telemetry (F2) and read
// the ride and rotor rows the sim fills in; fail on any page error. Serves OUTDIR itself.
//   node tools/check_browser.cjs OUTDIR
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(process.argv[2] || '.');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.x3d': 'model/x3d+xml', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.wasm': 'application/wasm' };
(async () => {
  const { chromium } = require('playwright');
  const server = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
  }).listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--no-sandbox', '--use-angle=swiftshader', '--use-webgpu-adapter=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
  const errors = [], logs = [];
  // headless SwiftShader cannot present a WebGPU swap chain: draw into an off-screen texture instead, and pace the frames slowly (the same harness the WebGPU ports were smoke-tested with)
  await page.addInitScript(() => { window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 500);
    const orig = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, o) { if (t !== 'webgpu') return orig.call(this, t, o); const canvas = this;
      return { _t: null, _d: null, _f: 'bgra8unorm', canvas, configure(c) { this._d = c.device; this._f = c.format; }, unconfigure() {}, getCurrentTexture() { const w = canvas.width, h = canvas.height; if (!this._t || this._t.width !== w || this._t.height !== h) this._t = this._d.createTexture({ size: [w, h], format: this._f, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.TEXTURE_BINDING }); return this._t; } }; }; });
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.text().slice(0, 160)); });
  await page.goto(`${base}index.html?start=free:salt-ring:ronin&quality=low&noanim=1`);
  await page.waitForTimeout(20000);
  await page.keyboard.press('F2');
  await page.keyboard.down('ArrowUp');
  const samples = [];
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(2500);
    samples.push(await page.evaluate(() => { const t = document.querySelector('#telemetry'); return t ? t.innerText.replace(/\s+/g, ' ').slice(0, 700) : null; }));
  }
  await page.keyboard.up('ArrowUp');
  await browser.close(); server.close();
  const withRide = samples.filter(s => s && /heave/.test(s));
  const out = { browser: 'chromium', pass: errors.length === 0 && withRide.length > 0, pageErrors: errors, consoleErrors: logs.slice(0, 5), rideRowsSeen: withRide.length, first: withRide[0] || samples[0], last: withRide[withRide.length - 1] || samples[samples.length - 1] };
  console.log(JSON.stringify(out, null, 1)); process.exit(out.pass ? 0 : 1);
})();
