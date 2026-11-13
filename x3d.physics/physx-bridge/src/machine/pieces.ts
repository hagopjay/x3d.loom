// The Marble Machine: board, piece library and the machine description (plain data: what build mode edits, undo stores and export embeds).
// Every piece becomes standard X3D RigidBodyPhysics nodes through the IR (ir.ts -> x3d.ts).
import type { Pose, Vec3 } from '../bridge/model.ts';
import { IDENTITY, applyPose, compose, zRot } from './ir.ts';
import type { IRBody, IRClock, IRJoint, IRShape, MachineIR, VisualGeom } from './ir.ts';

export const GRID = 0.04;
/** Grid extent of the pegboard (piece origins snap to these holes). */
export const COLS = [-16, 16] as const, ROWS = [0, 24] as const;
/** The slot between the pegboard (back) and the glass (front): pieces span z ∈ [−DEPTH/2, DEPTH/2]. */
export const DEPTH = 0.05;
export const MARBLE_R = 0.008, MARBLE_MASS = 0.005, MAX_MARBLES = 20;
/** Two hoppers (Drop alternates between them): A top left, B top right. */
export const HOPPERS: Vec3[] = [[-0.52, 0.93, 0], [0.52, 0.93, 0]];
export const HOPPER = HOPPERS[0];
/** Goal cup (walls 0.1 m: marbles leave a funnel still moving sideways, and 0.06 m walls let them out: measured). */
export const CUP = { x: 0.44, y: 0.0, inner: 0.11, top: 0.1 };

export type PieceType = 'ramp' | 'curve' | 'halfpipe' | 'funnel' | 'zigzag' | 'flipper' | 'seesaw' | 'pendulum' | 'dominoes' | 'launcher' | 'wheel' | 'elevator' | 'bell' | 'xylophone';

export interface PieceInst { id: number; type: PieceType; gx: number; gy: number; rot: number; params?: Record<string, number> }
export interface Machine { format: 'x3d-physx-machine/1'; name: string; pieces: PieceInst[]; marbles: number }

export interface PieceInfo { type: PieceType; label: string; key: string; nodes: string; defaults: Record<string, number>; rot: number; about: string }

/** The palette, in display order (key = palette shortcut). */
export const PIECES: PieceInfo[] = [
  { type: 'ramp', label: 'Ramp', key: 'a', nodes: 'RigidBody fixed + Box', defaults: { length: 0.24 }, rot: -15, about: 'a straight board; tilt it in 15° steps' },
  { type: 'curve', label: 'Curved ramp', key: 'c', nodes: 'RigidBody fixed + IndexedFaceSet (PhysX triangle mesh)', defaults: {}, rot: 0, about: 'turns a falling marble sideways' },
  { type: 'halfpipe', label: 'Half-pipe', key: 'h', nodes: 'RigidBody fixed + IndexedFaceSet', defaults: {}, rot: 0, about: 'marbles rock to and fro; fast ones fly out' },
  { type: 'funnel', label: 'Funnel', key: 'u', nodes: 'RigidBody fixed + two Boxes (CollidableOffset)', defaults: {}, rot: 0, about: 'gathers marbles to one point' },
  { type: 'zigzag', label: 'Zigzag', key: 'z', nodes: 'RigidBody fixed + five Boxes', defaults: {}, rot: 0, about: 'a switchback: the flat stand-in for a spiral' },
  { type: 'flipper', label: 'Flipper', key: 'f', nodes: 'SingleAxisHingeJoint with limits + MotorJoint torque', defaults: {}, rot: 0, about: 'press F (or the Flip button) to flip' },
  { type: 'seesaw', label: 'Seesaw', key: 's', nodes: 'SingleAxisHingeJoint, free, with limits', defaults: {}, rot: 0, about: 'tips under a marble' },
  { type: 'pendulum', label: 'Wrecking ball', key: 'p', nodes: 'SingleAxisHingeJoint + heavy bob', defaults: { start: 60 }, rot: 0, about: 'starts raised and swings when the run starts' },
  { type: 'dominoes', label: 'Dominoes', key: 'd', nodes: 'RigidBody dynamic Boxes on a shelf', defaults: { count: 10 }, rot: 0, about: 'a row of 4 to 40 dominoes' },
  { type: 'launcher', label: 'Launcher', key: 'l', nodes: 'SliderJoint with sliderForce', defaults: {}, rot: 0, about: 'press L (or Launch) to fire' },
  { type: 'wheel', label: 'Paddle wheel', key: 'w', nodes: 'DoubleAxisHingeJoint axle motor', defaults: { spin: -1.5 }, rot: 0, about: 'turns on its own (spin: rad/s, negative = clockwise) and flings marbles' },
  { type: 'elevator', label: 'Elevator', key: 'v', nodes: 'fixed RigidBody driven by a ROUTE (kinematic)', defaults: { height: 0.32 }, rot: 0, about: 'lifts marbles and tips them out at the top' },
  { type: 'bell', label: 'Bell', key: 'b', nodes: 'RigidBody fixed + Cone, in the chimes CollisionSensor', defaults: { note: 84 }, rot: 0, about: 'rings when a marble hits it' },
  { type: 'xylophone', label: 'Xylophone', key: 'x', nodes: 'five fixed bars in the chimes CollisionSensor', defaults: {}, rot: 0, about: 'a staircase of tuned bars' },
];
export const pieceInfo = (t: PieceType) => PIECES.find((p) => p.type === t)!;

// ---------------------------------------------------------------- geometry helpers

const box = (x: number, y: number, z = DEPTH): VisualGeom => ({ kind: 'box', size: [x, y, z] });
const at = (x: number, y: number, deg = 0, z = 0): Pose => ({ p: [x, y, z], q: zRot(deg) });
/** Pose of a body whose origin (= its centre of mass: X3D's centerOfMass defaults to the body origin) sits at `offset` from a pivot at the piece origin, swung by `deg`. */
const aboutPivot = (offset: [number, number], deg: number): Pose => {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return { p: [offset[0] * c - offset[1] * s, offset[0] * s + offset[1] * c, 0], q: zRot(deg) };
};

/** A closed slab of the given thickness following a 2-D polyline, extruded over the slot depth (a triangle mesh for curved tracks). */
export function slab(path: [number, number][], thickness: number, depth = DEPTH): VisualGeom {
  const n = path.length, h = thickness / 2, dz = depth / 2;
  const nrm = path.map((_, i) => {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(n - 1, i + 1)];
    const tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
    return [-ty / l, tx / l];
  });
  const points: number[] = [];
  // ring per path point: (outer, back), (outer, front), (inner, front), (inner, back)
  for (let i = 0; i < n; i++) {
    const [x, y] = path[i], [nx, ny] = nrm[i];
    points.push(x + nx * h, y + ny * h, -dz, x + nx * h, y + ny * h, dz, x - nx * h, y - ny * h, dz, x - nx * h, y - ny * h, -dz);
  }
  const indices: number[] = [];
  const quad = (a: number, b: number, c: number, d: number) => indices.push(a, b, c, a, c, d);
  for (let i = 0; i + 1 < n; i++) {
    const r = 4 * i, s = 4 * (i + 1);
    for (let k = 0; k < 4; k++) quad(r + k, s + k, s + ((k + 1) % 4), r + ((k + 1) % 4));
  }
  quad(0, 1, 2, 3); quad(4 * (n - 1) + 3, 4 * (n - 1) + 2, 4 * (n - 1) + 1, 4 * (n - 1));
  return { kind: 'mesh', points: points.map((x) => +x.toFixed(5)), indices };
}
const arc = (cx: number, cy: number, r: number, a0: number, a1: number, segs: number): [number, number][] =>
  Array.from({ length: segs + 1 }, (_, i) => { const a = ((a0 + ((a1 - a0) * i) / segs) * Math.PI) / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });

// ---------------------------------------------------------------- builder

class Build {
  bodies: IRBody[] = [];
  joints: IRJoint[] = [];
  clocks: IRClock[] = [];
  chimes: string[] = [];
  private frame: Pose = IDENTITY;
  private piece = -1;
  private prefix = '';
  begin(piece: number, prefix: string, frame: Pose) { this.piece = piece; this.prefix = prefix; this.frame = frame; }
  body(name: string, local: Pose, shapes: [VisualGeom, Pose, string][], o: Partial<IRBody> = {}): string {
    const def = `${this.prefix}${name}`;
    const irShapes: IRShape[] = shapes.map(([geom, l, mat], i) => ({ def: `${def}C${shapes.length > 1 ? i : ''}`, geom, local: l, mat }));
    this.bodies.push({ def, pose: compose(this.frame, local), pieceLocal: local, piece: this.piece, fixed: true, shapes: irShapes, ...o });
    return def;
  }
  /** Joint fields in piece-local coordinates; anchors and axes are converted to world (X3D reads them in world coordinates at load). */
  joint(type: IRJoint['type'], name: string, b1: string | null, b2: string | null, fields: IRJoint['fields'], points: string[] = [], axes: string[] = []) {
    const f = { ...fields };
    for (const k of points) f[k] = applyPose(this.frame, f[k] as Vec3);
    for (const k of axes) { const a = applyPose({ p: [0, 0, 0], q: this.frame.q }, f[k] as Vec3); f[k] = a.map((x) => +x.toFixed(6)); }
    for (const k of points) f[k] = (f[k] as number[]).map((x) => +x.toFixed(6));
    this.joints.push({ type, def: `${this.prefix}${name}`, body1: b1, body2: b2, fields: f });
  }
  clock(name: string, body: string, cycle: number, keys: number[], localValues: Vec3[]) {
    this.clocks.push({ def: `${this.prefix}${name}`, body, cycle, keys, values: localValues.map((v) => applyPose(this.frame, v).map((x) => +x.toFixed(6)) as Vec3), pieceLocalValues: localValues });
  }
}

function addPiece(B: Build, p: PieceInst) {
  const info = pieceInfo(p.type);
  const prm = { ...info.defaults, ...p.params };
  const frame: Pose = { p: [p.gx * GRID, p.gy * GRID, 0], q: zRot(p.rot) };
  B.begin(p.id, `P${p.id}`, frame);
  switch (p.type) {
    case 'ramp': B.body('Ramp', IDENTITY, [[box(prm.length, 0.008), IDENTITY, 'wood']]); break;
    case 'curve': {
      const path = [...arc(0, 0.12, 0.12, 180, 270, 14), [0.05, 0] as [number, number]];
      B.body('Curve', IDENTITY, [[slab(path, 0.006), IDENTITY, 'wood']]);
      break;
    }
    case 'halfpipe': B.body('Pipe', IDENTITY, [[slab(arc(0, 0.1, 0.1, 195, 345, 18), 0.006), IDENTITY, 'wood']]); break;
    case 'funnel': {
      // walls from (∓0.1, 0.08) down to (∓0.016, 0): a 0.032 m opening for 0.016 m marbles
      const ang = (Math.atan2(0.08, 0.084) * 180) / Math.PI;
      const wall = (s: number): [VisualGeom, Pose, string] => [box(Math.hypot(0.084, 0.08), 0.008), at(s * 0.058, 0.04, s * ang), 'brass'];
      B.body('Funnel', IDENTITY, [wall(-1), wall(1)]);
      break;
    }
    case 'zigzag': {
      const r = 12;
      B.body('Zigzag', IDENTITY, [
        [box(0.16, 0.008), at(0, 0, -r), 'wood'], [box(0.16, 0.008), at(0, -0.065, r), 'wood'], [box(0.16, 0.008), at(0, -0.13, -r), 'wood'],
        // end walls 0.03 m beyond the ramp ends (a 0.016 m gap wedged marbles: measured)
        [box(0.008, 0.08), at(0.112, -0.03), 'steel'], [box(0.008, 0.08), at(-0.112, -0.095), 'steel'],
      ]);
      break;
    }
    case 'flipper': {
      const base = B.body('Pin', IDENTITY, [[box(0.014, 0.014), IDENTITY, 'steel']]);
      // the bar rests at its lower stop, 20° below horizontal, pivoting at the piece origin
      const bar = B.body('Bar', aboutPivot([0.05, 0], -20), [[box(0.1, 0.012, 0.044), IDENTITY, 'red']], { fixed: false, mass: 0.03 });
      B.joint('SingleAxisHingeJoint', 'Hinge', bar, base, { anchorPoint: [0, 0, 0], axis: [0, 0, 1], minAngle: -0.01, maxAngle: 0.9, stopBounce: 0.1 }, ['anchorPoint'], ['axis']);
      B.joint('MotorJoint', 'Motor', bar, base, { enabledAxes: 1, motor1Axis: [0, 0, 1], axis1Torque: -0.02, autoCalc: true }, [], ['motor1Axis']);
      break;
    }
    case 'seesaw': {
      const base = B.body('Pivot', at(0, -0.02), [[box(0.014, 0.04), IDENTITY, 'steel']]);
      const plank = B.body('Plank', at(0, 0.004), [[box(0.2, 0.008, 0.044), IDENTITY, 'wood']], { fixed: false, mass: 0.03 });
      B.joint('SingleAxisHingeJoint', 'Hinge', plank, base, { anchorPoint: [0, 0, 0], axis: [0, 0, 1], minAngle: -0.3, maxAngle: 0.3 }, ['anchorPoint'], ['axis']);
      break;
    }
    case 'pendulum': {
      const L = 0.1375; // a pivot 4 holes above a domino row puts the bob's lowest point at the dominoes' mid-height
      const pivot = B.body('Pivot', IDENTITY, [[box(0.014, 0.014), IDENTITY, 'steel']]);
      // body origin at the bob (its centre of mass), raised by `start` degrees about the pivot
      const bob = B.body('Bob', aboutPivot([0, -L], prm.start), [[{ kind: 'sphere', r: 0.02 }, IDENTITY, 'brass'], [box(0.005, L, 0.008), at(0, L / 2), 'steel']], { fixed: false, mass: 0.15 });
      B.joint('SingleAxisHingeJoint', 'Hinge', bob, pivot, { anchorPoint: [0, 0, 0], axis: [0, 0, 1] }, ['anchorPoint'], ['axis']);
      break;
    }
    case 'dominoes': {
      const n = Math.max(4, Math.min(40, Math.round(prm.count))), sp = 0.026, len = (n - 1) * sp + 0.04;
      B.body('Shelf', at(len / 2 - 0.02, -0.004), [[box(len, 0.008), IDENTITY, 'wood']]);
      for (let i = 0; i < n; i++) B.body(`Domino${i}`, at(i * sp, 0.0225), [[box(0.006, 0.045, 0.04), IDENTITY, i % 2 ? 'ivory' : 'ebony']], { fixed: false, mass: 0.006, role: 'domino' });
      break;
    }
    case 'launcher': {
      const frameB = B.body('Frame', IDENTITY, [[box(0.05, 0.01), at(0, -0.035), 'steel'], [box(0.006, 0.08), at(-0.026, 0.0), 'steel'], [box(0.006, 0.08), at(0.026, 0.0), 'steel']]);
      const plunger = B.body('Plunger', at(0, -0.022), [[box(0.04, 0.012, 0.044), IDENTITY, 'blue']], { fixed: false, mass: 0.03 });
      B.joint('SliderJoint', 'Slider', plunger, frameB, { axis: [0, 1, 0], minSeparation: 0, maxSeparation: 0.045, sliderForce: -0.2, stopBounce: 0 }, [], ['axis']);
      break;
    }
    case 'wheel': {
      const hub = B.body('Hub', IDENTITY, [[box(0.012, 0.012), IDENTITY, 'steel']]);
      const wheel = B.body('Wheel', IDENTITY, [[box(0.17, 0.01, 0.044), IDENTITY, 'wood'], [box(0.01, 0.17, 0.044), IDENTITY, 'wood']], { fixed: false, mass: 0.05 });
      B.joint('DoubleAxisHingeJoint', 'Axle', hub, wheel, { anchorPoint: [0, 0, 0], axis1: [0, 1, 0], axis2: [0, 0, 1], minAngle1: 0, maxAngle1: 0, desiredAngularVelocity2: prm.spin, maxTorque2: 0.03 }, ['anchorPoint'], ['axis1', 'axis2']);
      break;
    }
    case 'elevator': {
      const H = prm.height;
      B.body('Shaft', IDENTITY, [[box(0.008, H - 0.03), at(0.045, (H - 0.03) / 2 - 0.01), 'steel'], [box(0.12, 0.008), at(0.11, H - 0.005, -15), 'wood']]);
      const plat = B.body('Platform', at(0, 0, -10), [[box(0.075, 0.008), IDENTITY, 'steel']]);
      B.clock('Clock', plat, 6, [0, 0.15, 0.5, 0.6, 1], [[0, 0, 0], [0, 0, 0], [0, H, 0], [0, H, 0], [0, 0, 0]]);
      break;
    }
    case 'bell': {
      const def = B.body('Bell', IDENTITY, [[{ kind: 'cone', r: 0.03, h: 0.045 }, IDENTITY, 'brass']], { role: 'chime', note: prm.note });
      B.chimes.push(`${def}C`);
      break;
    }
    case 'xylophone': {
      const notes = [72, 74, 76, 79, 81];
      notes.forEach((note, k) => {
        const def = B.body(`Bar${k}`, at(k * 0.05, -k * 0.035, -8), [[box(0.065 - k * 0.006, 0.01, 0.044), IDENTITY, `bar${k}`]], { role: 'chime', note });
        B.chimes.push(`${def}C`);
      });
      break;
    }
  }
}

function addBoard(B: Build, marbles: number, marbleStart: 'shelf' | 'hopper') {
  B.begin(-1, 'Board', IDENTITY);
  const W = 1.38, H = 1.06, cy = 0.5;
  B.body('Back', at(0, cy, 0, -DEPTH / 2 - 0.006), [[box(W, H, 0.012), IDENTITY, 'pegboard']], { role: 'board' });
  B.body('Glass', at(0, cy, 0, DEPTH / 2 + 0.003), [[box(W, H, 0.006), IDENTITY, 'glassPane']], { role: 'board' });
  B.body('Frame', IDENTITY, [[box(W, 0.02), at(0, -0.01), 'frame'], [box(0.02, H), at(-W / 2 - 0.01, cy), 'frame'], [box(0.02, H), at(W / 2 + 0.01, cy), 'frame'], [box(W, 0.02), at(0, cy + H / 2 + 0.01), 'frame']], { role: 'board' });
  // hoppers: a V with an opening for one marble
  HOPPERS.forEach(([hx, hy], k) => B.body(k ? 'HopperB' : 'Hopper', IDENTITY, [[box(0.1, 0.006), at(hx - 0.06, hy + 0.04, -40), 'brass'], [box(0.1, 0.006), at(hx + 0.06, hy + 0.04, 40), 'brass']], { role: 'board' }));
  // shelf for parked marbles (top centre), with end stops
  B.body('Shelf', IDENTITY, [[box(0.4, 0.006), at(0.02, 1.005), 'frame'], [box(0.006, 0.03), at(-0.182, 1.02), 'frame'], [box(0.006, 0.03), at(0.222, 1.02), 'frame']], { role: 'board' });
  // goal cup (bottom right)
  B.body('Cup', IDENTITY, [[box(CUP.inner + 0.012, 0.008), at(CUP.x, 0.004), 'brass'], [box(0.006, 0.1), at(CUP.x - CUP.inner / 2 - 0.003, 0.05), 'brass'], [box(0.006, 0.1), at(CUP.x + CUP.inner / 2 + 0.003, 0.05), 'brass']], { role: 'cup' });
  B.begin(-1, '', IDENTITY); // marbles are named Marble0..19 (the page and the race find them by DEF)
  for (let i = 0; i < marbles; i++) {
    const [hx, hy] = HOPPERS[i % 2];
    const p: Vec3 = marbleStart === 'shelf' ? [-0.165 + i * (2 * MARBLE_R + 0.0015), 1.008 + MARBLE_R + 0.0005, 0] : [hx + ((i % 3) - 1) * 0.004, hy + 0.03 + Math.floor(i / 2) * 0.02, 0];
    B.body(`Marble${i}`, { p, q: [0, 0, 0, 1] }, [[{ kind: 'sphere', r: MARBLE_R }, IDENTITY, `marble${i % 4}`]], { fixed: false, mass: MARBLE_MASS, role: 'marble' });
  }
}

export interface BuildOptions { marbleStart?: 'shelf' | 'hopper'; /** false: the pieces alone (piece fragments). */ board?: boolean }

export function buildIR(m: Machine, o: BuildOptions = {}): MachineIR {
  const B = new Build();
  if (o.board !== false) addBoard(B, Math.min(MAX_MARBLES, m.marbles), o.marbleStart ?? 'shelf');
  for (const p of m.pieces) addPiece(B, p);
  return { bodies: B.bodies, joints: B.joints, clocks: B.clocks, chimes: B.chimes, surface: { bounce: 0.3, minBounceSpeed: 0.1, friction: 0.35 } };
}

/** Drop alternates between hopper A and hopper B. */
export const USE_HOPPER_B = true;
/** Where the k-th dropped marble goes: above hopper A (or A and B alternating), slightly staggered. */
export function dropPoint(k: number, hopper?: number): Vec3 { const h = HOPPERS[hopper ?? (USE_HOPPER_B ? k % 2 : 0)]; return [h[0] + (((k >> 1) % 3) - 1) * 0.008, h[1] + 0.07, 0]; }

export const MATERIALS: Record<string, string> = {
  wood: '<PhysicalMaterial baseColor="0.66 0.45 0.26" metallic="0" roughness="0.55"/>',
  brass: '<PhysicalMaterial baseColor="0.86 0.68 0.32" metallic="1" roughness="0.3"/>',
  steel: '<PhysicalMaterial baseColor="0.62 0.64 0.68" metallic="1" roughness="0.35"/>',
  red: '<PhysicalMaterial baseColor="0.78 0.16 0.12" metallic="0" roughness="0.4"/>',
  blue: '<PhysicalMaterial baseColor="0.15 0.35 0.8" metallic="0" roughness="0.4"/>',
  ivory: '<PhysicalMaterial baseColor="0.92 0.89 0.8" metallic="0" roughness="0.5"/>',
  ebony: '<PhysicalMaterial baseColor="0.12 0.1 0.09" metallic="0" roughness="0.5"/>',
  frame: '<PhysicalMaterial baseColor="0.3 0.22 0.15" metallic="0" roughness="0.7"/>',
  pegboard: '<PhysicalMaterial baseColor="0.78 0.68 0.52" metallic="0" roughness="0.9"/>',
  glassPane: '<PhysicalMaterial baseColor="0.85 0.92 1" metallic="0" roughness="0.05" transparency="0.92"/>',
  // the demos (src/demos)
  stone: '<PhysicalMaterial baseColor="0.66 0.61 0.53" metallic="0" roughness="0.9"/>',
  stoneDark: '<PhysicalMaterial baseColor="0.46 0.43 0.39" metallic="0" roughness="0.9"/>',
  grass: '<PhysicalMaterial baseColor="0.3 0.42 0.2" metallic="0" roughness="0.95"/>',
  iron: '<PhysicalMaterial baseColor="0.32 0.32 0.34" metallic="1" roughness="0.5"/>',
  rope: '<PhysicalMaterial baseColor="0.72 0.6 0.4" metallic="0" roughness="0.9"/>',
  felt: '<PhysicalMaterial baseColor="0.1 0.24 0.18" metallic="0" roughness="1"/>',
  bead: '<PhysicalMaterial baseColor="0.9 0.94 1" metallic="0" roughness="0.08"/>',
  domino0: '<PhysicalMaterial baseColor="0.86 0.2 0.16" metallic="0" roughness="0.35"/>',
  domino1: '<PhysicalMaterial baseColor="0.95 0.72 0.15" metallic="0" roughness="0.35"/>',
  domino2: '<PhysicalMaterial baseColor="0.18 0.62 0.38" metallic="0" roughness="0.35"/>',
  domino3: '<PhysicalMaterial baseColor="0.2 0.42 0.85" metallic="0" roughness="0.35"/>',
  domino4: '<PhysicalMaterial baseColor="0.93 0.92 0.88" metallic="0" roughness="0.35"/>',
  // the ragdoll (src/ragdoll)
  carpet: '<PhysicalMaterial baseColor="0.62 0.12 0.14" metallic="0" roughness="0.95"/>',
  cardboard: '<PhysicalMaterial baseColor="0.72 0.55 0.34" metallic="0" roughness="0.9"/>',
  rail: '<PhysicalMaterial baseColor="0.78 0.78 0.8" metallic="1" roughness="0.3"/>',
  tnt: '<PhysicalMaterial baseColor="0.85 0.1 0.08" metallic="0" roughness="0.5"/>',
  roof: '<PhysicalMaterial baseColor="0.58 0.16 0.12" metallic="0" roughness="0.75"/>',
  banner: '<PhysicalMaterial baseColor="0.12 0.26 0.62" metallic="0" roughness="0.8"/>',
  gold: '<PhysicalMaterial baseColor="0.92 0.72 0.25" metallic="1" roughness="0.3"/>',
  dummyBall: '<PhysicalMaterial baseColor="0.98 0.8 0.12" metallic="0" roughness="0.4"/>',
  stoneWarm: '<PhysicalMaterial baseColor="0.74 0.67 0.56" metallic="0" roughness="0.92"/>',
  marble0: '<PhysicalMaterial baseColor="0.35 0.6 1" metallic="0.2" roughness="0.1"/>',
  marble1: '<PhysicalMaterial baseColor="1 0.45 0.3" metallic="0.2" roughness="0.1"/>',
  marble2: '<PhysicalMaterial baseColor="0.4 0.9 0.5" metallic="0.2" roughness="0.1"/>',
  marble3: '<PhysicalMaterial baseColor="0.95 0.85 0.3" metallic="0.2" roughness="0.1"/>',
  bar0: '<PhysicalMaterial baseColor="0.85 0.2 0.2" metallic="0.6" roughness="0.3"/>',
  bar1: '<PhysicalMaterial baseColor="0.9 0.55 0.15" metallic="0.6" roughness="0.3"/>',
  bar2: '<PhysicalMaterial baseColor="0.9 0.85 0.2" metallic="0.6" roughness="0.3"/>',
  bar3: '<PhysicalMaterial baseColor="0.25 0.75 0.3" metallic="0.6" roughness="0.3"/>',
  bar4: '<PhysicalMaterial baseColor="0.25 0.45 0.9" metallic="0.6" roughness="0.3"/>',
};

/** Validate an imported machine description (untrusted: it came from a file). Ids become DEF names, so they must be small integers. */
export function sanitizeMachine(j: unknown): Machine | string {
  if (!j || typeof j !== 'object') return 'not an object';
  const o = j as Record<string, unknown>;
  if (o.format !== 'x3d-physx-machine/1') return 'unknown format';
  if (!Array.isArray(o.pieces) || o.pieces.length > 200) return 'pieces missing or too many';
  const types = new Set(PIECES.map((p) => p.type));
  const ids = new Set<number>();
  const pieces: PieceInst[] = [];
  for (const raw of o.pieces as Record<string, unknown>[]) {
    const id = Number(raw?.id), gx = Number(raw?.gx), gy = Number(raw?.gy), rot = Number(raw?.rot);
    if (!Number.isInteger(id) || id < 0 || id > 100000 || ids.has(id)) return `bad piece id ${String(raw?.id)}`;
    if (!types.has(raw.type as PieceType)) return `unknown piece type ${String(raw?.type).slice(0, 40)}`;
    if (![gx, gy, rot].every(Number.isFinite)) return `piece ${id}: bad position`;
    const info = pieceInfo(raw.type as PieceType);
    const params: Record<string, number> = {};
    const rp = (raw.params ?? {}) as Record<string, unknown>;
    for (const k of Object.keys(info.defaults)) if (Number.isFinite(Number(rp[k]))) params[k] = Number(rp[k]);
    ids.add(id);
    pieces.push({ id, type: raw.type as PieceType, gx: Math.max(COLS[0], Math.min(COLS[1], Math.round(gx))), gy: Math.max(ROWS[0], Math.min(ROWS[1], Math.round(gy))), rot: ((((Math.round(rot) % 360) + 540) % 360) - 180), params }); // whole degrees in (−180, 180]; build mode rotates in 15° steps, tuned layouts may use any angle
  }
  const marbles = Math.max(1, Math.min(MAX_MARBLES, Math.round(Number(o.marbles) || MAX_MARBLES)));
  const name = String(o.name ?? 'Marble machine').slice(0, 80);
  return { format: 'x3d-physx-machine/1', name, pieces, marbles };
}

/** Parameter ranges for the inspector's − / + buttons. */
export const PARAM_STEPS: Record<string, { min: number; max: number; step: number; unit: string }> = {
  length: { min: 0.08, max: 0.4, step: 0.04, unit: 'm' },
  count: { min: 4, max: 40, step: 2, unit: '' },
  height: { min: 0.12, max: 0.6, step: 0.04, unit: 'm' },
  start: { min: 0, max: 120, step: 15, unit: '°' },
  note: { min: 60, max: 96, step: 1, unit: 'MIDI' },
  spin: { min: -4, max: 4, step: 0.5, unit: 'rad/s' },
};

/** For the info panel: which X3D node fields each piece relies on (their PhysX mapping rows are shown from mapping.ts). */
export const PIECE_FIELDS: Record<PieceType, [string, string][]> = {
  ramp: [['RigidBody', 'fixed'], ['CollidableShape', 'shape'], ['CollisionCollection', 'frictionCoefficients']],
  curve: [['RigidBody', 'fixed'], ['CollidableShape', 'shape']],
  halfpipe: [['RigidBody', 'fixed'], ['CollidableShape', 'shape']],
  funnel: [['CollidableOffset', 'translation'], ['CollidableShape', 'shape']],
  zigzag: [['CollidableOffset', 'translation'], ['CollidableShape', 'shape']],
  flipper: [['SingleAxisHingeJoint', 'minAngle'], ['SingleAxisHingeJoint', 'stopBounce'], ['MotorJoint', 'axis1Torque'], ['MotorJoint', 'motor1Axis']],
  seesaw: [['SingleAxisHingeJoint', 'axis'], ['SingleAxisHingeJoint', 'maxAngle'], ['RigidBody', 'inertia']],
  pendulum: [['SingleAxisHingeJoint', 'anchorPoint'], ['RigidBody', 'centerOfMass'], ['RigidBody', 'mass']],
  dominoes: [['RigidBody', 'mass'], ['RigidBody', 'inertia'], ['CollisionCollection', 'frictionCoefficients']],
  launcher: [['SliderJoint', 'sliderForce'], ['SliderJoint', 'maxSeparation'], ['SliderJoint', 'axis']],
  wheel: [['DoubleAxisHingeJoint', 'desiredAngularVelocity2'], ['DoubleAxisHingeJoint', 'maxTorque2'], ['DoubleAxisHingeJoint', 'minAngle1']],
  elevator: [['RigidBody', 'fixed'], ['RigidBody', 'position']],
  bell: [['CollisionSensor', 'contacts'], ['CollidableShape', 'shape']],
  xylophone: [['CollisionSensor', 'contacts'], ['RigidBody', 'fixed']],
};
