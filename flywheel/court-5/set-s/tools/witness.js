// Witness harness: loads every scene in X_ITE (kit/x_ite) under Chromium/Playwright,
// plays the intent lines (grammar of kit/INTENT.md), records console messages, a few probes and a screenshot.
// usage: NODE_PATH=$(npm root -g) node tools/witness.js [shots-dir]
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const HERE = path.resolve(__dirname, '..'), KIT = path.resolve(HERE, '..', 'kit');
const SHOTS = process.argv[2] || null;
const MIME = { '.x3d': 'model/x3d+xml', '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png' };
const PAGE = `<!doctype html><html><head><script src="/kit/x_ite/x_ite.min.js"></script></head>
<body style="margin:0;background:#888"><x3d-canvas style="width:400px;height:300px" splashScreen="false" notifications="false" timings="false"></x3d-canvas></body></html>`;
const server = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/page.html') { r.writeHead(200, { 'content-type': 'text/html' }); return r.end(PAGE); }
  const f = u.startsWith('/kit/') ? path.join(KIT, u.slice(5)) : path.join(HERE, u.slice(1));
  if (!f.startsWith(KIT) && !f.startsWith(HERE)) { r.writeHead(403); return r.end(); }
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end('nf'); }
    r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(d); });
});
function intents(file) {
  const s = fs.readFileSync(path.join(HERE, file), 'utf8'), out = [];
  for (const m of s.matchAll(/<meta name='intent' content="([^"]*)"\/>/g))
    out.push(m[1].replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
  return out;
}
function parse(line) {
  let m;
  if ((m = line.match(/^send (\w+)\.(\w+) = (.+) at ([\d.]+)s$/))) return { k: 'send', def: m[1], field: m[2], value: m[3], t: +m[4] };
  if ((m = line.match(/^after ([\d.]+)s: (\w+)\.(\w+) (changed|unchanged)$/))) return { k: m[4], t: +m[1], def: m[2], field: m[3] };
  if ((m = line.match(/^after ([\d.]+)s: (\w+)\.(\w+) == ([-\d.e ]+?)( tol ([\d.]+))?$/)))
    return { k: 'eq', t: +m[1], def: m[2], field: m[3], nums: m[4].trim().split(/\s+/).map(Number), tol: m[6] ? +m[6] : 0.001 };
  if ((m = line.match(/^after ([\d.]+)s: (\w+)\.(\w+)\[(\d+)\] (>=|<=|>|<) ([-\d.e]+)$/)))
    return { k: 'cmp', t: +m[1], def: m[2], field: m[3], i: +m[4], op: m[5], n: +m[6] };
  return { k: 'unknown', line };
}
async function run(browser, file, port) {
  const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
  const cons = [];
  page.on('console', m => { if (['error', 'warning'].includes(m.type()) && !/GL Driver Message/.test(m.text())) cons.push(m.type() + ': ' + m.text().slice(0, 240)); });
  page.on('pageerror', e => cons.push('pageerror: ' + String(e).slice(0, 240)));
  await page.goto(`http://127.0.0.1:${port}/page.html`);
  await page.waitForFunction(() => window.X3D && X3D.getBrowser && X3D.getBrowser());
  let loadError = null;
  try { await page.evaluate(async url => { await X3D.getBrowser().loadURL(new X3D.MFString(url)); }, `http://127.0.0.1:${port}/${file}`); }
  catch (e) { loadError = String(e).slice(0, 240); }
  await page.evaluate(() => {
    window.readField = (def, field) => {
      const flat = v => (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') ? [v]
        : (v && typeof v[Symbol.iterator] === 'function') ? [...v].flatMap(flat) : [String(v)];
      try { return flat(X3D.getBrowser().currentScene.getNamedNode(def)[field]); } catch (e) { return { error: String(e) }; }
    };
    window.writeField = (def, field, raw) => {
      const v = raw === 'now' ? Date.now() / 1000 : raw === 'true' ? true : raw === 'false' ? false
        : /^".*"$/.test(raw) ? raw.slice(1, -1) : Number(raw);
      try { X3D.getBrowser().currentScene.getNamedNode(def)[field] = v; return 'ok'; } catch (e) { return String(e); }
    };
  });
  const t0 = Date.now(), steps = intents(file).map(parse).sort((a, b) => a.t - b.t), results = [];
  const watched = [...new Set(steps.filter(s => s.k !== 'send' && s.k !== 'unknown').map(s => s.def + '.' + s.field))];
  await page.waitForTimeout(50);
  const initial = {};
  for (const w of watched) initial[w] = await page.evaluate(([d, f]) => readField(d, f), w.split('.'));
  for (const s of steps) {
    if (s.k === 'unknown') { results.push({ line: s.line, holds: false, note: 'not understood' }); continue; }
    const wait = s.t * 1000 - (Date.now() - t0); if (wait > 0) await page.waitForTimeout(wait);
    if (s.k === 'send') { results.push({ send: `${s.def}.${s.field}=${s.value}`, at: s.t, r: await page.evaluate(([d, f, v]) => writeField(d, f, v), [s.def, s.field, s.value]) }); continue; }
    const v = await page.evaluate(([d, f]) => readField(d, f), [s.def, s.field]), i0 = initial[s.def + '.' + s.field];
    let holds = false;
    if (Array.isArray(v)) {
      if (s.k === 'changed') holds = JSON.stringify(v) !== JSON.stringify(i0);
      if (s.k === 'unchanged') holds = JSON.stringify(v) === JSON.stringify(i0);
      if (s.k === 'eq') holds = v.length === s.nums.length && v.every((x, i) => Math.abs(x - s.nums[i]) <= s.tol);
      if (s.k === 'cmp') { const x = v[s.i]; holds = s.op === '>' ? x > s.n : s.op === '<' ? x < s.n : s.op === '>=' ? x >= s.n : x <= s.n; }
    }
    results.push({ assert: `${s.k} ${s.def}.${s.field}`, at: s.t, value: Array.isArray(v) ? v.map(x => typeof x === 'number' ? +x.toFixed(4) : x) : v, holds });
  }
  const rest = 1800 - (Date.now() - t0); if (rest > 0) await page.waitForTimeout(rest);
  const probes = await page.evaluate(() => {
    const sc = X3D.getBrowser().currentScene, o = { rootNodes: sc.rootNodes.length };
    try { o.shelfChildren = sc.getNamedNode('Shelf').children.length; } catch (e) { }
    return o;
  });
  let shot = null;
  if (SHOTS) { shot = path.join(SHOTS, file.replace('.x3d', '.png')); await page.locator('x3d-canvas').screenshot({ path: shot }); }
  await page.close();
  const asserts = results.filter(r => 'holds' in r);
  return { file, loadError, console: cons, probes, intent: results, assertions: asserts.length, allHold: asserts.every(r => r.holds) };
}
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port, browser = await chromium.launch();
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const files = fs.readdirSync(HERE).filter(f => /^(fault|twin|decoy)-\d+\.x3d$/.test(f)).sort(), out = {};
  for (let i = 0; i < files.length; i += 4)
    for (const r of await Promise.all(files.slice(i, i + 4).map(f => run(browser, f, port)))) out[r.file] = r;
  const gl = await (async () => { const p = await browser.newPage(); const s = await p.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const e = g.getExtension('WEBGL_debug_renderer_info'); return g.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : g.RENDERER); }); await p.close(); return s; })();
  fs.writeFileSync(path.join(HERE, 'witness.json'), JSON.stringify({ engine: 'X_ITE 16.8.0', chromium: browser.version(), gl, results: out }, null, 1));
  await browser.close(); server.close();
  for (const [f, r] of Object.entries(out)) console.log(f, r.loadError || '', 'console:', r.console.length, 'asserts:', r.assertions, r.allHold, JSON.stringify(r.probes));
})();
