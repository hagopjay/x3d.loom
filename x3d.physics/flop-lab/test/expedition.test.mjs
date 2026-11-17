import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../src/expedition.js', import.meta.url), 'utf8');
const context = vm.createContext({});
vm.runInContext(source + '\nthis.Expedition = Expedition;', context);
const { Expedition } = context, dt = 1 / 60;
let count = 0;
function check(name, test) { test(); count++; console.log('PASS ' + name); }
const zones = [0, 20, 40, 60, 80, 100, 120].map((x, i) => ({ kind: 'checkpoint', name: String(i), x, y: 2, w: 2, h: 4 }));
zones.push({ kind: 'star', id: 'a' }, { kind: 'star', id: 'b' }, { kind: 'fan', x: 80, y: 4, w: 4, h: 10 }, { kind: 'cannon' }, { kind: 'goal' });
function fake() {
  return { W: { zones: zones.map(z => ({ ...z })) }, hero: { x: 0, y: 1, vx: 0, vy: 0, off: false }, ground: null,
    hook: null, mode: 'hero', face: 1, lock: 0, deaths: 0, stars: 0, stunt: null, lastStunt: null,
    focus() { return this.mode === 'limp' ? this.chest : this.hero; },
    chest: { x: 0, y: 1, a: 0 },
    goTo(x, y) { this.hero.x = x; this.hero.y = y + .8; this.mode = 'hero'; this.stunt = null; } };
}
function advance(exp, sim, frames = 1, input = {}) { for (let i = 0; i < frames; i++) { exp.beforeStep(sim, input, dt); exp.afterStep(sim, input, dt); } }

check('Free play is the default and every physically available chapter remains selectable', () => {
  const e = new Expedition({ zones }); assert.equal(e.summary().state, 'free'); assert.equal(e.missions.length, 6);
  assert.ok(e.summary().missions.every(m => m.available && m.unlocked));
  assert.equal(new Expedition({ zones: [] }).missions.filter(m => m.available).length, 2);
});
check('Starting an unavailable chapter refuses without mutating a live run', () => {
  const e = new Expedition({ zones: [] }), s = fake(); e.start('first-flight', s);
  assert.throws(() => e.start('bullseye', s), /unavailable/); assert.equal(e.summary().id, 'first-flight');
});
check('Upright airtime is not First Flight; one actual ragdoll airtime threshold completes', () => {
  const e = new Expedition({ zones }), s = fake(); e.start('first-flight', s); advance(e, s, 60);
  assert.equal(e.state, 'active'); assert.equal(e.progress, 0);
  s.mode = 'limp'; s.stunt = { air: .79 }; advance(e, s); assert.equal(e.state, 'active');
  s.stunt.air = .8; advance(e, s); assert.equal(e.state, 'complete'); assert.equal(e.medal, 'gold');
});
check('Completed stunts can satisfy airtime but a stale earlier result is not borrowed', () => {
  const e = new Expedition({ zones }), s = fake(); s.lastStunt = { airtime_s: 4 }; e.start('first-flight', s); advance(e, s);
  assert.equal(e.state, 'active'); s.lastStunt = { airtime_s: .8 }; advance(e, s); assert.equal(e.state, 'complete');
});
check('Air Mail requires finishing the current distant flop, not passing through 12 m in midair', () => {
  const e = new Expedition({ zones }), s = fake(); e.start('airmail', s); s.mode = 'limp'; s.stunt = { dist: 20, air: 2 }; advance(e, s);
  assert.equal(e.progress, 0); s.mode = 'hero'; s.stunt = null; s.lastStunt = { distance_m: 12, airtime_s: 2 }; advance(e, s);
  assert.equal(e.state, 'complete');
});
check('Collector resets fresh stars and cannot complete with one', () => {
  const e = new Expedition({ zones }), s = fake(); s.stars = 9; s.W.zones.find(z => z.kind === 'star').got = true;
  e.start('collector', s); assert.equal(s.stars, 0); assert.ok(s.W.zones.filter(z => z.kind === 'star').every(z => !z.got));
  s.stars = 1; advance(e, s); assert.equal(e.state, 'active'); s.stars = 2; advance(e, s); assert.equal(e.state, 'complete');
});
check('Contact Sprint requires the destination region, not a distant x coordinate', () => {
  const e = new Expedition({ zones }), s = fake(); e.start('contact-run', s); s.hero.x = 20; s.hero.y = 80; advance(e, s);
  assert.equal(e.state, 'active'); s.hero.y = .8; advance(e, s); assert.equal(e.state, 'complete');
});
check('Wind Rider requires limp contact with a fan before height qualifies', () => {
  const e = new Expedition({ zones }), s = fake(); e.start('windrider', s);
  s.mode = 'limp'; s.stunt = { y0: 0, peakY: 6, air: 1 }; s.chest.x = 10; s.chest.y = 6; advance(e, s); assert.equal(e.state, 'active');
  s.chest.x = 80; advance(e, s); assert.equal(e.state, 'active');
  s.chest.y = 11; advance(e, s); assert.equal(e.state, 'complete');
});
check('An old peak before fan entry and a separate later flop cannot satisfy the wind rise', () => {
  const e = new Expedition({ zones }), s = fake(); e.start('windrider', s);
  s.mode = 'limp'; s.stunt = { y0: 0, peakY: 20, air: 1 }; s.chest.x = 10; s.chest.y = 20; advance(e, s);
  s.chest.x = 80; s.chest.y = 6; advance(e, s); assert.equal(e.progress, 0);
  s.chest.y = 4; advance(e, s); assert.equal(e.progress, 0);
  s.stunt = { y0: 0, peakY: 15, air: 1 }; s.chest.x = 10; s.chest.y = 15; advance(e, s);
  assert.equal(e.state, 'active'); assert.equal(e.progress, 0);
});
check('A generic goal hit cannot satisfy Cannon Post without a cannon launch', () => {
  const e = new Expedition({ zones }), s = fake(); e.start('bullseye', s); s.mode = 'limp'; s.stunt = { goal: true }; advance(e, s);
  assert.equal(e.state, 'active'); s.stunt.cannon = { angle: 45, power: 32 }; advance(e, s); assert.equal(e.state, 'complete');
});
check('Respawning fails the attempt and a retry resets its death baseline', () => {
  const e = new Expedition({ zones }), s = fake(); e.start('first-flight', s); s.deaths++; advance(e, s); assert.equal(e.state, 'failed');
  e.reset(s); advance(e, s); assert.equal(e.state, 'active');
});
check('Challenge expiry is explicit and no progress earns a timeout medal', () => {
  const e = new Expedition({ zones }), s = fake(); e.start('first-flight', s); advance(e, s, 2700);
  assert.equal(e.state, 'failed'); assert.equal(e.medal, null);
});
check('Modified runs complete only as practice and retry does not erase the modification', () => {
  const e = new Expedition({ zones }), s = fake(); e.start('collector', s); e.invalidate('Gravity edited'); s.stars = 2; advance(e, s);
  assert.equal(e.state, 'complete'); assert.equal(e.medal, null); assert.equal(e.completed.size, 0); assert.equal(e.bestByMission.size, 0);
  e.reset(s); assert.equal(e.eligible, false); assert.equal(e.practiceReason, 'Gravity edited');
  e.restoreEligibility(); assert.equal(e.eligible, true);
});
check('A nonfinite airtime cannot earn a medal and a ghost from another course is not shown', () => {
  const e = new Expedition({ zones }), s = fake(); e.start('first-flight', s); s.mode = 'limp'; s.stunt = { air: Infinity }; advance(e, s);
  assert.equal(e.state, 'active'); assert.equal(e.progress, 0);
  e.bestByMission.set('first-flight', { courseKey: 'other-course', time: 1, medal: 'gold', poses: [{ t: 0, x: 999, y: 999 }] });
  e.reset(s); assert.equal(e.summary().ghost, null); assert.equal(e.summary().best, null);
});
check('Dash requires one airborne unhooked hero and normalizes diagonal speed', () => {
  const e = new Expedition({ zones }), s = fake(); s.ground = {}; assert.equal(e.beforeStep(s, { dashP: true, x: 1 }, dt), false);
  s.ground = null; s.hook = {}; assert.equal(e.beforeStep(s, { dashP: true, x: 1 }, dt), false);
  s.hook = null; s.mode = 'limp'; assert.equal(e.beforeStep(s, { dashP: true, x: 1 }, dt), false);
  s.mode = 'hero'; assert.equal(e.beforeStep(s, { dashP: true, x: 1, y: 1 }, dt), true);
  assert.ok(Math.abs(Math.hypot(s.hero.vx, s.hero.vy) - 18) < 1e-12); assert.equal(e.dashes, 1);
  assert.equal(e.beforeStep(s, { dashP: true, x: -1 }, dt), false);
  advance(e, s, 30); assert.equal(e.beforeStep(s, { dashP: true, x: -1 }, dt), false);
  s.ground = {}; advance(e, s); s.ground = null; assert.equal(e.beforeStep(s, { dashP: true, x: -1 }, dt), true);
});
check('Disabled dash and malformed timing cannot silently alter the hero', () => {
  const e = new Expedition({ zones }, { dash: false }), s = fake();
  assert.equal(e.beforeStep(s, { dashP: true, x: 1 }, dt), false); assert.equal(s.hero.vx, 0);
  assert.throws(() => e.beforeStep(s, {}, .02), /fixed/); assert.throws(() => e.afterStep(s, {}, NaN), /fixed/);
});
check('Visual trace storage is bounded and restarting can follow a prior eligible completion', () => {
  const e = new Expedition({ zones }), s = fake(); advance(e, s, 11000); assert.equal(e.trace.length, 2400);
  e.start('first-flight', s); advance(e, s, 8); s.mode = 'limp'; s.stunt = { air: .8 }; advance(e, s);
  assert.ok(e.bestByMission.get('first-flight').poses.length > 0); e.reset(s); advance(e, s, 4);
  assert.ok(e.ghostPose()); const p = e.ghostPose(); p.x = 999; assert.notEqual(e.ghostPose().x, 999);
  assert.equal(e.ghostPose(-1), null); assert.equal(e.ghostPose(Infinity), null);
});
console.log(`${count} expedition controls passed`);
