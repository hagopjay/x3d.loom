// Write the Loom run record (loom.physics-run/1) for the Flop Lab cannon shot from this folder's own receipts.
// It measures nothing: every number is read from receipts/gates.json, receipts/hashes-node.json and receipts/crosshost.json.
// Judge the result with:  kit/loom physics x3d.physics/flop-lab --evidence <run>/evidence --runs 'runs/*.physics.json'
import fs from 'fs';
import crypto from 'crypto';
const R = (f) => JSON.parse(fs.readFileSync(new URL('../receipts/' + f, import.meta.url), 'utf8'));
const gates = R('gates.json'), hashesHex = R('hashes-node.json'), cross = R('crosshost.json'), pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const dec = (a) => a.map((h) => parseInt(h, 16)), trace = (a) => crypto.createHash('sha256').update(a.join(',')).digest('hex');
const hashes = dec(hashesHex), browser = dec(cross.hashes);
let mism = 0, first = -1; for (let i = 0; i < hashes.length; i++) if (hashes[i] !== browser[i]) { mism++; if (first < 0) first = i; }
const sameHost = gates.gates.find((g) => /differing step hashes/.test(g.name));
const rec = {
  schema: 'loom.physics-run/1', id: 'flop-lab/default-level/cannon-shot/recorded-in-node',
  project: { name: 'x3d.physics/flop-lab', contract: 'flop-lab/0.1' },
  engine: { name: 'flop-lab xpbd2d', version: pkg.version, build: 'src/core.js + level.js + game.js, sha256 ' + gates.engine_sha256 },
  model: { sha256: gates.model_sha256, source: 'defaultLevel() in src/level.js', what: 'the level the run was built from, hashed as JSON.stringify of the level data. The browser built the same bytes (' + (cross.model_sha256_browser === gates.model_sha256 ? 'equal' : 'DIFFERENT') + ' sha256). level/default-level.x3d is its X3D export, rounded to 4 digits, and is not the model of this run.' },
  recorded: { host: 'node', host_version: gates.node, fixed_step_s: 1 / 60, substeps: 8, steps: hashes.length, hashes, trace_sha256: trace(hashes), what: 'a ragdoll fired from the cannon at step 0 (45 deg, 32 m/s), no input afterwards; FNV-1a over the x, y and angle bits of every body, each step' },
  required_hosts: ['node', 'chromium'],
  replays: [
    { host: 'node', host_version: gates.node, engine_version: pkg.version, steps: hashes.length, mismatches: sameHost.value, first_mismatch: -1, what: 'a second fresh run in the same process' },
    { host: 'chromium', host_version: cross.browser + ' headless, ' + cross.renderer, engine_version: pkg.version, steps: browser.length, mismatches: mism, first_mismatch: first, trace_sha256: trace(browser), what: 'the built page (index.html) under a page policy like the artifact host\'s' },
  ],
  references: gates.gates.map((g) => ({ id: g.name, observed: Number(g.value), limit: g.limit, declared_limit: g.limit, rule: 'at most', status: g.pass ? 'pass' : 'fail', measured: gates.date, source: 'receipts/gates.json; test/gates.test.mjs; test/limits.json' })),
  tolerances: [],
  controls: gates.controls.filter((c) => c.caught !== null).map((c) => ({ id: c.name + ': ' + c.value + ' against ' + c.need, expect: 'fail', observed_failed: c.caught, source: 'receipts/gates.json' }))
    .concat(cross.control_native_trig && cross.control_native_trig.differing !== undefined ? [{ id: 'solver using the built-in sine and cosine: ' + cross.control_native_trig.differing + ' of 300 step hashes differ between Node and Chromium, first at step ' + cross.control_native_trig.first_difference, expect: 'fail', observed_failed: cross.control_native_trig.differing > 0, source: 'receipts/crosshost.json' }] : []),
  losses: { authored_fields_dropped: 0, reported: true, source: 'the level is written by the engine\'s own prefabs; nothing authored elsewhere was read for this run' },
  reported_not_gated: gates.controls.filter((c) => c.caught === null).map((c) => ({ id: c.name, observed: c.value })),
  not_shown: ['Firefox and WebKit (they could not be installed in the build session: the download hosts were refused)', 'a second machine', 'a real GPU (the browser run used SwiftShader)', 'limits committed before the run: test/limits.json lands in the same commit as its results, and one control threshold was removed after the first run (see its _changes line), so this record carries no `limits` block', 'the hero under keyboard input (the run has no input after the launch)', 'the Claude curator (no model was reachable in the test frame)'],
  sources: { references: 'receipts/gates.json', trace: 'receipts/hashes-node.json', replays: 'receipts/crosshost.json', math: 'receipts/math-sweep.json' },
};
fs.mkdirSync(new URL('../runs/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('../runs/flop-lab-cannon-shot-node.physics.json', import.meta.url), JSON.stringify(rec, null, 1) + '\n');
console.log('runs/flop-lab-cannon-shot-node.physics.json:', rec.references.length, 'references,', rec.controls.length, 'controls,', rec.replays.length, 'replays, chromium mismatches', mism);
