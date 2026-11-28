// X_ITE witness for set c. Usage: NODE_PATH=$(npm root -g) node harness/witness.mjs <kitDir> [file ...]
// Serves this folder at / and the kit at /kit/, loads each scene in X_ITE, records console output,
// evaluates the intent lines (grammar of kit/INTENT.md), samples extra probes and saves a screenshot.
import { createRequire } from 'module';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const KIT = path.resolve(process.argv[2]);
let files = process.argv.slice(3);
if (!files.length) files = fs.readdirSync(ROOT).filter(f => /^(fault|twin|decoy)-\d+\.x3d$/.test(f)).sort();
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.x3d': 'model/x3d+xml', '.png': 'image/png', '.wav': 'audio/wav', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.json': 'application/json' };
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><script src="/kit/x_ite/x_ite.min.js"></script>
<style>body{margin:0}x3d-canvas{width:400px;height:300px;display:block}</style></head><body><x3d-canvas id="c" splashScreen="false" notifications="false" timings="false" contextMenu="false"></x3d-canvas></body></html>`;
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/page.html') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE); }
  const base = u.startsWith('/kit/') ? KIT : ROOT;
  const rel = u.startsWith('/kit/') ? u.slice(5) : u.slice(1);
  const p = path.join(base, rel);
  if (!p.startsWith(base) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

function parseIntents(xml) {
  const out = [];
  for (const m of xml.matchAll(/<meta name='intent' content='([^']*)'\/>/g))
    out.push(m[1].replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&').replace(/&apos;/g, "'"));
  return out;
}
// extra probes sampled 2.5 s after load (not part of the intent arm): [DEF, field]
const PROBES = {
  '10': [['Sign', 'textBounds'], ['Sign', 'string']], '11': [['Title', 'origin'], ['Title', 'textBounds']],
  '19': [['TowerDetail', 'level_changed'], ['Camera', 'position']], '18': [['Globe', 'level_changed']],
  '03': [], '05': [], '08': [],
};

const browser = await chromium.launch();
const results = {};
let gl = null, chromeVersion = browser.version();
for (const f of files) {
  const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
  const cons = [];
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) cons.push(`${m.type()}: ${m.text()}`.slice(0, 300)); });
  page.on('pageerror', e => cons.push('pageerror: ' + String(e).slice(0, 300)));
  await page.goto(origin + '/page.html');
  const xml = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const intents = parseIntents(xml);
  const num = f.match(/-(\d+)\./)[1];
  const probes = f.startsWith('decoy') ? [] : (PROBES[num] || []);
  const r = await page.evaluate(async ({ url, intents, probes }) => {
    const Browser = document.getElementById('c').browser;
    const out = { load: 'ok', intents: [], probes: {} };
    try { await Browser.loadURL(new X3D.MFString(url)); } catch (e) { out.load = 'error: ' + e; return out; }
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const scene = Browser.currentScene;
    const read = (def, field) => {
      const v = scene.getNamedNode(def)[field];
      if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') return [v];
      const a = []; const flat = x => { if (typeof x === 'object' && x !== null && typeof x[Symbol.iterator] === 'function') { for (const e of x) flat(e); } else a.push(x); }; flat(v);
      return a;
    };
    await sleep(100);
    const t0 = performance.now();
    const sends = [], checks = [];
    for (const line of intents) {
      let m;
      if ((m = line.match(/^send (\w+)\.(\w+) = (.+) at ([\d.]+)s$/))) sends.push({ def: m[1], field: m[2], val: m[3], t: +m[4] });
      else if ((m = line.match(/^after ([\d.]+)s: (\w+)\.(\w+)(?:\[(\d+)\])? ?(changed|unchanged|==|>=|<=|>|<) ?(.*?)(?: tol ([\d.]+))?$/)))
        checks.push({ line, t: +m[1], def: m[2], field: m[3], idx: m[4] === undefined ? null : +m[4], op: m[5], rhs: m[6], tol: m[7] ? +m[7] : 0.001 });
      else out.intents.push({ line, holds: false, note: 'not understood' });
    }
    const initial = {};
    for (const c of checks) { try { initial[c.def + '.' + c.field] = read(c.def, c.field); } catch (e) { } }
    const events = [...sends.map(s => ({ ...s, kind: 'send' })), ...checks.map(c => ({ ...c, kind: 'check' }))].sort((a, b) => a.t - b.t);
    for (const ev of events) {
      const wait = ev.t * 1000 - (performance.now() - t0);
      if (wait > 0) await sleep(wait);
      if (ev.kind === 'send') {
        let v = ev.val;
        if (v === 'now') v = Browser.currentTime ?? Date.now() / 1000; else if (v === 'true') v = true; else if (v === 'false') v = false; else if (/^".*"$/.test(v)) v = v.slice(1, -1); else v = +v;
        try { scene.getNamedNode(ev.def)[ev.field] = v; } catch (e) { out.intents.push({ line: 'send ' + ev.def, holds: false, note: String(e) }); }
      } else {
        let holds = false, got = null, note = '';
        try {
          got = read(ev.def, ev.field);
          const ini = initial[ev.def + '.' + ev.field];
          if (ev.op === 'changed') holds = JSON.stringify(got) !== JSON.stringify(ini);
          else if (ev.op === 'unchanged') holds = JSON.stringify(got) === JSON.stringify(ini);
          else if (ev.op === '==') { const want = ev.rhs.trim().split(/\s+/).map(Number); const g = ev.idx === null ? got : [got[ev.idx]]; holds = g.length === want.length && g.every((x, i) => Math.abs(x - want[i]) <= ev.tol); }
          else { const x = got[ev.idx ?? 0], w = +ev.rhs; holds = x !== undefined && ({ '>': x > w, '<': x < w, '>=': x >= w, '<=': x <= w })[ev.op]; }
        } catch (e) { note = String(e); }
        out.intents.push({ line: ev.line, holds: !!holds, got, note });
      }
    }
    const rest = 2500 - (performance.now() - t0);
    if (rest > 0) await sleep(rest);
    for (const [d, fl] of probes) { try { out.probes[d + '.' + fl] = read(d, fl); } catch (e) { out.probes[d + '.' + fl] = 'error: ' + e; } }
    const g = Browser.getContext ? Browser.getContext() : null;
    try { const c = document.createElement('canvas').getContext('webgl2'); const ext = c.getExtension('WEBGL_debug_renderer_info'); out.gl = ext ? c.getParameter(ext.UNMASKED_RENDERER_WEBGL) : c.getParameter(c.RENDERER); } catch (e) { out.gl = 'unknown'; }
    out.x_ite = Browser.version;
    return out;
  }, { url: origin + '/' + f, intents, probes });
  await page.locator('#c').screenshot({ path: path.join(HERE, 'shots', f.replace('.x3d', '.png')) });
  gl = r.gl || gl;
  results[f] = { ...r, console: cons };
  console.log(f, r.load, JSON.stringify(r.intents.map(i => [i.holds, i.got])), JSON.stringify(r.probes), cons.length ? cons : '');
  await page.close();
}
await browser.close();
server.close();
const outFile = path.join(ROOT, 'witness.json');
let prev = {};
if (process.argv.length > 3 && fs.existsSync(outFile)) prev = JSON.parse(fs.readFileSync(outFile, 'utf8')).scenes || {};
fs.writeFileSync(outFile, JSON.stringify({ chromium: chromeVersion, gl, scenes: { ...prev, ...results } }, null, 1));
