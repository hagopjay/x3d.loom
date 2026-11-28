#!/usr/bin/env node
// Witness harness: loads every scene in X_ITE 16.8.0 (headless Chromium via Playwright),
// samples the fields each description is about, and writes witness.json.
// Usage: node witness.js [name-filter-regex]
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const HERE = __dirname;
const KIT = path.join(HERE, '..', 'kit');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.x3d': 'model/x3d+xml',
   '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };

function serve() {
   const server = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      let file;
      if (url.startsWith('/kit/')) file = path.join(KIT, path.normalize(url.slice(5)));
      else if (url.startsWith('/a/')) file = path.join(HERE, path.normalize(url.slice(3)));
      else if (url === '/page') {
         res.writeHead(200, { 'content-type': 'text/html' });
         res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><script src="/kit/x_ite/x_ite.min.js"></script>
<style>html,body{margin:0;padding:0} x3d-canvas{display:block;width:600px;height:400px}</style></head>
<body><x3d-canvas splashScreen="false" notifications="false" timings="false" contextMenu="false"></x3d-canvas></body></html>`);
         return;
      } else { res.writeHead(404); res.end(); return; }
      fs.readFile(file, (err, data) => {
         if (err) { res.writeHead(404); res.end(); return; }
         res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
         res.end(data);
      });
   });
   return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const CX = 300, CY = 200; // canvas centre in page pixels

// in-page probe: {key: [node, field, component?]} -> {key: value|null}
async function probe(page, probes) {
   return page.evaluate(probes => {
      const scene = document.querySelector('x3d-canvas').browser.currentScene;
      const out = {};
      for (const [key, [node, field, comp]] of Object.entries(probes)) {
         try {
            let v = scene.getNamedNode(node)[field];
            if (comp !== undefined) v = v[comp];
            out[key] = (typeof v === 'object' && v !== null) ? String(v) : v;
         } catch (e) { out[key] = null; }
      }
      return out;
   }, probes);
}

async function sampleFor(page, probes, ms, every = 50) {
   const samples = [];
   const t0 = Date.now();
   while (Date.now() - t0 < ms) {
      const s = await probe(page, probes);
      s.t = (Date.now() - t0) / 1000;
      samples.push(s);
      await sleep(every);
   }
   return samples;
}

async function click(page, x = CX, y = CY) {
   await page.mouse.move(x - 3, y - 3);
   await sleep(150);
   await page.mouse.move(x, y);
   await sleep(200);
   await page.mouse.down();
   await sleep(200);
   await page.mouse.up();
   await sleep(200);
}

const col = (samples, key) => samples.map(s => s[key]).filter(v => v !== null && v !== undefined);
const max = a => a.length ? Math.max(...a) : null;
const min = a => a.length ? Math.min(...a) : null;
const range = a => a.length ? Math.max(...a) - Math.min(...a) : 0;
const r3 = v => v === null ? null : Math.round(v * 1000) / 1000;

// Each plan: run(page) -> samples ; verdict(samples) -> {intended, note}
const timed = (probes, ms, verdict) => ({ run: page => sampleFor(page, probes, ms), verdict });

const PLANS = {
   'pair-01': timed({ sx: ['PulsingBall', 'scale', 'x'] }, 2600, s => {
      const m = max(col(s, 'sx')); return { intended: m > 1.3, note: `PulsingBall.scale.x max ${r3(m)} over 2.6 s` };
   }),
   'pair-02': timed({ sy: ['Crate', 'scale', 'y'], by: ['CrateBox', 'size', 'y'] }, 3200, s => {
      const m = Math.max(max(col(s, 'sy')), max(col(s, 'by')));
      return { intended: m > 2.5, note: `max of Crate.scale.y / CrateBox.size.y ${r3(m)} over 3.2 s` };
   }),
   'pair-03': timed({ a: ['Blades', 'rotation', 'angle'], act: ['BladeClock', 'isActive'] }, 2500, s => {
      const m = max(col(s, 'a')); const act = col(s, 'act').some(Boolean);
      return { intended: m > 1 && act, note: `Blades.rotation.angle max ${r3(m)} over 2.5 s, clock isActive seen ${act}` };
   }),
   'pair-04': timed({ r: ['BeaconMaterial', 'emissiveColor', 'r'] }, 2000, s => {
      const m = range(col(s, 'r')); return { intended: m > 0.6, note: `BeaconMaterial.emissiveColor.r swing (max minus min) ${r3(m)} over 2 s` };
   }),
   'pair-05': timed({ f: ['LiftClock', 'fraction_changed'], y: ['Platform', 'translation', 'y'] }, 4300, s => {
      const mid = s.filter(x => x.f > 0.43 && x.f < 0.57).map(x => x.y);
      return { intended: mid.length > 0 && min(mid) > 2.9, note: `Platform.translation.y while clock fraction in 0.43..0.57: min ${r3(min(mid))} max ${r3(max(mid))} (${mid.length} samples)` };
   }),
   'pair-06': timed({ a: ['Globe', 'rotation', 'angle'] }, 2500, s => {
      const a = col(s, 'a'); const m = max(a.map(v => Math.min(v, 2 * Math.PI - v)));
      return { intended: m > 1, note: `Globe.rotation angle (folded to 0..pi) max ${r3(m)} over 2.5 s` };
   }),
   'pair-07': timed({ l: ['LeftLantern', 'translation', 'y'], r: ['RightLantern', 'translation', 'y'] }, 3200, s => {
      const d = max(s.map(x => Math.abs(x.l - x.r)));
      return { intended: d > 0.2 && range(col(s, 'l')) > 0.5 && range(col(s, 'r')) > 0.5,
         note: `max |left.y - right.y| ${r3(d)}; left y range ${r3(range(col(s, 'l')))}, right y range ${r3(range(col(s, 'r')))} over 3.2 s` };
   }),
   'pair-08': timed({ x: ['Door', 'translation', 'x'] }, 5300, s => {
      const m = max(col(s, 'x')); return { intended: m > 1.5, note: `Door.translation.x max ${r3(m)} over 5.3 s` };
   }),
   'pair-09': timed({ r: ['PanelMaterial', 'diffuseColor', 'r'], g: ['PanelMaterial', 'diffuseColor', 'g'] }, 3000, s => {
      const m = max(col(s, 'r')); return { intended: m > 0.9, note: `PanelMaterial.diffuseColor.r max ${r3(m)} over 3 s` };
   }),
   'pair-10': timed({ a: ['BridgeDeck', 'rotation', 'angle'] }, 6300, s => {
      const m = max(col(s, 'a')); return { intended: m > 0.9, note: `BridgeDeck.rotation.angle max ${r3(m)} over 6.3 s` };
   }),
   'pair-11': timed({ w: ['Frames', 'whichChoice'] }, 3600, s => {
      const seen = [...new Set(col(s, 'w'))].sort();
      return { intended: seen.join() === '0,1,2', note: `Frames.whichChoice values seen over 3.6 s: ${seen.join(' ')}` };
   }),
   'pair-12': {
      run: async page => { await click(page); return sampleFor(page, { r: ['BulbMaterial', 'emissiveColor', 'r'] }, 1000); },
      verdict: s => { const m = max(col(s, 'r')); return { intended: m > 0.9, note: `after a real click on the button at the canvas centre, BulbMaterial.emissiveColor.r max ${r3(m)}` }; },
   },
   'pair-13': {
      run: async page => {
         await page.mouse.move(CX + 38, CY); await sleep(200);
         await page.mouse.move(CX + 40, CY); await sleep(200);
         await page.mouse.down(); await sleep(200);
         await page.mouse.move(CX + 41, CY); await sleep(100);
         await page.mouse.move(CX + 42, CY); await sleep(200);
         const s = await sampleFor(page, { x: ['Puck', 'translation', 'x'] }, 300);
         await page.mouse.up(); await sleep(100);
         return s;
      },
      verdict: s => { const m = max(col(s, 'x').map(Math.abs)); return { intended: m !== null && m > 0.005 && m < 0.2, note: `grabbed 40 px right of the puck centre and dragged 2 px: |Puck.translation.x| ${r3(m)} (2 px is about 0.04 m, 40 px about 0.83 m)` }; },
   },
   'pair-14': timed({ x: ['Gate', 'translation', 'x'], act: ['GateZone', 'isActive'] }, 3000, s => {
      const m = max(col(s, 'x')); return { intended: m > 1.5, note: `Gate.translation.x max ${r3(m)} over 3 s; zone isActive seen ${col(s, 'act').some(Boolean)}` };
   }),
   'pair-15': {
      run: async page => {
         await click(page, CX, CY + 150);
         await page.keyboard.press('ArrowRight'); await sleep(200);
         await page.keyboard.press('ArrowRight'); await sleep(200);
         const a = await sampleFor(page, { x: ['Cart', 'translation', 'x'] }, 200);
         await page.keyboard.press('ArrowLeft'); await sleep(200);
         const b = await sampleFor(page, { x2: ['Cart', 'translation', 'x'] }, 200);
         return a.concat(b);
      },
      verdict: s => { const a = max(col(s, 'x')), b = min(col(s, 'x2')); return { intended: a === 2 && b === 1, note: `real key presses: after two right arrows Cart.translation.x = ${a}; after one left arrow = ${b}` }; },
   },
   'pair-16': {
      run: async page => { await click(page); return sampleFor(page, { r: ['TileMaterial', 'diffuseColor', 'r'], b: ['TileMaterial', 'diffuseColor', 'b'] }, 400); },
      verdict: s => { const r = max(col(s, 'r')), b = min(col(s, 'b')); return { intended: r === 1 && b === 0, note: `after a real click on the tile, TileMaterial.diffuseColor r ${r3(r)} b ${r3(b)}` }; },
   },
   'pair-17': {
      run: async page => {
         const out = [];
         await click(page); out.push(...await sampleFor(page, { on1: ['Lamp', 'on'] }, 200));
         await click(page); out.push(...await sampleFor(page, { on2: ['Lamp', 'on'] }, 200));
         await click(page); out.push(...await sampleFor(page, { on3: ['Lamp', 'on'] }, 200));
         return out;
      },
      verdict: s => { const a = col(s, 'on1').pop(), b = col(s, 'on2').pop(), c = col(s, 'on3').pop(); return { intended: a === true && b === false && c === true, note: `Lamp.on after real clicks 1, 2, 3: ${a}, ${b}, ${c}` }; },
   },
   'pair-18': timed({ px: ['BeePath', 'translation', 'x'], py: ['BeePath', 'translation', 'y'], bx: ['Bee', 'translation', 'x'], by: ['Bee', 'translation', 'y'] }, 3000, s => {
      const xs = s.map(v => v.px + v.bx), ys = s.map(v => v.py + v.by);
      return { intended: range(xs) > 3 && range(ys) > 0.3, note: `bee position (BeePath + Bee translation) over 3 s: x range ${r3(range(xs))}, y range ${r3(range(ys))}` };
   }),
   'pair-19': timed({ x: ['Marker', 'translation', 'x'] }, 4400, s => {
      const xs = col(s, 'x'); const mid = xs.filter(v => Math.abs(v) < 1.7).length;
      return { intended: mid >= 3 && max(xs) > 1.9, note: `Marker.translation.x over 4.4 s: ${mid} samples strictly between the posts (|x| < 1.7), max ${r3(max(xs))}` };
   }),
   'pair-20': {
      run: async page => { await click(page); await sleep(400); return sampleFor(page, { bound: ['CloseUp', 'isBound'], over: ['Overview', 'isBound'] }, 300); },
      verdict: s => { const b = col(s, 'bound').pop(); return { intended: b === true, note: `0.6 s after a real click and release on the statue, CloseUp.isBound = ${b}, Overview.isBound = ${col(s, 'over').pop()}` }; },
   },
   'decoy-01': {
      run: async page => {
         const out = [];
         await click(page); out.push(...await sampleFor(page, { on1: ['Lamp', 'on'] }, 200));
         await click(page); out.push(...await sampleFor(page, { on2: ['Lamp', 'on'] }, 200));
         await click(page); out.push(...await sampleFor(page, { on3: ['Lamp', 'on'] }, 200));
         return out;
      },
      verdict: s => { const a = col(s, 'on1').pop(), b = col(s, 'on2').pop(), c = col(s, 'on3').pop(); return { intended: a === true && b === false && c === true, note: `Lamp.on after real clicks 1, 2, 3: ${a}, ${b}, ${c}` }; },
   },
   'decoy-02': timed({ a: ['Globe', 'rotation', 'angle'], y: ['Globe', 'rotation', 'y'], f: ['SpinClock', 'fraction_changed'] }, 4200, s => {
      // signed turn about +Y should track 2*pi*fraction
      let worst = 0;
      for (const v of s) {
         if (v.a === null || v.f === null) continue;
         let turn = (v.y < 0 ? -v.a : v.a); turn = ((turn % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
         let want = 2 * Math.PI * v.f; let d = Math.abs(turn - want); d = Math.min(d, 2 * Math.PI - d);
         worst = Math.max(worst, d);
      }
      const m = max(col(s, 'a').map(v => Math.min(v, 2 * Math.PI - v)));
      return { intended: m > 2.8 && worst < 0.35, note: `Globe turn about +Y tracks 2*pi*fraction (worst deviation ${r3(worst)} rad, sampling skew included); folded angle max ${r3(m)} over 4.2 s` };
   }),
   'decoy-03': timed({ y: ['Buoy', 'translation', 'y'], act: ['BobClock', 'isActive'] }, 3400, s => {
      const m = max(col(s, 'y')); const last = s.slice(-10).map(v => v.act).every(Boolean);
      return { intended: m > 0.9 && last, note: `Buoy.translation.y max ${r3(m)} over 3.4 s; clock still active at the end: ${last}` };
   }),
   'decoy-04': timed({ x: ['Slider', 'translation', 'x'] }, 4200, s => {
      const xs = col(s, 'x'); return { intended: max(xs) > 1.8 && min(xs) < -1.8, note: `Slider.translation.x min ${r3(min(xs))} max ${r3(max(xs))} over 4.2 s` };
   }),
   'decoy-05': timed({ l: ['Leader', 'translation', 'x'], c: ['Copy', 'translation', 'x'] }, 2600, s => {
      const ls = col(s, 'l'); const seen = [...new Set(ls.map(v => r3(v)))].sort((a, b) => a - b);
      const same = s.every(v => v.l === v.c);
      return { intended: seen.join() === '-1.5,1.5' && same, note: `Leader.translation.x values seen: ${seen.join(' ')}; Copy.translation.x equal to it in every sample: ${same}` };
   }),
};

function planFor(name) {
   const m = name.match(/^(fault|twin|decoy)-(\d\d)\.x3d$/);
   return m[1] === 'decoy' ? PLANS[`decoy-${m[2]}`] : PLANS[`pair-${m[2]}`];
}

async function runOne(browser, base, name) {
   const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
   const page = await context.newPage();
   const consoleLog = [];
   page.on('console', m => consoleLog.push({ type: m.type(), text: m.text().slice(0, 400) }));
   page.on('pageerror', e => consoleLog.push({ type: 'pageerror', text: String(e).slice(0, 400) }));
   const result = { file: name };
   try {
      await page.goto(`${base}/page`);
      await page.waitForFunction(() => window.X3D && document.querySelector('x3d-canvas') && document.querySelector('x3d-canvas').browser);
      result.load = await page.evaluate(async url => {
         const browser = document.querySelector('x3d-canvas').browser;
         try { await browser.loadURL(new X3D.MFString(url)); return 'ok'; }
         catch (e) { return 'loadURL rejected: ' + String(e).slice(0, 300); }
      }, `${base}/a/${name}`);
      await sleep(300);
      const plan = planFor(name);
      result.samples = await plan.run(page);
      Object.assign(result, plan.verdict(result.samples));
   } catch (e) {
      result.harness_error = String(e).slice(0, 400);
      result.intended = false;
   }
   result.console = consoleLog;
   result.console_errors = consoleLog.filter(m => m.type === 'error' || m.type === 'pageerror').length;
   await context.close();
   return result;
}

(async () => {
   const filter = new RegExp(process.argv[2] || '.');
   const names = fs.readdirSync(HERE).filter(f => /^(fault|twin|decoy)-\d\d\.x3d$/.test(f) && filter.test(f)).sort();
   const server = await serve();
   const base = `http://127.0.0.1:${server.address().port}`;
   const browser = await chromium.launch();
   const meta = await (async () => {
      const page = await browser.newPage();
      await page.goto(`${base}/page`);
      await page.waitForFunction(() => window.X3D && document.querySelector('x3d-canvas') && document.querySelector('x3d-canvas').browser);
      const m = await page.evaluate(() => {
         const b = document.querySelector('x3d-canvas').browser;
         const c = document.createElement('canvas'); const gl = c.getContext('webgl2');
         const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
         return { x_ite: b.version, renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : (gl ? gl.getParameter(gl.RENDERER) : 'no webgl2') };
      });
      await page.close();
      return m;
   })();
   meta.chromium = browser.version();
   meta.playwright = require('playwright/package.json').version;
   meta.node = process.version;
   const results = {};
   const queue = names.slice();
   const CONC = Number(process.env.CONC || 3);
   await Promise.all(Array.from({ length: CONC }, async () => {
      while (queue.length) {
         const name = queue.shift();
         const r = await runOne(browser, base, name);
         results[name] = r;
         console.log(name.padEnd(14), String(r.intended).padEnd(6), `err=${r.console_errors}`, r.load, '|', r.note || r.harness_error);
         for (const m of r.console) if (m.type !== 'log' && m.type !== 'info') console.log('     ', m.type, m.text.replace(/\s+/g, ' ').slice(0, 220));
      }
   }));
   await browser.close();
   server.close();
   const out = { meta, results: Object.fromEntries(Object.keys(results).sort().map(k => [k, results[k]])) };
   const outFile = process.argv[2] ? path.join(HERE, 'witness.partial.json') : path.join(HERE, 'witness.json');
   fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
   console.log(JSON.stringify(meta));
})();
