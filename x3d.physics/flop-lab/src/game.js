// loom:sim
// ===== game.js : world building, the hero who goes limp, stunts, and headless experiments. No DOM. =====
const ROLE_COLOR = { static: '#3fd0ff', crate: '#ffd27a', ball: '#ffe9b0', domino: '#f6f1e1', plank: '#ffbd73', chain: '#9fb4d9', hazard: '#ff4fa3',
  jelly: '#7dffb2', spring: '#7dffb2', peg: '#3fd0ff', lift: '#b79bff', cloth: '#c9a7ff', hero: '#ffc23d', rag: '#ffc23d' };

function buildWorld(level, tune) {
  const ph = level.physics;
  const W = new World(Object.assign({ gy: -ph.gravity, substeps: ph.substeps, iters: ph.iters }, tune));
  for (const s of level.bodies) W.add(s);
  for (const j of level.joints) {
    const a = W.byId.get(j.a), b = j.b ? W.byId.get(j.b) : null; if (!a || (j.b && !b)) continue;
    W.link(Object.assign({}, j, { a, b }));
  }
  for (const z of level.zones) {
    const zz = Object.assign({}, z);
    if (z.kind === 'water') { const n = Math.max(8, Math.round(z.w / 0.25)); zz.col = new Float64Array(n); zz.vel = new Float64Array(n); }
    W.zones.push(zz);
  }
  return W;
}

const FEEL = { g: 38, fallMul: 1.7, cutMul: 2.6, maxFall: 26, run: 8.6, accel: 80, decel: 100, airAccel: 52, jumpV: 15.4, coyote: 0.1, buffer: 0.13,
  wallSlide: 3.4, wallJumpVx: 9.6, wallJumpVy: 13.6, wallLock: 0.16, hookRange: 5.8, hookMin: 1.4, hookPump: 16, hookReel: 4.5, springV: 21.5, hitFlop: 7 };
const NOINPUT = { x: 0, y: 0, jump: false, jumpP: false, hook: false, flopP: false };
// ragdoll: id, shape, r, half-length, y above the feet, mass
const RAG = [['hips', 'pill', 0.15, 0.05, 0.98, 2], ['chest', 'pill', 0.17, 0.1, 1.3, 3], ['head', 'ball', 0.15, 0, 1.66, 1],
  ['uarm1', 'pill', 0.06, 0.12, 1.27, 0.4], ['larm1', 'pill', 0.055, 0.12, 0.93, 0.3], ['uarm2', 'pill', 0.06, 0.12, 1.27, 0.4], ['larm2', 'pill', 0.055, 0.12, 0.93, 0.3],
  ['uleg1', 'pill', 0.085, 0.14, 0.66, 0.9], ['lleg1', 'pill', 0.07, 0.15, 0.23, 0.6], ['uleg2', 'pill', 0.085, 0.14, 0.66, 0.9], ['lleg2', 'pill', 0.07, 0.15, 0.23, 0.6]];
// hinges: body A, body B, height of the pin, min and max angle of B relative to A (radians)
const RAGJ = [['hips', 'chest', 1.13, -0.4, 0.6], ['chest', 'head', 1.5, -0.5, 0.5],
  ['chest', 'uarm1', 1.45, null, null], ['uarm1', 'larm1', 1.1, -0.05, 2.4], ['chest', 'uarm2', 1.45, null, null], ['uarm2', 'larm2', 1.1, -0.05, 2.4],
  ['hips', 'uleg1', 0.88, -0.5, 1.8], ['uleg1', 'lleg1', 0.44, -2.3, 0.05], ['hips', 'uleg2', 0.88, -0.5, 1.8], ['uleg2', 'lleg2', 0.44, -2.3, 0.05]];

class Sim {
  constructor(level, opt = {}) {
    this.level = level; this.opt = opt; this.feel = Object.assign({}, FEEL, opt.feel);
    const W = (this.W = buildWorld(level, opt.tune)); this.rnd = rng32(opt.seed || 7);
    const cps = W.zones.filter((z) => z.kind === 'checkpoint');
    this.cp = cps.length ? { x: cps[0].x, y: cps[0].y - 2 } : { x: 0, y: 0 };
    this.hero = W.add({ id: 'HERO', role: 'hero', shape: 'pill', r: 0.34, hl: 0.36, mass: 10, lock: true, fric: 0, rest: 0, wind: 0.3, buoy: 1.3, x: this.cp.x, y: this.cp.y + 0.72 });
    this.rag = {}; this.ragList = [];
    for (const [id, shape, r, hl, y, mass] of RAG) {
      const b = W.add({ id: 'RAG_' + id, role: 'rag', shape, r, hl, mass, x: 0, y: -500 + y, group: 99, fric: 0.7, rest: 0.15, buoy: 1.2, wind: 1, off: true });
      b.ry = y; this.rag[id] = b; this.ragList.push(b);
    }
    for (const [a, b, y, mn, mx] of RAGJ) W.link({ type: 'hinge', a: this.rag[a], b: this.rag[b], ax: 0, ay: -500 + y, min: mn, max: mx, damp: 8, temp: true });
    this.mode = opt.headless ? 'idle' : 'hero'; if (opt.headless) this.hero.off = true;
    this.ground = null; this.wall = 0; this.coy = 0; this.buf = 0; this.lock = 0; this.hook = null; this.hookCd = 0; this.face = 1;
    this.stunt = null; this.lastStunt = null; this.stunts = []; this.stars = 0; this.starTotal = W.zones.filter((z) => z.kind === 'star').length;
    this.cannon = null; this.fx = []; this.deaths = 0; this.hall = cps.length ? cps[0].name : '';
  }
  emit(type, d) { this.fx.push(Object.assign({ type }, d)); }
  // ---- per-frame ----
  step(inp, dt) {
    this.fx.length = 0;
    if (this.mode === 'hero') this.control(inp, dt);
    else if (this.mode === 'cannon') this.aim(inp, dt);
    else if (this.mode === 'limp') this.wiggle(inp, dt);
    this.W.step(dt);
    this.after(inp, dt);
  }
  control(inp, dt) {
    const F = this.feel, h = this.hero, W = this.W, grounded = !!this.ground;
    if (inp.x) this.face = inp.x > 0 ? 1 : -1;
    if (h.vy <= 0) this.sprung = false;                          // a bounce pad throw is not cut short by letting go of jump
    h.gs = (F.g / Math.abs(W.P.gy || 1)) * (h.vy < 0 ? F.fallMul : !inp.jump && !this.hook && !this.sprung ? F.cutMul : 1);
    this.lock -= dt; this.hookCd -= dt;
    if (this.hook) {
      h.vx += inp.x * F.hookPump * dt;
      this.hook.rest = clamp(this.hook.rest - inp.y * F.hookReel * dt, F.hookMin, F.hookRange);
    } else if (this.lock <= 0) {
      const base = grounded ? this.ground.vx : 0, target = inp.x * F.run + base;
      const acc = grounded ? (inp.x ? F.accel : F.decel) : inp.x ? F.airAccel : 4;
      const dv = target - h.vx, step = acc * dt;
      h.vx += Math.abs(dv) <= step ? dv : Math.sign(dv) * step;
    }
    if (inp.jumpP) this.buf = F.buffer; else this.buf -= dt;
    const swim = h.wet > 0.25;                                  // in water there is no floor: let the hero kick off the surface
    this.coy = grounded || swim ? F.coyote : this.coy - dt;
    if (this.buf > 0) {
      if (this.hook) { this.unhook(1.15); this.buf = 0; }
      else if (this.coy > 0) { h.vy = F.jumpV * (swim && !grounded ? 0.8 : 1) + (grounded ? Math.max(0, this.ground.vy) : 0); this.coy = 0; this.buf = 0; this.ground = null; this.emit('jump'); }
      else if (this.wall && !grounded) { h.vx = -this.wall * F.wallJumpVx; h.vy = F.wallJumpVy; this.lock = F.wallLock; this.buf = 0; this.face = -this.wall; this.emit('jump'); }
    }
    if (this.wall && !grounded && inp.x === this.wall && h.vy < -F.wallSlide) h.vy = -F.wallSlide;
    if (h.vy < -F.maxFall) h.vy = -F.maxFall;
    if (inp.hook && !this.hook && this.hookCd <= 0) {
      let best = null, bd = F.hookRange;
      for (const z of W.zones) if (z.kind === 'ring') { const d = hyp(z.x - h.x, z.y - h.y); if (d < bd) { bd = d; best = z; } }
      if (best) { this.hook = W.link({ type: 'rope', a: h, ax: h.x, ay: h.y, bx: best.x, by: best.y, rest: Math.max(bd, F.hookMin), temp: true }); this.hook.ring = best; this.emit('hook'); }
    } else if (!inp.hook && this.hook) this.unhook(1);
    if (inp.flopP) this.flop(h.vx, h.vy, 'you let go');
    else if (inp.y > 0 && !this.hook) for (const z of W.zones) if (z.kind === 'cannon' && Math.abs(z.x - h.x) < 1.3 && Math.abs(z.y - h.y) < 1.8) { this.cannon = z; this.mode = 'cannon'; h.off = true; this.cannonWait = 0.25; this.emit('hook'); break; }
  }
  unhook(boost) {
    if (!this.hook) return; const i = this.W.joints.indexOf(this.hook); if (i >= 0) this.W.joints.splice(i, 1);
    this.hook = null; this.hookCd = 0.2; this.hero.vx *= boost; this.hero.vy *= boost;
  }
  aim(inp, dt) {
    const z = this.cannon; this.cannonWait -= dt;
    z.angle = clamp(z.angle + inp.y * 40 * dt, 5, 88); z.power = clamp(z.power + inp.x * 10 * dt, 8, 48);
    if (inp.jumpP && this.cannonWait < 0) { this.syncCannon(z); this.launchFrom(z); }
    else if (inp.flopP) { this.syncCannon(z); this.mode = 'hero'; this.hero.off = false; this.hero.x = z.x; this.hero.y = z.y + 0.2; this.hero.vx = this.hero.vy = 0; this.cannon = null; }
  }
  syncCannon(z) { // keep the level data in step with what the player aimed
    const part = this.level.parts.find((p) => p.id === z.part), spec = this.level.zones.find((q) => q.id === z.id);
    const a = +z.angle.toFixed(1), pw = +z.power.toFixed(1);
    if (part) { part.p.angle = a; part.p.power = pw; } if (spec) { spec.angle = a; spec.power = pw; }
  }
  launchFrom(z) {
    const a = z.angle * DEG, c = cos(a), s = sin(a);
    this.cannon = null; this.flopAt(z.x + c * 1.5, z.y + s * 1.5 - 0.9, c * z.power, s * z.power, 'fired at ' + z.angle.toFixed(0) + ' deg, ' + z.power.toFixed(0) + ' m/s');
    this.stunt.cannon = { angle: +z.angle.toFixed(1), power: +z.power.toFixed(1) }; this.emit('boom', { x: z.x, y: z.y });
  }
  wiggle(inp, dt) { if (inp.x) this.rag.chest.om -= inp.x * 14 * dt; if (inp.flopP && this.stunt.t > 0.3) this.stand(); }
  flop(vx, vy, why) { const h = this.hero; this.flopAt(h.x, h.y - 0.72, vx, vy, why); }
  flopAt(fx, fy, vx, vy, why) {
    this.unhook(1); this.hero.off = true; this.mode = 'limp';
    const spin = (this.rnd() - 0.5) * 1.5 - vx * 0.12;
    for (const b of this.ragList) {
      b.off = false; b.x = fx + (this.rnd() - 0.5) * 0.01; b.y = fy + b.ry; b.a = 0; b.px = b.x; b.py = b.y; b.pa = 0;
      b.vx = vx - spin * (b.ry - 1.1); b.vy = vy; b.om = spin;
    }
    const goal = this.W.zones.find((z) => z.kind === 'goal');
    this.stunt = { why, t: 0, x0: fx, y0: fy + 1.3, air: 0, spins: 0, bonks: 0, hardest: 0, peakV: hyp(vx, vy), peakY: fy + 1.3, dist: 0, goal: false,
      goalMiss: goal ? hyp(goal.x - fx, goal.y - fy - 1.3) : null, la: 0, still: 0, bonkCd: 0 };
    this.emit('flop');
  }
  stand() {
    const c = this.rag.chest, h = this.hero, s = this.stunt;
    for (const b of this.ragList) { b.off = true; b.vx = b.vy = b.om = 0; }
    h.off = false; h.x = c.x; h.y = c.y + 0.25; h.vx = c.vx * 0.5; h.vy = Math.max(c.vy * 0.5, 2); h.px = h.x; h.py = h.y;
    this.mode = 'hero'; this.ground = null; this.coy = 0;
    if (s) { this.lastStunt = this.score(s); this.stunts.push(this.lastStunt); if (this.stunts.length > 12) this.stunts.shift(); this.emit('stunt', { stunt: this.lastStunt }); }
    this.stunt = null;
  }
  score(s) {
    const r = { why: s.why, seconds: +s.t.toFixed(2), distance_m: +s.dist.toFixed(2), airtime_s: +s.air.toFixed(2), spins: +s.spins.toFixed(2), bonks: s.bonks,
      hardest_hit_mps: +s.hardest.toFixed(1), peak_speed_mps: +s.peakV.toFixed(1), peak_height_m: +(s.peakY - s.y0).toFixed(2), hit_goal: s.goal,
      goal_miss_m: s.goalMiss === null ? null : +s.goalMiss.toFixed(2) };
    if (s.cannon) r.cannon = s.cannon;
    r.score = Math.round(12 * s.dist + 60 * s.air + 120 * s.spins + 35 * s.bonks + 6 * s.peakV + (s.goal ? 500 : 0));
    return r;
  }
  respawn() {
    if (this.mode === 'limp') { for (const b of this.ragList) { b.off = true; b.vx = b.vy = b.om = 0; } this.stunt = null; }
    this.unhook(1); const h = this.hero; h.off = false; h.x = this.cp.x; h.y = this.cp.y + 0.8; h.vx = h.vy = 0; h.px = h.x; h.py = h.y; this.mode = 'hero'; this.cannon = null; this.deaths++; this.emit('respawn');
  }
  goTo(x, y) { this.cp = { x, y }; this.respawn(); this.deaths--; const z = this.W.zones.find((q) => q.kind === 'checkpoint' && q.x === x); if (z) this.hall = z.name; }
  focus() { return this.mode === 'limp' ? this.rag.chest : this.mode === 'cannon' ? this.cannon : this.hero; }
  after(inp, dt) {
    const W = this.W, h = this.hero;
    if (this.mode === 'hero') {
      this.ground = null; this.wall = 0; let spring = false;
      for (let k = 0; k < W.nc; k++) {
        const c = W.contacts[k]; if (c.a !== h && c.b !== h) continue;
        const o = c.a === h ? c.b : c.a, sgn = c.a === h ? -1 : 1, nx = c.nx * sgn, ny = c.ny * sgn;
        if (ny > 0.6) { this.ground = o; if (o.role === 'spring') spring = true; }
        else if (Math.abs(nx) > 0.8 && o.im === 0 && !o.kin) this.wall = nx > 0 ? -1 : 1;
      }
      if (spring) { h.vy = this.feel.springV; this.ground = null; this.sprung = true; this.emit('spring'); }
      for (const e of W.events) {
        if (e.a !== h && e.b !== h) continue; const o = e.a === h ? e.b : e.a;
        if (e.speed > this.feel.hitFlop && (o.kin || (o.im > 0 && o.mass >= 4 && o.role !== 'jelly'))) {
          const dir = Math.sign(h.x - o.x) || 1, push = Math.min(e.speed, 14);
          this.flop(h.vx + (o.kin ? dir * push : o.vx * 0.9), Math.max(h.vy, 0) + push * 0.5, 'hit by ' + (o.part || o.role) + ' at ' + e.speed.toFixed(1) + ' m/s'); break;
        }
      }
    }
    if (this.mode === 'limp') {
      const s = this.stunt, c = this.rag.chest; s.t += dt; s.bonkCd -= dt;
      let touching = false;
      for (let k = 0; k < W.nc; k++) { const q = W.contacts[k]; if ((q.a.role === 'rag') !== (q.b.role === 'rag')) { touching = true; break; } }
      const wet = this.ragList.some((b) => b.wet > 0);
      if (!touching && !wet) s.air += dt;
      for (const e of W.events) if (((e.a.role === 'rag') !== (e.b.role === 'rag')) && e.speed > 5 && s.bonkCd <= 0) { s.bonks++; s.bonkCd = 0.12; s.hardest = Math.max(s.hardest, e.speed); this.emit('bonk', { x: e.x, y: e.y, speed: e.speed }); }
      s.spins += Math.abs(c.a - s.la) / TAU; s.la = c.a;
      const v = hyp(c.vx, c.vy); s.peakV = Math.max(s.peakV, v); s.peakY = Math.max(s.peakY, c.y); s.dist = Math.max(s.dist, Math.abs(c.x - s.x0));
      for (const z of W.zones) if (z.kind === 'goal') { const d = hyp(z.x - c.x, z.y - c.y); s.goalMiss = Math.min(s.goalMiss, d); if (d < z.w / 2 && !s.goal) { s.goal = true; this.emit('goal', { x: z.x, y: z.y }); } }
      s.still = v < 0.9 && s.t > 0.7 ? s.still + dt : 0;
      if (s.still > 0.7 && !this.opt.headless) this.stand();
    }
    const f = this.focus();
    if (this.mode !== 'idle') {
      let hz = null; for (const z of W.zones) if (z.kind === 'checkpoint' && z.x <= f.x + 1 && (!hz || z.x > hz.x)) hz = z;   // the hall you are in, wherever you were thrown
      if (hz) this.hall = hz.name;
      for (const z of W.zones) {
        if (z.kind === 'checkpoint' && this.mode === 'hero' && Math.abs(z.x - f.x) < 1 && Math.abs(z.y - f.y) < 2.2 && (this.cp.x !== z.x)) { this.cp = { x: z.x, y: z.y - 2 }; this.hall = z.name; this.emit('checkpoint', { name: z.name }); }
        else if (z.kind === 'star' && !z.got && hyp(z.x - f.x, z.y - f.y) < 1.1) { z.got = true; this.stars++; this.emit('star', { x: z.x, y: z.y }); }
      }
      if (f.y < -14 && !this.opt.headless) this.respawn();
    }
  }
}

// ---------- headless experiments ----------
function applyVary(level, tune, key, value) {
  const [head, field] = key.split('.');
  if (head === 'physics') { if (!(field in level.physics)) throw new Error('physics has gravity, substeps, iters'); level.physics[field] = value; }
  else if (head === 'tune') tune[field] = value;
  else {
    const id = head === 'cannon' ? (level.parts.find((p) => p.kind === 'cannon') || {}).id : head;
    if (!level.parts.some((p) => p.id === id)) throw new Error('no part "' + head + '" to vary');
    editPart(level, id, { [field]: value });
  }
}
function runTrial(level, o) {
  const tune = Object.assign({}, o.tune), L = cloneLevel(level);
  if (o.vary) applyVary(L, tune, o.vary, o.value);
  let x0 = -1e9, x1 = 1e9, z = null;
  if (o.scenario === 'cannon') { z = L.zones.find((q) => q.kind === 'cannon' && (!o.cannon || q.part === o.cannon)); if (!z) throw new Error('this level has no cannon'); x0 = z.x - 12; x1 = z.x + 70; }
  else if (o.scenario === 'drop') { x0 = o.x - 30; x1 = o.x + 50; }
  else if (o.watch) { const e = partBounds(L).get(o.watch); if (!e) throw new Error('no part "' + o.watch + '" to watch'); x0 = e[0] - 25; x1 = e[1] + 25; }
  const sim = new Sim(windowLevel(L, x0, x1), { headless: true, tune, seed: o.seed || 7 }), W = sim.W, clock = o.clock || (() => 0);
  if (o.kernel) W.kernel = o.kernel;
  if (z) sim.launchFrom(W.zones.find((q) => q.id === z.id));
  else if (o.scenario === 'drop') sim.flopAt(o.x, o.y, o.vx || 0, o.vy || 0, 'dropped');
  if (o.poke) { const b = W.bodies.find((q) => q.part === o.poke.part && q.im > 0); if (!b) throw new Error('nothing to poke in part ' + o.poke.part); b.vx += o.poke.vx || 0; b.vy += o.poke.vy || 0; b.om += o.poke.spin || 0; }
  const e0 = W.energy(), n = Math.round(clamp(o.seconds || 6, 0.5, 20) * 60), t0 = clock(); let peakKE = e0.ke;
  for (let i = 0; i < n; i++) { sim.step(NOINPUT, 1 / 60); if ((i & 7) === 0) peakKE = Math.max(peakKE, W.energy().ke); }
  const ms = (clock() - t0) / n, e1 = W.energy(), row = {};
  if (o.vary) row.value = o.value;
  if (sim.stunt) Object.assign(row, sim.score(sim.stunt));
  if (o.watch) { const bs = W.bodies.filter((b) => b.part === o.watch && b.im > 0); row.fallen = bs.filter((b) => Math.abs(b.a - (b.spec.a || 0)) > 1).length; row.of = bs.length; row.moved_m = +Math.max(0, ...bs.map((b) => hyp(b.x - b.spec.x, b.y - b.spec.y))).toFixed(2); }
  row.energy_start_J = +(e0.ke + e0.pe).toFixed(1); row.energy_end_J = +(e1.ke + e1.pe).toFixed(1); row.peak_kinetic_J = +peakKE.toFixed(1);
  row.bodies = W.bodies.length; row.ms_per_step = +ms.toFixed(3); row.hash = W.hash();
  return row;
}
