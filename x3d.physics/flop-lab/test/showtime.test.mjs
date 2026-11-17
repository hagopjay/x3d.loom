// Actual Sim controls plus named adapter-event negative controls; no browser.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const names = ['core', 'level', 'game', 'showtime'];
const source = names.map(n => fs.readFileSync(new URL('../src/' + n + '.js', import.meta.url), 'utf8')).join('\n');
const ctx = vm.createContext({});
vm.runInContext(source + '\nthis.api={Sim,StuntShow,defaultLevel,newLevel,addPart,NOINPUT};', ctx);
const { Sim, StuntShow, defaultLevel, newLevel, addPart, NOINPUT } = ctx.api;
const dt = 1 / 60;
let count = 0;
function check(name, fn) { fn(); count++; console.log('PASS ' + name); }
function make(opt = {}) {
  const level = newLevel({ gravity: 22, substeps: 8, iters: 1 });
  addPart(level, 'platform', { x: 0, y: -1, w: 80, h: 1 }, 'floor');
  const sim = new Sim(level), show = new StuntShow(opt); show.resetRun(sim);
  return { level, sim, show };
}
function tick(p, input = NOINPUT) {
  const fired = p.show.beforeStep(p.sim, input, dt); p.sim.step(input, dt); p.show.afterStep(p.sim, input, dt); return fired;
}
function air(p) { p.sim.flopAt(-2, 20, 3, 8, 'controlled high-altitude fixture'); tick(p); }

check('the judge enforces fixed-step units at both hooks', () => {
  const p = make(); assert.throws(() => p.show.beforeStep(p.sim, {}, .01), /1\/60/);
  assert.throws(() => p.show.afterStep(p.sim, {}, NaN), /1\/60/);
});
check('neutral judge hooks preserve 240 real stock physics poses and source bytes', () => {
  const level = defaultLevel(), other = defaultLevel(), a = new Sim(level), b = new Sim(other), show = new StuntShow();
  const model = JSON.stringify(other); show.resetRun(b);
  for (let frame = 0; frame < 240; frame++) {
    const input = { ...NOINPUT, x: frame > 50 && frame < 130 ? 1 : 0, jump: frame >= 40 && frame < 70,
      jumpP: frame === 40, flopP: frame === 45 || frame === 100 };
    a.step(input, dt); show.beforeStep(b, input, dt); b.step(input, dt); show.afterStep(b, input, dt);
    assert.equal(a.W.hash(), b.W.hash(), 'pose divergence at ' + frame);
  }
  assert.equal(JSON.stringify(other), model);
});
check('upright puff input refuses and neither consumes charges nor invents tricks', () => {
  const p = make(); for (let n = 0; n < 40; n++) tick(p);
  assert.equal(tick(p, { ...NOINPUT, puffP: true }), false);
  assert.equal(p.show.summary().stats.puffs, 0); assert.equal(p.show.summary().banked, 0);
});
check('one real ragdoll puff gives every active limb exactly the same bounded delta-v', () => {
  const p = make(); air(p); const old = p.sim.ragList.map(b => ({ vx: b.vx, vy: b.vy }));
  assert.equal(p.show.beforeStep(p.sim, { ...NOINPUT, x: 1, y: 1, puffP: true }, dt), true);
  const first = p.sim.ragList[0], dx = first.vx - old[0].vx, dy = first.vy - old[0].vy;
  assert.ok(Math.abs(Math.sqrt(dx * dx + dy * dy) - 6) < 1e-12);
  p.sim.ragList.forEach((b, i) => { assert.ok(Math.abs((b.vx - old[i].vx) - dx) < 1e-12); assert.ok(Math.abs((b.vy - old[i].vy) - dy) < 1e-12); });
  assert.equal(p.show.summary().puffsLeft, 2);
  assert.equal(p.show.beforeStep(p.sim, { ...NOINPUT, puffP: true }, dt), false, 'duplicate preparation refuses');
});
check('cooldown and three-charge ceiling refuse repeated input within a real flop', () => {
  const p = make(); air(p); assert.equal(tick(p, { ...NOINPUT, puffP: true }), true);
  assert.equal(tick(p, { ...NOINPUT, puffP: true }), false);
  for (let n = 0; n < 25; n++) tick(p);
  assert.equal(tick(p, { ...NOINPUT, puffP: true }), true);
  for (let n = 0; n < 25; n++) tick(p);
  assert.equal(tick(p, { ...NOINPUT, puffP: true }), true);
  for (let n = 0; n < 25; n++) tick(p);
  assert.equal(tick(p, { ...NOINPUT, puffP: true }), false);
  assert.equal(p.show.summary().stats.puffs, 3); assert.equal(p.show.summary().puffsLeft, 0);
});
check('enabled puff changes a real trajectory while its disabled twin stays unpowered', () => {
  const a = make(), b = make({ puffs: false }); air(a); air(b);
  assert.equal(a.sim.W.hash(), b.sim.W.hash());
  assert.equal(tick(a, { ...NOINPUT, puffP: true }), true);
  assert.equal(tick(b, { ...NOINPUT, puffP: true }), false);
  assert.notEqual(a.sim.W.hash(), b.sim.W.hash());
});
check('malformed direction falls back to a finite default without mutating the source level', () => {
  const p = make(), original = JSON.stringify(p.level); air(p);
  assert.equal(tick(p, { ...NOINPUT, x: NaN, y: Infinity, puffP: true }), true);
  assert.ok(p.sim.ragList.every(b => [b.vx, b.vy, b.x, b.y].every(Number.isFinite)));
  assert.equal(JSON.stringify(p.level), original);
});
check('pending style banks only after actual recovery and duplicate observation cannot pay twice', () => {
  const p = make(); air(p); for (let n = 0; n < 55; n++) tick(p);
  assert.ok(p.show.summary().score > 0); assert.equal(p.show.summary().banked, 0);
  p.sim.stand(); tick(p); const bank = p.show.summary().banked;
  assert.ok(bank > 0); assert.equal(p.show.summary().stats.banks, 1);
  p.show.afterStep(p.sim, NOINPUT, dt); assert.equal(p.show.summary().banked, bank);
  tick(p); assert.equal(p.show.summary().banked, bank);
});
check('respawn forfeits pending style instead of awarding a recovery or sticker', () => {
  const p = make(); air(p); for (let n = 0; n < 35; n++) tick(p);
  assert.ok(p.show.summary().score > 0); p.sim.respawn(); tick(p);
  const s = p.show.summary(); assert.equal(s.banked, 0); assert.equal(s.stats.banks, 0);
  assert.equal(s.stats.lostChains, 1); assert.equal(s.stickers.filter(q => q.earned).length, 0);
});
check('rebuild retains session records but refuses an old completed result and starts no chain', () => {
  const p = make(); air(p); for (let n = 0; n < 40; n++) tick(p); p.sim.stand(); tick(p);
  const old = p.show.summary(), fresh = new Sim(p.level); fresh.lastStunt = p.sim.lastStunt;
  p.sim = fresh; p.show.resetRun(fresh); tick(p);
  assert.equal(p.show.summary().banked, old.banked); assert.equal(p.show.summary().best, old.best);
  assert.equal(p.show.summary().active, false); assert.equal(p.show.summary().stats.banks, old.stats.banks);
});
check('new flop reload is explicit arcade behavior, with a fresh chain multiplier', () => {
  const p = make(); air(p); tick(p, { ...NOINPUT, puffP: true });
  assert.equal(p.show.summary().puffsLeft, 2); p.sim.stand(); tick(p);
  p.sim.flop(p.sim.hero.vx, p.sim.hero.vy, 'second fixture flop'); tick(p);
  assert.equal(p.show.summary().puffsLeft, 3); assert.ok(p.show.summary().combo <= 1);
});
check('a bare dash key does not pretend a dash ability actually fired', () => {
  const p = make(); tick(p, { ...NOINPUT, dashP: true }); air(p);
  assert.ok(!p.show.summary().events.some(e => e.trick === 'dash'));
  assert.ok(!p.show.chain.families.has('launch'));
});
check('nonfinite observed angle forfeits the pending chain instead of masking NaN as zero', () => {
  const p = make(); air(p); for (let n = 0; n < 25; n++) tick(p);
  assert.ok(p.show.summary().score > 0);
  // Inject at the observation boundary; do not step a corrupt physical model.
  p.sim.W.step(dt); p.sim.rag.chest.a = NaN; p.show.afterStep(p.sim, NOINPUT, dt);
  assert.equal(p.show.summary().active, false); assert.equal(p.show.summary().puffsLeft, 0);
  assert.equal(p.show.summary().banked, 0);
});
check('repeating the same observed hit cannot farm points and fresh zero-speed hits refuse', () => {
  const p = make(); air(p); for (let n = 0; n < 12; n++) tick(p);
  const floor = p.sim.W.bodies.find(b => b.id.startsWith('floor'));
  assert.ok(floor); const c = p.show.chain, baseline = c.raw;
  // Named adapter-event fixture: keep physical ticks real, inject one report at
  // their observation boundary. The second identical partner remains refused.
  p.sim.rag.chest.x += 2; p.sim.W.step(dt);
  p.sim.W.events = [{ a: p.sim.rag.chest, b: floor, speed: 8 }]; p.sim.fx.length = 0;
  p.show.afterStep(p.sim, NOINPUT, dt); assert.equal(c.bonks, 1);
  const scored = c.raw; assert.ok(scored > baseline);
  p.sim.rag.chest.x += 3; p.sim.W.step(dt);
  p.sim.W.events = [{ a: p.sim.rag.chest, b: floor, speed: 9 }]; p.show.afterStep(p.sim, NOINPUT, dt);
  assert.equal(c.bonks, 1); assert.equal(c.raw, scored);
  const other = { role: 'static', id: 'another-object' };
  p.sim.W.step(dt); p.sim.W.events = [{ a: p.sim.rag.chest, b: other, speed: 0 }]; p.show.afterStep(p.sim, NOINPUT, dt);
  assert.equal(c.bonks, 1);
});
check('old bank never fulfills a newly selected spotlight and prompts are open in any order', () => {
  const p = make(); air(p); for (let n = 0; n < 35; n++) tick(p); p.sim.stand(); tick(p);
  assert.equal(p.show.summary().prompt.complete, true);
  p.show.selectPrompt('puff'); tick(p); assert.equal(p.show.summary().prompt.complete, false);
  assert.equal(p.show.summary().prompt.progress, 0);
  assert.throws(() => p.show.selectPrompt('secret-nonsense'), /Unknown/);
  p.show.selectPrompt('finale'); assert.equal(p.show.summary().prompt.id, 'finale');
});
check('event sequence survives reset and returned summaries cannot mutate internal sets', () => {
  const p = make(); air(p); const first = p.show.summary().events.at(-1).seq;
  const s = p.show.summary(); s.events.length = 0; s.stickers[0].earned = true;
  assert.ok(p.show.events.length > 0); assert.equal(p.show.summary().stickers[0].earned, false);
  p.show.resetRun(new Sim(p.level)); p.sim = new Sim(p.level); p.show.resetRun(p.sim); air(p);
  assert.ok(p.show.summary().events.at(-1).seq > first);
  assert.doesNotThrow(() => JSON.stringify(p.show.summary()));
});
console.log(count + ' Showtime controls passed');
