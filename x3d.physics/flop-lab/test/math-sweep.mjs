// Which Math function disagrees between the two hosts? Sweep 200,000 arguments each and compare a hash of the result bits.
import { chromium } from 'playwright';
import fs from 'fs';
const probe = `() => { const f = new Float64Array(1), u = new Uint32Array(f.buffer); const out = {};
  const fns = { sin: Math.sin, cos: Math.cos, atan2: (x) => Math.atan2(x, 1.37), hypot: (x) => Math.hypot(x, 0.731), sqrt: Math.sqrt, exp: (x) => Math.exp(-x), pow: (x) => Math.pow(10, x), mul: (x) => x * 1.0000001 + x * x };
  for (const [k, fn] of Object.entries(fns)) { let h = 0x811c9dc5; const ex = []; let s = 12345; const N = 200000, per = [];
    for (let i = 0; i < N; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; const x = (s / 4294967296) * 6.5 + (k === 'sqrt' ? 0 : -0.1); f[0] = fn(x); h ^= u[0]; h = Math.imul(h, 16777619); h ^= u[1]; h = Math.imul(h, 16777619); per.push(u[0] & 3); }
    out[k] = (h >>> 0).toString(16); out[k + '_low'] = per.join(''); }
  return out; }`;
const a = eval(probe)();
const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : { channel: 'chrome' }); const page = await browser.newPage(); await page.goto('about:blank');
const b = await page.evaluate(`(${probe})()`); const ua = await page.evaluate(() => navigator.userAgent.match(/Chrome\/[\d.]+/)[0]); await browser.close(); const rec = { node: process.version, v8: process.versions.v8, browser: ua, arguments_each: 200000, range: '-0.1 to 6.4', differing: {} };
for (const k of Object.keys(a)) { if (k.endsWith('_low')) continue; let d = 0; const la = a[k + '_low'], lb = b[k + '_low']; for (let i = 0; i < la.length; i++) if (la[i] !== lb[i]) d++; rec.differing[k] = d; console.log(k.padEnd(6), a[k] === b[k] ? 'identical' : `DIFFERS: ${d} of 200000 results differ in the low bits`); }
fs.writeFileSync(new URL('../receipts/math-sweep.json', import.meta.url), JSON.stringify(rec, null, 1));
console.log('node', process.version, 'v8', process.versions.v8);
