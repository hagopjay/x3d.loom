#!/usr/bin/env node
// x3dgltf: the glTF tooling lane's command line.
//   x3dgltf profiles                                   list profiles and their contracts
//   x3dgltf inspect FILE.glb                           inventory, byte table, transfer sizes, extensions
//   x3dgltf validate FILE.glb [--max-warnings N]       Khronos validator on the file and, if compressed, on its decoded canonical form
//   x3dgltf optimize IN.glb OUT.glb --profile P [--no-verify] [--receipt R.json]
//   x3dgltf verify SRC.glb OUT.glb --profile P         identity / geometry / material / animation / validator gates
//   x3dgltf matrix --files a.glb,b.glb --profiles web,draco --out DIR [--md TABLE.md] [--expect-fail static-joined]
// Exit codes: 0 all gates pass, 1 a gate failed, 2 usage error.
import fs from 'node:fs';
import path from 'node:path';
import { PROFILES, PROFILE_IDS } from '../src/profiles.mjs';
import { optimize } from '../src/optimize.mjs';
import { verify, loadDoc } from '../src/verify.mjs';
import { inventory, byteBreakdown } from '../src/measure.mjs';
import { transferSizes } from '../src/transfer.mjs';
import { validateDelivery } from '../src/validate.mjs';
import { runCase } from '../src/run.mjs';
import { matrixMarkdown } from '../src/table.mjs';

const argv = process.argv.slice(2);
const cmd = argv.shift();
const flags = {}, pos = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) { const k = a.slice(2); if (['no-verify', 'verbose', 'json'].includes(k)) flags[k] = true; else flags[k] = argv[++i]; }
  else pos.push(a);
}
const die = (m, code = 2) => { console.error('x3dgltf: ' + m); process.exit(code); };
const kb = (n) => (n / 1024).toFixed(1) + ' KiB';
const stepLine = (s) => console.error(`  step ${s.step.padEnd(12)} ${String(s.ms).padStart(6)} ms   nodes ${s.before.nodes}->${s.after.nodes}  meshes ${s.before.meshes}->${s.after.meshes}  materials ${s.before.materials}->${s.after.materials}  accessors ${s.before.accessors}->${s.after.accessors}`);

if (!cmd || cmd === 'help' || cmd === '--help') { console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 11).map((l) => l.replace(/^\/\/ ?/, '')).join('\n')); process.exit(cmd ? 0 : 2); }

if (cmd === 'profiles') {
  for (const id of PROFILE_IDS) { const p = PROFILES[id]; console.log(`${id.padEnd(16)} identity ${p.identity.padEnd(6)} geometry ${p.geometry.padEnd(8)} writes ${p.writes.join(',') || 'nothing'}${p.trap || id === 'static-joined' ? '   [TRAP: measured, never shipped]' : ''}\n${' '.repeat(16)} ${p.summary}`); }
  process.exit(0);
}

if (cmd === 'inspect') {
  const f = pos[0] || die('inspect needs a file'); const buf = fs.readFileSync(f);
  const inv = inventory(await loadDoc(buf)); delete inv.textureList;
  const out = { file: path.basename(f), inventory: inv, bytes: byteBreakdown(buf), transfer: transferSizes(buf) };
  if (flags.json) console.log(JSON.stringify(out, null, 1));
  else {
    console.log(`${out.file}  ${kb(buf.length)}  gzip ${kb(out.transfer.gzip)}  brotli ${kb(out.transfer.brotli)}`);
    console.log(`  nodes ${inv.nodes}  meshes ${inv.meshes}  primitives ${inv.primitives}  materials ${inv.materials}  textures ${inv.textures}  animations ${inv.animations} (${inv.channels} channels)  cameras ${inv.cameras}  lights ${inv.lights}`);
    console.log(`  draw calls ${inv.drawCalls}  triangles ${inv.triangles}  instances ${inv.instances} in ${inv.instancedNodes} batches  vertices uploaded ${inv.uploadVertices}  resident vertex ${kb(inv.residentVertexBytes)} index ${kb(inv.residentIndexBytes)}`);
    console.log(`  extensions used: ${inv.extensionsUsed.join(', ') || 'none'}   required: ${inv.extensionsRequired.join(', ') || 'none'}`);
    console.log('  bytes: json ' + kb(out.bytes.jsonBytes) + '  ' + Object.entries(out.bytes.byCategory).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${kb(v)}`).join('  '));
  }
  process.exit(0);
}

if (cmd === 'validate') {
  const f = pos[0] || die('validate needs a file'); const r = await validateDelivery(fs.readFileSync(f), { maxWarnings: flags['max-warnings'] != null ? Number(flags['max-warnings']) : null });
  if (flags.json) console.log(JSON.stringify(r, null, 1));
  else {
    const line = (tag, v) => console.log(`${v.ok ? 'OK  ' : 'FAIL'} ${tag}: ${v.numErrors} errors, ${v.numWarnings} warnings (${v.explainedWarnings} explained by an extension the validator does not know), ${v.numInfos} infos; ${v.totalTriangleCount} tris; extensions ${v.extensionsUsed.join(',') || 'none'}`);
    line('delivered', r.delivered); if (r.canonical) line('canonical ', r.canonical);
    if (r.delivered.extensionsNotValidated.length) console.log(`  NOT VALIDATED by gltf-validator ${r.delivered.validatorVersion}: ${r.delivered.extensionsNotValidated.join(', ')}${r.canonical ? ' (the canonical file is the check on the geometry)' : ''}`);
  }
  process.exit(r.ok ? 0 : 1);
}

if (cmd === 'optimize' || cmd === 'verify') {
  const [a, b] = pos; if (!a || !b) die(`${cmd} needs two paths`);
  const pid = flags.profile || die('--profile is required'); if (!PROFILES[pid]) die(`unknown profile ${pid}; known: ${PROFILE_IDS.join(', ')}`);
  const src = fs.readFileSync(a); let outBytes, steps = [];
  if (cmd === 'optimize') {
    const r = await optimize(src, pid, { onStep: flags.verbose ? stepLine : null }); outBytes = r.bytes; steps = r.steps; fs.writeFileSync(b, outBytes);
    console.log(`${path.basename(a)} -> ${path.basename(b)}  profile ${pid}  ${kb(src.length)} -> ${kb(outBytes.length)} (${(100 * outBytes.length / src.length).toFixed(1)}%)`);
  } else outBytes = fs.readFileSync(b);
  if (cmd === 'optimize' && flags['no-verify']) process.exit(0);
  const rep = await verify(src, outBytes, pid);
  rep.steps = steps.map((s) => ({ step: s.step, ms: s.ms }));
  if (flags.receipt) { fs.mkdirSync(path.dirname(path.resolve(flags.receipt)), { recursive: true }); fs.writeFileSync(flags.receipt, JSON.stringify(rep, (k, v) => (v instanceof Float64Array ? undefined : v), 1) + '\n'); }
  const g = rep.geometry, id = rep.identity, v = rep.validator;
  console.log(`${rep.ok ? 'PASS' : 'FAIL'}  validator ${v.delivered.errors}e/${v.delivered.warnings}w${v.canonical ? ` canonical ${v.canonical.errors}e/${v.canonical.warnings}w` : ''}  identity kept ${id.preserved}/${id.sourceTokens} lost ${id.lost} added ${id.added}  triangles ${g.sourceTriangles}->${g.outputTriangles}  centroid max ${g.centroid ? g.centroid.maxRel.toExponential(2) : 'n/a'} of diagonal  materials ${rep.materials.identical}/${rep.materials.source} identical  animation ${rep.animation.matched}/${rep.animation.channelsSource} channels`);
  for (const f of rep.failures) console.log('  FAIL ' + f);
  if (PROFILES[pid].identity === 'lossy' && id.lost) console.log(`  NOTE profile ${pid} has a lossy identity contract: PASS means its bounds held, not that the X3D identity did (${id.lost} of ${id.sourceTokens} tokens lost). Never ship it.`);
  process.exit(rep.ok ? 0 : 1);
}

if (cmd === 'matrix') {
  const files = (flags.files || die('--files a.glb,b.glb')).split(',').filter(Boolean);
  const profs = (flags.profiles || PROFILE_IDS.join(',')).split(',').filter(Boolean);
  for (const p of profs) if (!PROFILES[p]) die('unknown profile ' + p);
  const outDir = flags.out || die('--out DIR'); fs.mkdirSync(outDir, { recursive: true });
  const expectFail = new Set((flags['expect-fail'] || '').split(',').filter(Boolean));
  const rows = [];
  for (const f of files) for (const p of profs) {
    const t = performance.now();
    try {
      const { row, report } = await runCase(f, p, { outDir: flags['keep'] ? path.join(outDir, 'glb') : null });
      row.expectedFail = expectFail.has(p); rows.push(row);
      fs.mkdirSync(path.join(outDir, 'receipts'), { recursive: true });
      fs.writeFileSync(path.join(outDir, 'receipts', `${path.basename(f, '.glb')}.${p}.json`), JSON.stringify(report, null, 1) + '\n');
      console.error(`${row.ok ? 'ok  ' : 'FAIL'} ${path.basename(f).padEnd(52)} ${p.padEnd(16)} ${kb(row.bytes.source)} -> ${kb(row.bytes.output)} (${(100 * row.bytes.ratio).toFixed(1)}%)  ${Math.round(performance.now() - t)} ms${row.ok ? '' : '  ' + row.failures.join('; ')}`);
    } catch (e) { console.error(`ERR  ${path.basename(f)} ${p}: ${e.message}`); rows.push({ file: path.basename(f), profile: p, ok: false, error: e.message, failures: [e.message] }); }
  }
  fs.writeFileSync(path.join(outDir, 'matrix.json'), JSON.stringify(rows, null, 1) + '\n');
  if (flags.md) fs.writeFileSync(flags.md, matrixMarkdown(rows));
  process.exit(rows.every((r) => r.ok || r.expectedFail) ? 0 : 1);
}
die('unknown command ' + cmd);
