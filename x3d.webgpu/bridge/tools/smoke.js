// node smoke.js FIXTURE.x3d [--babylon babylon.js] -> JSON: the fixture loaded into the real Babylon WebGPU body (SwiftShader), a few seconds of frames, page errors, pixel stats.
// Proves the kit and the bridge nodes live inside the full bundle (reader + wgsl + body + SAI), not only in the headless reader.
const fs = require('fs'), path = require('path'), http = require('http'), crypto = require('crypto');
const { chromium } = require('playwright');
const BR = path.resolve(__dirname, '..'), SRC = path.resolve(BR, '..', 'demo', 'src');
const args = process.argv.slice(2); const bi = args.indexOf('--babylon'); const babylon = bi >= 0 ? args.splice(bi, 2)[1] : (process.env.BABYLON_JS || '/tmp/bb/t/package/babylon.js');
const fixture = args[0], secs = +(args[1] || 3);
const rd = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');
const READER = ['shared/adapter.js', 'brain/reader.js', 'gobbler/reader-ext.js', 'demiurge/reader-ext-dm.js', 'dynasty/reader-ext-dl.js', 'hall/reader-ext-hl.js'].filter((p) => fs.existsSync(path.join(SRC, p)));
const nodes = fs.readdirSync(path.join(BR, 'src', 'nodes')).filter((f) => f.endsWith('.js')).sort().map((f) => fs.readFileSync(path.join(BR, 'src', 'nodes', f), 'utf8'));
const bodyBr = fs.existsSync(path.join(BR, 'src', 'body-br.js')) ? [fs.readFileSync(path.join(BR, 'src', 'body-br.js'), 'utf8')] : [];
const parts = [...READER.map(rd), fs.readFileSync(path.join(BR, 'src', 'kit.js'), 'utf8'), ...nodes, rd('brain/wgsl.js'), rd('brain/body.js'), rd('brain/body-cam.js'), ...bodyBr, rd('brain/sai.js'),
  'window.__R = R; window.Body = Body; window.__events = events;'];
const bundle = '(function () {\n"use strict";\n' + parts.join('\n') + '\n})();\n';
const html = `<!doctype html><meta charset=utf-8><body style="margin:0"><canvas id=c width=320 height=240 style="width:320px;height:240px"></canvas><script src="/babylon.js"></script><script src="/bundle.js"></script>`;
(async () => {
  const files = { '/bundle.js': bundle, '/babylon.js': fs.readFileSync(babylon, 'utf8'), '/index.html': html };
  const s = http.createServer((q, r) => { const u = q.url.split('?')[0]; if (files[u] === undefined) { r.statusCode = 404; return r.end(); } r.setHeader('content-type', u.endsWith('.js') ? 'text/javascript' : 'text/html'); r.end(files[u]); });
  await new Promise((r) => s.listen(0, r));
  const b = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-webgpu-adapter=swiftshader'] });
  const p = await b.newPage(), errs = [], notes = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 200))); p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); });
  await p.addInitScript(() => {   // as the earlier port harnesses do (runs/webgpu-dynasty-20261108/dl-play.js): headless draws into an offscreen texture, frames paced at 600 ms
    window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 300);
    const o = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (t, op) { if (t !== 'webgpu') return o.call(this, t, op); const canvas = this;
      const ctx = { _t: null, _d: null, _f: 'bgra8unorm', canvas, configure(c) { this._d = c.device; this._f = c.format; }, unconfigure() {},
        getCurrentTexture() { const w = canvas.width, h = canvas.height; if (!this._t || this._t.width !== w || this._t.height !== h) { this._t = this._d.createTexture({ size: [w, h], format: this._f, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.TEXTURE_BINDING }); } return this._t; } };
      window.__ctx = ctx; return ctx; };
  });
  await p.goto('http://localhost:' + s.address().port + '/index.html');
  const xml = fs.readFileSync(fixture, 'utf8');
  const res = await p.evaluate(async ([xml, secs]) => {
    const body = new Body(document.getElementById('c'), { onNote: (m) => (window.__notes = window.__notes || []).push(m) });
    await body.init(); X3DSAI.setBody(body);
    const sc = await X3DSAI.B.createX3DFromString(xml); await X3DSAI.B.replaceWorld(sc);
    const t0 = performance.now(); const seen = {}; 
    for (const n of sc._world.nodes) if (n.def) for (const f of Object.keys(__R.fdefsOf(n))) { const k = n.def + '.' + f; if (__R.fdefsOf(n)[f][1] === 'out' || __R.fdefsOf(n)[f][1] === 'io') { (n.cbs ||= {})[f] = (n.cbs[f] || new Map()); n.cbs[f].set('smoke', () => { seen[k] = (seen[k] || 0) + 1; }); } }
    await new Promise((r) => setTimeout(r, secs * 1000));
    const cv = document.getElementById('c'); const frames = body.stats.frames;
    return { frames, adapter: body.adapterInfo, babylon: BABYLON.Engine.Version, notes: window.__notes || [], warnings: sc._world.warnings, events: seen, switches: sc._world.nodes.filter((n) => n.type === 'Switch').map((n) => n.f.whichChoice) };
  }, [xml, secs]);
  await p.screenshot({ path: process.env.SMOKE_PNG || '/tmp/bb/smoke.png', clip: { x: 0, y: 0, width: 320, height: 240 } });
  res.pageErrors = errs.slice(0, 6); res.bundle = crypto.createHash('sha256').update(bundle).digest('hex').slice(0, 12);
  console.log(JSON.stringify(res)); await b.close(); s.close();
})();
