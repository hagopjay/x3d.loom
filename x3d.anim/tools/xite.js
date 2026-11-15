// Run an X3D string in X_ITE 16.6.0 (headless Chromium, SwiftShader) and read back what its interpolators and ROUTEs do.
// measureXite(x3d, timeline, fractions): freezes the clock, sets every interpolator's set_fraction, lets X_ITE process the events, reads the ROUTE target fields.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import http from 'node:http'; import { createRequire } from 'node:module';
import { interpName } from '../src/x3d-write.js';
const require = createRequire(import.meta.url), XITE = process.env.XITE_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'node_modules', 'x_ite', 'dist');
const { chromium } = require('playwright');

export async function withXite(fn) {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try { const pg = await b.newPage({ viewport: { width: 320, height: 240 } }); pg.on('pageerror', (e) => { (pg._errs ||= []).push(e.message.slice(0, 200)); });
    const page = '<!doctype html><meta charset=utf-8><link rel=stylesheet href="/x_ite/x_ite.css"><body style="margin:0"><x3d-canvas id=c style="width:320px;height:240px;display:block"></x3d-canvas><script src="/x_ite/x_ite.min.js"></script>';
    const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') { r.setHeader('content-type', 'text/html'); return r.end(page); }
      const f = path.join(XITE, u.replace(/^\/x_ite\//, '')); if (u.startsWith('/x_ite/') && f.startsWith(XITE) && fs.existsSync(f) && fs.statSync(f).isFile()) { r.setHeader('content-type', f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'application/octet-stream'); return fs.createReadStream(f).pipe(r); } r.statusCode = 404; r.end('no'); });
    await new Promise((ok) => srv.listen(0, ok)); pg._srv = srv; await pg.goto('http://localhost:' + srv.address().port + '/'); await pg.waitForFunction(() => window.X3D && X3D.getBrowser('#c'));
    await pg.evaluate(async () => { const br = X3D.getBrowser('#c'); try { br.setBrowserOption('Notifications', false); br.setBrowserOption('Timings', false); br.setBrowserOption('ContextMenu', false); } catch (e) {} });
    const env = { chromium: b.version(), x_ite: await pg.evaluate(() => X3D.getBrowser('#c').version) };
    return await fn(pg, env); } finally { await b.close(); }
}
export async function loadScene(pg, x3d) { await pg.evaluate(async (x) => { const br = window.__br || X3D.getBrowser('#c'), sc = await br.createX3DFromString(x); await br.replaceWorld(sc); await br.nextFrame(); await br.nextFrame(); window.__sc = sc; }, x3d); }
export const shot = async (pg) => (await pg.screenshot({ type: 'png' }));

const READ = { SFFloat: (v) => [v], SFInt32: (v) => [v], SFVec2f: (v) => [v.x, v.y], SFVec3f: (v) => [v.x, v.y, v.z], SFColor: (v) => [v.r, v.g, v.b], SFRotation: (v) => [v.x, v.y, v.z, v.angle] };
// returns samples[i][channelIndex] = value read from the target field after set_fraction = fractions[i] on every interpolator
export async function sweep(pg, tl, fractions, clock) {
  const spec = tl.channels.map((c) => ({ ip: interpName(c), def: c.def, field: c.field, type: c.type })), ck = clock || 'Clock_' + tl.name.replace(/[^A-Za-z0-9_]/g, '_');
  return pg.evaluate(async ({ spec, fractions, ck }) => {
    const br = window.__br || X3D.getBrowser('#c'), sc = window.__sc, out = []; sc.getNamedNode(ck).enabled = false; await br.nextFrame();
    const rd = { SFFloat: (v) => [v], SFInt32: (v) => [v], SFVec2f: (v) => [v.x, v.y], SFVec3f: (v) => [v.x, v.y, v.z], SFColor: (v) => [v.r, v.g, v.b], SFRotation: (v) => [v.x, v.y, v.z, v.angle] };
    for (const f of fractions) { for (const s of spec) sc.getNamedNode(s.ip).set_fraction = f; await br.nextFrame(); await br.nextFrame(); out.push(spec.map((s) => rd[s.type](sc.getNamedNode(s.def)[s.field]))); }
    return out; }, { spec, fractions, ck });
}
