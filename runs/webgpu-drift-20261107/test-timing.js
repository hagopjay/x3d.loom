// node test-timing.js: drives drift-timing.js with a stub DOM and synthetic rAF timestamps, then checks the statistics and the on-screen warnings.
// 1) 60 Hz with 3 slow frames, real-GPU adapter; 2) the same on a SwiftShader adapter (must warn); 3) a hidden tab (must flag invalid); 4) cancel; 5) ?timing=0 (no button)
const fs = require('fs'), path = require('path'), assert = require('assert');
const SRC = fs.readFileSync(path.join(__dirname, '../../x3d.webgpu/demo/src/drift/drift-timing.js'), 'utf8');
function run({ adapter, hidden = false, search = '?tsec=10&twarm=2', dts, cancelAt = null, noBattery = false }) {
  const els = []; const mk = (tag) => { const e = { tag, style: {}, children: [], textContent: '', value: '', listeners: {}, append(...c) { this.children.push(...c); }, appendChild(c) { this.children.push(c); return c; }, replaceChildren() { this.children = []; }, addEventListener(t, f) { this.listeners[t] = f; }, focus() {}, select() {} }; els.push(e); return e; };
  const document = { readyState: 'complete', hidden, body: mk('body'), createElement: mk, addEventListener(t, f) { document._l[t] = f; }, removeEventListener() {}, _l: {} };
  // synthetic clock: each rAF callback gets the next timestamp
  let now = 1000, i = 0, pending = null;
  const window = { location: { search }, devicePixelRatio: 2, __adapter: adapter, __adapterVia: 'default', __driftBuild: 'testbuild', KANSEI: { state: () => ({ screen: 'play', track: 'kessel-pass', car: 'ronin', camera: 'chase', sel: { quality: 'medium' } }) }, __driftWebGPU: { babylon: '9.32.0', adapter: {}, body: { engine: { getRenderingCanvas: () => ({ width: 1280, height: 720 }), getHardwareScalingLevel: () => 1 } } } };
  const navigator = { userAgent: 'Mozilla/5.0 (test) Chrome/156.0.0.0', platform: 'Win32', hardwareConcurrency: 4, deviceMemory: 8, getBattery: noBattery ? undefined : async () => ({ charging: true, level: 0.83 }), clipboard: { writeText: async () => {} } };
  const rafs = (cb) => { pending = cb; return 1; };
  const fn = new Function('window', 'document', 'navigator', 'URLSearchParams', 'requestAnimationFrame', 'cancelAnimationFrame', 'location', 'setTimeout', SRC);
  fn(window, document, navigator, URLSearchParams, rafs, () => { pending = null; }, window.location, setTimeout);
  return { els, window, document, pump: async () => { await new Promise((r) => setImmediate(r)); let n = 0; while (pending && i < dts.length) { const cb = pending; pending = null; now += dts[i++]; if (cancelAt === i) { return 'stop'; } cb(now); n++; await new Promise((r) => setImmediate(r)); } return n; }, btn: els.find((e) => e.id === 'x3d-timing-btn'), panel: els.find((e) => e.id === 'x3d-timing-panel') };
}
const text = (e) => [e.textContent, ...e.children.map(text)].join('\n');
(async () => {
  // 60 Hz for 12 s (720 frames of 16.7 ms), plus 3 slow frames of 60 ms in the measured window
  const dts = Array(720).fill(16.7); dts[300] = 60; dts[400] = 60; dts[500] = 60;
  const real = { info: { vendor: 'intel', architecture: 'gen-9', device: '', description: 'Intel(R) UHD Graphics 620' }, features: new Set(['timestamp-query']) };
  let t = run({ adapter: real, dts }); t.btn.onclick({ stopPropagation() {} });
  await new Promise((r) => setTimeout(r, 20)); await t.pump();
  let r = t.window.__driftTimingResult; assert(r, 'no result');
  console.log('test 1', JSON.stringify({ frames: r.frames, ms: r.ms, fps: r.fps_mean, low: r.one_percent_low_fps, o33: r.frames_over_33ms, soft: r.machine.gpu_is_software, gpu: r.machine.gpu, batt: r.machine.battery, build: r.build, ts: r.machine.gpu.timestamp_query }));
  assert.strictEqual(r.ms.p50, 16.7); assert.strictEqual(r.frames_over_33ms, 3); assert.strictEqual(r.machine.gpu_is_software, false);
  assert(r.ms.p99 <= 60 && r.ms.max === 60, 'max'); assert.strictEqual(r.window_s, 10); assert(r.frames > 590 && r.frames < 610, 'frame count ' + r.frames);
  assert(!/do not count/.test(text(t.panel)), 'false software warning'); assert.strictEqual(r.machine.battery.level, 0.8); assert.strictEqual(r.page.track, 'kessel-pass');
  // nearest-rank p95 of 600 samples with 3 slow ones = 16.7
  assert.strictEqual(r.ms.p95, 16.7);
  // 2) software adapter
  const sw = { info: { vendor: 'google', architecture: 'swiftshader', device: 'SwiftShader Device (Subzero)', description: '' }, features: new Set() };
  t = run({ adapter: sw, dts }); t.btn.onclick({ stopPropagation() {} }); await new Promise((r) => setTimeout(r, 20)); await t.pump();
  r = t.window.__driftTimingResult; assert.strictEqual(r.machine.gpu_is_software, true); assert(/do not count/.test(text(t.panel)), 'software warning missing'); console.log('test 2 software adapter flagged');
  // 3) hidden tab
  t = run({ adapter: real, dts, hidden: true }); t.btn.onclick({ stopPropagation() {} }); await new Promise((r) => setTimeout(r, 20)); await t.pump();
  r = t.window.__driftTimingResult; assert.strictEqual(r.tab_hidden_during_run, true); assert(/not valid/.test(text(t.panel))); console.log('test 3 hidden tab flagged');
  // 4) too few frames (slow page): 1.2 s frames
  t = run({ adapter: real, dts: Array(60).fill(1200), search: '?tsec=10&twarm=2' }); t.btn.onclick({ stopPropagation() {} }); await new Promise((r) => setTimeout(r, 20)); await t.pump();
  r = t.window.__driftTimingResult; assert(r.frames < 30 && /too few/.test(text(t.panel))); console.log('test 4 slow page flagged, frames', r.frames, 'p50', r.ms.p50);
  // 5) no battery API, ?timing=0 hides
  t = run({ adapter: real, dts, noBattery: true }); t.btn.onclick({ stopPropagation() {} }); await new Promise((r) => setTimeout(r, 20)); await t.pump(); assert.strictEqual(t.window.__driftTimingResult.machine.battery, null);
  t = run({ adapter: real, dts, search: '?timing=0' }); assert(!t.btn, 'button should not exist with timing=0'); console.log('test 5 ok');
  console.log('ALL OK');
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
