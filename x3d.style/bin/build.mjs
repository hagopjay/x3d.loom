#!/usr/bin/env node
// Build everything the kit can say without a browser:
//   styles/authored.jsonld --lint--> --repair--> styles/catalogue.jsonld
//   catalogue x scene --compile--> out/<style>.x3d
//   the transposition matrix (every structure x every palette, plain and inverted) --lint--> out/matrix.json
// Usage: node bin/build.mjs [outDir]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { lint, transpose, invert, idOf, VERSION } from '../src/grammar.mjs';
import { repair } from '../src/repair.mjs';
import { compile } from '../src/compile.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || path.join(ROOT, 'out'));
fs.mkdirSync(out, { recursive: true });
const authored = JSON.parse(fs.readFileSync(path.join(ROOT, 'styles/authored.jsonld'), 'utf8'));
const scene = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/node-city.scene.json'), 'utf8'));

const repairs = [], styles = [];
for (const a of authored['@graph']) {
  const before = lint(a, scene);
  const r = repair(a, scene);
  const s = r.changed ? { ...r.style, '@id': a['@id'], authoredScore: r.before } : a;
  styles.push(s);
  repairs.push({ id: r.id, authored: `${before.passed}/${before.applicable}`, failed: before.rules.filter(x => x.applies && !x.pass).map(x => ({ id: x.id, name: x.name, measured: x.measured, need: x.need, note: x.note })),
    repaired: r.after === 1, coloursMoved: `${r.changed}/${r.colours}`, meanDrift: r.meanDrift, maxDrift: r.maxDrift, log: r.log });
}
const catalogue = { ...authored, '@id': 'xst:catalogue/1', label: 'X3D style catalogue 1 (linted, repaired where the grammar asked)', '@graph': styles };
fs.writeFileSync(path.join(ROOT, 'styles/catalogue.jsonld'), JSON.stringify(catalogue, null, 1));

const files = [];
for (const s of styles) {
  const l = lint(s, scene);
  const t0 = performance.now();
  const x = compile(scene, s, { lint: l });
  const ms = performance.now() - t0;
  const name = `${idOf(s)}.x3d`;
  fs.writeFileSync(path.join(out, name), x);
  files.push({ style: idOf(s), file: name, bytes: Buffer.byteLength(x), sha256: crypto.createHash('sha256').update(x).digest('hex'), compile_ms: +ms.toFixed(1), lint: `${l.passed}/${l.applicable}`, ok: l.ok });
  console.log(name.padEnd(22), String(Buffer.byteLength(x)).padStart(8), 'bytes', ms.toFixed(0).padStart(4), 'ms  lint', `${l.passed}/${l.applicable}`);
}
// the matrix: 12 structures x 12 palettes x {as is, inverted}
const cells = [];
for (const st of styles) for (const pal of styles) for (const inv of [false, true]) {
  let s = idOf(st) === idOf(pal) ? st : transpose(st, pal);
  if (inv) s = invert(s);
  const l = lint(s, scene);
  let fixed = null;
  if (!l.ok) { const r = repair(s, scene); fixed = { ok: r.ok, meanDrift: r.meanDrift, maxDrift: r.maxDrift }; }
  cells.push({ structure: idOf(st), palette: idOf(pal), inverted: inv, passed: l.passed, applicable: l.applicable, ok: l.ok, fails: l.rules.filter(x => x.applies && !x.pass).map(x => x.id), repair: fixed });
}
const tally = f => { const c = cells.filter(f); return { cells: c.length, pass: c.filter(x => x.ok).length, passAfterRepair: c.filter(x => x.ok || (x.repair && x.repair.ok)).length }; };
const byRule = {}; for (const c of cells) for (const f of c.fails) byRule[f] = (byRule[f] || 0) + 1;
const matrix = { grammar: VERSION, instrument: `x3d.style grammar.mjs lint + repair.mjs, Node ${process.version}`, all: tally(() => true), plain: tally(c => !c.inverted), inverted: tally(c => c.inverted),
  home: tally(c => !c.inverted && c.structure === c.palette), failsByRule: byRule, cells };
fs.writeFileSync(path.join(out, 'matrix.json'), JSON.stringify(matrix));
fs.writeFileSync(path.join(out, 'build-receipt.json'), JSON.stringify({ grammar: VERSION, node: process.version, scene: { id: scene.id, counts: scene.counts, sources: scene.sources }, repairs, files,
  matrix: { all: matrix.all, plain: matrix.plain, inverted: matrix.inverted, home: matrix.home, failsByRule: byRule } }, null, 1));
console.log('matrix', JSON.stringify({ all: matrix.all, plain: matrix.plain, inverted: matrix.inverted, failsByRule: byRule }));
