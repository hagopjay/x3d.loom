// loom:sim
// ===== core.js : a small 2D XPBD rigid-body engine. No DOM, no clock, no randomness, no engine-approximated math. =====
const PI = Math.PI, TAU = 2 * PI, DEG = PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function rng32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0; let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// ---- the lab's own sin, cos and atan2 ----
// Math.sin, Math.cos, Math.atan2, Math.exp and Math.pow may differ in their last bits between JavaScript engines
// (historical source run: Node 22 and Chrome 153 disagreed on some sampled results).
// The helpers below reduce that dependency. Equality remains a claim to measure
// on each declared model, input trace and host pair, not a promise for every host.
const PIO2_A = 1.5707963267341256, PIO2_B = 6.077100506506192e-11;        // pi/2 split in two, so k * PIO2_A is exact for small k
const S3 = -1 / 6, S5 = 1 / 120, S7 = -1 / 5040, S9 = 1 / 362880, S11 = -1 / 39916800, S13 = 1 / 6227020800, S15 = -1 / 1307674368000;
const C2 = -1 / 2, C4 = 1 / 24, C6 = -1 / 720, C8 = 1 / 40320, C10 = -1 / 3628800, C12 = 1 / 479001600, C14 = -1 / 87178291200, C16 = 1 / 20922789888000;
const sinK = (r) => { const q = r * r; return r * (1 + q * (S3 + q * (S5 + q * (S7 + q * (S9 + q * (S11 + q * (S13 + q * S15))))))); };
const cosK = (r) => { const q = r * r; return 1 + q * (C2 + q * (C4 + q * (C6 + q * (C8 + q * (C10 + q * (C12 + q * (C14 + q * C16))))))); };
function sin(x) { const k = Math.round(x * 0.6366197723675814), r = x - k * PIO2_A - k * PIO2_B, q = k & 3; return q === 0 ? sinK(r) : q === 1 ? cosK(r) : q === 2 ? -sinK(r) : -cosK(r); }
function cos(x) { const k = Math.round(x * 0.6366197723675814), r = x - k * PIO2_A - k * PIO2_B, q = k & 3; return q === 0 ? cosK(r) : q === 1 ? -sinK(r) : q === 2 ? -cosK(r) : sinK(r); }
function atan2(y, x) {
  const ax = Math.abs(x), ay = Math.abs(y); if (ax === 0 && ay === 0) return 0;
  let t = ax > ay ? ay / ax : ax / ay;
  t = t / (1 + Math.sqrt(1 + t * t)); t = t / (1 + Math.sqrt(1 + t * t));    // halve the angle twice: now under pi/16
  const q = t * t; let sum = 0; for (let n = 27; n >= 1; n -= 2) sum = (n % 4 === 1 ? 1 : -1) / n + q * sum;
  let r = 4 * t * sum; if (ay > ax) r = PI / 2 - r; if (x < 0) r = PI - r; return y < 0 ? -r : r;
}
const hyp = (x, y) => Math.sqrt(x * x + y * y);

function makeBody(o) {
  const b = {
    id: o.id, part: o.part || '', role: o.role || '', shape: o.shape || 'box',
    hw: (o.w ?? 1) / 2, hh: (o.h ?? 1) / 2, r: o.r || 0, hl: o.hl || 0,
    x: o.x || 0, y: o.y || 0, a: o.a || 0, px: 0, py: 0, pa: 0, vx: o.vx || 0, vy: o.vy || 0, om: o.om || 0,
    mass: o.mass || 0, im: 0, ii: 0, fric: o.fric ?? 0.6, rest: o.rest ?? 0.1, group: o.group || 0,
    gs: o.gs ?? 1, buoy: o.buoy ?? 1.4, wind: o.wind ?? 1, off: !!o.off, kin: o.kin || null, lock: !!o.lock,
    minx: 0, maxx: 0, miny: 0, maxy: 0, ey: 0, cs: null, wet: 0, spec: o,
  };
  if (b.shape === 'ball') b.cs = [0];
  else if (b.shape === 'pill') {
    const n = Math.max(2, Math.ceil((2 * b.hl) / b.r) + 1); b.cs = [];
    for (let i = 0; i < n; i++) b.cs.push(-b.hl + (2 * b.hl * i) / (n - 1));
  }
  b.px = b.x; b.py = b.y; b.pa = b.a;
  setMass(b, b.mass);
  return b;
}
function setMass(b, m) {
  b.mass = m;
  if (!(m > 0) || b.kin) { b.im = 0; b.ii = 0; return; }
  let I;
  if (b.shape === 'ball') I = 0.5 * m * b.r * b.r;
  else if (b.shape === 'pill') { const w = 2 * b.r, h = 2 * b.hl + 2 * b.r; I = (m * (w * w + h * h)) / 12; }
  else I = (m * (4 * b.hw * b.hw + 4 * b.hh * b.hh)) / 12;
  b.im = 1 / m; b.ii = b.lock ? 0 : 1 / I;
}

// ---------- THE KERNEL: these functions are what the Solver tab shows and lets you edit ----------
function integrate(W, b, h) {
  // Predict. Semi-implicit Euler: velocity first, then position from the NEW velocity.
  if (b.im > 0) {
    b.vx += W.P.gx * b.gs * h;
    b.vy += W.P.gy * b.gs * h;
  }
  b.px = b.x; b.py = b.y; b.pa = b.a;      // remember where we were
  b.x += b.vx * h; b.y += b.vy * h; b.a += b.om * h;
}

function contactDepth(W, c, h) {
  // How deep is this contact right now? Also caches the lever arms on the contact.
  const A = c.a, B = c.b;
  const ca = cos(A.a), sa = sin(A.a), cb = cos(B.a), sb = sin(B.a);
  c.rax = ca * c.lax - sa * c.lay; c.ray = sa * c.lax + ca * c.lay;     // contact arm on A
  c.rbx = cb * c.lbx - sb * c.lby; c.rby = sb * c.lbx + cb * c.lby;     // contact arm on B
  c.rnA = c.rax * c.ny - c.ray * c.nx; c.rnB = c.rbx * c.ny - c.rby * c.nx;
  const sep = (B.x + c.rbx - A.x - c.rax) * c.nx + (B.y + c.rby - A.y - c.ray) * c.ny;
  const d = c.d - sep - 0.003;                     // minus a little slop, so resting things stay in touch
  // Push far enough to stop this substep's approach, plus a slow bleed of any older overlap.
  // Pushing out all of a deep overlap at once would become real speed: a "pop" that looks like a bounce.
  return Math.min(d, (Math.max(0, -c.vn0) + W.P.maxDepen) * h);
}

function pushApart(c, lam) {
  const A = c.a, B = c.b;
  A.x -= c.nx * lam * A.im; A.y -= c.ny * lam * A.im; A.a -= c.rnA * lam * A.ii;
  B.x += c.nx * lam * B.im; B.y += c.ny * lam * B.im; B.a += c.rnB * lam * B.ii;
  c.ln += lam;
}

function solveContact(W, c, h) {
  // Push two overlapping bodies apart along the contact normal n (A to B).
  if (c.twin === 2) return;                        // second corner of a face: solved together with the first
  const A = c.a, B = c.b, m = c.twin === 1 ? c.mate : null;
  const d1 = contactDepth(W, c, h);
  if (m) {
    // A box resting on a face touches at two corners. Solve both at once (a 2x2 system):
    // one corner at a time leaves a little spin every substep, and stacks rock themselves over.
    const d2 = contactDepth(W, m, h);
    if (d1 > 0 && d2 > 0) {
      const k11 = A.im + B.im + A.ii * c.rnA * c.rnA + B.ii * c.rnB * c.rnB;
      const k22 = A.im + B.im + A.ii * m.rnA * m.rnA + B.ii * m.rnB * m.rnB;
      const k12 = A.im + B.im + A.ii * c.rnA * m.rnA + B.ii * c.rnB * m.rnB;
      const det = k11 * k22 - k12 * k12;
      if (det > 1e-12) {
        const l1 = (k22 * d1 - k12 * d2) / det, l2 = (k11 * d2 - k12 * d1) / det;
        if (l1 >= 0 && l2 >= 0) { pushApart(c, l1); pushApart(m, l2); return; }
      }
    }
  }
  if (d1 > 0) { const w = A.im + B.im + A.ii * c.rnA * c.rnA + B.ii * c.rnB * c.rnB; if (w > 0) pushApart(c, d1 / w); }
  if (m) { const d2 = contactDepth(W, m, h); const w = A.im + B.im + A.ii * m.rnA * m.rnA + B.ii * m.rnB * m.rnB; if (d2 > 0 && w > 0) pushApart(m, d2 / w); }
}

function friction(W, c, h) {
  // After every push is done: how far did the two surfaces slide past each other this substep?
  // A face contact (two corners) gets ONE friction pull at the middle of the face. Pulling at each
  // corner in turn twists the box a little every substep, and that twist feeds a rocking stack.
  if (c.twin === 2) return;
  const m = c.twin === 1 ? c.mate : null, ln = m ? c.ln + m.ln : c.ln;
  if (ln <= 0) return;
  const A = c.a, B = c.b, tx = -c.ny, ty = c.nx;
  const lax = m ? (c.lax + m.lax) / 2 : c.lax, lay = m ? (c.lay + m.lay) / 2 : c.lay;
  const lbx = m ? (c.lbx + m.lbx) / 2 : c.lbx, lby = m ? (c.lby + m.lby) / 2 : c.lby;
  const ca = cos(A.a), sa = sin(A.a), cb = cos(B.a), sb = sin(B.a);
  const rax = ca * lax - sa * lay, ray = sa * lax + ca * lay, rbx = cb * lbx - sb * lby, rby = sb * lbx + cb * lby;
  const pca = cos(A.pa), psa = sin(A.pa), pcb = cos(B.pa), psb = sin(B.pa);
  const dAx = A.x + rax - (A.px + pca * lax - psa * lay), dAy = A.y + ray - (A.py + psa * lax + pca * lay);
  const dBx = B.x + rbx - (B.px + pcb * lbx - psb * lby), dBy = B.y + rby - (B.py + psb * lbx + pcb * lby);
  const slip = (dAx - dBx) * tx + (dAy - dBy) * ty;
  const rtA = rax * ty - ray * tx, rtB = rbx * ty - rby * tx;
  const wt = A.im + A.ii * rtA * rtA + B.im + B.ii * rtB * rtB;
  if (wt === 0) return;
  let lt = -slip / wt;
  const cap = c.mu * ln;                            // Coulomb: friction <= mu * normal push
  if (lt > cap) lt = cap; else if (lt < -cap) lt = -cap;
  A.x += tx * lt * A.im; A.y += ty * lt * A.im; A.a += rtA * lt * A.ii;
  B.x -= tx * lt * B.im; B.y -= ty * lt * B.im; B.a -= rtB * lt * B.ii;
}

function updateVelocity(W, b, h) {
  // XPBD's trick: velocity is whatever the position solve actually did.
  if (b.im === 0) return;
  b.vx = (b.x - b.px) / h; b.vy = (b.y - b.py) / h; b.om = (b.a - b.pa) / h;
  const k = 1 - W.P.damp * h; b.vx *= k; b.vy *= k; b.om *= k;
}

function closing(c) {
  // Speed at which the two bodies separate along the normal at this contact (negative = closing).
  const A = c.a, B = c.b;
  c.rax = c.px - A.x; c.ray = c.py - A.y; c.rbx = c.px - B.x; c.rby = c.py - B.y;
  c.rnA = c.rax * c.ny - c.ray * c.nx; c.rnB = c.rbx * c.ny - c.rby * c.nx;
  return (B.vx - B.om * c.rby - A.vx + A.om * c.ray) * c.nx + (B.vy + B.om * c.rbx - A.vy - A.om * c.rax) * c.ny;
}

function kick(c, j) {
  const A = c.a, B = c.b;
  A.vx -= c.nx * j * A.im; A.vy -= c.ny * j * A.im; A.om -= c.rnA * j * A.ii;
  B.vx += c.nx * j * B.im; B.vy += c.ny * j * B.im; B.om += c.rnB * j * B.ii;
}

function wanted(c) {
  // Separating speed this contact still owes: came in fast, so leave at e times that speed.
  if (c.ln <= 0 || c.vn0 > -1.0) return 0;
  return Math.max(0, -c.e * c.vn0 - closing(c));
}

function bounce(W, c, h) {
  // Restitution, at velocity level.
  if (c.twin === 2) return;
  const A = c.a, B = c.b, m = c.twin === 1 ? c.mate : null;
  const g1 = wanted(c), g2 = m ? wanted(m) : 0;
  if (g1 > 0 && g2 > 0) {                           // both corners of a face: again a 2x2 solve
    const k11 = A.im + B.im + A.ii * c.rnA * c.rnA + B.ii * c.rnB * c.rnB;
    const k22 = A.im + B.im + A.ii * m.rnA * m.rnA + B.ii * m.rnB * m.rnB;
    const k12 = A.im + B.im + A.ii * c.rnA * m.rnA + B.ii * c.rnB * m.rnB;
    const det = k11 * k22 - k12 * k12;
    if (det > 1e-12) {
      const j1 = (k22 * g1 - k12 * g2) / det, j2 = (k11 * g2 - k12 * g1) / det;
      if (j1 >= 0 && j2 >= 0) { kick(c, j1); kick(m, j2); return; }
    }
  }
  if (g1 > 0) kick(c, g1 / (A.im + B.im + A.ii * c.rnA * c.rnA + B.ii * c.rnB * c.rnB));
  if (m) { const g = wanted(m); if (g > 0) kick(m, g / (A.im + B.im + A.ii * m.rnA * m.rnA + B.ii * m.rnB * m.rnB)); }
}

function substep(W, h) {
  // One small time step. A frame runs this W.P.substeps times.
  W.mark('fields');    W.applyFields(h);                     // fans, water
  W.mark('integrate'); for (const b of W.active) integrate(W, b, h);
  W.mark('narrow');    W.detect();                           // exact contacts for the broad-phase pairs
  for (let i = 0; i < W.P.iters; i++) {
    W.mark('joints');   for (const j of W.joints) W.solveJoint(j, h);
    W.mark('contacts'); for (let k = 0; k < W.nc; k++) solveContact(W, W.contacts[k], h);
                        for (let k = 0; k < W.nc; k++) friction(W, W.contacts[k], h);
  }
  W.mark('velocity');
  for (const b of W.active) updateVelocity(W, b, h);
  for (let k = 0; k < W.nc; k++) bounce(W, W.contacts[k], h);
  W.dampJoints(h);
}
const KERNEL = { integrate, solveContact, friction, updateVelocity, bounce, substep };
const KERNEL_NOTE = '// sin, cos and hyp are local helpers built from + - * / and sqrt.\n// Historical source experiments found built-in trig disagreements in one Node/Chromium pair.\n// A pose fingerprint matches only the tested model, input trace and host pair; test every new host.\n\n';
const KERNEL_SOURCE = KERNEL_NOTE + [integrate, contactDepth, pushApart, solveContact, friction, updateVelocity, closing, kick, wanted, bounce, substep].map((f) => f.toString()).join('\n\n');
function compileKernel(src) {
  const f = new Function('sin', 'cos', 'hyp', src + '\n;return { integrate, solveContact, friction, updateVelocity, bounce, substep };');
  const k = f(sin, cos, hyp);
  for (const n of Object.keys(KERNEL)) if (typeof k[n] !== 'function') throw new Error('missing function ' + n);
  return k;
}

// ---------- World ----------
const PHASES = ['broad', 'fields', 'integrate', 'narrow', 'joints', 'contacts', 'velocity', 'water'];
class World {
  constructor(P) {
    this.P = Object.assign({ gx: 0, gy: -30, substeps: 8, iters: 1, fricMul: 1, restAdd: 0, soft: 1, damp: 0.03, maxDepen: 2 }, P);
    this.bodies = []; this.joints = []; this.zones = []; this.byId = new Map(); this.active = [];
    this.contacts = []; this.nc = 0; this.pairs = []; this.np = 0; this.events = [];
    this.time = 0; this.frame = 0; this.kernel = KERNEL; this.clock = null;   // the page may lend a clock for the profiler; the simulation never reads one
    this.prof = {}; for (const p of PHASES) this.prof[p] = 0; this._ph = null; this._pt = 0;
    this.stats = { tests: 0, pairs: 0, contacts: 0, brute: 0 };
    this._hb = new Float64Array(3); this._hu = new Uint32Array(this._hb.buffer);
  }
  mark(name) {
    if (!this.clock) return;
    const t = this.clock(); if (this._ph) this.prof[this._ph] += t - this._pt; this._ph = name; this._pt = t;
  }
  add(o) { const b = makeBody(o); this.bodies.push(b); this.byId.set(b.id, b); return b; }
  local(b, wx, wy) { const c = cos(b.a), s = sin(b.a), dx = wx - b.x, dy = wy - b.y; return [c * dx + s * dy, -s * dx + c * dy]; }
  // joint: type 'hinge' | 'rope' | 'spring'. Anchors are given in world coordinates.
  link(o) {
    const A = o.a, B = o.b || null;
    const [lax, lay] = this.local(A, o.ax, o.ay);
    const bx = o.bx ?? o.ax, by = o.by ?? o.ay;
    let lbx = bx, lby = by; if (B) [lbx, lby] = this.local(B, bx, by);
    const j = { id: o.id || '', part: o.part || '', type: o.type || 'hinge', a: A, b: B, lax, lay, lbx, lby,
      min: o.min ?? null, max: o.max ?? null, ref: (B ? B.a : 0) - A.a,
      rest: o.rest ?? hyp(bx - o.ax, by - o.ay), comp: o.comp || 0, damp: o.damp || 0, temp: !!o.temp };
    this.joints.push(j); return j;
  }
  solveJoint(j, h) {
    const A = j.a, B = j.b; if (A.off || (B && B.off)) return;
    const ca = cos(A.a), sa = sin(A.a);
    const rax = ca * j.lax - sa * j.lay, ray = sa * j.lax + ca * j.lay;
    let rbx = 0, rby = 0, pbx = j.lbx, pby = j.lby, bim = 0, bii = 0;
    if (B) { const cb = cos(B.a), sb = sin(B.a); rbx = cb * j.lbx - sb * j.lby; rby = sb * j.lbx + cb * j.lby; pbx = B.x + rbx; pby = B.y + rby; bim = B.im; bii = B.ii; }
    const dx = pbx - A.x - rax, dy = pby - A.y - ray;
    if (j.type === 'hinge' && !this.P.controlHinge1D) {
      // pin two points together: solve both axes at once (a 2x2 system), so a long lever arm cannot leak error sideways
      const soft = j.comp / (h * h);
      const k11 = A.im + bim + A.ii * ray * ray + bii * rby * rby + soft, k22 = A.im + bim + A.ii * rax * rax + bii * rbx * rbx + soft;
      const k12 = -A.ii * rax * ray - bii * rbx * rby, det = k11 * k22 - k12 * k12;
      if (det > 1e-12) {
        const Px = (k22 * dx - k12 * dy) / det, Py = (k11 * dy - k12 * dx) / det;
        A.x += Px * A.im; A.y += Py * A.im; A.a += A.ii * (rax * Py - ray * Px);
        if (B) { B.x -= Px * bim; B.y -= Py * bim; B.a -= bii * (rbx * Py - rby * Px); }
      }
    } else {
      const len = hyp(dx, dy); let c = len - (j.type === 'hinge' ? 0 : j.rest), comp = j.comp;   // (a hinge only gets here under the 1D control)
      if (j.type === 'rope' && c <= 0) c = 0;
      if (j.type === 'spring') comp *= this.P.soft;
      if (len > 1e-9 && c !== 0) {
        const nx = dx / len, ny = dy / len;
        const rnA = rax * ny - ray * nx, rnB = rbx * ny - rby * nx;
        const w = A.im + A.ii * rnA * rnA + bim + bii * rnB * rnB;
        if (w > 0) {
          const lam = c / (w + comp / (h * h));
          A.x += nx * lam * A.im; A.y += ny * lam * A.im; A.a += rnA * lam * A.ii;
          if (B) { B.x -= nx * lam * bim; B.y -= ny * lam * bim; B.a -= rnB * lam * bii; }
        }
      }
    }
    if (j.min !== null) {
      const rel = (B ? B.a : 0) - A.a - j.ref;
      const err = rel < j.min ? rel - j.min : rel > j.max ? rel - j.max : 0;
      const w = A.ii + bii;
      if (err !== 0 && w > 0) { A.a += (err * A.ii) / w; if (B) B.a -= (err * bii) / w; }
    }
  }
  dampJoints(h) {
    for (const j of this.joints) {
      if (!j.damp || !j.b || j.a.off || j.b.off) continue;
      const A = j.a, B = j.b, w = A.ii + B.ii; if (w === 0) continue;
      const d = (B.om - A.om) * Math.min(1, j.damp * h);
      A.om += (d * A.ii) / w; B.om -= (d * B.ii) / w;
    }
  }
  applyFields(h) {
    for (const z of this.zones) {
      if (z.kind !== 'fan' && z.kind !== 'water') continue;
      const x0 = z.x - z.w / 2, x1 = z.x + z.w / 2, y0 = z.y - z.h / 2, y1 = z.y + z.h / 2;
      for (const b of this.active) {
        if (b.im === 0 || b.x < x0 || b.x > x1) continue;
        if (z.kind === 'fan') {
          if (b.y < y0 || b.y > y1) continue;
          const fall = 1 - 0.5 * clamp((b.y - y0) / z.h, 0, 1);         // weaker far from the blades
          b.vx += z.fx * b.wind * fall * h; b.vy += z.fy * b.wind * fall * h;
        } else {
          if (b.y - b.ey > y1 + 1) continue;
          const n = z.col.length, ci = clamp(Math.floor(((b.x - x0) / z.w) * n), 0, n - 1);
          const surf = y1 + z.col[ci];
          const f = clamp((surf - (b.y - b.ey)) / (2 * b.ey + 1e-6), 0, 1);
          if (f <= 0) continue;
          b.vy += -this.P.gy * b.gs * b.buoy * f * h;                    // buoyancy
          const k = 1 - Math.min(1, 3 * f * h); b.vx *= k; b.vy *= k; b.om *= k;   // drag
          z.vel[ci] += b.vy * f * h * 2.2 * Math.min(1, b.mass / 2);     // the body drags the surface with it
          b.wet = f;
        }
      }
    }
  }
  stepWater(dt) {
    for (const z of this.zones) {
      if (z.kind !== 'water') continue;
      const n = z.col.length, hh = z.col, v = z.vel, dx = z.w / n, c2 = 16 / (dx * dx);
      for (let i = 0; i < n; i++) {
        const l = hh[i > 0 ? i - 1 : 0], r = hh[i < n - 1 ? i + 1 : n - 1];
        v[i] = (v[i] + c2 * (l + r - 2 * hh[i]) * dt) * 0.992;
      }
      let mean = 0; for (let i = 0; i < n; i++) { hh[i] = clamp(hh[i] + v[i] * dt, -0.8, 0.8); mean += hh[i]; }
      mean /= n; for (let i = 0; i < n; i++) hh[i] -= mean;
    }
  }
  // ---- broad phase: sweep and prune along x ----
  broad(dt) {
    const act = this.active; act.length = 0;
    for (const b of this.bodies) {
      if (b.off) continue;
      let ex, ey;
      if (b.shape === 'box') { const c = Math.abs(cos(b.a)), s = Math.abs(sin(b.a)); ex = c * b.hw + s * b.hh; ey = s * b.hw + c * b.hh; }
      else if (b.shape === 'ball') { ex = ey = b.r; }
      else { const c = Math.abs(cos(b.a)), s = Math.abs(sin(b.a)); ex = s * b.hl + b.r; ey = c * b.hl + b.r; }
      const m = 0.06 + (Math.abs(b.vx) + Math.abs(b.vy) + Math.abs(b.om) * (ex + ey)) * dt;
      b.ey = ey; b.wet = 0; b.minx = b.x - ex - m; b.maxx = b.x + ex + m; b.miny = b.y - ey - m; b.maxy = b.y + ey + m;
      act.push(b);
    }
    const s = this.sorted || (this.sorted = []); s.length = 0; for (const b of act) s.push(b);
    s.sort(this.P.controlSortByCentre ? (p, q) => p.x - q.x : (p, q) => p.minx - q.minx);   // the control sorts wrongly, to show the pair gate can fail
    let np = 0, tests = 0; const pairs = this.pairs;
    for (let i = 0; i < s.length; i++) {
      const a = s[i];
      for (let j = i + 1; j < s.length && s[j].minx <= a.maxx; j++) {
        const b = s[j]; tests++;
        if (a.im === 0 && b.im === 0) continue;
        if (a.group !== 0 && a.group === b.group) continue;
        if (a.maxy < b.miny || b.maxy < a.miny) continue;
        pairs[np++] = a; pairs[np++] = b;
      }
    }
    this.np = np; this.stats.tests = tests; this.stats.pairs = np / 2; this.stats.brute = (s.length * (s.length - 1)) / 2;
  }
  // ---- narrow phase ----
  contact(a, b, nx, ny, px, py, d) {
    let c = this.contacts[this.nc];
    if (!c) c = this.contacts[this.nc] = {};
    this.nc++;
    c.a = a; c.b = b; c.nx = nx; c.ny = ny; c.px = px; c.py = py; c.d = d; c.ln = 0; c.twin = 0; c.mate = null;
    const ca = cos(a.a), sa = sin(a.a), cb = cos(b.a), sb = sin(b.a);
    const rax = px - a.x, ray = py - a.y, rbx = px - b.x, rby = py - b.y;
    c.lax = ca * rax + sa * ray; c.lay = -sa * rax + ca * ray; c.lbx = cb * rbx + sb * rby; c.lby = -sb * rbx + cb * rby;
    c.vn0 = (b.vx - b.om * rby - a.vx + a.om * ray) * nx + (b.vy + b.om * rbx - a.vy - a.om * rax) * ny;
    c.mu = Math.sqrt(a.fric * b.fric) * this.P.fricMul;
    c.e = clamp(Math.max(a.rest, b.rest) + this.P.restAdd, 0, 1.3);
    if (c.vn0 < -4) this.events.push({ a, b, speed: -c.vn0, x: px, y: py });
  }
  cc(a, ax, ay, ar, b, bx, by, br) {
    const dx = bx - ax, dy = by - ay, rr = ar + br, d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr) return;
    const dist = Math.sqrt(d2), nx = dist > 1e-9 ? dx / dist : 0, ny = dist > 1e-9 ? dy / dist : 1, d = rr - dist;
    this.contact(a, b, nx, ny, ax + nx * (ar - d / 2), ay + ny * (ar - d / 2), d);
  }
  cb(C, cx, cy, r, B, flip) { // circle (body C) against box B. flip: C is second in the pair
    const c = cos(B.a), s = sin(B.a), dx = cx - B.x, dy = cy - B.y;
    const lx = c * dx + s * dy, ly = -s * dx + c * dy;
    const qx = clamp(lx, -B.hw, B.hw), qy = clamp(ly, -B.hh, B.hh);
    let nlx, nly, d;
    if (qx === lx && qy === ly) {                      // centre inside the box: leave by the nearest face
      const ox = B.hw - Math.abs(lx), oy = B.hh - Math.abs(ly);
      if (ox < oy) { nlx = lx < 0 ? -1 : 1; nly = 0; d = ox + r; } else { nlx = 0; nly = ly < 0 ? -1 : 1; d = oy + r; }
    } else {
      const ex = lx - qx, ey = ly - qy, dist = hyp(ex, ey);
      if (dist >= r) return;
      nlx = ex / dist; nly = ey / dist; d = r - dist;
    }
    const nx = c * nlx - s * nly, ny = s * nlx + c * nly;  // box -> circle, world
    const px = cx - nx * (r - d / 2), py = cy - ny * (r - d / 2);
    if (flip) this.contact(B, C, nx, ny, px, py, d); else this.contact(C, B, -nx, -ny, px, py, d);
  }
  bb(A, B) { // box-box, after Box2D-Lite: best axis, then clip the incident edge
    const ca = cos(A.a), sa = sin(A.a), cb = cos(B.a), sb = sin(B.a);
    const dx = B.x - A.x, dy = B.y - A.y;
    const dAx = ca * dx + sa * dy, dAy = -sa * dx + ca * dy, dBx = cb * dx + sb * dy, dBy = -sb * dx + cb * dy;
    const c00 = Math.abs(ca * cb + sa * sb), c01 = Math.abs(-ca * sb + sa * cb), c10 = Math.abs(-sa * cb + ca * sb), c11 = Math.abs(sa * sb + ca * cb);
    const fAx = Math.abs(dAx) - A.hw - (c00 * B.hw + c01 * B.hh), fAy = Math.abs(dAy) - A.hh - (c10 * B.hw + c11 * B.hh);
    if (fAx > 0 || fAy > 0) return;
    const fBx = Math.abs(dBx) - B.hw - (c00 * A.hw + c10 * A.hh), fBy = Math.abs(dBy) - B.hh - (c01 * A.hw + c11 * A.hh);
    if (fBx > 0 || fBy > 0) return;
    let axis = 0, sep = fAx, nx = dAx > 0 ? ca : -ca, ny = dAx > 0 ? sa : -sa;
    if (fAy > 0.95 * sep + 0.01 * A.hh) { axis = 1; sep = fAy; nx = dAy > 0 ? -sa : sa; ny = dAy > 0 ? ca : -ca; }
    if (fBx > 0.95 * sep + 0.01 * B.hw) { axis = 2; sep = fBx; nx = dBx > 0 ? cb : -cb; ny = dBx > 0 ? sb : -sb; }
    if (fBy > 0.95 * sep + 0.01 * B.hh) { axis = 3; sep = fBy; nx = dBy > 0 ? -sb : sb; ny = dBy > 0 ? cb : -cb; }
    const R = axis < 2 ? A : B, I = axis < 2 ? B : A;               // reference and incident boxes
    const fnx = axis < 2 ? nx : -nx, fny = axis < 2 ? ny : -ny;     // reference face normal
    const rc = cos(R.a), rs = sin(R.a), ic = cos(I.a), is = sin(I.a);
    const alongX = axis === 0 || axis === 2;
    const front = R.x * fnx + R.y * fny + (alongX ? R.hw : R.hh);
    const snx = alongX ? -rs : rc, sny = alongX ? rc : rs, side = R.x * snx + R.y * sny, sh = alongX ? R.hh : R.hw;
    // incident edge
    const lnx = -(ic * fnx + is * fny), lny = -(-is * fnx + ic * fny);
    let e0x, e0y, e1x, e1y;
    if (Math.abs(lnx) > Math.abs(lny)) {
      if (lnx > 0) { e0x = I.hw; e0y = -I.hh; e1x = I.hw; e1y = I.hh; } else { e0x = -I.hw; e0y = I.hh; e1x = -I.hw; e1y = -I.hh; }
    } else if (lny > 0) { e0x = I.hw; e0y = I.hh; e1x = -I.hw; e1y = I.hh; } else { e0x = -I.hw; e0y = -I.hh; e1x = I.hw; e1y = -I.hh; }
    let p0x = I.x + ic * e0x - is * e0y, p0y = I.y + is * e0x + ic * e0y, p1x = I.x + ic * e1x - is * e1y, p1y = I.y + is * e1x + ic * e1y;
    // clip against the two side planes
    for (let pass = 0; pass < 2; pass++) {
      const cnx = pass ? snx : -snx, cny = pass ? sny : -sny, off = pass ? side + sh : -side + sh;
      const d0 = cnx * p0x + cny * p0y - off, d1 = cnx * p1x + cny * p1y - off;
      if (d0 > 0 && d1 > 0) return;
      if (d0 > 0) { const t = d0 / (d0 - d1); p0x += t * (p1x - p0x); p0y += t * (p1y - p0y); }
      else if (d1 > 0) { const t = d1 / (d1 - d0); p1x += t * (p0x - p1x); p1y += t * (p0y - p1y); }
    }
    const s0 = fnx * p0x + fny * p0y - front, s1 = fnx * p1x + fny * p1y - front;
    const n0 = this.nc;
    if (s0 <= 0) this.contact(A, B, nx, ny, p0x - fnx * s0 * 0.5, p0y - fny * s0 * 0.5, -s0);
    if (s1 <= 0) this.contact(A, B, nx, ny, p1x - fnx * s1 * 0.5, p1y - fny * s1 * 0.5, -s1);
    if (this.nc === n0 + 2) { const c0 = this.contacts[n0], c1 = this.contacts[n0 + 1]; c0.twin = 1; c0.mate = c1; c1.twin = 2; }
  }
  detect() {
    this.nc = 0; const P = this.pairs;
    for (let i = 0; i < this.np; i += 2) {
      const a = P[i], b = P[i + 1];
      if (a.off || b.off) continue;
      const ab = a.shape === 'box', bbx = b.shape === 'box';
      if (ab && bbx) { this.bb(a, b); continue; }
      if (ab) { const s = sin(b.a), c = cos(b.a); for (const o of b.cs) this.cb(b, b.x - s * o, b.y + c * o, b.r, a, true); continue; }
      const sa = sin(a.a), ca = cos(a.a);
      if (bbx) { for (const o of a.cs) this.cb(a, a.x - sa * o, a.y + ca * o, a.r, b, false); continue; }
      const sb = sin(b.a), cb = cos(b.a);
      for (const o of a.cs) for (const q of b.cs) this.cc(a, a.x - sa * o, a.y + ca * o, a.r, b, b.x - sb * q, b.y + cb * q, b.r);
    }
    this.stats.contacts = this.nc;
  }
  step(dt) {
    this.events.length = 0;
    for (const p of PHASES) this.prof[p] = 0;
    const t1 = this.time + dt;
    for (const b of this.bodies) {
      const k = b.kin; if (!k || b.off) continue;
      const ph = (TAU * t1) / (k.period || 1) + (k.phase || 0);
      const tx = k.x0 + (k.ax || 0) * sin(ph), ty = k.y0 + (k.ay || 0) * sin(ph);
      b.vx = (tx - b.x) / dt; b.vy = (ty - b.y) / dt; b.om = k.spin || 0;
    }
    this.mark('broad'); this.broad(dt);
    const n = Math.max(1, this.P.substeps | 0), h = dt / n;
    for (let s = 0; s < n; s++) this.kernel.substep(this, h);
    this.mark('water'); this.stepWater(dt);
    this.mark(null);
    this.time = t1; this.frame++;
  }
  energy() {
    let ke = 0, pe = 0;
    for (const b of this.bodies) {
      if (b.off || b.im === 0) continue;
      ke += 0.5 * b.mass * (b.vx * b.vx + b.vy * b.vy) + (b.ii ? (0.5 * b.om * b.om) / b.ii : 0);
      pe += -b.mass * (this.P.gx * b.x + this.P.gy * b.y) * b.gs;
    }
    return { ke, pe };
  }
  hash() { // FNV-1a over every body's pose, bit for bit
    let hsh = 0x811c9dc5; const f = this._hb, u = this._hu;
    for (const b of this.bodies) {
      f[0] = b.x; f[1] = b.y; f[2] = b.a;
      for (let i = 0; i < 6; i++) { hsh ^= u[i]; hsh = Math.imul(hsh, 16777619); }
    }
    return (hsh >>> 0).toString(16).padStart(8, '0');
  }
  snapshot() {
    const n = this.bodies.length, s = new Float64Array(n * 7 + 1);
    for (let i = 0; i < n; i++) { const b = this.bodies[i], o = i * 7; s[o] = b.x; s[o + 1] = b.y; s[o + 2] = b.a; s[o + 3] = b.vx; s[o + 4] = b.vy; s[o + 5] = b.om; s[o + 6] = b.off ? 1 : 0; }
    s[n * 7] = this.time; return s;
  }
  restore(s, poseOnly) {
    const n = this.bodies.length; if (s.length !== n * 7 + 1) return false;
    for (let i = 0; i < n; i++) {
      const b = this.bodies[i], o = i * 7; b.x = s[o]; b.y = s[o + 1]; b.a = s[o + 2]; b.off = s[o + 6] === 1;
      if (!poseOnly) { b.vx = s[o + 3]; b.vy = s[o + 4]; b.om = s[o + 5]; b.px = b.x; b.py = b.y; b.pa = b.a; }
    }
    if (!poseOnly) this.time = s[n * 7];
    return true;
  }
  pick(x, y) { // topmost dynamic body under a point
    let best = null;
    for (const b of this.bodies) {
      if (b.off) continue;
      const [lx, ly] = this.local(b, x, y); let hit;
      if (b.shape === 'box') hit = Math.abs(lx) <= b.hw && Math.abs(ly) <= b.hh;
      else if (b.shape === 'ball') hit = lx * lx + ly * ly <= b.r * b.r;
      else hit = Math.abs(lx) <= b.r && Math.abs(ly) <= b.hl + b.r;
      if (hit && (!best || (b.im > 0 && best.im === 0))) best = b;
    }
    return best;
  }
}
