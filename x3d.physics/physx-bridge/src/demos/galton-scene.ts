// The Galton board as X3D: glass beads wait in a closed hopper; the page meters them one at a time into a chute above the first pin
// (a gravity-fed 2D outlet narrow enough for single file jams: granular arching, measured), then hexagonal rows of pins and bins.
// Tilt turns the collection's gravity in the board's plane (live). Pure: used by the page and in Node (tools/galton-sim.ts).
import { axisAngleToQuat } from '../bridge/math.ts';
import type { Quat, Vec3 } from '../bridge/model.ts';
import type { IRBody, IRJoint, IRShape, MachineIR, SceneMeta } from '../machine/index.ts';
import { viewpoint } from './view.ts';

export const BEAD_R = 0.004, BEAD_MASS = 0.00067; // a 8 mm glass bead
const SLOT = 2 * BEAD_R + 0.0012; // between glass and back board
export const PIN_R = 0.004;
export const BIN_TOP = 0.2, NECK = 0.044, CHUTE = 0.011;
/** Rows on a hexagonal lattice: each bead that slips between two pins lands on the pin below the gap. */
export const rowDy = (pitch: number) => pitch * 0.866;

export interface Galton {
  format: 'x3d-physx-galton/1';
  name: string;
  beads: number;
  rows: number;
  /** Pin pitch along a row (m). */
  pitch: number;
  bounce: number;
  /** Degrees, positive = board leans right (gravity turned in the board's plane). */
  tilt: number;
  /** Drag of the glass and back board on a bead: RigidBody linearDampingFactor (fraction of velocity removed per second). */
  drag: number;
}
export const LIMITS = { beads: [60, 400, 20], rows: [6, 16, 1], pitch: [0.018, 0.024, 0.001], bounce: [0, 0.7, 0.05], tilt: [-12, 12, 1], drag: [0, 0.9999, 0] } as const;
export const defaultGalton = (): Galton => ({ format: 'x3d-physx-galton/1', name: 'Galton board', beads: 240, rows: 12, pitch: 0.019, bounce: 0.1, tilt: 0, drag: DRAG });
/** Default drag: coefficient 6/s (terminal speed g/6 ≈ 1.6 m/s): beads arrive at each pin slowly, as on a real board. */
export const DRAG = 1 - Math.exp(-6);

export function sanitizeGalton(v: unknown): Galton | string {
  const g = v as Galton;
  if (!g || g.format !== 'x3d-physx-galton/1') return 'not a Galton board description';
  const c = (k: keyof typeof LIMITS) => { const [lo, hi] = LIMITS[k]; return Math.max(lo, Math.min(hi, Number(g[k]))); };
  if (![g.beads, g.rows, g.pitch, g.bounce, g.tilt].every((x) => Number.isFinite(Number(x)))) return 'a setting is not a number';
  const drag = Number.isFinite(Number(g.drag)) ? Math.max(0, Math.min(0.9999, Number(g.drag))) : DRAG;
  return { format: g.format, name: String(g.name ?? 'Galton board').slice(0, 80), beads: Math.round(c('beads')), rows: Math.round(c('rows')), pitch: c('pitch'), bounce: c('bounce'), tilt: c('tilt'), drag };
}

/**
 * Shake: SHAKE.hz taps for SHAKE.s seconds. During each tap the board is jerked down and sideways, so in its frame gravity points up and
 * aside for a moment (the page sets RigidBodyCollection.gravity): wedged beads lift off their pins and fall again.
 */
export const SHAKE = { hz: 7, s: 0.6, up: 6, side: 4 };
export function shakeGravity(tiltDeg: number, u: number): Vec3 {
  if (u < 0 || u > SHAKE.s || (u * SHAKE.hz) % 1 > 0.3) return gravityFor(tiltDeg);
  const side = Math.floor(u * SHAKE.hz) % 2 ? 1 : -1;
  return [side * SHAKE.side, SHAKE.up, 0];
}
export const gravityFor = (tiltDeg: number): Vec3 => { const a = (tiltDeg * Math.PI) / 180; return [9.81 * Math.sin(a), -9.81 * Math.cos(a), 0]; };

/** Layout numbers the page needs (bins, rows). */
export function geometry(g: Galton) {
  const lastRow = BIN_TOP + 0.02, firstRow = lastRow + (g.rows - 1) * rowDy(g.pitch), chuteBottom = firstRow + PIN_R + BEAD_R + 0.012, neckY = chuteBottom + 0.05;
  const halfW = (g.rows / 2 + 1.5) * g.pitch;
  const bins = Array.from({ length: g.rows + 1 }, (_, j) => (j - g.rows / 2) * g.pitch);
  return { lastRow, firstRow, chuteBottom, neckY, halfW, bins, hopperTop: neckY + 0.17, dropAt: [0, neckY - 0.012, 0] as Vec3 };
}

/** Pearson's χ² of counts against expectations, tail bins pooled until each expects at least 5 (the usual rule for the approximation). */
export function chiSquare(obs: number[], exp: number[]) {
  const o: number[] = [], e: number[] = [];
  let ao = 0, ae = 0;
  obs.forEach((x, i) => { ao += x; ae += exp[i]; if (ae >= 5 || i === obs.length - 1) { o.push(ao); e.push(ae); ao = 0; ae = 0; } });
  if (e.length > 1 && e[e.length - 1] < 5) { o[o.length - 2] += o.pop()!; e[e.length - 2] += e.pop()!; }
  return { chi2: o.reduce((s, x, i) => s + (x - e[i]) ** 2 / e[i], 0), dof: o.length - 1 };
}

/** P(χ²_k > x): the regularised upper incomplete gamma Q(k/2, x/2) (series / continued fraction, Numerical Recipes style). */
export function chiSquareP(x: number, k: number) {
  if (k <= 0 || !(x >= 0)) return NaN;
  const a = k / 2, z = x / 2;
  const lnG = (v: number) => { const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]; let y = v, t = v + 5.5; t -= (v + 0.5) * Math.log(t); let ser = 1.000000000190015; for (const cj of c) ser += cj / ++y; return -t + Math.log((2.5066282746310005 * ser) / v); };
  if (z < a + 1) { let sum = 1 / a, del = sum, ap = a; for (let n = 0; n < 200; n++) { del *= z / ++ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-12) break; } return 1 - sum * Math.exp(-z + a * Math.log(z) - lnG(a)); }
  let b = z + 1 - a, c = 1e300, d = 1 / b, h = d;
  for (let i = 1; i < 200; i++) { const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300; c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-12) break; }
  return Math.exp(-z + a * Math.log(z) - lnG(a)) * h;
}

/** Binomial(n, ½) probabilities: where a bead would land if every pin were a fair coin. */
export function binomial(n: number) { const p: number[] = []; let c = 1; for (let k = 0; k <= n; k++) { p.push(c / 2 ** n); c = (c * (n - k)) / (k + 1); } return p; }

export function buildGalton(g: Galton): { ir: MachineIR; meta: SceneMeta; beads: number[] } {
  const q0: Quat = [0, 0, 0, 1], zq = (a: number): Quat => axisAngleToQuat(0, 0, 1, a), xq = (a: number): Quat => axisAngleToQuat(1, 0, 0, a);
  const G = geometry(g), bodies: IRBody[] = [], joints: IRJoint[] = [];
  const fixed = (def: string, shapes: IRShape[], role: IRBody['role'] = 'board') => bodies.push({ def, pose: { p: [0, 0, 0], q: q0 }, pieceLocal: { p: [0, 0, 0], q: q0 }, piece: -1, fixed: true, role, shapes });
  const box = (def: string, size: Vec3, p: Vec3, mat: string, q: Quat = q0): IRShape => ({ def, geom: { kind: 'box', size }, local: { p, q }, mat });
  const W = 2 * G.halfW, top = G.hopperTop;

  // the case: back board, glass, floor, sides
  fixed('Case', [
    box('Back', [W + 0.12, top + 0.04, 0.01], [0, top / 2, -SLOT / 2 - 0.005], 'ebony'),
    box('Floor', [W + 0.04, 0.02, SLOT + 0.02], [0, -0.01, 0], 'frame'),
    box('SideL', [0.02, top, SLOT + 0.02], [-G.halfW - 0.01, top / 2, 0], 'frame'),
    box('SideR', [0.02, top, SLOT + 0.02], [G.halfW + 0.01, top / 2, 0], 'frame'),
  ]);
  fixed('Glass', [box('GlassPane', [W + 0.04, top, 0.004], [0, top / 2, SLOT / 2 + 0.002], 'glassPane')]);
  // bins
  const dividers: IRShape[] = [];
  for (let j = 0; j <= g.rows + 1; j++) { const x = (j - g.rows / 2 - 0.5) * g.pitch; if (Math.abs(x) < G.halfW) dividers.push(box(`Div${j}`, [0.002, BIN_TOP, SLOT], [x, BIN_TOP / 2, 0], 'brass')); }
  fixed('Bins', dividers);
  // pins: row k at height lastRow + (rows-1-k)·dy, offset by k·pitch/2; across the board
  const pins: IRShape[] = [];
  for (let k = 0; k < g.rows; k++) {
    const y = G.firstRow - k * rowDy(g.pitch);
    for (let m = -30; m <= 30; m++) {
      const x = (m + (k % 2) / 2) * g.pitch;
      if (Math.abs(x) > G.halfW - PIN_R - BEAD_R * 0.6) continue;
      pins.push({ def: `Pin${k}_${m + 30}`, geom: { kind: 'cylinder', r: PIN_R, h: SLOT }, local: { p: [x, y, 0], q: xq(Math.PI / 2) }, mat: 'steel' });
    }
  }
  fixed('Pins', pins);
  // the hopper: two walls at 45°, a neck, the gate (hinged at the left of the neck) and its latch
  const wallLen = Math.hypot(G.halfW - NECK / 2, top - G.neckY) * 1.02, ang = Math.atan2(top - G.neckY, G.halfW - NECK / 2);
  for (const s of [-1, 1]) {
    const cx = s * (NECK / 2 + (G.halfW - NECK / 2) / 2), cy = (G.neckY + top) / 2;
    fixed(`Funnel${s < 0 ? 'L' : 'R'}`, [box(`Funnel${s < 0 ? 'L' : 'R'}S`, [wallLen, 0.004, SLOT], [cx, cy + 0.002, 0], 'frame', zq(s * ang))]);
  }
  // the hopper's floor (closed) and the chute under it: beads leave single file, centred over the first pin
  fixed('HopperFloor', [box('HopperFloorS', [NECK + 0.01, 0.004, SLOT], [0, G.neckY - 0.002, 0], 'brass')]);
  for (const sx of [-1, 1]) fixed(`Chute${sx < 0 ? 'L' : 'R'}`, [box(`Chute${sx < 0 ? 'L' : 'R'}S`, [0.003, G.neckY - 0.004 - G.chuteBottom, SLOT], [sx * (CHUTE / 2 + 0.0015), (G.neckY - 0.004 + G.chuteBottom) / 2, 0], 'brass')]);
  // beads, packed in rows inside the hopper from the gate up
  const beadIdx: number[] = [];
  const dx = 2 * BEAD_R + 0.0009, dy = dx * 0.87;
  let placed = 0;
  for (let r = 0; placed < g.beads && r < 200; r++) {
    const y = G.neckY + BEAD_R + 0.001 + r * dy, half = NECK / 2 + (y - G.neckY - 0.006) / Math.tan(ang) - BEAD_R * 2.2;
    const n = Math.max(1, Math.floor((2 * half) / dx) + 1), x0 = -((n - 1) * dx) / 2 + (r % 2 ? dx / 4 : -dx / 4);
    for (let i = 0; i < n && placed < g.beads; i++) {
      const p: Vec3 = [x0 + i * dx, y, ((placed * 7919) % 5 - 2) * 0.00005];
      beadIdx.push(bodies.length);
      bodies.push({ def: `Bead${placed}`, pose: { p, q: q0 }, pieceLocal: { p, q: q0 }, piece: -1, fixed: false, mass: BEAD_MASS, role: 'bead', damping: { linear: g.drag, angular: 0.5 }, shapes: [{ def: `Bead${placed}S`, geom: { kind: 'sphere', r: BEAD_R }, local: { p: [0, 0, 0], q: q0 }, mat: 'bead' }] });
      placed++;
    }
  }
  const ir: MachineIR = {
    // the pins are watched by a CollisionSensor: with the bridge's 'sensed' contacts only bead-on-pin pairs report (the ticks)
    bodies, joints, clocks: [], chimes: pins.map((p) => p.def),
    surface: { bounce: g.bounce, minBounceSpeed: 0.05, friction: 0.15 },
    gravity: gravityFor(g.tilt),
    world: { autoDisable: true, disableLinearSpeed: 0.003, disableAngularSpeed: 0.03, disableTime: 1.5, iterations: 8 },
  };
  const meta: SceneMeta = {
    title: g.name,
    description: `A Galton board: ${placed} glass beads (${BEAD_R * 2000} mm), ${g.rows} rows of pins ${g.pitch * 1000} mm apart, bounce ${g.bounce}, tilt ${g.tilt}°. The page drops beads from the hopper into the chute one at a time.`,
    info: 'Units: metres, kilograms, seconds, radians. Y up; the board is the XY plane.',
    generator: 'x3d-physx-bridge demos (src/demos/galton-scene.ts)',
    shareShapes: true,
    viewpoints: [
      viewpoint('Front', 'The board', [0, top / 2 + 0.02, 0.95], [0, top / 2, 0]),
      viewpoint('Pins', 'The pins, close', [0.05, (G.firstRow + G.lastRow) / 2 + 0.03, 0.42], [0, (G.firstRow + G.lastRow) / 2, 0]),
      viewpoint('Bins', 'The bins', [0, BIN_TOP * 0.6, 0.45], [0, BIN_TOP * 0.5, 0]),
    ].join('\n'),
  };
  return { ir, meta, beads: beadIdx };
}
