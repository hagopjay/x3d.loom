// node chirp-play.js URL: drives the Babylon Chirp page like a visitor (Watch, the look switch, Wide view, a drag, the other two inspirals) and reports page errors. Software adapter, correctness only.
const { chromium } = require('playwright');
(async () => {
  const url = process.argv[2];
  const b = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--no-sandbox', '--use-angle=swiftshader', '--use-webgpu-adapter=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
  const errs = []; p.on('console', m => { if (/error/i.test(m.type())) errs.push(m.text().slice(0, 200)); }); p.on('pageerror', e => errs.push('pageerror ' + e.message.slice(0, 200)));
  await p.addInitScript(() => {
    window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 400);
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (t, o) { if (t !== 'webgpu') return orig.call(this, t, o); const canvas = this;
      const ctx = { _t: null, _d: null, _f: 'bgra8unorm', canvas, configure(c) { this._d = c.device; this._f = c.format; }, unconfigure() {},
        getCurrentTexture() { const w = canvas.width, h = canvas.height; if (!this._t || this._t.width !== w || this._t.height !== h) this._t = this._d.createTexture({ size: [w, h], format: this._f, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.TEXTURE_BINDING }); return this._t; } };
      return ctx; };
  });
  await p.goto(url);
  await p.waitForFunction(() => window.chirpView && window.chirpView().case && !window.chirpView().loading, null, { timeout: 280000 });
  const out = {};
  out.start = await p.evaluate(() => ({ look: window.__chirpLook.on, check: window.chirpView().check, build: window.__chirpBuild, babylon: window.__chirpWebGPU.babylon }));
  await p.click('#watch'); await p.waitForTimeout(9000);
  if (process.env.DBG) console.log('dbg', JSON.stringify(await p.evaluate(process.env.DBG)));
  const v1 = await p.evaluate(() => window.chirpView()); await p.waitForTimeout(9000); const v2 = await p.evaluate(() => window.chirpView());
  out.watch = { mode: v1.mode, t1: v1.t_fraction, t2: v2.t_fraction, advancing: v2.t_fraction > v1.t_fraction };
  await p.click('#watch'); out.paused = (await p.evaluate(() => window.chirpView().mode)) === null;
  await p.click('#lookSwitch'); out.lookAfterClick = await p.evaluate(() => window.__chirpLook.on); await p.waitForTimeout(3000);
  await p.click('#lookSwitch'); out.lookBack = await p.evaluate(() => window.__chirpLook.on); await p.waitForTimeout(3000);
  await p.click('#views button[data-v="Wide"]'); await p.waitForTimeout(3000);
  const box = await p.locator('#stage').boundingBox(); out.poseBefore = await p.evaluate(() => window.__chirpWebGPU.body.pose.pos.slice()); await p.evaluate(() => { const cv = window.__chirpWebGPU.body.canvas; window.__ev = []; for (const t of ['pointerdown','pointermove','pointerup']) cv.addEventListener(t, (e) => window.__ev.push(t + ':' + e.buttons + ':' + window.__chirpWebGPU.body.pose.pos.map(x=>+x.toFixed(2)).join(',') + ':down=' + window.__chirpWebGPU.body.ptr.down + ':nav=' + window.__chirpWebGPU.body.noNav)); }); await p.mouse.move(box.x + 500, box.y + 300); await p.mouse.down(); await p.mouse.move(box.x + 600, box.y + 260, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(3000);
  if (process.env.DBG2) console.log('dbg2', JSON.stringify(await p.evaluate(process.env.DBG2)));
  out.hit = await p.evaluate((b) => { const e = document.elementFromPoint(b.x + 600, b.y + 260); return e ? e.tagName + '#' + e.id : null; }, box);
  out.pose = await p.evaluate(() => { const q = window.__chirpWebGPU.body.pose; return q && q.pos.map(x => +x.toFixed(2)); });
  out.ev = await p.evaluate(() => window.__ev.slice(0, 8));
  out.cam = await p.evaluate(() => window.__chirpWebGPU.body.scene.activeCamera.position.asArray().map(x => +x.toFixed(2)));
  out.cases = [];
  for (const id of ['q4', 'eccentric']) { await p.click(`#cases button[data-id="${id}"]`); await p.waitForFunction((id) => window.chirpView().case === id && !window.chirpView().loading, id, { timeout: 120000 }); out.cases.push([id, await p.evaluate(() => window.chirpView().check.status)]); }
  out.inPlace = await p.evaluate(() => window.__chirpWebGPU.body.stats.inPlace); out.errors = errs;
  console.log(JSON.stringify(out, null, 1)); await b.close();
})();
