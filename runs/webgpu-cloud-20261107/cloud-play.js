// node cloud-play.js URL: drives the Babylon Electron Cloud page like a visitor (Lyman playback, the look switch, the cut slider, the share buttons, a drag, other states) and reports page errors. Software adapter, correctness only.
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
  await p.goto(url + '#lyman');
  const ready = (id) => p.waitForFunction((id) => window.cloudView && window.cloudView().case === id && !window.cloudView().loading && window.cloudView().meshed === window.cloudView().frames, id, { timeout: 280000 });
  await ready('lyman');
  const out = {};
  out.start = await p.evaluate(() => ({ look: window.__cloudLook.on, check: window.cloudView().check, build: window.__cloudBuild, babylon: window.__cloudWebGPU.babylon }));
  await p.click('#play'); if (process.env.POLL) { const seq = []; for (let i = 0; i < 12; i++) { await p.waitForTimeout(700); seq.push(await p.evaluate(() => { const b = window.__cloudWebGPU.body; const sq = b.world.nodes.find(n => n.type === 'IntegerSequencer'), ts = b.world.nodes.find(n => n.type === 'TimeSensor'); return [window.cloudView().frame, sq.f.value_changed, +ts.f.fraction_changed.toFixed(2), ts.f.enabled, ts.f.isActive]; })); } console.log('poll', JSON.stringify(seq)); }
  await p.waitForTimeout(8000);
  const v1 = await p.evaluate(() => window.cloudView()); await p.waitForTimeout(8000); const v2 = await p.evaluate(() => window.cloudView());
  out.play = { playing: v1.playing, f1: v1.frame, f2: v2.frame, advancing: v1.frame !== v2.frame };
  await p.click('#play'); out.paused = !(await p.evaluate(() => window.cloudView().playing));
  await p.click('#lookSwitch'); out.lookAfterClick = await p.evaluate(() => window.__cloudLook.on); await p.waitForTimeout(3000);
  await p.click('#lookSwitch'); out.lookBack = await p.evaluate(() => window.__cloudLook.on); await p.waitForTimeout(2000);
  await p.evaluate(() => { const c = document.getElementById('cut'); c.value = 0.4; c.dispatchEvent(new Event('input')); }); await p.waitForTimeout(2500);
  out.cut = await p.evaluate(() => window.cloudView().cut);
  const box = await p.locator('#stage').boundingBox(); const before = await p.evaluate(() => window.__cloudWebGPU.body.pose.pos.slice());
  await p.mouse.move(box.x + 500, box.y + 300); await p.mouse.down(); await p.mouse.move(box.x + 600, box.y + 260, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(2500);
  out.orbit = { before: before.map(x => +x.toFixed(2)), after: (await p.evaluate(() => window.__cloudWebGPU.body.pose.pos.slice())).map(x => +x.toFixed(2)) };
  out.states = [];
  for (const id of ['1s', '5gz4', '3dz2']) { await p.evaluate((id) => { location.hash = '#' + id; }, id); await ready(id); out.states.push([id, await p.evaluate(() => window.cloudView().check.status)]); }
  out.errors = errs;
  console.log(JSON.stringify(out)); await b.close();
})();
