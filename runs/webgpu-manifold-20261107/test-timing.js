// node test-timing.js: drives manifold-timing.js with a stub DOM and synthetic rAF timestamps, then checks the statistics and the on-screen warnings (same cases as the KANSEI test, plus the GPU-time path).
// 1) 60 Hz with 3 slow frames, real-GPU adapter, GPU timestamps; 2) SwiftShader adapter (must warn); 3) hidden tab (must flag invalid); 4) too few frames; 5) no battery API, ?timing=0 (no button); 6) no timestamp-query (gpu_frame_ms null)
const fs = require('fs'), path = require('path'), assert = require('assert');
const SRC = fs.readFileSync(path.join(__dirname, '../../x3d.webgpu/demo/src/manifold/manifold-timing.js'), 'utf8');
function run({ adapter, hidden = false, search = '?tsec=10&twarm=2', dts, noBattery = false, gpu = true }) {
  const els = []; const mk = (tag) => { const e = { tag, style: {}, children: [], textContent: '', value: '', listeners: {}, append(...c) { this.children.push(...c); }, appendChild(c) { this.children.push(c); return c; }, replaceChildren() { this.children = []; }, addEventListener(t, f) { this.listeners[t] = f; }, focus() {}, select() {} }; els.push(e); return e; };
  const dom = { quality: { value: 'balanced' }, qualityLabel: { textContent: 'Balanced · 1×' }, lensToggle: { checked: true }, grain: { checked: true }, traces: { checked: true }, filaments: { checked: true }, veil: { checked: true } };
  const document = { readyState: 'complete', hidden, body: mk('body'), createElement: mk, getElementById: (id) => dom[id] || null, querySelector: () => ({ getAttribute: () => '0', textContent: ' Reverie' }), addEventListener(t, f) { document._l[t] = f; }, removeEventListener() {}, _l: {} };
  let now = 1000, i = 0, pending = null; const afterRender = new Set();
  const inst = { gpuFrameTimeCounter: { current: 0 }, dispose() {} };
  const BABYLON = { EngineInstrumentation: function () { return inst; } };
  const body = { engine: { getRenderingCanvas: () => ({ width: 1280, height: 720 }), getHardwareScalingLevel: () => 1 }, scene: { onAfterRenderObservable: { add: (f) => { afterRender.add(f); return f; }, remove: (f) => afterRender.delete(f) } }, mf: { look: { glow: 0.65 } } };
  const window = { location: { search }, devicePixelRatio: 2, __adapter: adapter, __adapterVia: '{}', __manifoldBuild: 'testbuild', BABYLON: gpu ? BABYLON : undefined, __manifoldWebGPU: { babylon: '9.32.0', adapter: {}, body } };
  const navigator = { userAgent: 'Mozilla/5.0 (test) Chrome/156.0.0.0', platform: 'Win32', hardwareConcurrency: 4, deviceMemory: 8, getBattery: noBattery ? undefined : async () => ({ charging: true, level: 0.83 }), clipboard: { writeText: async () => {} } };
  const rafs = (cb) => { pending = cb; return 1; };
  const fn = new Function('window', 'document', 'navigator', 'URLSearchParams', 'requestAnimationFrame', 'cancelAnimationFrame', 'location', 'setTimeout', 'performance', 'BABYLON', SRC);
  const perf = { now: () => now };
  fn(window, document, navigator, URLSearchParams, rafs, () => { pending = null; }, window.location, setTimeout, perf, window.BABYLON);
  return { els, window, document, pump: async () => { await new Promise((r) => setImmediate(r)); let n = 0; while (pending && i < dts.length) { const cb = pending; pending = null; now += dts[i++]; inst.gpuFrameTimeCounter.current = 4.2e6; for (const f of afterRender) f(); cb(now); n++; await new Promise((r) => setImmediate(r)); } return n; }, btn: els.find((e) => e.id === 'x3d-timing-btn'), panel: els.find((e) => e.id === 'x3d-timing-panel') };
}
const text = (e) => [e.textContent, ...e.children.map(text)].join('\n');
(async () => {
  const dts = Array(720).fill(16.7); dts[300] = 60; dts[400] = 60; dts[500] = 60;
  const real = { info: { vendor: 'intel', architecture: 'gen-9', device: '', description: 'Intel(R) UHD Graphics 620' }, features: new Set(['timestamp-query']) };
  let t = run({ adapter: real, dts }); t.btn.onclick({ stopPropagation() {} });
  await new Promise((r) => setTimeout(r, 20)); await t.pump();
  let r = t.window.__manifoldTimingResult; assert(r, 'no result');
  console.log('test 1', JSON.stringify({ schema: r.schema, frames: r.frames, ms: r.ms, fps: r.fps_mean, low: r.one_percent_low_fps, o33: r.frames_over_33ms, soft: r.machine.gpu_is_software, gpuMs: r.gpu_frame_ms, mood: r.page.mood, build: r.build }));
  assert.strictEqual(r.schema, 'x3d.manifold.timing/1'); assert.strictEqual(r.ms.p50, 16.7); assert.strictEqual(r.frames_over_33ms, 3); assert.strictEqual(r.machine.gpu_is_software, false);
  assert(r.ms.p99 <= 60 && r.ms.max === 60, 'max'); assert.strictEqual(r.window_s, 10); assert(r.frames > 590 && r.frames < 610, 'frame count ' + r.frames);
  assert(!/do not count/.test(text(t.panel)), 'false software warning'); assert.strictEqual(r.machine.battery.level, 0.8); assert.strictEqual(r.page.mood, '0 Reverie'); assert.strictEqual(r.page.settings_changed_during_run, false);
  assert.strictEqual(r.ms.p95, 16.7); assert(r.gpu_frame_ms && r.gpu_frame_ms.p50 === 4.2 && r.gpu_frame_ms.samples > 590, 'gpu frame time');
  const sw = { info: { vendor: 'google', architecture: 'swiftshader', device: 'SwiftShader Device (Subzero)', description: '' }, features: new Set() };
  t = run({ adapter: sw, dts }); t.btn.onclick({ stopPropagation() {} }); await new Promise((r) => setTimeout(r, 20)); await t.pump();
  r = t.window.__manifoldTimingResult; assert.strictEqual(r.machine.gpu_is_software, true); assert(/do not count/.test(text(t.panel)), 'software warning missing'); console.log('test 2 software adapter flagged');
  t = run({ adapter: real, dts, hidden: true }); t.btn.onclick({ stopPropagation() {} }); await new Promise((r) => setTimeout(r, 20)); await t.pump();
  r = t.window.__manifoldTimingResult; assert.strictEqual(r.tab_hidden_during_run, true); assert(/not valid/.test(text(t.panel))); console.log('test 3 hidden tab flagged');
  t = run({ adapter: real, dts: Array(60).fill(1200), search: '?tsec=10&twarm=2' }); t.btn.onclick({ stopPropagation() {} }); await new Promise((r) => setTimeout(r, 20)); await t.pump();
  r = t.window.__manifoldTimingResult; assert(r.frames < 30 && /too few/.test(text(t.panel))); console.log('test 4 slow page flagged, frames', r.frames, 'p50', r.ms.p50);
  t = run({ adapter: real, dts, noBattery: true }); t.btn.onclick({ stopPropagation() {} }); await new Promise((r) => setTimeout(r, 20)); await t.pump(); assert.strictEqual(t.window.__manifoldTimingResult.machine.battery, null);
  t = run({ adapter: real, dts, search: '?timing=0' }); assert(!t.btn, 'button should not exist with timing=0'); console.log('test 5 ok');
  t = run({ adapter: real, dts, gpu: false }); t.btn.onclick({ stopPropagation() {} }); await new Promise((r) => setTimeout(r, 20)); await t.pump();
  r = t.window.__manifoldTimingResult; assert.strictEqual(r.gpu_frame_ms, null); assert(/no timestamp query/.test(text(t.panel))); console.log('test 6 no GPU timestamps: interval only');
  console.log('ALL OK');
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
