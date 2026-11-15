// node tools/export-demo-data.js OUTDIR -> data for the browser demo: the Theatre state, and what @theatre/core evaluates it to (240 Hz), so the page needs no Theatre code.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { fromTheatre, restFromState } from '../src/theatre.js';
const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), out = process.argv[2] || path.join(HERE, 'demo-data'); fs.mkdirSync(out, { recursive: true });
const state = JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures', 'theatre-box.state.json'), 'utf8'));
const defaults = { Box: { scale: { x: 1, y: 1, z: 1 } }, BoxMat: { diffuseColor: { r: 0.9, g: 0.3, b: 0.1 } } };
const made = await fromTheatre(state, { name: 'theatre_box', defaults }), dur = made.timeline.duration, HZ = 240, n = Math.round(dur * HZ);
const paths = []; const rest = restFromState(state.sheetsById.Sheet1);   // list of [def, field, comp]
for (const d of Object.keys(rest)) for (const f of Object.keys(rest[d])) { const v = rest[d][f]; if (typeof v === 'number') paths.push([d, f, null]); else for (const c of Object.keys(v)) paths.push([d, f, c]); }
const get = (s, [d, f, c]) => (c ? s[d][f][c] : s[d][f]);
const samples = paths.map(() => new Array(n + 1)); for (let i = 0; i <= n; i++) { const s = made.oracle(i / HZ); paths.forEach((p, k) => { samples[k][i] = +get(s, p).toPrecision(9); }); }
// error of the page's linear resampling of those 240 Hz samples against Theatre itself, at off-grid times
let worst = 0; for (let j = 0; j < 997; j++) { const t = dur * (j + 0.31) / 997, i = Math.min(n - 1, Math.floor(t * HZ)), u = t * HZ - i, s = made.oracle(t); paths.forEach((p, k) => { worst = Math.max(worst, Math.abs(samples[k][i] * (1 - u) + samples[k][i + 1] * u - get(s, p))); }); }
const authored = {}; for (const [obj, o] of Object.entries(state.sheetsById.Sheet1.sequence.tracksByObject)) for (const [pp, tid] of Object.entries(o.trackIdByPropPath)) authored[obj + '.' + JSON.parse(pp).join('.')] = o.trackData[tid].keyframes.map((k) => ({ t: k.position, v: k.value, handles: k.handles }));
fs.writeFileSync(path.join(out, 'theatre-box.oracle.json'), JSON.stringify({ tool: '@theatre/core 0.7.2', hz: HZ, duration: dur, paths, samples, authored, rest, defaults, resampleMaxErr: +worst.toPrecision(3), checkTimes: 997 }));
console.log('written', out, 'paths', paths.length, 'resample err', worst);
process.exit(0)
