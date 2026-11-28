// Play test, version 1. It loads each scene in X_ITE, plays it in real time, sends the stimuli the intent lines
// ask for (field writes, and now real clicks, drags and key presses), and checks each assertion (fields, and now
// counts, array lengths and pixels). No reader is involved: an assertion holds or it does not.
//
//   node flywheel/intent-1/play.mjs <x_ite dist dir> <sets dir> <out.json> [--intent <dir>] [--only twin,decoy]
//                                   [--match set-a/twin-03]
//
// Intent lines come from <meta name="intent" content="..."/> in each scene, or, with --intent, from text files
// <dir>/set-X/pair-NN.intent (used for fault-NN and twin-NN) and <dir>/set-X/decoy-NN.intent, one line each, so
// that whoever writes the intent never has to touch, or see, the fault. Grammar: INTENT.md beside this file.
// Version 0 (flywheel/court-5/play/play.mjs) is left as it was run in court 5.
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const argv = process.argv.slice(2);
const opt = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
const [xite, sets, outFile] = argv.slice(0, 3).map((p) => path.resolve(p));
const intentDir = opt('--intent') && path.resolve(opt('--intent'));
const only = opt('--only') ? opt('--only').split(',') : ['fault', 'twin', 'decoy'];
const match = opt('--match');
const W = 640, H = 480;
const TYPES = { '.js': 'text/javascript', '.x3d': 'model/x3d+xml', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.wasm': 'application/wasm' };
const PAGE = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0}</style><script src="/kit/x_ite.min.js"></script><x3d-canvas style="display:block;width:${W}px;height:${H}px"></x3d-canvas>`;

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

const N = '(-?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][-+]?\\d+)?)';           // one number
const T = '(?:at load|after\\s+([\\d.]+)s):\\s*';                     // "at load:" is "after 0.3s:"
const TOL = '(?:\\s+tol\\s+([\\d.eE+-]+))?';
const OP = '(>=|<=|>|<|==|!=)';
export function metaLines(text) {
  const head = text.split('<Scene')[0];
  return [...head.matchAll(/<meta\s+name=(["'])intent\1\s+content=(["'])(.*?)\2\s*\/>/g)].map((m) => m[3].replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&'));
}
export function parseIntent(lines) {
  const steps = [], bad = [];
  const t = (x) => (x === undefined ? 0.3 : +x);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    let m;
    if ((m = line.match(/^send\s+([\w-]+)\.(\w+)\s*=\s*(.+?)\s+at\s+([\d.]+)s$/))) steps.push({ kind: 'send', line, def: m[1], field: m[2], value: m[3], t: +m[4] });
    else if ((m = line.match(new RegExp(`^click\\s+${N}\\s+${N}\\s+at\\s+([\\d.]+)s$`)))) steps.push({ kind: 'click', line, x: +m[1], y: +m[2], t: +m[3] });
    else if ((m = line.match(new RegExp(`^drag\\s+${N}\\s+${N}\\s+to\\s+${N}\\s+${N}\\s+at\\s+([\\d.]+)s$`)))) steps.push({ kind: 'drag', line, x: +m[1], y: +m[2], x2: +m[3], y2: +m[4], t: +m[5] });
    else if ((m = line.match(/^key\s+(\w+)\s+at\s+([\d.]+)s$/))) steps.push({ kind: 'key', line, key: m[1], t: +m[2] });
    else if ((m = line.match(new RegExp(`^${T}([\\w-]+)\\.(\\w+)\\s+(changed|unchanged)$`)))) steps.push({ kind: m[4], line, def: m[2], field: m[3], t: t(m[1]) });
    else if ((m = line.match(new RegExp(`^${T}([\\w-]+)\\.(\\w+)\\.length\\s*${OP}\\s*(\\d+)$`)))) steps.push({ kind: 'length', line, def: m[2], field: m[3], op: m[4], number: +m[5], t: t(m[1]) });
    else if ((m = line.match(new RegExp(`^${T}([\\w-]+)\\.(\\w+)(?:\\[(\\d+)\\])?\\s*(>=|<=|>|<)\\s*${N}$`)))) steps.push({ kind: 'compare', line, def: m[2], field: m[3], index: m[4] === undefined ? 0 : +m[4], op: m[5], number: +m[6], t: t(m[1]) });
    else if ((m = line.match(new RegExp(`^${T}count\\((\\w+)\\)\\s*${OP}\\s*(\\d+)$`)))) steps.push({ kind: 'count', line, type: m[2], op: m[3], number: +m[4], t: t(m[1]) });
    else if ((m = line.match(new RegExp(`^${T}pixel\\s+${N}\\s+${N}\\s*(==|!=)\\s*${N}\\s+${N}\\s+${N}${TOL}$`)))) steps.push({ kind: 'pixel', line, x: +m[2], y: +m[3], op: m[4], rgb: [+m[5], +m[6], +m[7]], tol: m[8] ? +m[8] : 0.15, t: t(m[1]) });
    else if ((m = line.match(new RegExp(`^${T}pixel\\s+${N}\\s+${N}\\s+(brighter|darker)\\s+than\\s+pixel\\s+${N}\\s+${N}$`)))) steps.push({ kind: 'brighter', line, x: +m[2], y: +m[3], dir: m[4], x2: +m[5], y2: +m[6], t: t(m[1]) });
    else if ((m = line.match(new RegExp(`^${T}pixels\\s*(==|!=)\\s*${N}\\s+${N}\\s+${N}${TOL}\\s+cover\\s*(>=|<=|>|<)\\s*${N}$`)))) steps.push({ kind: 'cover', line, op: m[2], rgb: [+m[3], +m[4], +m[5]], tol: m[6] ? +m[6] : 0.15, cmp: m[7], number: +m[8], t: t(m[1]) });
    else if ((m = line.match(new RegExp(`^${T}([\\w-]+)\\.(\\w+)\\s*(==|!=)\\s*(.+?)${TOL}$`)))) steps.push({ kind: 'equals', line, def: m[2], field: m[3], op: m[4], value: m[5], tol: m[6] ? +m[6] : 0.001, t: t(m[1]) });
    else bad.push(line);
  }
  const first = (s) => ['send', 'click', 'drag', 'key'].includes(s.kind) ? -1 : 1;
  return { steps: steps.sort((a, b) => a.t - b.t || first(a) - first(b)), bad, lines: lines.length };
}

// Every number in a printed field value, whatever brackets, commas or line breaks the engine prints around them.
const nums = (s) => (String(s).match(/-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?|NaN|-?Infinity/g) || []).map(Number);
const numeric = (s) => /^[\s\d.eE+\-,\[\]]*$/.test(String(s)) && nums(s).length > 0;
const cmp = (op, a, b) => ({ '>': a > b, '<': a < b, '>=': a >= b, '<=': a <= b, '==': a === b, '!=': a !== b }[op]);
const near = (p, rgb, tol) => p.every((v, i) => Math.abs(v - rgb[i]) <= tol);
const lum = (p) => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
function judge(step, now, start, shot) {
  if (step.kind === 'pixel') { const p = shot.at(step.x, step.y); return { seen: p.map((v) => +v.toFixed(3)).join(' '), holds: near(p, step.rgb, step.tol) === (step.op === '==') }; }
  if (step.kind === 'brighter') { const a = lum(shot.at(step.x, step.y)), b = lum(shot.at(step.x2, step.y2)); return { seen: `${a.toFixed(3)} against ${b.toFixed(3)}`, holds: step.dir === 'brighter' ? a > b + 0.02 : a < b - 0.02 }; }
  if (step.kind === 'cover') { const f = shot.cover(step.rgb, step.tol, step.op === '=='); return { seen: f.toFixed(4), holds: cmp(step.cmp, f, step.number) }; }
  if (now === null) return { holds: false, why: 'no such node or field' };
  if (step.kind === 'count') return { holds: cmp(step.op, +now, step.number) };
  if (step.kind === 'length') return { holds: cmp(step.op, +now, step.number) };
  if (step.kind === 'changed' || step.kind === 'unchanged') {
    const a = nums(start), b = nums(now);
    const same = numeric(start) && numeric(now) ? a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) <= 1e-6) : String(start) === String(now);
    return { holds: step.kind === 'changed' ? !same : same };
  }
  if (step.kind === 'compare') { const x = nums(now)[step.index]; return { holds: x !== undefined && cmp(step.op, x, step.number) }; }
  const want = nums(step.value), got = nums(now);
  let same;
  if (!numeric(step.value)) {
    const strip = (s) => String(s).trim().replace(/^\[|\]$/g, '').trim().split(/\s*,\s*|\s+(?=")/).map((x) => x.trim().replace(/^"|"$/g, '')).join('\u0001');
    same = strip(now) === strip(step.value) || String(now).trim().toLowerCase() === step.value.trim().toLowerCase();
  } else same = want.length === got.length && want.every((x, i) => Math.abs(x - got[i]) <= step.tol);
  return { holds: same === (step.op === '==') };
}

const browser = await chromium.launch();
const out = { engine: null, chromium: browser.version(), viewport: [W, H], play_version: 1, intent_from: intentDir ? 'files' : 'meta', files: {} };
const read = (page, s) => page.evaluate(([kind, a, b]) => {
  try {
    const scene = X3D.getBrowser().currentScene;
    if (kind === 'count') {
      let n = 0; const seen = new Set();
      const walk = (node) => {
        if (!node) return; let id = node; try { id = node.getValue() || node; } catch (e) {} if (seen.has(id)) return; seen.add(id);
        let type; try { type = node.getNodeTypeName(); } catch (e) { return; }
        if (type === a) n += 1;
        let defs; try { defs = node.getFieldDefinitions(); } catch (e) { return; }
        for (const d of defs) {
          let v; try { v = node[d.name]; } catch (e) { continue; }
          if (d.dataType === X3D.X3DConstants.SFNode) walk(v);
          else if (d.dataType === X3D.X3DConstants.MFNode && v) for (let i = 0; i < v.length; i += 1) walk(v[i]);
        }
      };
      for (let i = 0; i < scene.rootNodes.length; i += 1) walk(scene.rootNodes[i]);
      return String(n);
    }
    const v = scene.getNamedNode(a)[b];
    if (v === undefined) return null;
    if (kind === 'length') return v === null ? '0' : String(v.length);
    return v === null ? 'NULL' : String(v);
  } catch (e) { return null; }
}, [s.kind, s.kind === 'count' ? s.type : s.def, s.field]);

async function shoot(page) {
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: W, height: H } });
  const data = await page.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    return Array.from(g.getImageData(0, 0, c.width, c.height).data);
  }, png.toString('base64'));
  const px = (i) => [data[i] / 255, data[i + 1] / 255, data[i + 2] / 255];
  return {
    // the mean of a 5 by 5 patch, so that one aliased edge pixel does not decide an assertion
    at: (x, y) => { const cx = Math.min(W - 3, Math.max(2, Math.round(x * (W - 1)))), cy = Math.min(H - 3, Math.max(2, Math.round(y * (H - 1)))); const s = [0, 0, 0]; for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) px(((cy + dy) * W + cx + dx) * 4).forEach((v, i) => { s[i] += v / 25; }); return s; },
    cover: (rgb, tol, equal) => { let n = 0; for (let i = 0; i < W * H; i += 1) if (near(px(i * 4), rgb, tol) === equal) n += 1; return n / (W * H); },
  };
}

const KEYS = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', enter: 'Enter', space: 'Space', home: 'Home', end: 'End', pageup: 'PageUp', pagedown: 'PageDown' };
for (const folder of fs.readdirSync(sets).filter((d) => d.startsWith('set-')).sort()) {
  for (const name of fs.readdirSync(path.join(sets, folder)).filter((f) => /^(fault|twin|decoy)-.*\.x3d$/.test(f)).sort()) {
    const role = name.split('-')[0], num = name.match(/-(\d+)/)[1];
    if (!only.includes(role) || (match && !`${folder}/${name}`.includes(match))) continue;
    const key = `${folder.replace('set-', '')}/${name}`;
    let lines;
    if (intentDir) {
      const f = path.join(intentDir, folder, `${role === 'decoy' ? 'decoy' : 'pair'}-${num}.intent`);
      lines = fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#')) : [];
    } else lines = metaLines(fs.readFileSync(path.join(sets, folder, name), 'utf8'));
    const intent = parseIntent(lines);
    const rec = { intent_lines: intent.lines, not_understood: intent.bad, assertions: [], console_errors: 0 };
    out.files[key] = rec;
    const acts = ['send', 'click', 'drag', 'key'];
    if (!intent.steps.some((s) => !acts.includes(s.kind))) { rec.result = 'no assertion'; continue; }
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    page.on('console', (m) => { if (m.type() === 'error') rec.console_errors += 1; });
    try {
      await page.goto(`${base}/page.html`);
      await page.waitForFunction(() => window.X3D && X3D.getBrowser());
      out.engine = out.engine || await page.evaluate(() => `X_ITE ${X3D.getBrowser().version}`);
      await page.evaluate((u) => X3D.getBrowser().loadURL(new X3D.MFString(u)), `${base}/sets/${folder}/${name}`);
      const t0 = Date.now(), start = {};
      for (const s of intent.steps) if (s.kind === 'changed' || s.kind === 'unchanged') start[`${s.def}.${s.field}`] ??= await read(page, s);
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
        } else if (s.kind === 'click') {
          await page.mouse.move(s.x * W, s.y * H); await page.waitForTimeout(60);
          await page.mouse.down(); await page.waitForTimeout(80); await page.mouse.up(); rec.sent = (rec.sent || 0) + 1;
        } else if (s.kind === 'drag') {
          await page.mouse.move(s.x * W, s.y * H); await page.waitForTimeout(60); await page.mouse.down();
          for (let i = 1; i <= 8; i += 1) { await page.mouse.move((s.x + (s.x2 - s.x) * i / 8) * W, (s.y + (s.y2 - s.y) * i / 8) * H); await page.waitForTimeout(30); }
          await page.mouse.up(); rec.sent = (rec.sent || 0) + 1;
        } else if (s.kind === 'key') {
          await page.focus('x3d-canvas').catch(() => {});
          await page.keyboard.press(KEYS[s.key.toLowerCase()] || s.key); rec.sent = (rec.sent || 0) + 1;
        } else {
          const pixels = ['pixel', 'brighter', 'cover'].includes(s.kind);
          const now = pixels ? undefined : await read(page, s);
          const j = judge(s, now, start[`${s.def}.${s.field}`], pixels ? await shoot(page) : null);
          rec.assertions.push({ line: s.line, ...(pixels ? {} : { at_start: start[`${s.def}.${s.field}`], seen: now }), ...j });
        }
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
console.log(outFile, out.engine, n.length, 'files;', n.filter((r) => r.result === 'all hold').length, 'all hold,', n.filter((r) => r.result === 'fails').length, 'fail,', n.filter((r) => r.result === 'no assertion').length, 'with no assertion,', n.filter((r) => r.result === 'did not load').length, 'did not load;', n.reduce((a, r) => a + r.not_understood.length, 0), 'lines not understood');
