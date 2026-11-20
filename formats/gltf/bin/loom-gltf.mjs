#!/usr/bin/env node
// The Loom for glTF 2.0, end to end:  GATE (Khronos glTF-Validator) -> HARNESS (camera + one key light) -> REFERENCE (Khronos
// glTF Sample Renderer) -> ENGINES (three.js, Babylon.js, X_ITE via an X3D Inline, Blender Cycles; x3d.wgpu listed, not run)
// -> SCORE (PSNR, SSIM vs the reference, after matching the display encode) -> RECEIPT (loom.render-receipt/1 per asset).
//
//   node bin/loom-gltf.mjs run [--assets Box,Duck] [--out runs/<id>] [--size 512] [--samples 64] [--engines three,babylon,xite,cycles]
//
// Exit 0 when every asset passed the gate and every run that ran is pass/warn; 1 otherwise; 2 usage.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';

import { ensureCorpus, cachePath } from '../tools/fetch-corpus.mjs';
import { harness } from '../src/harness.mjs';
import { renderKhronos, KHRONOS_VERSION } from '../src/reference-khronos.mjs';
import { score } from '../src/score.mjs';
import { ENCODE, reencodeTable } from '../src/encode.mjs';
import { seal, write, sha256, SCHEMA } from '../src/receipt.mjs';
import { ROOT, LOOM } from '../src/paths.mjs';
import { renderGlb } from '../../../x3d.gltf/render/render.mjs';
import { launchChromium, pkgVersion } from '../../../x3d.gltf/render/browser.mjs';
import { validateDelivery } from '../../../x3d.gltf/src/validate.mjs';

export const THRESHOLDS = {
  basis: 'encode-matched score vs the reference; v0 values, set by hand on 20 Nov 2026 before any calibration (grade: Suspected)',
  pass: { ssim_min: 0.98, psnr_fg_db_min: 30 },
  warn: { ssim_min: 0.95, psnr_fg_db_min: 25 },
};
const ENGINE_META = {
  three: { name: 'three.js', pkg: 'three' }, babylon: { name: 'Babylon.js', pkg: 'babylonjs' }, xite: { name: 'X_ITE (glTF via X3D 4.0 Inline)', pkg: 'x_ite' },
};
const BENIGN_CONSOLE = [/DracoDecoderModule is not defined/, /GPU stall due to ReadPixels/];

function judge(s) {
  if (!s) return 'error';
  const p = typeof s.psnr_fg_db === 'number' ? s.psnr_fg_db : Infinity;
  if (s.ssim >= THRESHOLDS.pass.ssim_min && p >= THRESHOLDS.pass.psnr_fg_db_min) return 'pass';
  if (s.ssim >= THRESHOLDS.warn.ssim_min && p >= THRESHOLDS.warn.psnr_fg_db_min) return 'warn';
  return 'fail';
}
const git = (args, cwd) => { const r = spawnSync('git', args, { cwd, encoding: 'utf8' }); return r.status === 0 ? r.stdout.trim() : null; };
const gpuFromWebgl = (renderer) => ({
  api: 'WebGL 2.0', adapter: renderer ?? null,
  backend: /Vulkan/.test(renderer ?? '') ? 'ANGLE -> Vulkan' : /OpenGL/.test(renderer ?? '') ? 'ANGLE -> OpenGL' : 'ANGLE',
  device_type: /SwiftShader|llvmpipe|lavapipe/i.test(renderer ?? '') ? 'Cpu' : 'unknown',
  driver: /SwiftShader/.test(renderer ?? '') ? 'SwiftShader' : null, driver_info: renderer ?? null,
});
const webglValidation = (errors) => ({ layer: null, layer_version: null, mode: 'Off', requested: false, enabled: false, unexpected_errors: null, attribution: 'WebGL has no validation layer; errors = GL errors on the browser console', errors: errors.filter((e) => /GL_INVALID|WebGL: INVALID|GL ERROR/i.test(e)).length, warnings: null, message_ids: [], log_sha256: null });

function findBpyPython() {
  for (const py of [process.env.LOOM_BPY_PYTHON, path.join(ROOT, '.bpy', 'bin', 'python'), 'python3'].filter(Boolean)) {
    const r = spawnSync(py, ['-c', 'import bpy, PIL, numpy; print(bpy.app.version_string)'], { encoding: 'utf8' });
    if (r.status === 0) return { py, version: r.stdout.trim() };
  }
  return null;
}

export async function run(opts) {
  const log = opts.log ?? console.log;
  const manifest = await ensureCorpus({ log: () => {} });
  // subjects: the pinned corpus by default, or local files (opts.subjects: [{id, file, corpus, semantic}]) e.g. X3D scenes converted by semantic/x3dsem.py
  const assets = opts.subjects ?? manifest.assets.filter((a) => !opts.assets || opts.assets.includes(a.id)).map((a) => ({ ...a, file: cachePath(a), corpus: { name: manifest.name, repo: manifest.repo, commit: manifest.commit, path: a.path } }));
  const outDir = path.resolve(opts.out);
  fs.mkdirSync(outDir, { recursive: true });
  const engines = opts.engines;
  const bpy = engines.includes('cycles') ? findBpyPython() : null;
  const browser = await launchChromium();
  const host_machine = { cpu: os.cpus()[0]?.model, cores: os.cpus().length, ram_gb: +(os.totalmem() / 2 ** 30).toFixed(1), os: `${os.type()} ${os.release()}`, arch: os.arch(), node: process.version, chromium: browser.version(), gpu: 'none (container without a GPU; WebGL through ANGLE on SwiftShader)' };
  const tools = {
    loom_commit: git(['rev-parse', 'HEAD'], LOOM), loom_dirty: Boolean(git(['status', '--porcelain', '--', 'formats/gltf', 'x3d.gltf'], LOOM)),
    gltf_validator: (await import('gltf-validator')).default.version(), khronos_sample_renderer: KHRONOS_VERSION,
    three: pkgVersion(path.join(LOOM, 'x3d.gltf/node_modules/three')), babylonjs: pkgVersion(path.join(LOOM, 'x3d.gltf/node_modules/babylonjs')),
    x_ite: pkgVersion(path.join(LOOM, 'x3d.gltf/node_modules/x_ite')), gltf_transform: pkgVersion(path.join(ROOT, 'node_modules/@gltf-transform/core')),
    blender_bpy: bpy?.version ?? null,
    playwright: (() => { for (const d of ['/opt/node22/lib/node_modules/playwright', '/opt/node-tools/node_modules/playwright', '/usr/local/lib/node_modules_global/playwright']) { try { return pkgVersion(d); } catch { /* next */ } } return null; })(),
  };
  const summary = [];
  try {
    for (const a of assets) {
      const t0 = Date.now();
      const dir = path.join(outDir, a.id); fs.mkdirSync(dir, { recursive: true });
      const src = a.file; const bytes = fs.readFileSync(src);
      // ---- 1. GATE --------------------------------------------------------------------------------------------------------
      const v = await validateDelivery(bytes);
      const d = v.delivered;
      const gate = { validator: { name: 'Khronos glTF-Validator (npm gltf-validator)', version: d.validatorVersion, commit: null }, verdict: v.ok ? 'pass' : 'fail',
        counts: { errors: d.numErrors, warnings: d.numWarnings, infos: d.numInfos, hints: d.numHints }, issues: d.issues.slice(0, 20), extensions_used: d.extensionsUsed, harnessed_counts: null };
      const receipt = {
        schema: SCHEMA,
        format: { name: 'gltf', version: '2.0', correct_is_pinned_by: 'glTF 2.0 spec Appendix B (BRDF) + KHR_lights_punctual (lux, inverse-square); display encode undefined by glTF, matched to the reference before judging' },
        subject: { id: a.id, file: path.basename(src), bytes: bytes.length, sha256: sha256(bytes), corpus: a.corpus ?? null },
        semantic: a.semantic ?? null,
        gate, harness: null,
        reference: { engine_id: 'khronos', kind: 'spec-reference-renderer', why: 'Khronos publishes it as the sample implementation of the glTF 2.0 BRDF; it is NOT normative (it encodes with gamma 2.2). Cycles is run as a second, path-traced witness.', png_sha256: null },
        runs: [], thresholds: THRESHOLDS, verdict: { subject: 'gate-fail' }, host_machine, tools, grade: 'Confirmed',
        limitations: [
          'no GPU: every WebGL number is ANGLE on SwiftShader (software Vulkan); a real-GPU run may differ',
          'raster engines draw no shadows; Cycles does. Self-shadowing assets score lower against Cycles by construction',
          'thresholds are v0 hand-set values, not calibrated',
        ],
        written_at: new Date().toISOString(), prev: null, signed: false,
      };
      if (!v.ok) {
        receipt.runs = ['khronos', ...engines, 'wgpu'].map((id) => ({ engine: { id, name: id, version: null }, status: 'not_run', reason: 'gate failed: the Loom does not render a file the validator rejects' }));
        write(seal(receipt), path.join(dir, 'receipt.json'));
        summary.push({ id: a.id, gate: gate.counts, verdict: 'gate-fail', runs: [] });
        log(`${a.id}: GATE FAIL ${JSON.stringify(gate.counts)}`);
        continue;
      }
      // ---- 2. HARNESS -----------------------------------------------------------------------------------------------------
      const lit = path.join(dir, `${a.id}.harnessed.glb`);
      const h = await harness(src, lit);
      const hv = await validateDelivery(fs.readFileSync(lit));
      gate.harnessed_counts = { errors: hv.delivered.numErrors, warnings: hv.delivered.numWarnings, infos: hv.delivered.numInfos, hints: hv.delivered.numHints };
      receipt.harness = { ...h, file: path.basename(lit), sha256: sha256(fs.readFileSync(lit)), rule: 'no IBL, no generated lights, no ambient, tone map none, exposure 1, clear #20242c, square frame, MSAA on' };
      // ---- 3. REFERENCE ---------------------------------------------------------------------------------------------------
      const ref = await renderKhronos({ browser, glb: lit, cameraIndex: h.cameraIndex, size: opts.size });
      const refPng = path.join(dir, 'khronos.png');
      const errs = (list) => list.filter((e) => !BENIGN_CONSOLE.some((re) => re.test(e)));
      if (ref.ok) fs.writeFileSync(refPng, ref.png);
      receipt.reference.png_sha256 = ref.ok ? sha256(ref.png) : null;
      receipt.runs.push({ engine: { id: 'khronos', name: 'Khronos glTF Sample Renderer', version: KHRONOS_VERSION }, status: ref.ok ? 'reference' : 'error', reason: ref.ok ? null : ref.part.error,
        host: { kind: 'browser', name: 'Chromium headless', version: browser.version(), user_agent: ref.part.userAgent ?? null }, gpu: gpuFromWebgl(ref.part.webgl?.renderer), api_validation: webglValidation(ref.part.console.errors),
        encode: ENCODE.khronos, output: ref.ok ? { png: 'khronos.png', sha256: sha256(ref.png), size: [opts.size, opts.size] } : null, score: null,
        console: { errors: errs(ref.part.console.errors), benign: ref.part.console.errors.length - errs(ref.part.console.errors).length, warnings: errs(ref.part.console.warnings).length },
        timing_ms: { load: Math.round(ref.part.loadMs ?? 0), settle: Math.round(ref.part.settleMs ?? 0), total: ref.part.totalMs }, notes: ref.part.notes ?? [] });
      // ---- 4. ENGINES -----------------------------------------------------------------------------------------------------
      for (const id of engines) {
        let row;
        const png = path.join(dir, `${id}.png`);
        if (id === 'cycles') {
          if (!bpy) { row = { engine: { id, name: 'Blender Cycles', version: null }, status: 'not_run', reason: 'no Python with bpy + numpy + PIL found (set LOOM_BPY_PYTHON); pip install bpy==5.3.0 pillow numpy' }; }
          else {
            const js = path.join(dir, 'cycles.render.json');
            const r = spawnSync(bpy.py, ['-I', path.join(ROOT, 'blender/cycles_render.py'), lit, png, js, '--size', String(opts.size), '--samples', String(opts.samples)], { encoding: 'utf8', timeout: 900_000 });
            fs.rmSync(png + '.rgba.png', { force: true });
            if (r.status !== 0 || !fs.existsSync(png)) row = { engine: { id, name: 'Blender Cycles', version: bpy.version }, status: 'error', reason: (r.stderr || r.stdout || 'no output').split('\n').slice(-6).join(' | ') };
            else {
              const c = JSON.parse(fs.readFileSync(js, 'utf8'));
              row = { engine: { id, name: 'Blender Cycles', version: c.engine.version }, host: { kind: 'native', name: c.host.name, version: c.host.python, user_agent: null }, gpu: c.gpu,
                api_validation: { layer: null, layer_version: null, mode: 'Off', requested: false, enabled: false, unexpected_errors: null, attribution: 'Cycles CPU uses no graphics API', errors: null, warnings: null, message_ids: [], log_sha256: null }, settings: c.settings,
                timing_ms: { total: Math.round((c.timing.import_s + c.timing.render_s) * 1000) }, notes: c.notes };
            }
          }
        } else {
          const r = await renderGlb({ engine: id, glb: lit, out: png, size: opts.size, camera: h.camera, browser, json: path.join(dir, `${id}.render.json`) });
          const rc = r.receipt;
          row = { engine: { id, name: ENGINE_META[id].name, version: rc.engine.version }, host: { kind: 'browser', name: 'Chromium headless', version: rc.chromium, user_agent: rc.userAgent },
            gpu: gpuFromWebgl(rc.webgl?.renderer), api_validation: webglValidation(rc.console.errors), lighting: rc.lighting,
            console: { errors: errs(rc.console.errors), warnings: errs(rc.console.warnings).length }, timing_ms: { load: rc.timing.loadMs, settle: rc.timing.settleMs, total: rc.timing.totalMs },
            status: r.ok ? undefined : 'error', reason: r.ok ? null : rc.error };
        }
        row.encode = ENCODE[id];
        if (fs.existsSync(png) && ref.ok && row.status !== 'error' && row.status !== 'not_run') {
          const raw = await score(png, refPng);
          const matched = await score(png, refPng, reencodeTable(ENCODE[id], ENCODE.khronos));
          row.output = { png: `${id}.png`, sha256: sha256(fs.readFileSync(png)), size: [opts.size, opts.size] };
          row.score = { vs: 'khronos', raw, encode_matched: matched, judged_on: 'encode_matched' };
          row.status = judge(matched);
        } else if (!row.status) row.status = 'error';
        receipt.runs.push(row);
      }
      // CONSENSUS: the raster candidates scored against each other. If they agree and all disagree with the reference, the
      // reference is the suspect (first seen 20 Nov 2026: normal-less meshes, Khronos 1.1.0 vs three/Babylon/X_ITE).
      const raster = receipt.runs.filter((r) => ['three', 'babylon', 'xite'].includes(r.engine.id) && r.output);
      const pairs = [];
      for (let i = 0; i < raster.length; i++) for (let j = i + 1; j < raster.length; j++) {
        const [x, y] = ENCODE[raster[j].engine.id] === 'gamma-2.2' ? [raster[i], raster[j]] : [raster[j], raster[i]];
        const sc = await score(path.join(dir, x.output.png), path.join(dir, y.output.png), reencodeTable(ENCODE[x.engine.id], ENCODE[y.engine.id]));
        pairs.push({ a: x.engine.id, b: y.engine.id, ssim: sc.ssim, psnr_fg_db: sc.psnr_fg_db, verdict: judge(sc) });
      }
      const agree = pairs.length >= 3 && pairs.every((p) => p.verdict === 'pass');
      const vsRefFails = raster.filter((r) => r.status === 'fail').length;
      receipt.consensus = { pairs, candidates_agree: agree, candidates_failing_reference: vsRefFails,
        reference_suspect: agree && vsRefFails >= 2, rule: 'R-GLTF-8: all raster candidates pass against each other and >= 2 fail against the reference -> the reference is the suspect' };
      // second witness: how far the two references are from each other
      const cyc = receipt.runs.find((r) => r.engine.id === 'cycles' && r.score);
      receipt.reference.agreement = cyc ? { witness: 'cycles', ssim: cyc.score.encode_matched.ssim, psnr_fg_db: cyc.score.encode_matched.psnr_fg_db } : null;
      receipt.runs.push({ engine: { id: 'wgpu', name: 'x3d.wgpu (Rust + wgpu)', version: '0.5.1' }, status: 'not_run', encode: ENCODE.wgpu,
        reason: 'x3d.wgpu 0.5.1 parses X3D only and has no glTF loader; route: X3D Inline of a glb (as X_ITE does) via the gltf crate. Its receipts already carry this schema\'s gpu block (x3d-wgpu-conformance/1 adapter) and gain api_validation from the VVL lane.' });
      const ranRows = receipt.runs.filter((r) => ['pass', 'warn', 'fail', 'error'].includes(r.status));
      const semFail = a.semantic && a.semantic.verdict !== 'pass';
      receipt.verdict = { semantic: a.semantic ? a.semantic.verdict : 'not_applicable', subject: semFail ? 'fail' : receipt.consensus.reference_suspect ? 'reference-suspect' : ranRows.some((r) => r.status === 'fail' || r.status === 'error') ? 'fail' : ranRows.some((r) => r.status === 'warn') ? 'warn' : 'pass',
        counts: Object.fromEntries(['pass', 'warn', 'fail', 'error', 'not_run'].map((s) => [s, receipt.runs.filter((r) => r.status === s).length])) };
      receipt.timing_ms = Date.now() - t0;
      write(seal(receipt), path.join(dir, 'receipt.json'));
      summary.push({ id: a.id, consensus: { agree: receipt.consensus.candidates_agree, reference_suspect: receipt.consensus.reference_suspect, pairs: receipt.consensus.pairs }, semantic: a.semantic ? { verdict: a.semantic.verdict, rules: a.semantic.rules.map((x) => `${x.id}:${x.pass ? 'pass' : 'FAIL'}`) } : null, gate: gate.counts, harnessed: gate.harnessed_counts, verdict: receipt.verdict.subject, runs: receipt.runs.map((r) => ({ id: r.engine.id, version: r.engine.version, status: r.status, raw: r.score?.raw ?? null, matched: r.score?.encode_matched ?? null, ms: r.timing_ms?.total ?? null })) });
      log(`${a.id.padEnd(28)} gate ${gate.verdict} (${d.numErrors}E ${d.numWarnings}W)  ` + receipt.runs.map((r) => `${r.engine.id}:${r.status}${r.score ? ` ${r.score.encode_matched.ssim}/${r.score.encode_matched.psnr_fg_db}dB` : ''}`).join('  ') + `  ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    }
  } finally {
    await browser.close();
  }
  const runJson = { schema: 'loom.gltf-run/1', written_at: new Date().toISOString(), size: opts.size, cycles_samples: opts.samples, host_machine, tools, thresholds: THRESHOLDS, corpus: { name: manifest.name, repo: manifest.repo, commit: manifest.commit }, assets: summary };
  fs.writeFileSync(path.join(outDir, 'run.json'), JSON.stringify(runJson, null, 2) + '\n');
  return runJson;
}

/** X3D -> glTF (KHR_xmp_json_ld) -> X3D round trip, then the converted glTF goes through the same visual Loom. */
export async function semanticSubjects(x3dFiles, outDir) {
  const { NodeIO } = await import('@gltf-transform/core');
  const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
  const subjects = [];
  for (const f of x3dFiles) {
    const id = path.basename(f, '.x3d');
    const dir = path.join(outDir, 'semantic', id);
    const r = spawnSync('python3', ['-I', path.join(ROOT, 'semantic/x3dsem.py'), 'roundtrip', path.resolve(f), dir], { encoding: 'utf8' });
    if (![0, 1].includes(r.status)) throw new Error(`x3dsem failed on ${f}: ${r.stderr}`);
    const sem = JSON.parse(fs.readFileSync(path.join(dir, 'semantic.json'), 'utf8'));
    const glb = path.join(dir, `${id}.glb`);
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    await io.write(glb, await io.read(path.join(dir, `${id}.gltf`)));
    // glTF-Transform keeps KHR_xmp_json_ld (it implements it); prove the packets survived the .gltf -> .glb step
    const jsonOf = (buf) => JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8'));
    const src = JSON.parse(fs.readFileSync(path.join(dir, `${id}.gltf`), 'utf8')), out = jsonOf(fs.readFileSync(glb));
    const { canonical } = await import('../src/receipt.mjs');
    const pk = (g) => (g.extensions?.KHR_xmp_json_ld?.packets ?? []).map(canonical).sort();
    const holders = (g) => (g.nodes ?? []).filter((n) => n.extensions?.KHR_xmp_json_ld).length;
    const same = canonical(pk(src)) === canonical(pk(out)) && holders(src) === holders(out);
    sem.rules.push({ id: 'S7', rule: '.gltf -> .glb through glTF-Transform 4.5.1 keeps every KHR_xmp_json_ld packet byte-equal (canonical JSON) and every node reference',
      packets: pk(out).length, nodes_with_packets: holders(out), pass: same });
    if (!same) sem.verdict = 'fail';
    const rel = path.relative(LOOM, path.resolve(f));
    subjects.push({ id: `x3d-${id}`, file: glb, corpus: { name: 'x3d.demo', repo: 'hagopjay/x3d.demo', commit: git(['rev-parse', 'HEAD'], path.dirname(path.resolve(f))), path: rel.replace(/^(\.\.\/)+x3d\.demo\//, '') }, semantic: sem });
  }
  return subjects;
}

async function main() {
  const { positionals, values } = parseArgs({ allowPositionals: true, options: {
    x3d: { type: 'string' },
    assets: { type: 'string' }, out: { type: 'string' }, size: { type: 'string', default: '512' }, samples: { type: 'string', default: '64' },
    engines: { type: 'string', default: 'three,babylon,xite,cycles' } } });
  if (positionals[0] !== 'run') { console.error('usage: node bin/loom-gltf.mjs run [--assets A,B | --x3d a.x3d,b.x3d] [--out DIR] [--size 512] [--samples 64] [--engines three,babylon,xite,cycles]'); process.exit(2); }
  const out = values.out ?? path.join(ROOT, 'runs', `run-${new Date().toISOString().slice(0, 10)}`);
  const subjects = values.x3d ? await semanticSubjects(values.x3d.split(','), out) : undefined;
  const r = await run({ subjects, assets: values.assets?.split(','), out, size: Number(values.size), samples: Number(values.samples), engines: values.engines.split(',') });
  const bad = r.assets.some((a) => a.verdict === 'gate-fail' || a.verdict === 'fail' || a.verdict === 'reference-suspect' || a.runs.some((x) => x.status === 'fail' || x.status === 'error'));
  console.log(`wrote ${out}/run.json and ${r.assets.length} receipts`);
  process.exit(bad ? 1 : 0);
}
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) main().catch((e) => { console.error(e); process.exit(4); });
