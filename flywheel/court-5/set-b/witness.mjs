// X_ITE witness harness for set b. Run: NODE_PATH=$(npm root -g) node witness.mjs
import { createRequire } from 'module';
import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');           // serves /author-b and /kit
const SELF = path.basename(HERE);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.x3d': 'model/x3d+xml', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/page.html') {
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end(`<!doctype html><html><head><script src="/kit/x_ite/x_ite.min.js"></script>
<style>body{margin:0}x3d-canvas{width:480px;height:360px;display:block}</style></head>
<body><x3d-canvas id="c" splashScreen="false" notifications="false" timings="false" contextMenu="false" preserveDrawingBuffer="true"></x3d-canvas></body></html>`);
  }
  const f = path.join(ROOT, p);
  if (!f.startsWith(path.join(ROOT, SELF)) && !f.startsWith(path.join(ROOT, 'kit'))) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
    res.end(d);
  });
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

function intents(file) {
  const t = fs.readFileSync(path.join(HERE, file), 'utf8');
  return [...t.matchAll(/<meta name="intent" content="([^"]*)"\/>/g)].map(m => m[1].replace(/&gt;/g, '>').replace(/&lt;/g, '<'));
}
const files = fs.readdirSync(HERE).filter(f => /^(fault|twin|decoy)-\d\d\.x3d$/.test(f)).sort();
const only = process.argv.slice(2);
const browser = await chromium.launch();
const out = fs.existsSync(path.join(HERE, 'witness.json')) && only.length ? JSON.parse(fs.readFileSync(path.join(HERE, 'witness.json'))) : {};
fs.mkdirSync(path.join(HERE, 'witness-shots'), { recursive: true });
for (const file of files) {
  if (only.length && !only.some(o => file.includes(o))) continue;
  const page = await browser.newPage({ viewport: { width: 480, height: 360 } });
  const logs = [];
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(`${m.type()}: ${m.text().slice(0, 300)}`); });
  page.on('pageerror', e => logs.push(`pageerror: ${String(e).slice(0, 300)}`));
  page.on('requestfailed', r => logs.push(`requestfailed: ${r.url().slice(0, 200)}`));
  await page.goto(base + '/page.html');
  const rec = { console: logs, intents: [] };
  const lines = intents(file);
  const asserts = lines.map(l => l.match(/^after ([\d.]+)s: (\w+)\.(\w+)(?:\[(\d+)\])? ?(changed|unchanged|==|>=|<=|>|<)? ?(.*?)(?: tol ([\d.]+))?$/)).filter(Boolean);
  const maxT = Math.max(1.5, ...asserts.map(a => parseFloat(a[1]))) + 0.3;
  try {
    rec.load = await page.evaluate(async (u) => {
      const b = document.getElementById('c').browser;
      window.__flat = (v) => {
        if (v === null || v === undefined) return null;
        if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') return [v];
        if (typeof v.length === 'number') { const o = []; for (let i = 0; i < v.length; i++) o.push(...(window.__flat(v[i]) || [])); return o; }
        const o = []; for (let i = 0; i < 16 && v[i] !== undefined; i++) o.push(v[i]); return o.length ? o : [String(v)];
      };
      try { await b.loadURL(new X3D.MFString(u)); } catch (e) { return 'loadURL rejected: ' + String(e).slice(0, 300); }
      window.__t0 = performance.now();
      return 'loaded';
    }, `${base}/${SELF}/${file}`);
    const read = (a) => page.evaluate(([d, f]) => {
      try { const n = document.getElementById('c').browser.currentScene.getNamedNode(d); return window.__flat(n[f]); }
      catch (e) { return { error: String(e).slice(0, 200) }; }
    }, [a[2], a[3]]);
    const initial = [];
    for (const a of asserts) initial.push(await read(a));
    await page.waitForTimeout(maxT * 1000);
    for (let i = 0; i < asserts.length; i++) {
      const a = asserts[i], v = await read(a);
      let holds = false;
      if (v && !v.error) {
        const tol = a[7] ? parseFloat(a[7]) : 0.001, idx = a[4] !== undefined ? parseInt(a[4]) : null;
        const want = a[6].trim().split(/\s+/).filter(Boolean).map(Number);
        if (a[5] === 'changed') holds = JSON.stringify(v) !== JSON.stringify(initial[i]);
        else if (a[5] === 'unchanged') holds = JSON.stringify(v) === JSON.stringify(initial[i]);
        else if (a[5] === '==') { const got = idx === null ? v : [v[idx]]; holds = got.length === want.length && got.every((g, k) => Math.abs(Number(g) - want[k]) <= tol); }
        else { const g = Number(v[idx === null ? 0 : idx]); const w = want[0]; holds = { '>': g > w, '<': g < w, '>=': g >= w, '<=': g <= w }[a[5]] === true; }
      }
      rec.intents.push({ line: a[0], value: v, holds });
    }
    rec.intent_lines = lines.length; rec.intent_understood = asserts.length;
    rec.stats = await page.evaluate(() => {
      const b = document.getElementById('c').browser, s = b.currentScene;
      const names = []; try { for (const n of s.namedNodes) names.push(n.getNodeName ? n.getNodeName() : String(n)); } catch (e) {}
      let md = null; try { const n = s.getNamedNode('BracketShape'); md = n.metadata ? n.metadata.getNodeTypeName() + ':' + n.metadata.name + (n.metadata.value && n.metadata.getNodeTypeName() === 'MetadataSet' ? ':' + n.metadata.value.length + ' entries' : '') : 'null'; } catch (e) {}
      return { metadataProbe: md, rootNodes: s.rootNodes.length, worldURL: String(s.worldURL).split('/').pop() };
    });
    const png = await page.locator('#c').screenshot();
    fs.writeFileSync(path.join(HERE, 'witness-shots', file.replace('.x3d', '.png')), png);
    rec.shot_sha256 = crypto.createHash('sha256').update(png).digest('hex');
  } catch (e) { rec.harness_error = String(e).slice(0, 300); }
  out[file] = rec;
  console.log(file, rec.load, JSON.stringify(rec.intents.map(i => [i.holds, i.value])), logs.length ? logs.join(' | ').slice(0, 400) : '');
  await page.close();
}
const v = await browser.version();
out.__tools = { chromium: v, node: process.version, playwright: require('playwright/package.json').version };
const p0 = await browser.newPage();
out.__tools.gl = await p0.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const e = g && g.getExtension('WEBGL_debug_renderer_info'); return g ? (e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'webgl2') : 'none'; });
await browser.close(); server.close();
fs.writeFileSync(path.join(HERE, 'witness.json'), JSON.stringify(out, null, 1));
