// Render .x3d files in the x3d.webgpu Babylon bridge body (WebGPU on SwiftShader, offscreen-texture stub as in the bridge's own rig) to PNG.
// usage: BABYLON_JS=/path/babylon.js node render_babylon.js OUTDIR SCENE.x3d...   -> OUTDIR/babylon/NAME.png, OUTDIR/babylon-env.json
// Rig: 128x128 render target (CreateScreenshotUsingRenderTargetAsync), tone mapping 'none', the scene's own Viewpoint.
const fs = require('fs'), path = require('path'), http = require('http');
const BR = path.resolve(process.env.BABYLON_BRIDGE || path.join(__dirname, '..', '..', 'x3d.webgpu', 'bridge'));
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require(path.join(BR, 'node_modules', 'playwright')); } })();
const bundle = require(path.join(BR, 'tools', 'bundle.js'));
const BAB = process.env.BABYLON_JS; if (!BAB) throw new Error('set BABYLON_JS to babylon.js (npm pack babylonjs@9.32.0)');
const [out, ...scenes] = process.argv.slice(2), W = 128, H = 128;
const STUB = () => {
  window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 300);
  const o = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (t, op) { if (t !== 'webgpu') return o.call(this, t, op); const canvas = this;
    return { _t: null, _d: null, _f: 'bgra8unorm', canvas, configure(c) { this._d = c.device; this._f = c.format; }, unconfigure() {},
      getCurrentTexture() { const w = canvas.width, h = canvas.height; if (!this._t || this._t.width !== w || this._t.height !== h) { this._t = this._d.createTexture({ size: [w, h], format: this._f, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.TEXTURE_BINDING }); } return this._t; } }; };
};
const files = {
  '/bundle-body.js': bundle('body'), '/babylon.js': fs.readFileSync(BAB, 'utf8'),
  '/p.html': `<!doctype html><meta charset=utf-8><body style="margin:0;background:#000"><canvas id=c width=${W} height=${H} style="width:${W}px;height:${H}px;display:block"></canvas><script src="/babylon.js"></script><script src="/bundle-body.js"></script><script>
window.sceneReady = (async () => { const body = new Body(document.getElementById('c'), { onNote: (m) => (window.__notes = window.__notes || []).push(m) }); await body.init(); X3DSAI.setBody(body); window.__body = body; body.setTone('none'); })();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
window.load = async (xml) => { await window.sceneReady; const sc = await X3DSAI.B.createX3DFromString(xml); await X3DSAI.B.replaceWorld(sc); for (let i = 0; i < 6; i++) await X3DSAI.B.nextFrame(); await sleep(window.__settle || 400);
  const b = window.__body; return BABYLON.Tools.CreateScreenshotUsingRenderTargetAsync(b.engine, b.scene.activeCamera, { width: ${W}, height: ${H} }); };</script>`,
};
const srv = http.createServer((q, r) => { const u = q.url.split('?')[0]; if (files[u]) { r.writeHead(200, { 'content-type': u.endsWith('.js') ? 'text/javascript' : 'text/html' }); return r.end(files[u]); } const sf = path.join(path.dirname(path.resolve(scenes[0])), path.basename(u)); if (path.basename(u) && fs.existsSync(sf) && fs.statSync(sf).isFile()) { r.writeHead(200, { 'content-type': u.endsWith('.png') ? 'image/png' : 'application/octet-stream' }); return r.end(fs.readFileSync(sf)); } r.writeHead(404); r.end(); }).listen(0, '127.0.0.1');
(async () => {
  await new Promise((r) => srv.once('listening', r));
  const b = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-webgpu-adapter=swiftshader'] });
  const env = { chromium: b.version(), rig: { w: W, h: H, tone: 'none', backend: 'WebGPU on SwiftShader, offscreen stub' }, failures: {} };
  fs.mkdirSync(path.join(out, 'babylon'), { recursive: true });
  const pg = await b.newPage({ viewport: { width: W, height: H } }); await pg.addInitScript(STUB); const errs = []; pg.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await pg.addInitScript((v) => { window.__settle = v; }, +(process.env.SETTLE_MS || 400)); await pg.goto('http://127.0.0.1:' + srv.address().port + '/p.html'); env.babylon = await pg.evaluate(() => window.sceneReady.then(() => BABYLON.Engine.Version));
  for (const s of scenes) { const name = path.basename(s, '.x3d');
    try { await pg.evaluate(() => { window.__notes = []; }); const d = await pg.evaluate((x) => window.load(x), fs.readFileSync(s, 'utf8')); const nt = await pg.evaluate(() => (window.__notes || []).slice(0, 3)); if (nt.length) (env.notes = env.notes || {})[name] = nt; fs.writeFileSync(path.join(out, 'babylon', name + '.png'), Buffer.from(d.split(',')[1], 'base64')); }
    catch (e) { env.failures[name] = String(e).slice(0, 200); } }
  env.pageErrors = errs.slice(0, 5); fs.writeFileSync(path.join(out, 'babylon-env.json'), JSON.stringify(env, null, 1));
  await b.close(); srv.close(); console.log(JSON.stringify(env));
})().catch((e) => { console.error(e); process.exit(1); });
