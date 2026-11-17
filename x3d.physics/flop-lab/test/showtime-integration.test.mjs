// Real-Sim integration controls. No browser, renderer, audio or controller hardware is invoked.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const sourceNames = ['core', 'level', 'game', 'showtime'];
const sources = Object.fromEntries(sourceNames.map(name => [name + '.js', fs.readFileSync(new URL('../src/' + name + '.js', import.meta.url), 'utf8')]));
const context = vm.createContext({});
vm.runInContext(Object.values(sources).join('\n') + '\nthis.ShowTest={Sim,StuntShow,defaultLevel,NOINPUT};', context);
const { Sim, StuntShow, defaultLevel, NOINPUT } = context.ShowTest;
const dt = 1 / 60;
const rows = [];
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const input = values => ({ ...NOINPUT, ...values });
function pair(options) {
  const level = defaultLevel(), sim = new Sim(level), show = new StuntShow(options);
  show.resetRun(sim);
  return { level, sim, show };
}
function tick(p, values = {}) {
  const keys = input(values);
  const puff = p.show.beforeStep(p.sim, keys, dt);
  p.sim.step(keys, dt);
  p.show.afterStep(p.sim, keys, dt);
  return puff;
}
function float(p) {
  p.sim.flopAt(-2, 20, 2, 8, 'controlled high-altitude integration fixture');
  tick(p);
}
function check(name, fn) {
  const observed = fn();
  rows.push({ name, pass: true, observed });
  console.log('PASS ' + name);
}

check('neutral Show observations preserve every physical pose for a stock input trace', () => {
  const raw = pair(), observed = pair();
  const model = JSON.stringify(observed.level), trace = [];
  for (let frame = 0; frame < 300; frame++) {
    const keys = input({ x: frame >= 30 && frame < 120 ? 1 : 0,
      jump: frame >= 40 && frame < 70, jumpP: frame === 40,
      flopP: frame === 45 || frame === 100 || frame === 190 });
    raw.sim.step(keys, dt);
    tick(observed, keys);
    assert.equal(raw.sim.W.hash(), observed.sim.W.hash(), 'neutral physical divergence at tick ' + frame);
    trace.push(observed.sim.W.hash());
  }
  assert.equal(JSON.stringify(observed.level), model);
  return { checkedTicks: trace.length, poseTraceSha256: sha(JSON.stringify(trace)), sourceUnchanged: true };
});

check('hero puff is refused while a legal ragdoll puff applies equal finite velocity increments', () => {
  const p = pair();
  for (let frame = 0; frame < 40; frame++) tick(p);
  assert.ok(p.sim.ground);
  assert.equal(p.show.beforeStep(p.sim, input({ puffP: true }), dt), false);
  float(p);
  const source = JSON.stringify(p.level);
  const before = p.sim.ragList.map(b => ({ vx: b.vx, vy: b.vy }));
  const heroBefore = { vx: p.sim.hero.vx, vy: p.sim.hero.vy };
  assert.equal(p.show.beforeStep(p.sim, input({ puffP: true, x: 1, y: 1 }), dt), true);
  const delta = p.sim.ragList.map((b, i) => ({ x: b.vx - before[i].vx, y: b.vy - before[i].vy }));
  for (const d of delta) {
    assert.ok(Number.isFinite(d.x) && Number.isFinite(d.y));
    assert.ok(Math.abs(d.x - delta[0].x) < 1e-12 && Math.abs(d.y - delta[0].y) < 1e-12);
  }
  assert.ok(Math.hypot(delta[0].x, delta[0].y) > 0);
  assert.deepEqual({ vx: p.sim.hero.vx, vy: p.sim.hero.vy }, heroBefore);
  assert.equal(p.show.summary().puffsLeft, 2);
  assert.equal(p.show.beforeStep(p.sim, input({ puffP: true }), dt), false, 'same-tick/cooldown second pulse must refuse');
  assert.equal(JSON.stringify(p.level), source);
  return { ragBodies: delta.length, deltaVelocity: delta[0], puffsLeft: 2, inactiveHeroUnchanged: true, sourceUnchanged: true };
});

check('continuous puff requests consume at most three charges in one actual airborne stunt', () => {
  const p = pair(); float(p);
  let accepted = 0;
  for (let frame = 0; frame < 100; frame++) {
    if (tick(p, { puffP: true, y: 1 })) accepted++;
  }
  assert.equal(p.sim.mode, 'limp', 'fixture must remain the same live stunt');
  assert.equal(accepted, 3);
  assert.equal(p.show.summary().puffsLeft, 0);
  assert.equal(p.show.summary().puffReady, false);
  return { liveTicks: 100, acceptedPuffs: accepted, remainingCharges: 0 };
});

check('same-host puff input traces repeat while the disabled-mechanic twin diverges', () => {
  const a = pair(), b = pair(), disabled = pair({ puffs: false });
  for (const p of [a, b, disabled]) float(p);
  const trace = [], inputs = []; let differing = 0, accepted = 0;
  for (let frame = 0; frame < 150; frame++) {
    const keys = input({ x: frame < 80 ? 1 : -1, y: 1, puffP: [2, 35, 68].includes(frame) });
    if (tick(a, keys)) accepted++;
    tick(b, keys); tick(disabled, keys);
    assert.equal(a.sim.W.hash(), b.sim.W.hash(), 'same-input physical divergence at tick ' + frame);
    if (a.sim.W.hash() !== disabled.sim.W.hash()) differing++;
    trace.push(a.sim.W.hash()); inputs.push(keys);
  }
  assert.equal(accepted, 3); assert.ok(differing > 0);
  return { checkedTicks: trace.length, acceptedPuffs: accepted, changedMechanicDifferingTicks: differing,
    inputSha256: sha(JSON.stringify(inputs)), poseTraceSha256: sha(JSON.stringify(trace)),
    scope: 'One local Node executor and a controlled high-altitude starting pose; not browser feel or cross-host evidence.' };
});

check('an ordinary stock-spawn jump-flop-three-puff-recover trace banks a scored stunt', () => {
  const p = pair(); let puffs = 0;
  const initial = { x: p.sim.hero.x, y: p.sim.hero.y };
  for (let frame = 0; frame < 125; frame++) {
    if (tick(p, { jump: frame >= 40 && frame < 70, jumpP: frame === 40,
      flopP: frame === 45 || frame === 115, puffP: [47, 71, 95].includes(frame), y: 1 })) puffs++;
  }
  const q = p.show.summary();
  assert.equal(puffs, 3); assert.equal(p.sim.mode, 'hero');
  assert.ok(q.banked > 0); assert.ok(q.best > 0);
  assert.equal(q.lastBank.puffs, 3);
  assert.ok(q.stickers.find(s => s.id === 'puffin').earned);
  return { initial, acceptedPuffs: puffs, banked: q.banked, best: q.best, lastBank: q.lastBank,
    input: { settleTicks: 40, jumpOnTick: 41, flopOnTick: 46, upwardPuffsOnTicks: [48, 72, 96], recoverOnTick: 116 },
    scope: 'One ordinary stock-spawn fixed-step input trace; no manual teleport or initial pose modification.' };
});

check('live recovery banks an observed chain exactly once; respawn forfeits its unbanked twin', () => {
  const recover = pair(), respawn = pair();
  for (const p of [recover, respawn]) {
    float(p);
    for (let frame = 0; frame < 70; frame++) tick(p);
    assert.ok(p.show.summary().score > 0, 'airborne fixture must establish a real observed chain');
    assert.equal(p.show.summary().banked, 0);
  }
  recover.sim.stand(); tick(recover);
  const banked = recover.show.summary().banked;
  assert.ok(banked > 0);
  for (let i = 0; i < 10; i++) recover.show.afterStep(recover.sim, input(), dt);
  assert.equal(recover.show.summary().banked, banked, 'same physical frame cannot be paid repeatedly');
  respawn.sim.respawn(); tick(respawn);
  assert.equal(respawn.show.summary().banked, 0);
  assert.equal(respawn.show.summary().score, 0);
  return { recoveredBank: banked, duplicatedObservationBank: recover.show.summary().banked, respawnBank: 0, respawnChain: 0 };
});

check('a fresh run retains earned session records but drops pending score and ignores stale finished stunts', () => {
  const p = pair(); float(p);
  for (let frame = 0; frame < 70; frame++) tick(p);
  p.sim.stand(); tick(p);
  const earned = p.show.summary();
  assert.ok(earned.banked > 0);
  const fresh = new Sim(defaultLevel());
  p.show.resetRun(fresh);
  p.sim = fresh;
  const reset = p.show.summary();
  assert.equal(reset.banked, earned.banked); assert.equal(reset.best, earned.best);
  assert.equal(reset.score, 0);
  for (let frame = 0; frame < 90; frame++) tick(p);
  assert.equal(p.show.summary().banked, earned.banked);
  // Reattach to a real Sim which already has a finished result: old history must not pay.
  const old = pair(); float(old);
  for (let frame = 0; frame < 60; frame++) tick(old);
  old.sim.stand();
  const outsider = new StuntShow(); outsider.resetRun(old.sim);
  for (let frame = 0; frame < 20; frame++) {
    outsider.beforeStep(old.sim, input(), dt); old.sim.step(input(), dt); outsider.afterStep(old.sim, input(), dt);
  }
  assert.equal(outsider.summary().banked, 0);
  return { preservedBank: reset.banked, preservedBest: reset.best, pendingAfterReset: 0, staleResultBank: 0 };
});

check('the actual app tick guard prevents all live work during pose review, with a live-path sentinel control', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const start = app.indexOf('function tick() {'), end = app.indexOf('\nfunction solverFailed(', start);
  assert.ok(start >= 0 && end > start, 'actual app tick extraction points must exist');
  const state = { scrub: 0, get sim() { throw new Error('LIVE_PATH_SENTINEL'); } };
  const c = vm.createContext({ S: state });
  vm.runInContext(app.slice(start, end), c);
  assert.doesNotThrow(() => c.tick());
  state.scrub = -1;
  assert.throws(() => c.tick(), /LIVE_PATH_SENTINEL/);
  return { reviewRefusesLiveWorldAccess: true, livePathSentinelCaught: true, appSourceSha256: sha(app),
    scope: 'Actual extracted app function with a sentinel Sim accessor, not a browser or full app initialization.' };
});

const report = { schema: 'floplab.showtime-integration/1', node: process.version,
  source_sha256: Object.fromEntries(Object.entries(sources).map(([name, value]) => [name, sha(value)])),
  passed: rows.length, checks: rows,
  limitations: ['Real Sim in one Node host; fixtures deliberately name controlled initial states.',
    'No renderer, audio, player amusement, physical actuator model, browser input timing or formal Loom acceptance was measured.'] };
console.log(JSON.stringify(report));
console.log(`${rows.length} real-Sim Showtime integration controls passed`);
