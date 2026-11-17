// Real-Sim integration controls for the expedition hooks. No DOM or browser is invoked.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const sourceNames = ['core', 'level', 'game', 'expedition'];
const sources = Object.fromEntries(sourceNames.map(n => [n + '.js', fs.readFileSync(new URL('../src/' + n + '.js', import.meta.url), 'utf8')]));
const context = vm.createContext({});
vm.runInContext(Object.values(sources).join('\n') + '\nthis.M={Sim,Expedition,defaultLevel,NOINPUT};', context);
const { Sim, Expedition, defaultLevel, NOINPUT } = context.M;
const dt = 1 / 60, rows = [];
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function check(name, fn) { const observed = fn(); rows.push({ name, pass: true, observed }); console.log('PASS ' + name); }
function make(opt = {}) { const level = defaultLevel(); return { level, sim: new Sim(level), exp: new Expedition(level, opt) }; }
function tick(pair, input = NOINPUT) { pair.exp.beforeStep(pair.sim, input, dt); pair.sim.step(input, dt); pair.exp.afterStep(pair.sim, input, dt); }

check('neutral expedition hooks preserve every stock physical pose hash for an identical model and input trace', () => {
  const left = make(), right = make(), modelBefore = JSON.stringify(right.level);
  assert.equal(JSON.stringify(left.level), modelBefore);
  const trace = [];
  for (let frame = 0; frame < 300; frame++) {
    const input = { ...NOINPUT, x: frame >= 30 && frame < 120 ? 1 : 0,
      jump: frame >= 45 && frame < 70, jumpP: frame === 45, flopP: frame === 95 || frame === 175 };
    left.sim.step(input, dt); tick(right, input);
    assert.equal(left.sim.W.hash(), right.sim.W.hash(), 'physical divergence at frame ' + frame);
    trace.push(right.sim.W.hash());
  }
  assert.equal(JSON.stringify(right.level), modelBefore);
  return { checkedSteps: trace.length, finalPoseHash: trace.at(-1), traceSha256: sha(JSON.stringify(trace)), modelUnchanged: true };
});

check('grounded dash is refused and one airborne burst changes the real trajectory against a disabled twin', () => {
  const enabled = make(), disabled = make({ dash: false });
  for (let frame = 0; frame < 30; frame++) { tick(enabled); tick(disabled); }
  assert.ok(enabled.sim.ground && disabled.sim.ground);
  assert.equal(enabled.exp.beforeStep(enabled.sim, { ...NOINPUT, x: 1, dashP: true }, dt), false);
  for (const pair of [enabled, disabled]) tick(pair, { ...NOINPUT, jump: true, jumpP: true });
  assert.equal(enabled.sim.ground, null);
  const input = { ...NOINPUT, x: 1, jump: true, dashP: true };
  tick(enabled, input); tick(disabled, input);
  assert.equal(enabled.exp.dashes, 1); assert.equal(disabled.exp.dashes, 0);
  assert.notEqual(enabled.sim.W.hash(), disabled.sim.W.hash());
  assert.equal(enabled.exp.beforeStep(enabled.sim, input, dt), false);
  return { enabledDashes: enabled.exp.dashes, disabledDashes: disabled.exp.dashes,
    enabledPoseHash: enabled.sim.W.hash(), disabledPoseHash: disabled.sim.W.hash() };
});

check('two real dash input traces repeat on this host while the changed-input twin diverges', () => {
  const a = make(), b = make(), noDash = make(); const inputHashes = [], trace = []; let differing = 0;
  for (let frame = 0; frame < 180; frame++) {
    const input = { ...NOINPUT, x: frame < 110 ? 1 : 0, jump: frame >= 30 && frame < 60,
      jumpP: frame === 30, dashP: frame === 33, flopP: frame === 90 };
    tick(a, input); tick(b, input); tick(noDash, { ...input, dashP: false });
    assert.equal(a.sim.W.hash(), b.sim.W.hash(), 'same-input divergence at frame ' + frame);
    if (a.sim.W.hash() !== noDash.sim.W.hash()) differing++;
    inputHashes.push(input); trace.push(a.sim.W.hash());
  }
  assert.ok(a.exp.dashes > 0); assert.ok(differing > 0);
  return { checkedSteps: trace.length, dashCount: a.exp.dashes, changedInputDifferingSteps: differing,
    inputTraceSha256: sha(JSON.stringify(inputHashes)), poseTraceSha256: sha(JSON.stringify(trace)) };
});

check('First Flight accepts actual ragdoll airtime while upright flight is a negative control', () => {
  const positive = make(), upright = make();
  for (const pair of [positive, upright]) {
    pair.exp.start('first-flight', pair.sim);
    pair.sim.hero.y = 12; pair.sim.hero.py = 12; pair.sim.hero.vy = 12;
  }
  for (let frame = 0; frame < 100; frame++) {
    tick(positive, { ...NOINPUT, jump: true, flopP: frame === 0 });
    tick(upright, { ...NOINPUT, jump: true });
  }
  assert.equal(positive.exp.state, 'complete'); assert.equal(positive.exp.medal, 'gold');
  assert.equal(upright.exp.state, 'active'); assert.equal(upright.exp.progress, 0);
  return { realRagdollProgress: positive.exp.progress, uprightProgress: upright.exp.progress,
    achievedAtFixedSeconds: positive.exp.time, positiveMedal: positive.exp.medal,
    scope: 'Controlled high-altitude initial pose isolates objective semantics; this is not a normal-course player completion.' };
});

check('First Flight is achievable from the stock spawn by an ordinary jump then flop input trace', () => {
  const pair = make(), upright = make();
  pair.exp.start('first-flight', pair.sim); upright.exp.start('first-flight', upright.sim);
  const initial = { x: pair.sim.hero.x, y: pair.sim.hero.y };
  for (let frame = 0; frame < 120; frame++) {
    const input = { ...NOINPUT, jump: frame >= 40 && frame < 70, jumpP: frame === 40, flopP: frame === 45 };
    tick(pair, input); tick(upright, { ...input, flopP: false });
  }
  assert.equal(pair.exp.state, 'complete'); assert.equal(pair.exp.medal, 'gold');
  assert.equal(upright.exp.state, 'active'); assert.equal(upright.exp.progress, 0);
  return { initial, thresholdSeconds: pair.exp.current.goal, recordedRagdollAirtime: pair.exp.progress,
    fixedSecondsAtCompletion: pair.exp.time, medal: pair.exp.medal,
    input: { settleSteps: 40, jumpOnStep: 41, flopOnStep: 46, jumpHeldThroughStep: 70 },
    scope: 'One stock-level fixed-step Node input trace, not a human feel or browser timing measurement.' };
});

check('real respawn fails the attempt and retry establishes a fresh death baseline', () => {
  const pair = make(); pair.exp.start('contact-run', pair.sim);
  pair.sim.respawn(); tick(pair);
  assert.equal(pair.exp.state, 'failed'); assert.equal(pair.exp.medal, null);
  const deaths = pair.sim.deaths; pair.exp.reset(pair.sim); tick(pair);
  assert.equal(pair.sim.deaths, deaths); assert.equal(pair.exp.state, 'active');
  return { deaths, stateAfterRetry: pair.exp.state };
});

check('real completed ragdoll objective remains practice after invalidation and retry', () => {
  const pair = make(); pair.exp.start('first-flight', pair.sim); pair.exp.invalidate('Controlled model edit'); pair.exp.reset(pair.sim);
  pair.sim.hero.y = 12; pair.sim.hero.py = 12; pair.sim.hero.vy = 12;
  for (let frame = 0; frame < 100; frame++) tick(pair, { ...NOINPUT, jump: true, flopP: frame === 0 });
  assert.equal(pair.exp.state, 'complete'); assert.equal(pair.exp.medal, null);
  assert.equal(pair.exp.completed.size, 0); assert.equal(pair.exp.bestByMission.size, 0);
  return { state: pair.exp.state, eligible: pair.exp.eligible, medal: pair.exp.medal,
    completedRecords: pair.exp.completed.size, bestRecords: pair.exp.bestByMission.size };
});

check('actual mission-start lifecycle rebuilds physical state while free exploration preserves it', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const codec = fs.readFileSync(new URL('../src/x3dio.js', import.meta.url), 'utf8');
  const take = (name, next) => {
    const from = app.indexOf('function ' + name + '('), to = app.indexOf('\nfunction ' + next + '(', from);
    assert.ok(from >= 0 && to > from, 'app lifecycle extraction points must exist');
    return app.slice(from, to);
  };
  const nodes = new Map(), messages = [], view = { load(world) { this.loadedWorld = world; } };
  const node = () => ({ classList: { remove() {} }, focus() {} });
  const lifecycle = vm.createContext({
    view, performance: { now: () => 0 }, held: new Set(), jumpQ: false, flopQ: false, dashQ: false,
    $: id => { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); },
    returnLive() {}, drop() {}, buildHalls() {}, freshX3D() {}, buildMissions() {}, updateInspector() {}, updateExpedition() {},
    toast(message) { messages.push(message); },
  });
  vm.runInContext(Object.values(sources).join('\n') + '\n' + codec + '\nthis.Lab={Sim,Expedition,defaultLevel};\n' +
    take('rebuild', 'liveAdd') + '\n' + take('beginMission', 'updateExpedition'), lifecycle);
  const level = lifecycle.Lab.defaultLevel(), oldSim = new lifecycle.Lab.Sim(level), campaign = new lifecycle.Lab.Expedition(level);
  for (let frame = 0; frame < 5; frame++) oldSim.step(NOINPUT, dt);
  const fallen = oldSim.W.bodies.find(b => b.role === 'crate'); assert.ok(fallen);
  fallen.x += 4; fallen.a = .7;
  campaign.completed.add('collector'); campaign.bestByMission.set('collector', { time: 7, medal: 'fixture', poses: [] });
  lifecycle.S = { level, sim: oldSim, expedition: campaign, tune: {}, feel: {}, kernel: null, practiceReason: '',
    replay: [], energy: [], tab: 'play', selectedId: null, ghostTrail: [], liveSnapshot: null };
  lifecycle.beginMission('first-flight');
  const fresh = lifecycle.S.sim;
  assert.notEqual(fresh, oldSim); assert.equal(fresh.W.frame, 0); assert.equal(fresh.W.time, 0);
  assert.equal(lifecycle.S.expedition, campaign); assert.ok(campaign.completed.has('collector'));
  assert.equal(campaign.bestByMission.get('collector').time, 7);
  const repaired = fresh.W.byId.get(fallen.id);
  assert.equal(repaired.x, repaired.spec.x); assert.equal(repaired.a, repaired.spec.a || 0);
  assert.equal(view.loadedWorld, fresh.W);
  fresh.W.step(dt); const frameBeforeFree = fresh.W.frame;
  lifecycle.beginMission('free');
  assert.equal(lifecycle.S.sim, fresh); assert.equal(fresh.W.frame, frameBeforeFree);
  lifecycle.beginMission('not-a-real-challenge');
  assert.equal(lifecycle.S.sim, fresh); assert.match(messages.at(-1), /unavailable/);
  return { newPhysicalWorld: true, challengeFrameAtStart: 0, retainedCampaignObject: true,
    restoredSourceObstaclePose: true, freeplayRetainsWorld: true, unavailableMissionLeavesWorld: true,
    appSourceSha256: sha(app), codecSourceSha256: sha(codec),
    scope: 'Actual app lifecycle functions plus real Sim/Expedition/validator; view and DOM adapters are non-browser stubs.' };
});

const report = { schema: 'flop-lab.expedition-integration/1', node: process.version,
  source_sha256: Object.fromEntries(Object.entries(sources).map(([name, value]) => [name, sha(value)])),
  passed: rows.length, checks: rows,
  limitations: ['Actual Sim and Expedition hooks in one Node host.',
    'No browser input, player feel, cross-host replay, external leaderboard or formal Loom acceptance was measured.',
    'Game medal thresholds are authored design values, separate from scientific solver gates.'] };
fs.writeFileSync(new URL('./new-controls.expedition-integration.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(`${rows.length} real-Sim integration controls passed`);
