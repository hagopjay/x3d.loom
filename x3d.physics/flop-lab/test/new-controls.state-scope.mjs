// Independent scope probes: a pose hash and a review snapshot are not full simulation-state identity.
import './mk.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';
const { World, Sim, defaultLevel } = await import('../dist/core.mjs?' + Date.now());
const probes = [];
function record(id, condition, observed, scope) {
  probes.push({ id, pass: Boolean(condition), observed, scope });
  console.log(`${condition ? 'PASS' : 'FAIL'} ${id}: ${JSON.stringify(observed)}`);
}

// Same pose, different velocity: the documented World.hash() input is pose, not the full state.
{
  const a = new World({ gy: 0, damp: 0 }), b = new World({ gy: 0, damp: 0 });
  const x = a.add({ id: 'ball', shape: 'ball', r: 0.3, mass: 1, x: 0, y: 20 });
  const y = b.add({ id: 'ball', shape: 'ball', r: 0.3, mass: 1, x: 0, y: 20 });
  y.vx = 1;
  const beforeSame = a.hash() === b.hash();
  a.step(1 / 60); b.step(1 / 60);
  const nextDiffers = a.hash() !== b.hash();
  record('pose_hash_does_not_identify_velocity', beforeSame && nextDiffers,
    { beforeSame, nextDiffers, ax: x.x, bx: y.x },
    'Expected scope control. Equal pose digests cannot alone authorize continuation-state equivalence.');
}

// Restoring a review snapshot rewinds World.time but does not rewind World.frame.
{
  const w = new World({ gy: 0, damp: 0 });
  w.add({ id: 'ball', shape: 'ball', r: 0.3, mass: 1, y: 20 });
  const saved = w.snapshot();
  w.step(1 / 60);
  const ok = w.restore(saved, false);
  record('review_snapshot_is_not_a_full_world_checkpoint', ok && w.time === 0 && w.frame === 1,
    { restored: ok, restoredTime: w.time, retainedFrame: w.frame },
    'Documents current snapshot scope; this command does not claim deterministic branch/resume.');
}

// A consumed random input changes a later ragdoll even when both worlds have the same pose snapshot.
{
  const make = () => new Sim(defaultLevel(), { seed: 77 });
  const a = make(), b = make(), repairedA = make(), repairedB = make();
  const beforeSame = a.W.hash() === b.W.hash();
  a.rnd();
  repairedA.rnd(); repairedB.rnd();
  const restored = a.W.restore(b.W.snapshot(), false);
  for (const sim of [a, b, repairedA, repairedB]) sim.flopAt(0, 10, 5, 2, 'scope probe');
  const missedRandomState = a.W.hash() !== b.W.hash();
  const repairedTwinMatches = repairedA.W.hash() === repairedB.W.hash();
  record('hidden_rng_requires_its_own_checkpoint_or_input_trace',
    beforeSame && restored && missedRandomState && repairedTwinMatches,
    { beforeSame, restored, missedRandomState, repairedTwinMatches },
    'One same-host controlled RNG-consumption difference and repaired twin; not a cross-host result.');
}

const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const report = {
  schema: 'flop-lab.state-scope-probes/1', node: process.version,
  source_sha256: Object.fromEntries(['core', 'level', 'game'].map(name =>
    [name + '.js', sha(fs.readFileSync(new URL('../src/' + name + '.js', import.meta.url)))])),
  probes,
  limitations: [
    'Expected scope probes, not assertions that the current review snapshot is a full checkpoint.',
    'No browser, renderer, cross-host replay or formal Loom acceptance was executed.',
    'A future full-state implementation should replace these scope expectations with corresponding checkpoint controls.',
  ],
};
fs.writeFileSync(new URL('./new-controls.state-scope.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
process.exitCode = probes.every(row => row.pass) ? 0 : 1;
