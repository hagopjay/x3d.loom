// loom:sim
// ===== level.js : prefabs ("parts") that expand into bodies, joints and zones; the default course =====
// A level is { physics, parts:[{id,kind,p}], bodies:[...], joints:[...], zones:[...] } of plain data.
const PREFABS = {
  platform: { doc: 'static slab; x,y = centre of its TOP face; w,h; angle (deg)', d: { w: 6, h: 0.5, angle: 0 },
    build(p, k) { const a = p.angle * DEG; k.B({ role: 'static', x: p.x + sin(a) * p.h / 2, y: p.y - cos(a) * p.h / 2, a, w: p.w, h: p.h, fric: 0.8 }); } },
  ramp: { doc: 'static slope whose top runs from (x,y) to (x2,y2)', d: { x2: 6, y2: -3, thick: 0.5 },
    build(p, k) { const dx = p.x2 - p.x, dy = p.y2 - p.y, a = atan2(dy, dx), L = hyp(dx, dy);
      k.B({ role: 'static', x: (p.x + p.x2) / 2 + sin(a) * p.thick / 2, y: (p.y + p.y2) / 2 - cos(a) * p.thick / 2, a, w: L, h: p.thick, fric: 0.5 }); } },
  crates: { doc: 'stack of boxes; x,y = bottom centre; cols, rows, size, mass (each)', d: { cols: 1, rows: 1, size: 0.9, mass: 2 },
    build(p, k) { for (let r = 0; r < p.rows; r++) for (let c = 0; c < p.cols; c++)
      k.B({ role: 'crate', x: p.x + (c - (p.cols - 1) / 2) * p.size * 1.02, y: p.y + p.size * (r + 0.5) + 0.002 * r, w: p.size, h: p.size, mass: p.mass, fric: 0.7 }); } },
  raft: { doc: 'floating plank; x,y centre; w,h; mass', d: { w: 1.8, h: 0.5, mass: 3 },
    build(p, k) { k.B({ role: 'crate', x: p.x, y: p.y, w: p.w, h: p.h, mass: p.mass, buoy: 2.6, fric: 0.9 }); } },
  ball: { doc: 'one ball; x,y centre; r, mass, bounce (0..1)', d: { r: 0.45, mass: 2, bounce: 0.45 },
    build(p, k) { k.B({ role: 'ball', shape: 'ball', x: p.x, y: p.y, r: p.r, mass: p.mass, rest: p.bounce, fric: 0.5 }); } },
  dominoes: { doc: 'row of standing dominoes going +x; x,y = foot of the first; count, spacing, height, thick', d: { count: 12, spacing: 0.8, height: 1.5, thick: 0.22 },
    build(p, k) { for (let i = 0; i < p.count; i++) k.B({ role: 'domino', x: p.x + i * p.spacing, y: p.y + p.height / 2, w: p.thick, h: p.height, mass: 0.8, fric: 0.55, rest: 0 }); } },
  seesaw: { doc: 'plank on a pivot; x,y = ground under the pivot; length', d: { length: 6 },
    build(p, k) { const g = k.group(), post = k.B({ role: 'static', x: p.x, y: p.y + 0.3, w: 0.5, h: 0.6, group: g });
      const pl = k.B({ role: 'plank', x: p.x, y: p.y + 0.72, w: p.length, h: 0.2, mass: 3, group: g });
      k.J({ type: 'hinge', a: pl, b: post, ax: p.x, ay: p.y + 0.72, min: -0.35, max: 0.35 }); } },
  pendulum: { doc: 'wrecking ball on a chain; x,y = ceiling anchor; length, r, mass, angle (deg from straight down)', d: { length: 6, r: 0.8, mass: 40, angle: 55, links: 6 },
    build(p, k) { const g = k.group(), a = p.angle * DEG, ux = sin(a), uy = -cos(a), seg = (p.length - p.r) / p.links;
      let prev = k.B({ role: 'static', x: p.x, y: p.y + 0.15, w: 0.8, h: 0.3, group: g });      // every joint names two bodies: the ceiling block is body 2 of the first link
      for (let i = 0; i < p.links; i++) { const cx = p.x + ux * seg * (i + 0.5), cy = p.y + uy * seg * (i + 0.5);
        const l = k.B({ role: 'chain', shape: 'pill', x: cx, y: cy, a, r: 0.07, hl: seg / 2 - 0.07, mass: 0.6, group: g });
        k.J({ type: 'hinge', a: l, b: prev, ax: p.x + ux * seg * i, ay: p.y + uy * seg * i }); prev = l; }
      const ball = k.B({ role: 'hazard', shape: 'ball', x: p.x + ux * p.length, y: p.y + uy * p.length, r: p.r, mass: p.mass, group: g, rest: 0.2 });
      k.J({ type: 'hinge', a: ball, b: prev, ax: p.x + ux * (p.length - p.r), ay: p.y + uy * (p.length - p.r) }); } },
  bridge: { doc: 'hinged plank bridge from (x,y) going +x; length, planks', d: { length: 8, planks: 8 },
    build(p, k) { const g = k.group(), w = p.length / p.planks; let prev = k.B({ role: 'static', x: p.x - 0.15, y: p.y - 0.25, w: 0.3, h: 0.5, group: g });
      const end = k.B({ role: 'static', x: p.x + p.length + 0.15, y: p.y - 0.25, w: 0.3, h: 0.5, group: g });
      for (let i = 0; i < p.planks; i++) { const pl = k.B({ role: 'plank', x: p.x + w * (i + 0.5), y: p.y - 0.1, w: w - 0.04, h: 0.2, mass: 1.2, group: g, fric: 0.9 });
        k.J({ type: 'hinge', a: pl, b: prev, ax: p.x + w * i, ay: p.y - 0.1, comp: 1e-5 }); prev = pl; }
      k.J({ type: 'hinge', a: prev, b: end, ax: p.x + p.length, ay: p.y - 0.1, comp: 1e-5 }); } },
  jelly: { doc: 'soft block: balls joined by springs; x,y = bottom centre; cols, rows, size (spacing), softness (spring compliance, 0.0001 stiff .. 0.02 wobbly)', d: { cols: 6, rows: 4, size: 0.5, softness: 0.002 },
    build(p, k) { const g = k.group(), n = []; const s = p.size;
      for (let r = 0; r < p.rows; r++) for (let c = 0; c < p.cols; c++) n.push(k.B({ role: 'jelly', shape: 'ball', x: p.x + (c - (p.cols - 1) / 2) * s, y: p.y + s * (r + 0.5), r: s * 0.5, mass: 0.5, group: g, fric: 0.8, rest: 0.3 }));
      const at = (c, r) => n[r * p.cols + c], sp = (a, b) => k.J({ type: 'spring', a, b, ax: a.x, ay: a.y, bx: b.x, by: b.y, comp: p.softness });
      for (let r = 0; r < p.rows; r++) for (let c = 0; c < p.cols; c++) {
        if (c + 1 < p.cols) sp(at(c, r), at(c + 1, r)); if (r + 1 < p.rows) sp(at(c, r), at(c, r + 1));
        if (c + 1 < p.cols && r + 1 < p.rows) { sp(at(c, r), at(c + 1, r + 1)); sp(at(c + 1, r), at(c, r + 1)); } } } },
  spring: { doc: 'bounce pad; x,y = top centre; w', d: { w: 2 }, build(p, k) { k.B({ role: 'spring', x: p.x, y: p.y - 0.15, w: p.w, h: 0.3, rest: 0.95 }); } },
  fan: { doc: 'wind column; x,y = centre of the blades; w (across), h (reach), force (m/s2), angle (deg, 90 = up)', d: { w: 3, h: 9, force: 46, angle: 90 },
    build(p, k) { const a = p.angle * DEG, c = cos(a), s = sin(a), up = Math.abs(s) > Math.abs(c);
      k.Z({ kind: 'fan', x: p.x + (c * p.h) / 2, y: p.y + (s * p.h) / 2, w: up ? p.w : p.h, h: up ? p.h : p.w, fx: c * p.force, fy: s * p.force, angle: p.angle }); } },
  water: { doc: 'tank with height-field water; x = centre, y = water surface; w, depth', d: { w: 10, depth: 3 },
    build(p, k) { const t = 0.4;
      k.B({ role: 'static', x: p.x, y: p.y - p.depth - t / 2, w: p.w + 2 * t, h: t });
      k.B({ role: 'static', x: p.x - p.w / 2 - t / 2, y: p.y - p.depth / 2 + 0.2, w: t, h: p.depth + 0.4 });
      k.B({ role: 'static', x: p.x + p.w / 2 + t / 2, y: p.y - p.depth / 2 + 0.2, w: t, h: p.depth + 0.4 });
      k.Z({ kind: 'water', x: p.x, y: p.y - p.depth / 2, w: p.w, h: p.depth }); } },
  pegs: { doc: 'staggered peg board (Galton); x = centre, y = top row; cols, rows, spacing, r', d: { cols: 7, rows: 5, spacing: 1.1, r: 0.14 },
    build(p, k) { for (let r = 0; r < p.rows; r++) for (let c = 0; c < p.cols - (r % 2); c++)
      k.B({ role: 'peg', shape: 'ball', x: p.x + (c - (p.cols - 1 - (r % 2)) / 2) * p.spacing, y: p.y - r * p.spacing * 0.8, r: p.r, rest: 0.35 }); } },
  balls: { doc: 'a batch of small balls; x,y = bottom centre of the batch; count, r, mass, bounce', d: { count: 40, r: 0.22, mass: 0.3, bounce: 0.3 },
    build(p, k) { const cols = Math.ceil(Math.sqrt(p.count * 2)); const rnd = rng32(k.seed);
      for (let i = 0; i < p.count; i++) k.B({ role: 'ball', shape: 'ball', x: p.x + ((i % cols) - (cols - 1) / 2) * p.r * 2.15 + (rnd() - 0.5) * 0.05, y: p.y + p.r + Math.floor(i / cols) * p.r * 2.15, r: p.r, mass: p.mass, rest: p.bounce, fric: 0.3 }); } },
  ring: { doc: 'grapple ring the hero can hook; x,y', d: {}, build(p, k) { k.Z({ kind: 'ring', x: p.x, y: p.y, w: 0.6, h: 0.6 }); } },
  lift: { doc: 'moving platform; x,y = top centre at rest; w; dx,dy = swing each way; period (s)', d: { w: 3, dx: 0, dy: 3, period: 5 },
    build(p, k) { k.B({ role: 'lift', x: p.x, y: p.y - 0.15, w: p.w, h: 0.3, fric: 1, kin: { x0: p.x, y0: p.y - 0.15, ax: p.dx, ay: p.dy, period: p.period } }); } },
  spinner: { doc: 'motor-driven bar; x,y = hub; length; speed (rad/s, sign = direction)', d: { length: 5, speed: 2 },
    build(p, k) { k.B({ role: 'hazard', x: p.x, y: p.y, w: p.length, h: 0.3, kin: { x0: p.x, y0: p.y, spin: p.speed } }); } },
  curtain: { doc: 'hanging streamers; x,y = left end of the rail; strands, length, spacing', d: { strands: 5, length: 3, spacing: 0.55, links: 5 },
    build(p, k) { const g = k.group(), seg = p.length / p.links, span = (p.strands - 1) * p.spacing;
      const rail = k.B({ role: 'static', x: p.x + span / 2, y: p.y + 0.1, w: span + 0.6, h: 0.2, group: g });
      for (let s = 0; s < p.strands; s++) { let prev = rail; const x = p.x + s * p.spacing;
        for (let i = 0; i < p.links; i++) { const l = k.B({ role: 'cloth', shape: 'pill', x, y: p.y - seg * (i + 0.5), r: 0.05, hl: seg / 2 - 0.05, mass: 0.08, group: g, wind: 1.6 });
          k.J({ type: 'hinge', a: l, b: prev, ax: x, ay: p.y - seg * i, damp: 2 }); prev = l; } } } },
  cannon: { doc: 'dummy cannon; x,y = breech; angle (deg above horizontal), power (m/s)', d: { angle: 45, power: 32 },
    build(p, k) { k.Z({ kind: 'cannon', x: p.x, y: p.y, w: 2, h: 2, angle: p.angle, power: p.power }); } },
  goal: { doc: 'bullseye target for a flying dummy; x,y; r', d: { r: 1.6 }, build(p, k) { k.Z({ kind: 'goal', x: p.x, y: p.y, w: 2 * p.r, h: 2 * p.r }); } },
  star: { doc: 'collectible; x,y', d: {}, build(p, k) { k.Z({ kind: 'star', x: p.x, y: p.y, w: 1, h: 1 }); } },
  checkpoint: { doc: 'respawn point and hall marker; x,y = floor; name', d: { name: 'Hall' }, build(p, k) { k.Z({ kind: 'checkpoint', x: p.x, y: p.y + 2, w: 2, h: 4, name: p.name }); } },
  label: { doc: 'wall sign; x,y; title; text', d: { title: '', text: '' }, build(p, k) { k.Z({ kind: 'label', x: p.x, y: p.y, w: 1, h: 1, title: p.title, text: p.text }); } },
};

function expandPart(level, part) {
  const def = PREFABS[part.kind]; if (!def) throw new Error('unknown part kind "' + part.kind + '". Kinds: ' + Object.keys(PREFABS).join(', '));
  const p = Object.assign({}, def.d, part.p); let n = 0; const made = new Map();
  for (const key of Object.keys(p)) if (typeof p[key] === 'string' && key !== 'name' && key !== 'title' && key !== 'text' && p[key].trim() !== '' && !isNaN(+p[key])) p[key] = +p[key];
  if (!isFinite(p.x) || !isFinite(p.y)) throw new Error('part needs numeric x and y');
  let hs = 7; for (const ch of part.id) hs = (Math.imul(hs, 31) + ch.charCodeAt(0)) >>> 0;
  const k = {
    seed: hs, group: () => 100 + ++level.gseq,          // collision groups are numbered per level, so the same calls build the same level in any process
    B(o) { o.id = part.id + '_' + n++; o.part = part.id; o.shape = o.shape || 'box'; level.bodies.push(o); return o; },
    J(o) { const j = Object.assign({}, o, { id: part.id + '_j' + n++, part: part.id, a: o.a.id, b: o.b ? o.b.id : null }); level.joints.push(j); return j; },
    Z(o) { o.id = part.id + '_z' + n++; o.part = part.id; level.zones.push(o); return o; },
  };
  def.build(p, k);
}
function removePartPrims(level, id) {
  level.bodies = level.bodies.filter((b) => b.part !== id); level.joints = level.joints.filter((j) => j.part !== id); level.zones = level.zones.filter((z) => z.part !== id);
}
function newLevel(physics) { return { physics: Object.assign({ gravity: 30, substeps: 8, iters: 1 }, physics), parts: [], bodies: [], joints: [], zones: [], seq: 0, gseq: 0 }; }
function addPart(level, kind, p, id) {
  if (!PREFABS[kind]) throw new Error('unknown part kind "' + kind + '". Kinds: ' + Object.keys(PREFABS).join(', '));
  id = id || kind + '_' + ++level.seq; while (level.parts.some((q) => q.id === id)) id = kind + '_' + ++level.seq;
  const part = { id, kind, p: Object.assign({}, p) }; expandPart(level, part); level.parts.push(part); return part;
}
function editPart(level, id, changes) {
  const part = level.parts.find((q) => q.id === id); if (!part) throw new Error('no part with id ' + id);
  const keep = { bodies: level.bodies, joints: level.joints, zones: level.zones }, old = part.p;
  removePartPrims(level, id); part.p = Object.assign({}, old, changes);
  try { expandPart(level, part); } catch (e) { part.p = old; Object.assign(level, keep); throw e; }
  return part;
}
function removePart(level, id) {
  const i = level.parts.findIndex((q) => q.id === id); if (i < 0) throw new Error('no part with id ' + id);
  level.parts.splice(i, 1); removePartPrims(level, id);
}
function cloneLevel(L) { return JSON.parse(JSON.stringify(L)); }
function partBounds(level) {
  const m = new Map(); const grow = (id, x0, x1) => { const e = m.get(id) || [Infinity, -Infinity]; e[0] = Math.min(e[0], x0); e[1] = Math.max(e[1], x1); m.set(id, e); };
  for (const b of level.bodies) { const e = b.shape === 'box' ? hyp(b.w, b.h) / 2 : (b.r || 0) + (b.hl || 0); grow(b.part, b.x - e, b.x + e); }
  for (const z of level.zones) grow(z.part, z.x - z.w / 2, z.x + z.w / 2);
  return m;
}
function windowLevel(L, x0, x1) { // keep only parts that touch [x0, x1]: used for fast headless experiments
  const out = cloneLevel(L), bd = partBounds(out), keep = new Set();
  for (const [id, e] of bd) if (e[1] >= x0 && e[0] <= x1) keep.add(id);
  out.parts = out.parts.filter((p) => keep.has(p.id)); out.bodies = out.bodies.filter((b) => keep.has(b.part));
  out.joints = out.joints.filter((j) => keep.has(j.part)); out.zones = out.zones.filter((z) => keep.has(z.part));
  return out;
}

const HALLS = [
  { key: 'feel', x: -2, y: 0, name: '0 Feel', title: 'HALL 0 · FEEL', text: 'Run, jump, wall-jump. Press F to go limp: you become eleven bodies and ten hinges.' },
  { key: 'contact', x: 17, y: 0, name: '1 Contact', title: 'HALL 1 · CONTACT', text: 'Dominoes are boxes that only push. Friction is capped at mu times the push.' },
  { key: 'joints', x: 51, y: -3, name: '2 Joints', title: 'HALL 2 · JOINTS', text: 'A hinge pins two points together. Chains, bridges and you are made of them. Hold Shift near a ring.' },
  { key: 'soft', x: 78, y: -3, name: '3 Compliance', title: 'HALL 3 · COMPLIANCE', text: 'Same lattice twice. Only the spring compliance differs, by 100 times.' },
  { key: 'fields', x: 93, y: -3, name: '4 Fields', title: 'HALL 4 · FIELDS', text: 'Wind and water are forces over a region. Upright you are too heavy for the fan. Limp, you fly.' },
  { key: 'broad', x: 117, y: -3, name: '5 Broad phase', title: 'HALL 5 · BROAD PHASE', text: 'Sorting bodies along x finds the few pairs worth testing. Turn on the Pairs overlay.' },
  { key: 'cannon', x: 139, y: -3, name: '6 Cannon', title: 'HALL 6 · THE CANNON', text: 'Up at the cannon to climb in. Aim, then jump to fire. Ask the curator for the best angle.' },
];
function defaultLevel() {
  const L = newLevel(); const P = (kind, p, id) => addPart(L, kind, p, id);
  // floors and walls
  P('platform', { x: 10.5, y: 0, w: 41, h: 2 }, 'floor_a');
  P('platform', { x: -10.5, y: 12, w: 1, h: 14 }, 'wall_left');
  P('ramp', { x: 31, y: 0, x2: 37, y2: -3, thick: 0.6 }, 'ramp_a');
  P('platform', { x: 50.5, y: -3, w: 27, h: 2 }, 'floor_b');
  P('platform', { x: 88.55, y: -3, w: 25.1, h: 2 }, 'floor_c');
  P('platform', { x: 142.2, y: -3, w: 56.6, h: 2 }, 'floor_d');
  P('platform', { x: 171, y: 13, w: 1, h: 18 }, 'wall_right');
  for (const h of HALLS) { P('checkpoint', { x: h.x, y: h.y, name: h.name }, 'cp_' + h.key); P('label', { x: h.x + 5, y: h.y + 7.2, title: h.title, text: h.text }, 'sign_' + h.key); }
  // Hall 0: feel
  P('platform', { x: 5, y: 1.3, w: 2.6, h: 1.3 }, 'step_1');
  P('spring', { x: 9.5, y: 0.08, w: 2 }, 'pad_1');
  P('platform', { x: 13, y: 4, w: 1, h: 4 }, 'wall_jump');
  P('star', { x: 9.5, y: 5.6 }, 'star_1');
  // Hall 1: contact
  P('dominoes', { x: 18.5, y: 0, count: 13, spacing: 0.8, height: 1.5 }, 'dominoes_1');
  P('ball', { x: 29.4, y: 0.5, r: 0.5, mass: 3 }, 'ball_1');
  P('star', { x: 24, y: 2.6 }, 'star_2');
  P('seesaw', { x: 41, y: -3, length: 6 }, 'seesaw_1');
  P('crates', { x: 43.2, y: -2.2, cols: 1, rows: 1, size: 0.7, mass: 1 }, 'crate_fling');
  P('crates', { x: 47, y: -3, cols: 3, rows: 3, size: 0.9, mass: 1.5 }, 'crates_1');
  // Hall 2: joints
  P('pendulum', { x: 58, y: 5.5, length: 7, r: 0.85, mass: 45, angle: 60 }, 'wrecker_1');
  P('bridge', { x: 64, y: -3, length: 12, planks: 12 }, 'bridge_1');
  P('ring', { x: 66.5, y: 1.6 }, 'ring_1'); P('ring', { x: 70.5, y: 2 }, 'ring_2'); P('ring', { x: 74.5, y: 1.6 }, 'ring_3');
  P('star', { x: 70.5, y: -0.4 }, 'star_3');
  // Hall 3: compliance
  P('jelly', { x: 82.5, y: -3, cols: 6, rows: 4, size: 0.5, softness: 0.0002 }, 'jelly_stiff');
  P('jelly', { x: 88, y: -3, cols: 6, rows: 4, size: 0.5, softness: 0.02 }, 'jelly_soft');
  P('star', { x: 88, y: 1.2 }, 'star_4');
  // Hall 4: fields
  P('fan', { x: 96, y: -3, w: 3, h: 10, force: 46 }, 'fan_1');
  P('curtain', { x: 94.9, y: 8, strands: 5, length: 3, spacing: 0.55 }, 'streamers_1');
  P('star', { x: 96, y: 4.2 }, 'star_5');
  P('water', { x: 107.5, y: -3.5, w: 12, depth: 3 }, 'tank_1');
  for (let i = 0; i < 4; i++) P('raft', { x: 103.4 + i * 2.75, y: -3.4 }, 'raft_' + (i + 1));
  P('star', { x: 107.5, y: -1.6 }, 'star_6');
  // Hall 5: broad phase
  P('platform', { x: 119.5, y: -1.8, w: 0.4, h: 1.2 }, 'bin_l'); P('platform', { x: 129.5, y: -1.8, w: 0.4, h: 1.2 }, 'bin_r');
  P('pegs', { x: 124.5, y: 5.2, cols: 7, rows: 5, spacing: 1.15 }, 'pegs_1');
  P('balls', { x: 124.5, y: 6.4, count: 60, r: 0.22 }, 'balls_1');
  P('star', { x: 124.5, y: -2.3 }, 'star_7');
  P('lift', { x: 134, y: 0.2, w: 2.6, dy: 3, period: 5 }, 'lift_1');
  P('platform', { x: 137.6, y: 3.4, w: 2.4, h: 0.3 }, 'ledge_1');
  P('star', { x: 137.6, y: 4.5 }, 'star_8');
  // Hall 6: cannon
  P('cannon', { x: 143, y: -2, angle: 45, power: 32 }, 'cannon_1');
  P('spinner', { x: 153, y: 9.5, length: 5, speed: 2 }, 'spinner_1');
  P('crates', { x: 161, y: -3, cols: 3, rows: 6, size: 0.9, mass: 1.2 }, 'tower_1');
  P('goal', { x: 167.5, y: 2.5, r: 1.6 }, 'goal_1');
  P('star', { x: 167.5, y: 2.5 }, 'star_9');
  return L;
}
