// Runs the harness in headless Chromium (SwiftShader WebGPU by default) and writes receipts/<name>.json.
//   node tools/run.js [--quick] [--mutate='kernel|old text|new text'] [--only=particles,volume] [--nobench] [--name=receipt-name] [--gpu]   (--gpu: use the machine's real adapter, no SwiftShader flags)
// Needs playwright (NODE_PATH or local install). CHROMIUM_EXECUTABLE overrides the browser.
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), args = process.argv.slice(2), flag = (n) => args.includes('--' + n), val = (n) => { const a = args.find((x) => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : ''; };
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.wgsl': 'text/plain', '.x3d': 'application/xml', '.json': 'application/json' };
const srv = http.createServer((q, r) => { const p = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': mime[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); });
(async () => {
  const { chromium } = require('playwright');
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok)); const port = srv.address().port;
  const launch = ['--enable-unsafe-webgpu', '--no-sandbox', '--ignore-gpu-blocklist', ...(flag('gpu') ? ['--enable-features=Vulkan'] : ['--use-angle=swiftshader', '--use-webgpu-adapter=swiftshader', '--enable-features=Vulkan'])];
  const b = await chromium.launch({ args: launch, executablePath: process.env.CHROMIUM_EXECUTABLE || undefined });
  const p = await b.newPage(); p.on('console', (m) => process.stderr.write('[page] ' + m.text() + '\n')); p.on('pageerror', (e) => process.stderr.write('[pageerror] ' + e + '\n'));
  const mut = val('mutate') ? Buffer.from(JSON.stringify([val('mutate').split('|')])).toString('base64') : '';
  await p.goto(`http://127.0.0.1:${port}/bench/index.html?mut=${encodeURIComponent(mut)}`);
  const only = val('only') ? val('only').split(',') : undefined;
  const res = await p.evaluate((o) => window.X3DGPU.runAll(o), { quick: flag('quick'), only, noBench: flag('nobench') });
  res.rig.mutation = val('mutate') || null; res.rig.chromium = b.version(); res.rig.flags = launch; res.rig.node = process.version; res.rig.cpus = require('os').cpus().length + 'x ' + require('os').cpus()[0].model; res.rig.when = new Date().toISOString();
  const name = val('name') || (flag('quick') ? 'quick' : 'full') + (flag('gpu') ? '-gpu' : '-swiftshader');
  fs.mkdirSync(path.join(root, 'receipts'), { recursive: true }); fs.writeFileSync(path.join(root, 'receipts', name + '.json'), JSON.stringify(res, null, 1));
  const sum = Object.fromEntries(Object.entries(res.suites).map(([k, v]) => [k, v.error ? 'ERROR' : v.correctness.pass]));
  console.log(JSON.stringify({ receipt: 'receipts/' + name + '.json', pass: sum, gpu_errors: res.gpu_errors, total_s: res.total_s }, null, 1));
  await b.close(); srv.close(); process.exit(res.gpu_errors.length || Object.values(sum).some((x) => x !== true) ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
