// node run-tests.js [--no-xite] [--babylon babylon.js] NODE...  -> prints one JSON line {env, results:{NODE:{ok, ours, xite, msg, gaps}}}
// Every node has fixtures/NODE.x3d and fixtures/NODE.test.json. The same spec runs in two engines through the SAI both expose:
//   ours  = the reader + SAI shim of x3d.webgpu (headless: no Babylon for mode "events"; mode "draw" adds the Babylon body on SwiftShader WebGPU)
//   xite  = X_ITE ($XITE_DIR, default /tmp/bb/xite/package/dist), the oracle, WebGL2 on SwiftShader
// Spec: {node, mode, steps:[{set:[def,field,value,type?]}, {expect:[def,field,value]}, {event:[def,field,value]}, {noevent:[def,field]}], gaps:[...], xite:false to skip}
// Values: numbers, booleans, strings, arrays; "$time" matches any epoch-scale time. Floats compare at 1e-5.
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const BR = path.resolve(__dirname, '..'), SRC = path.resolve(BR, '..', 'demo', 'src');
const args = process.argv.slice(2); const noXite = args.includes('--no-xite');
const bi = args.indexOf('--babylon'); const babylon = bi >= 0 ? args.splice(bi, 2)[1] : process.env.BABYLON_JS;
const names = args.filter((a) => !a.startsWith('--'));
const XITE_DIR = process.env.XITE_DIR || '/tmp/bb/xite/package/dist';

// ---- the bundle: the same concatenation the page builders use, plus the bridge kit, the node files and a test boot ----------------------
const READER = ['brain/reader.js', 'gobbler/reader-ext.js', 'demiurge/reader-ext-dm.js', 'dynasty/reader-ext-dl.js', 'hall/reader-ext-hl.js'];
function bundle() {
  const rd = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');
  const nodes = fs.readdirSync(path.join(BR, 'src', 'nodes')).filter((f) => f.endsWith('.js')).sort().map((f) => fs.readFileSync(path.join(BR, 'src', 'nodes', f), 'utf8'));
  const parts = [...READER.filter((p) => fs.existsSync(path.join(SRC, p))).map(rd), fs.readFileSync(path.join(BR, 'src', 'kit.js'), 'utf8'), ...nodes, rd('brain/sai.js'),
    `window.__R = R; window.__events = events; window.__bridge = R.bridge; window.__worlds = R.bridge.worlds;`];
  return '(function () {\n"use strict";\n' + parts.join('\n') + '\n})();\n';
}

// ---- the runner both pages share: it only uses the SAI ---------------------------------------------------------------------------------
const RUNNER = `
const plain = (v) => {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'object') return v;
  if (Array.isArray(v) || (typeof v.length === 'number' && typeof v !== 'string' && !('x' in v))) return Array.from(v, plain);
  if ('angle' in v && 'x' in v) return [v.x, v.y, v.z, v.angle];
  if ('w' in v && 'x' in v) return [v.x, v.y, v.z, v.w];
  if ('z' in v && 'x' in v) return [v.x, v.y, v.z];
  if ('y' in v && 'x' in v) return [v.x, v.y];
  if ('r' in v && 'a' in v) return [v.r, v.g, v.b, v.a];
  if ('r' in v && 'g' in v) return [v.r, v.g, v.b];
  return v.getNodeName ? '[node ' + v.getNodeName() + ']' : String(v);
};
const close = (a, b) => {
  if (b === '$any') return true;
  if (b === '$time') return typeof a === 'number' && isFinite(a) && a > 1e9;
  if (typeof b === 'number' && typeof a === 'number') return Math.abs(a - b) <= 1e-5 * Math.max(1, Math.abs(b));
  if (Array.isArray(b)) return Array.isArray(a) && a.length === b.length && b.every((x, i) => close(a[i], x));
  return a === b;
};
const show = (v) => JSON.stringify(v);
async function runSpec(eng, spec, xml) {
  const out = { ok: true, steps: 0, fails: [], recorded: [] }; const X = window.X3D;
  const scene = await eng.open(xml); const nodes = {}; const events = {};
  const node = (d) => (nodes[d] ||= scene.getNamedNode(d));
  const conv = (t, v) => {
    if (!t) return v;
    switch (t) {
      case 'SFVec2f': return new X.SFVec2f(...v); case 'SFVec3f': return new X.SFVec3f(...v); case 'SFRotation': return new X.SFRotation(...v); case 'SFColor': return new X.SFColor(...v);
      case 'MFFloat': return new X.MFFloat(...v); case 'MFInt32': return new X.MFInt32(...v); case 'MFString': return new X.MFString(...v);
      default: return v;
    }
  };
  for (const s of spec.steps) for (const k of ["event", "noevent", "atleast"]) if (s[k]) {
    const [d, f] = s[k], key = d + '.' + f;
    if (!events[key]) { events[key] = []; node(d).addFieldCallback('w' + key, f, (v) => events[key].push(plain(v))); }
  }
  for (const [i, s] of spec.steps.entries()) {
    out.steps++;
    const fail = (m) => { out.ok = false; out.fails.push('step ' + (i + 1) + ': ' + m); };
    try {
      if (s.set) { for (const k in events) events[k].length = 0; const [d, f, v, t] = s.set; await eng.apply(() => { node(d)[f] = conv(t, v); }); }
      else if (s.settle) await eng.settle(s.settle);
      else if (s.expect) { const [d, f, v] = s.expect; const a = plain(node(d)[f]); if (!close(a, v)) fail(d + '.' + f + ' is ' + show(a) + ', expected ' + show(v)); }
      else if (s.event) { const [d, f, v] = s.event; const l = events[d + '.' + f]; if (v === '$any') out.recorded.push(l.length === 1 ? l[0] : l); if (l.length !== 1) fail(d + '.' + f + ' fired ' + l.length + ' times (' + show(l) + '), expected 1'); else if (!close(l[0], v)) fail(d + '.' + f + ' event ' + show(l[0]) + ', expected ' + show(v)); }
      else if (s.between) { const [d, f, lo, hi] = s.between; const a = plain(node(d)[f]); if (!(a > lo && a < hi)) fail(d + '.' + f + ' is ' + show(a) + ', expected between ' + lo + ' and ' + hi); }
      else if (s.near) { const [d, f, v, tol] = s.near; const a = plain(node(d)[f]); if (!(Math.abs(a - v) <= tol)) fail(d + '.' + f + ' is ' + show(a) + ', expected ' + v + ' within ' + tol); }
      else if (s.nearv) { const [d, f, v, tol] = s.nearv; const a = plain(node(d)[f]); if (!(Array.isArray(a) && a.length === v.length && v.every((x, i) => Math.abs(a[i] - x) <= tol))) fail(d + '.' + f + ' is ' + show(a) + ', expected ' + show(v) + ' within ' + tol); }
      else if (s.reset) { for (const k in events) events[k].length = 0; }
      else if (s.atleast) { const [d, f, n] = s.atleast; const l = events[d + '.' + f]; if (l.length < n) fail(d + '.' + f + ' fired ' + l.length + ' times, expected at least ' + n); }
      else if (s.noevent) { const [d, f] = s.noevent; const l = events[d + '.' + f]; if (l.length) fail(d + '.' + f + ' fired ' + show(l) + ', expected nothing'); }
    } catch (e) { fail('threw ' + String(e).slice(0, 160)); }
  }
  return out;
}
`;
const PAGE_OURS = `<!doctype html><meta charset=utf-8><body><script src="/bundle.js"></script><script>${RUNNER}
let ts = performance.timeOrigin / 1000 + performance.now() / 1000;
window.runOurs = async (spec, xml) => runSpec({
  open: async (x) => { const sc = await X3DSAI.B.createX3DFromString(x); return sc; },
  apply: async (fn) => { __events.begin(ts += 0.05); fn(); __events.drain(); },
  settle: async (dt) => { const sc = X3DSAI.B.currentScene, steps = Math.max(1, Math.round((dt || 0.05) / 0.05));
    for (let i = 0; i < steps; i++) { __events.begin(ts += 0.05); for (const n of (window.__worlds || [])) for (const t of n.nodes) if (t.type === 'TimeSensor') __R.tickTimeSensor(t, ts); __events.drain(); } },
}, spec, xml);
</script>`;
const PAGE_XITE = `<!doctype html><meta charset=utf-8><link rel=stylesheet href="/x_ite/x_ite.css"><body><x3d-canvas id=c style="width:64px;height:64px"></x3d-canvas><script src="/x_ite/x_ite.min.js"></script><script>${RUNNER}
window.runXite = async (spec, xml) => { const b = X3D.getBrowser('#c'); await b.loadComponents?.(b.getProfile ? b.getProfile('Full') : undefined).catch(() => {});
  return runSpec({
    open: async (x) => { const sc = await b.createX3DFromString(x); await b.replaceWorld(sc); await b.nextFrame(); return sc; },
    apply: async (fn) => { fn(); await b.nextFrame(); await b.nextFrame(); },
    settle: async (dt) => { await new Promise((r) => setTimeout(r, (dt || 0.05) * 1000)); await b.nextFrame(); },
  }, spec, xml); };
window.xiteInfo = () => ({ name: X3D.getBrowser('#c').name, version: X3D.getBrowser('#c').version });
</script>`;

function serve(files) {
  const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
  return new Promise((res) => { const s = http.createServer((q, r) => {
    const u = decodeURIComponent(q.url.split('?')[0]);
    if (files[u] !== undefined) { r.setHeader('content-type', mime[path.extname(u)] || 'text/html'); return r.end(files[u]); }
    if (u.startsWith('/x_ite/')) { const f = path.join(XITE_DIR, u.slice(7)); if (fs.existsSync(f) && fs.statSync(f).isFile()) { r.setHeader('content-type', mime[path.extname(f)] || 'application/octet-stream'); return fs.createReadStream(f).pipe(r); } }
    r.statusCode = 404; r.end('no');
  }).listen(0, () => res(s)); });
}

(async () => {
  const files = { '/bundle.js': bundle(), '/ours.html': PAGE_OURS, '/xite.html': PAGE_XITE };
  const server = await serve(files), base = 'http://localhost:' + server.address().port;
  const b = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-webgpu-adapter=swiftshader'] });
  const env = { chromium: b.version(), ours: 'x3d.webgpu reader + SAI shim, headless, bundle sha ' + require('crypto').createHash('sha256').update(files['/bundle.js']).digest('hex').slice(0, 12) };
  const results = {};
  const po = await b.newPage(), errs = []; po.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
  await po.goto(base + '/ours.html');
  let px = null;
  if (!noXite && fs.existsSync(path.join(XITE_DIR, 'x_ite.min.js'))) { px = await b.newPage(); px.on('pageerror', (e) => errs.push('xite: ' + e.message.slice(0, 160))); await px.goto(base + '/xite.html'); await px.waitForFunction(() => window.X3D && X3D.getBrowser('#c'), null, { timeout: 60000 }).catch(() => {}); env.xite = 'X_ITE ' + (await px.evaluate(() => window.xiteInfo && window.xiteInfo().version).catch(() => '?')) + ' (WebGL2, SwiftShader)'; }
  else env.xite = noXite ? 'skipped (--no-xite)' : 'not found at ' + XITE_DIR;
  for (const n of names) {
    const fx = path.join(BR, 'fixtures', n + '.x3d'), ts = path.join(BR, 'fixtures', n + '.test.json');
    if (!fs.existsSync(fx) || !fs.existsSync(ts)) { results[n] = { ok: false, msg: 'missing fixture or test spec' }; continue; }
    const xml = fs.readFileSync(fx, 'utf8'), spec = JSON.parse(fs.readFileSync(ts, 'utf8'));
    const r = { ok: false, ours: '?', xite: px && spec.xite !== false ? '?' : 'n/a' };
    try { const o = await po.evaluate(([s, x]) => window.runOurs(s, x), [spec, xml]); r.ours = o.ok ? `pass ${o.steps}/${o.steps}` : 'FAIL ' + o.fails.join(' | '); r.oursOk = o.ok; if (o.recorded.length) r.recordedOurs = o.recorded; } catch (e) { r.ours = 'ERROR ' + String(e).slice(0, 200); r.oursOk = false; }
    if (px && spec.xite !== false) { try { const o = await px.evaluate(([s, x]) => window.runXite(s, x), [spec, xml]); r.xite = o.ok ? `pass ${o.steps}/${o.steps}` : 'FAIL ' + o.fails.join(' | '); r.xiteOk = o.ok; if (o.recorded.length) r.recordedXite = o.recorded; } catch (e) { r.xite = 'ERROR ' + String(e).slice(0, 200); r.xiteOk = false; } }
    // the bridge passes when ours passes; a disagreeing oracle is reported, and a gap if the spec lists one
    r.ok = r.oursOk && (r.xiteOk !== false || !!spec.xiteDisagrees);
    r.msg = r.ok ? (r.xiteOk === false ? 'X_ITE differs (' + spec.xiteDisagrees + ')' : '') : (r.oursOk ? 'X_ITE disagrees with the spec: check the spec' : '');
    if (spec.gaps && spec.gaps.length) r.gaps = spec.gaps;
    results[n] = r;
  }
  if (errs.length) env.pageErrors = errs.slice(0, 5);
  await b.close(); server.close();
  console.log(JSON.stringify({ env, results }));
})().catch((e) => { console.error(e); console.log(JSON.stringify({ error: String(e) })); process.exit(0); });
