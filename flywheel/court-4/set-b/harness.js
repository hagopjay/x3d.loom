// Witness harness: serves ../kit and this folder over local http, loads each scene in X_ITE,
// screenshots the canvas, records console output and SAI probes.
// usage: node harness.js <out.json> <shots dir> file1.x3d[::probe-js] ...
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const here = __dirname, kit = path.join(here, '..', 'kit');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.x3d': 'model/x3d+xml', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  let f = null;
  if (u.startsWith('/kit/')) f = path.join(kit, path.normalize(u.slice(5)));
  else if (u.startsWith('/b/')) f = path.join(here, path.normalize(u.slice(3)));
  if (!f || f.includes('..') || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
});
(async () => {
  const [outFile, shots, ...items] = process.argv.slice(2);
  fs.mkdirSync(shots, { recursive: true });
  let probes = {};
  if (fs.existsSync(path.join(here, 'probes.json'))) probes = JSON.parse(fs.readFileSync(path.join(here, 'probes.json'), 'utf8'));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch();
  const result = { chromium: browser.version(), files: {} };
  for (const file of items) {
    const page = await browser.newPage({ viewport: { width: 400, height: 300 }, deviceScaleFactor: 1 });
    const msgs = [];
    page.on('console', m => { if (['error', 'warning'].includes(m.type())) msgs.push({ type: m.type(), text: m.text().slice(0, 400) }); });
    page.on('pageerror', e => msgs.push({ type: 'pageerror', text: String(e).slice(0, 400) }));
    await page.goto(base + '/b/harness.html');
    await page.waitForFunction(() => window.X3D && document.getElementById('c').browser);
    const pre = msgs.length;
    let r;
    try { r = await page.evaluate(([u, p]) => window.runWitness(u, p), [base + '/b/' + file, probes[file.replace(/^(fault|twin)-/, 'pair-')] || probes[file] || null]); }
    catch (e) { r = { harnessError: String(e) }; }
    await page.waitForTimeout(150);
    await (await page.$('#c')).screenshot({ path: path.join(shots, file + '.png') });
    r.console = msgs.slice(pre);
    r.errors = r.console.filter(m => m.type !== 'warning').length;
    r.warnings = r.console.filter(m => m.type === 'warning').length;
    result.files[file] = r;
    await page.close();
  }
  await browser.close(); server.close();
  fs.writeFileSync(outFile, JSON.stringify(result, null, 1));
})();
