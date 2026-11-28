// Witness harness for set a. Usage: NODE_PATH=$(npm root -g) node witness.mjs [file ...]
// Serves ../ (only /author-a/ and /kit/), loads each scene in X_ITE, plays the intent lines,
// runs extra probes (mouse, frame tracking) for pairs whose intent cannot be put in the grammar.
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.x3d': 'model/x3d+xml', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const f = path.normalize(path.join(ROOT, p));
  if (!(f.startsWith(path.join(ROOT, 'author-a') + path.sep) || f.startsWith(path.join(ROOT, 'kit') + path.sep)) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function intents(file) {
  const txt = fs.readFileSync(path.join(HERE, file), 'utf8');
  const out = { sends: [], asserts: [], unknown: [] };
  for (const m of txt.matchAll(/<meta name="intent" content="([^"]*)"\/>/g)) {
    const line = m[1].replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    let r;
    if ((r = line.match(/^send (\w+)\.(\w+) = (.+) at ([\d.]+)s$/))) {
      let v = r[3];
      if (v === 'true') v = true; else if (v === 'false') v = false; else if (v === 'now') v = 'now';
      else if (/^".*"$/.test(v)) v = v.slice(1, -1); else v = Number(v);
      out.sends.push({ line, def: r[1], field: r[2], value: v, t: Number(r[4]) });
    } else if ((r = line.match(/^after ([\d.]+)s: (\w+)\.(\w+)(?:\[(\d+)\])? (changed|unchanged|==|>=|<=|>|<)(?: (.*?))?(?: tol ([\d.]+))?$/))) {
      out.asserts.push({ line, t: Number(r[1]), def: r[2], field: r[3], idx: r[4] === undefined ? null : Number(r[4]), op: r[5], rhs: r[6] ? r[6].trim().split(/\s+/).map(Number) : null, tol: r[7] ? Number(r[7]) : 0.001 });
    } else out.unknown.push(line);
  }
  return out;
}
const same = (a, b, tol = 1e-6) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) <= tol);

const PROBES = {
  // press and release the pointer at the canvas centre, read a field afterwards
  '02': async (page) => { await page.mouse.move(400, 300); await sleep(150); await page.mouse.down(); await sleep(120); await page.mouse.up(); await sleep(2600);
    return { flag_after_click: await page.evaluate(() => W.read('Flag', 'translation')) }; },
  '09': async (page) => { const r = {};
    await page.mouse.move(400, 300); await sleep(200); r.glow_on_hover_drawer = await page.evaluate(() => W.read('DrawerGlow', 'on'));
    await page.mouse.down(); await sleep(200); r.lamp_while_held_on_drawer = await page.evaluate(() => W.read('CabinetLamp', 'on')); await page.mouse.up(); await sleep(150);
    await page.mouse.move(400, 170); await sleep(200); await page.mouse.down(); await sleep(200); r.lamp_while_held_on_body = await page.evaluate(() => W.read('CabinetLamp', 'on')); await page.mouse.up(); await sleep(100);
    r.lamp_after_release = await page.evaluate(() => W.read('CabinetLamp', 'on')); return r; },
  '11': async (page) => { const a = await page.evaluate(() => { try { return W.read('Blades', 'rotation'); } catch (e) { return String(e); } }); await sleep(600);
    const b = await page.evaluate(() => { try { return W.read('Blades', 'rotation'); } catch (e) { return String(e); } }); return { blades_rotation_t0: a, blades_rotation_t1: b }; },
  '12': async (page) => { const tr = await page.evaluate(() => W.track('Marker', 'translation', 5000)); let max = 0;
    for (let i = 1; i < tr.length; i++) max = Math.max(max, Math.hypot(tr[i][0] - tr[i - 1][0], tr[i][1] - tr[i - 1][1], tr[i][2] - tr[i - 1][2]));
    return { frames: tr.length, max_frame_to_frame_jump: max }; },
  '15': async (page) => { const r = {}; r.before = await page.evaluate(() => W.read('Wheel', 'rotation'));
    await page.mouse.move(400, 300); await sleep(150); await page.mouse.down(); await sleep(700); r.held = await page.evaluate(() => W.read('Wheel', 'rotation'));
    await page.mouse.up(); await sleep(300); r.released_a = await page.evaluate(() => W.read('Wheel', 'rotation')); await sleep(400); r.released_b = await page.evaluate(() => W.read('Wheel', 'rotation')); return r; },
  '19': async (page) => { const r = {}; const rd = () => page.evaluate(() => W.read('Magnet', 'translation'));
    await page.mouse.move(400, 300); await sleep(150); await page.mouse.down(); await page.mouse.move(450, 300, { steps: 5 }); await page.mouse.move(500, 300, { steps: 5 }); await sleep(100); r.end_of_drag_1 = await rd(); await page.mouse.up(); await sleep(200);
    await page.mouse.move(500, 300); await sleep(150); await page.mouse.down(); await page.mouse.move(500, 290, { steps: 3 }); await sleep(100); r.start_of_drag_2 = await rd();
    await page.mouse.move(500, 240, { steps: 5 }); await sleep(100); r.end_of_drag_2 = await rd(); await page.mouse.up(); return r; },
};

async function run(browser, file) {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const consoleErrors = [], consoleWarnings = [], other = [];
  page.on('console', m => { const t = m.type(); (t === 'error' ? consoleErrors : t === 'warning' ? consoleWarnings : other).push(m.text().slice(0, 300)); });
  page.on('pageerror', e => consoleErrors.push('pageerror: ' + String(e).slice(0, 300)));
  await page.goto(base + '/author-a/page.html');
  await page.waitForFunction(() => window.X3D && window.W);
  const rec = { file, consoleErrors, consoleWarnings };
  try { rec.engine = await page.evaluate(u => W.load(u), '/author-a/' + file); } catch (e) { rec.loadError = String(e).slice(0, 300); }
  rec.gl = await page.evaluate(() => W.gl());
  await sleep(150);
  const it = intents(file);
  rec.unknown_intent_lines = it.unknown;
  const t0 = Date.now();
  const baseline = {};
  for (const a of it.asserts) { const k = a.def + '.' + a.field; if (!(k in baseline)) baseline[k] = await page.evaluate(([d, f]) => { try { return W.read(d, f); } catch (e) { return String(e); } }, [a.def, a.field]); }
  rec.baseline = baseline;
  const events = [...it.sends.map(s => ({ ...s, kind: 'send' })), ...it.asserts.map(a => ({ ...a, kind: 'assert' }))].sort((x, y) => x.t - y.t);
  rec.sends = []; rec.asserts = [];
  for (const e of events) {
    const wait = t0 + e.t * 1000 - Date.now(); if (wait > 0) await sleep(wait);
    if (e.kind === 'send') {
      const err = await page.evaluate(([d, f, v]) => { try { W.send(d, f, v); return null; } catch (x) { return String(x); } }, [e.def, e.field, e.value]);
      rec.sends.push({ line: e.line, error: err });
    } else {
      const v = await page.evaluate(([d, f]) => { try { return W.read(d, f); } catch (x) { return String(x); } }, [e.def, e.field]);
      const b = baseline[e.def + '.' + e.field]; let holds = false;
      if (Array.isArray(v) && Array.isArray(b)) {
        if (e.op === 'changed') holds = !same(v, b); else if (e.op === 'unchanged') holds = same(v, b);
        else if (e.op === '==') { const x = e.idx === null ? v : [v[e.idx]]; holds = same(x, e.rhs, e.tol); }
        else { const x = v[e.idx === null ? 0 : e.idx], y = e.rhs[0]; holds = e.op === '>' ? x > y : e.op === '<' ? x < y : e.op === '>=' ? x >= y : x <= y; }
      }
      rec.asserts.push({ line: e.line, value: v, holds });
    }
  }
  const id = file.match(/^(fault|twin)-(\d\d)/);
  if (id && PROBES[id[2]]) { try { rec.probe = await PROBES[id[2]](page); } catch (e) { rec.probe = { error: String(e) }; } }
  rec.all_intent_hold = rec.asserts.length ? rec.asserts.every(a => a.holds) : null;
  await page.close();
  return rec;
}

const args = process.argv.slice(2);
const files = args.length ? args : fs.readdirSync(HERE).filter(f => /^(fault|twin|decoy)-\d\d\.x3d$/.test(f)).sort();
const browser = await chromium.launch();
const out = { chromium: browser.version(), results: {} };
for (const f of files) {
  const r = await run(browser, f); out.results[f] = r;
  console.log(f, 'intent:', r.all_intent_hold, 'errors:', r.consoleErrors.length, 'warn:', r.consoleWarnings.length, r.probe ? JSON.stringify(r.probe).slice(0, 260) : '', r.asserts.map(a => (a.holds ? 'ok ' : 'FAIL ') + JSON.stringify(a.value)).join(' | '));
  for (const e of [...r.consoleErrors, ...r.consoleWarnings].slice(0, 3)) console.log('    >', e.slice(0, 200));
  if (r.sends.some(s => s.error)) console.log('    send errors', JSON.stringify(r.sends));
}
await browser.close(); server.close();
if (!args.length) fs.writeFileSync(path.join(HERE, 'witness.json'), JSON.stringify(out, null, 1));
