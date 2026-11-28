// Headless play test for court 5's intent arm. It loads each scene in X_ITE, plays it in real time, sends the
// stimuli the intent lines ask for, and checks each assertion. No reader is involved: an assertion holds or it
// does not.
//
//   node flywheel/court-5/play/play.mjs <x_ite dist dir> <sets dir> <out.json>
//
// <x_ite dist dir> holds x_ite.min.js and assets/ (npm x_ite). Playwright must be installed; set NODE_PATH if it
// is installed globally.
// Grammar, one intent line per <meta name="intent" content="..."/> (intent/INTENT.md):
//   send DEF.field = VALUE at 0.2s            VALUE is a number, true, false, now, or a quoted string
//   after 1.5s: DEF.field changed             differs from its value just after loading
//   after 1.5s: DEF.field unchanged
//   after 1.5s: DEF.field == 0 1 0 1.57       every number within 0.001, or tol 0.05 at the end of the line
//   after 1.5s: DEF.field[3] > 1.4            one component, with > < >= <=
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

// require, not import, so that NODE_PATH can point at a global Playwright
const { chromium } = createRequire(import.meta.url)('playwright');

const [xite, sets, outFile] = process.argv.slice(2).map((p) => path.resolve(p));
const TYPES = { '.js': 'text/javascript', '.x3d': 'model/x3d+xml', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.wasm': 'application/wasm' };
const PAGE = '<!doctype html><meta charset="utf-8"><script src="/kit/x_ite.min.js"></script><x3d-canvas style="width:320px;height:240px"></x3d-canvas>';

const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/page.html') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE); }
  const root = u.startsWith('/kit/') ? xite : u.startsWith('/sets/') ? sets : null;
  const file = root && path.join(root, u.replace(/^\/(kit|sets)\//, ''));
  if (!file || !file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

export function parseIntent(text) {
  const head = text.split('<Scene')[0];
  const lines = [...head.matchAll(/<meta\s+name=(["'])intent\1\s+content=(["'])(.*?)\2\s*\/>/g)].map((m) => m[3].replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
  const steps = [], bad = [];
  for (const line of lines) {
    let m;
    if ((m = line.match(/^send\s+([\w-]+)\.(\w+)\s*=\s*(.+?)\s+at\s+([\d.]+)s$/))) steps.push({ kind: 'send', line, def: m[1], field: m[2], value: m[3], t: +m[4] });
    else if ((m = line.match(/^after\s+([\d.]+)s:\s*([\w-]+)\.(\w+)\s+(changed|unchanged)$/))) steps.push({ kind: m[4], line, def: m[2], field: m[3], t: +m[1] });
    else if ((m = line.match(/^after\s+([\d.]+)s:\s*([\w-]+)\.(\w+)\[(\d+)\]\s*(>=|<=|>|<)\s*(-?[\d.eE+-]+)$/))) steps.push({ kind: 'compare', line, def: m[2], field: m[3], index: +m[4], op: m[5], number: +m[6], t: +m[1] });
    else if ((m = line.match(/^after\s+([\d.]+)s:\s*([\w-]+)\.(\w+)\s*==\s*(.+?)(?:\s+tol\s+([\d.eE+-]+))?$/))) steps.push({ kind: 'equals', line, def: m[2], field: m[3], value: m[4], tol: m[5] ? +m[5] : 0.001, t: +m[1] });
    else bad.push(line);
  }
  return { steps: steps.sort((a, b) => a.t - b.t || (a.kind === 'send' ? -1 : 1)), bad, lines: lines.length };
}

const nums = (s) => String(s).trim().split(/[\s,]+/).map(Number);
function judge(step, now, start) {
  if (now === null) return { holds: false, why: 'no such node or field' };
  if (step.kind === 'changed' || step.kind === 'unchanged') {
    const a = nums(start), b = nums(now);
    const same = a.length === b.length && (a.some(Number.isNaN) ? String(start) === String(now) : a.every((x, i) => Math.abs(x - b[i]) <= 1e-6));
    return { holds: step.kind === 'changed' ? !same : same };
  }
  if (step.kind === 'compare') {
    const x = nums(now)[step.index];
    return { holds: { '>': x > step.number, '<': x < step.number, '>=': x >= step.number, '<=': x <= step.number }[step.op] };
  }
  const want = nums(step.value), got = nums(now);
  if (want.some(Number.isNaN)) return { holds: String(now).trim() === step.value.replace(/^"|"$/g, '') };
  return { holds: want.length === got.length && want.every((x, i) => Math.abs(x - got[i]) <= step.tol) };
}

const browser = await chromium.launch();
const out = { engine: null, chromium: browser.version(), files: {} };
const read = (page, def, field) => page.evaluate(([d, f]) => {
  try { const v = X3D.getBrowser().currentScene.getNamedNode(d)[f]; return v === undefined ? null : String(v); } catch (e) { return null; }
}, [def, field]);

for (const folder of fs.readdirSync(sets).filter((d) => d.startsWith('set-')).sort()) {
  for (const name of fs.readdirSync(path.join(sets, folder)).filter((f) => /^(fault|twin|decoy)-.*\.x3d$/.test(f)).sort()) {
    const key = `${folder.replace('set-', '')}/${name}`;
    const intent = parseIntent(fs.readFileSync(path.join(sets, folder, name), 'utf8'));
    const rec = { intent_lines: intent.lines, not_understood: intent.bad, assertions: [], console_errors: 0 };
    out.files[key] = rec;
    if (!intent.steps.some((s) => s.kind !== 'send')) { rec.result = 'no assertion'; continue; }
    const page = await browser.newPage();
    page.on('console', (m) => { if (m.type() === 'error') rec.console_errors += 1; });
    try {
      await page.goto(`${base}/page.html`);
      await page.waitForFunction(() => window.X3D && X3D.getBrowser());
      out.engine = out.engine || await page.evaluate(() => `X_ITE ${X3D.getBrowser().version}`);
      await page.evaluate((u) => X3D.getBrowser().loadURL(new X3D.MFString(u)), `${base}/sets/${folder}/${name}`);
      const t0 = Date.now(), start = {};
      for (const s of intent.steps) if (s.kind !== 'send') start[`${s.def}.${s.field}`] ??= await read(page, s.def, s.field);
      for (const s of intent.steps) {
        await page.waitForTimeout(Math.max(0, s.t * 1000 - (Date.now() - t0)));
        if (s.kind === 'send') {
          rec.sent = (rec.sent || 0) + await page.evaluate(([d, f, v]) => {
            try {
              const node = X3D.getBrowser().currentScene.getNamedNode(d);
              node[f] = v === 'now' ? Date.now() / 1000 : v === 'true' ? true : v === 'false' ? false : /^".*"$/.test(v) ? v.slice(1, -1) : Number(v);
              return 1;
            } catch (e) { return 0; }
          }, [s.def, s.field, s.value]);
          continue;
        }
        const now = await read(page, s.def, s.field);
        rec.assertions.push({ line: s.line, at_start: start[`${s.def}.${s.field}`], seen: now, ...judge(s, now, start[`${s.def}.${s.field}`]) });
      }
      rec.result = rec.assertions.every((a) => a.holds) ? 'all hold' : 'fails';
    } catch (e) {
      rec.result = 'did not load'; rec.error = String(e).slice(0, 300);
    }
    await page.close();
  }
}
await browser.close();
server.close();
fs.writeFileSync(outFile, JSON.stringify(out, null, 1) + '\n');
const n = Object.values(out.files);
console.log(outFile, out.engine, n.length, 'files;', n.filter((r) => r.result === 'all hold').length, 'all hold,', n.filter((r) => r.result === 'fails').length, 'fail,', n.filter((r) => r.result === 'no assertion').length, 'with no assertion,', n.filter((r) => r.result === 'did not load').length, 'did not load');
