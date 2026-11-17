import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const source = ['core', 'level', 'recipes', 'game', 'expedition', 'showtime', 'x3dio']
  .map(f => fs.readFileSync(new URL('src/' + f + '.js', root), 'utf8')).join('\n');
const M = vm.runInNewContext(source + '\n({createLabWorld, Sim, NOINPUT, Expedition, StuntShow, validateLevel, PREFABS});');
const dt = 1 / 60;
const digest = x => crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
let checks = 0;
function check(name, f) { f(); checks++; console.log('PASS ' + name); }

// These are serialized source identities from the previous committed release,
// retained before the carnival branch was added; they are not pose hashes.
const original = {
  museum: 'cfa68107223b1c1652190e0adc5d4fdde660a8e57badf85fe9d5f2d58e2cc928',
  skyline: 'ab2d39dd8e9b4cdac8385976ec9363835fed621da2eaff47dd96b7067da645d7',
  cascade: '1d0d79921756fa6ea91a395e87596b3b138065201102349286ace680232ee508',
  tidal: 'b6627eca7cfc76fdf6b76704b094f237d6d48e69807300c4eb6fffcf6895ee0f'
};
for (const [id, expected] of Object.entries(original)) check('previous source identity: ' + id,
  () => assert.equal(digest(M.createLabWorld(id, 7)), expected));

check('same carnival seed repeats; another seed changes retained source', () => {
  assert.equal(digest(M.createLabWorld('carnival', 7)), digest(M.createLabWorld('carnival', 7)));
  assert.notEqual(digest(M.createLabWorld('carnival', 7)), digest(M.createLabWorld('carnival', 8)));
});

check('carnival stays inside existing supported-prefab and expansion budgets', () => {
  const L = M.createLabWorld('carnival', 7);
  assert.equal(M.validateLevel(L).valid, true);
  assert.ok(L.bodies.length <= 120);
  assert.ok(L.parts.every(p => Object.hasOwn(M.PREFABS, p.kind)));
  assert.deepEqual(Array.from(L.parts.filter(p => p.kind === 'checkpoint'), p => p.id),
    ['cp_feel', 'cp_contact', 'cp_joints', 'cp_soft', 'cp_fields', 'cp_cannon']);
  const ids = [...L.bodies, ...L.joints, ...L.zones].map(q => q.id);
  assert.equal(new Set(ids).size, ids.length);
});

check('normal carnival spawn settles safely through 300 real ticks', () => {
  const sim = new M.Sim(M.createLabWorld('carnival', 7));
  for (let i = 0; i < 300; i++) sim.step(M.NOINPUT, dt);
  assert.equal(sim.deaths, 0);
  assert.equal(sim.mode, 'hero');
  assert.ok(sim.hero.y > 0.65 && sim.hero.y < 0.75);
  assert.ok(sim.W.bodies.every(b => [b.x, b.y, b.a, b.vx, b.vy, b.om].every(Number.isFinite)));
});

function debut(puffs = false, run = false) {
  const level = M.createLabWorld('carnival', 7), sourceBefore = digest(level);
  const sim = new M.Sim(level), show = new M.StuntShow(); show.resetRun(sim);
  let air = 0, peak = 0; const hashes = [];
  // Ordinary input from the authored spawn: no pose/velocity edits or goTo.
  for (let tick = 0; tick < 300; tick++) {
    const input = { ...M.NOINPUT, x: run && tick > 40 ? 1 : 0,
      jump: tick >= 41 && tick <= 70, jumpP: tick === 41,
      flopP: tick === 46 || (run && tick === 150), puffP: puffs && [60, 85, 110].includes(tick) };
    show.beforeStep(sim, input, dt); sim.step(input, dt); show.afterStep(sim, input, dt);
    if (sim.stunt) air = Math.max(air, sim.stunt.air);
    peak = Math.max(peak, sim.focus().y); hashes.push(sim.W.hash());
  }
  assert.equal(digest(level), sourceBefore);
  return { sim, show, air, peak, hashes };
}
let plain, puffed;
check('ordinary jump/flop is feasible from carnival spawn without puffs', () => {
  plain = debut(); assert.equal(plain.sim.deaths, 0);
  assert.ok(plain.air >= 0.8); assert.ok(plain.show.summary().banked > 0);
});
check('three legal puffs extend that real trajectory against its no-puff twin', () => {
  puffed = debut(true);
  assert.equal(puffed.sim.deaths, 0); assert.equal(puffed.show.summary().stats.puffs, 3);
  assert.ok(puffed.air > plain.air + 0.5); assert.ok(puffed.peak > plain.peak + 0.5);
  assert.notDeepEqual(puffed.hashes, plain.hashes);
});
check('carnival puff trace repeats on this executor with identical inputs', () => {
  assert.deepEqual(debut(true).hashes, puffed.hashes);
});
check('ordinary movement crosses the first bowling checkpoint without a respawn', () => {
  const { sim } = debut(false, true);
  assert.equal(sim.deaths, 0); assert.ok(sim.focus().x > 14);
});

function cannon(seed, fireTick) {
  const sim = new M.Sim(M.createLabWorld('carnival', seed));
  const expedition = new M.Expedition(sim.level);
  // This is the authored mission's checkpoint start, not a complete traversal
  // from the entrance. All entry, waiting, fire and collision use real input.
  expedition.start('bullseye', sim);
  let entered = false, fired = false, hit = false;
  for (let tick = 0; tick < 190; tick++) {
    const input = { ...M.NOINPUT, x: sim.mode === 'hero' && tick < 50 ? 1 : 0,
      y: sim.mode === 'hero' && tick < 50 ? 1 : 0, jumpP: tick === fireTick };
    expedition.beforeStep(sim, input, dt); sim.step(input, dt); expedition.afterStep(sim, input, dt);
    entered ||= sim.mode === 'cannon'; fired ||= !!sim.stunt?.cannon; hit ||= !!sim.stunt?.goal;
  }
  return { sim, expedition, entered, fired, hit };
}
check('unmodified cannon aim hits the forgiving target across four declared seeds', () => {
  for (const seed of [0, 1, 7, 2147483647]) {
    const r = cannon(seed, 65);
    assert.ok(r.entered && r.fired && r.hit); assert.equal(r.expedition.state, 'complete');
    assert.equal(r.sim.deaths, 0);
  }
});
check('early fire is refused and cannot claim that cannon target', () => {
  const r = cannon(7, 10);
  assert.ok(r.entered); assert.equal(r.fired, false); assert.equal(r.hit, false);
  assert.notEqual(r.expedition.state, 'complete');
});

console.log('Carnival controls: ' + checks + ' pass. Real local Sim/input traces; no renderer, cross-host or human-fun result claimed.');
