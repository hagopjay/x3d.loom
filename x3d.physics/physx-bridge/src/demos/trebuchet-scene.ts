// The trebuchet as X3D: a throwing arm on a SingleAxisHingeJoint, a counterweight hinged to its short end, a stone held to the arm's
// tip by a BallJoint (a taut sling), the arm held cocked by a latch BallJoint, and a castle of blocks. Fire removes the latch from
// RigidBodyCollection.joints; the sling joint is removed when the stone flies at the release angle (on a real trebuchet the prong's
// angle decides this). Pure: used by the page and in Node (tools/trebuchet-sim.ts).
import { axisAngleToQuat } from '../bridge/math.ts';
import type { Quat, Vec3 } from '../bridge/model.ts';
import type { IRBody, IRJoint, IRShape, MachineIR, SceneMeta } from '../machine/index.ts';
import { viewpoint } from './view.ts';

export interface Trebuchet {
  format: 'x3d-physx-trebuchet/1';
  name: string;
  counterweight: number; // kg
  stone: number; // kg
  sling: number; // m
  /** Let go when the stone's velocity points this many degrees above the horizon (falling through it). */
  release: number;
  castle: 'keep' | 'wall' | 'pyramid';
  distance: number; // m from the axle to the castle's front
}
export const LIMITS = { counterweight: [500, 4000, 250], stone: [10, 80, 5], sling: [2, 7, 0.5], release: [15, 75, 5], distance: [60, 260, 10] } as const;
export const defaultTrebuchet = (): Trebuchet => ({ format: 'x3d-physx-trebuchet/1', name: 'Trebuchet', counterweight: 2000, stone: 37, sling: 5, release: 40, castle: 'keep', distance: 166 });

export const PIVOT: Vec3 = [0, 5, 0];
export const LONG = 6, SHORT = 1.5, CW_DROP = 1.1, STONE_DENSITY = 2600;
const ARM_MASS = 220, BLOCK: Vec3 = [1, 0.5, 0.5], BLOCK_MASS = 40;
export const stoneRadius = (m: number) => Math.cbrt((3 * m) / (4 * Math.PI * STONE_DENSITY));

export function sanitizeTrebuchet(v: unknown): Trebuchet | string {
  const t = v as Trebuchet;
  if (!t || t.format !== 'x3d-physx-trebuchet/1') return 'not a trebuchet description';
  const c = (k: keyof typeof LIMITS) => { const x = Number(t[k]); if (!Number.isFinite(x)) throw new Error(k); const [lo, hi] = LIMITS[k]; return Math.max(lo, Math.min(hi, x)); };
  try {
    return { format: t.format, name: String(t.name ?? 'Trebuchet').slice(0, 80), counterweight: c('counterweight'), stone: c('stone'), sling: c('sling'), release: c('release'), castle: (['keep', 'wall', 'pyramid'] as const).includes(t.castle) ? t.castle : 'keep', distance: c('distance') };
  } catch (e) { return `${(e as Error).message} is not a number`; }
}

/** Cocked pose: the tip low behind the axle, the sling lying forward along the trough to the stone. */
export function cocked(t: Trebuchet) {
  const r = stoneRadius(t.stone), tipY = 0.35;
  const a = Math.asin((tipY - PIVOT[1]) / LONG), tipX = -LONG * Math.cos(a); // a < 0: below the axle, behind it
  const tip: Vec3 = [tipX, tipY, 0];
  const stone: Vec3 = [tipX + Math.sqrt(t.sling ** 2 - (tipY - r) ** 2), r, 0];
  const armAngle = Math.PI + a; // the arm's direction (from the counterweight end to the tip) as an angle from +x... used for the box
  const cwEnd: Vec3 = [PIVOT[0] - SHORT * (tipX - PIVOT[0]) / LONG, PIVOT[1] - SHORT * (tipY - PIVOT[1]) / LONG, 0];
  return { r, tip, stone, cwEnd, armAngle, a };
}

/**
 * One trebuchet (frame, arm, hinged counterweight, stone on a taut sling, latch) added to `bodies`/`joints`, DEF names prefixed with
 * `pre`, standing at z = z0. Used once by this page (no prefix) and three times by the ragdoll barrage.
 */
export function addTrebuchet(bodies: IRBody[], joints: IRJoint[], t: Trebuchet, pre = '', z0 = 0): { arm: number; cw: number; stone: number } {
  const q0: Quat = [0, 0, 0, 1], zq = (a: number): Quat => axisAngleToQuat(0, 0, 1, a);
  const add = (b: Omit<IRBody, 'pieceLocal' | 'piece'>) => { bodies.push({ ...b, pieceLocal: b.pose, piece: -1 }); return bodies.length - 1; };
  const box = (def: string, size: Vec3, p: Vec3, mat: string, q: Quat = q0): IRShape => ({ def, geom: { kind: 'box', size }, local: { p, q }, mat });
  const C = cocked(t), at = (p: Vec3): Vec3 => [p[0], p[1], p[2] + z0];
  // the frame: two A-frames either side of the arm, an axle, a trough
  const frame: IRShape[] = [];
  for (const z of [-0.9, 0.9]) {
    for (const s of [-1, 1]) { const ang = Math.atan2(PIVOT[1], 2.2); frame.push(box(`${pre}Leg${z > 0 ? 'N' : 'S'}${s > 0 ? 'F' : 'B'}`, [0.3, Math.hypot(2.2, PIVOT[1]) + 0.2, 0.3], [s * 1.1, PIVOT[1] / 2, z], 'wood', zq(s * (Math.PI / 2 - ang)))); }
    frame.push(box(`${pre}Sill${z > 0 ? 'N' : 'S'}`, [5.4, 0.3, 0.3], [0, 0.15, z], 'wood'));
  }
  // the axle in two stubs either side of the arm (a static shape through the arm would push it out)
  for (const z of [-0.65, 0.65]) frame.push({ def: `${pre}Axle${z > 0 ? 'N' : 'S'}`, geom: { kind: 'cylinder', r: 0.12, h: 0.9 }, local: { p: [PIVOT[0], PIVOT[1], z], q: axisAngleToQuat(1, 0, 0, Math.PI / 2) }, mat: 'iron' });
  add({ def: `${pre}Frame`, pose: { p: [0, 0, z0], q: q0 }, fixed: true, role: 'board', shapes: frame });
  // the arm: a beam from the counterweight end to the tip, its body frame at the axle
  const dir: Vec3 = [(C.tip[0] - PIVOT[0]) / LONG, (C.tip[1] - PIVOT[1]) / LONG, 0], armQ = zq(Math.atan2(dir[1], dir[0]));
  const mid = (LONG - SHORT) / 2;
  const arm = add({ def: `${pre}Arm`, pose: { p: at([PIVOT[0] + dir[0] * mid, PIVOT[1] + dir[1] * mid, 0]), q: armQ }, fixed: false, mass: ARM_MASS, role: 'beam', shapes: [box(`${pre}ArmS`, [LONG + SHORT, 0.3, 0.3], [0, 0, 0], 'wood')] });
  joints.push({ type: 'SingleAxisHingeJoint', def: `${pre}ArmHinge`, body1: `${pre}Arm`, body2: `${pre}Frame`, fields: { anchorPoint: at(PIVOT), axis: [0, 0, 1] } });
  // the counterweight box hangs from the short end on its own hinge
  const cwSide = Math.cbrt(t.counterweight / 2400) * 1.1;
  const cw = add({ def: `${pre}Counterweight`, pose: { p: at([C.cwEnd[0], C.cwEnd[1] - CW_DROP, 0]), q: q0 }, fixed: false, mass: t.counterweight, role: 'block', shapes: [box(`${pre}CounterweightS`, [cwSide, cwSide, 1.2], [0, 0, 0], 'iron'), box(`${pre}Hanger`, [0.12, CW_DROP - cwSide / 2, 0.12], [0, (CW_DROP - cwSide / 2) / 2 + cwSide / 2, 0], 'iron')] });
  joints.push({ type: 'SingleAxisHingeJoint', def: `${pre}CounterweightHinge`, body1: `${pre}Counterweight`, body2: `${pre}Arm`, fields: { anchorPoint: at(C.cwEnd), axis: [0, 0, 1] } });
  // the stone, held at the sling's length from the tip (a taut sling: a BallJoint whose anchor is the tip)
  const stone = add({ def: `${pre}Stone`, pose: { p: at(C.stone), q: q0 }, fixed: false, mass: t.stone, role: 'projectile', shapes: [{ def: `${pre}StoneS`, geom: { kind: 'sphere', r: C.r }, local: { p: [0, 0, 0], q: q0 }, mat: pre ? 'dummyBall' : 'stoneDark' }] });
  joints.push({ type: 'BallJoint', def: `${pre}Sling`, body1: `${pre}Stone`, body2: `${pre}Arm`, fields: { anchorPoint: at(C.tip) } });
  joints.push({ type: 'BallJoint', def: `${pre}Latch`, body1: `${pre}Arm`, body2: `${pre}Frame`, fields: { anchorPoint: at(C.tip) } });
  return { arm, cw, stone };
}

export function buildTrebuchet(t: Trebuchet): { ir: MachineIR; meta: SceneMeta; idx: { arm: number; cw: number; stone: number; blocks: number[] } } {
  const q0: Quat = [0, 0, 0, 1];
  const bodies: IRBody[] = [], joints: IRJoint[] = [];
  const add = (b: Omit<IRBody, 'pieceLocal' | 'piece'>) => { bodies.push({ ...b, pieceLocal: b.pose, piece: -1 }); return bodies.length - 1; };
  const box = (def: string, size: Vec3, p: Vec3, mat: string, q: Quat = q0): IRShape => ({ def, geom: { kind: 'box', size }, local: { p, q }, mat });

  add({ def: 'Ground', pose: { p: [60, -0.5, 0], q: q0 }, fixed: true, role: 'board', shapes: [box('GroundS', [420, 1, 80], [0, 0, 0], 'grass')] });
  const { arm, cw, stone } = addTrebuchet(bodies, joints, t);

  // the castle: blocks laid in courses with alternate joints
  const blocks: number[] = [];
  const lay = (x: number, z: number, course: number, len: Vec3, alongZ: boolean) => {
    const p: Vec3 = [x, BLOCK[1] / 2 + course * BLOCK[1] + 0.0005 * course, z];
    blocks.push(add({ def: `Block${blocks.length}`, pose: { p, q: alongZ ? axisAngleToQuat(0, 1, 0, Math.PI / 2) : q0 }, fixed: false, mass: BLOCK_MASS, role: 'block', shapes: [box(`Block${blocks.length}S`, len, [0, 0, 0], course % 2 ? 'stone' : 'stoneDark')] }));
  };
  const X0 = t.distance;
  const wall = (x: number, z0: number, n: number, courses: number) => { for (let c = 0; c < courses; c++) for (let k = 0; k < n - (c % 2); k++) lay(x, z0 + (k + (c % 2) / 2) * BLOCK[0] - ((n - 1) * BLOCK[0]) / 2, c, BLOCK, true); };
  if (t.castle === 'wall') wall(X0, 0, 12, 8);
  else if (t.castle === 'pyramid') { for (let c = 0; c < 9; c++) for (let k = 0; k < 10 - c; k++) lay(X0, (k - (9 - c) / 2) * BLOCK[0], c, BLOCK, true); }
  else { // the keep: a front wall with a gate gap, two towers
    for (let c = 0; c < 6; c++) for (let k = 0; k < 10 - (c % 2); k++) { const z = (k + (c % 2) / 2) * BLOCK[0] - 4.5; if (Math.abs(z) < 1 && c < 3) continue; lay(X0, z, c, BLOCK, true); }
    for (const zc of [-6.2, 6.2]) for (let c = 0; c < 10; c++) for (const [dx, dz] of [[0, -0.5], [0, 0.5], [1, -0.5], [1, 0.5]]) lay(X0 + dx - 0.25, zc + dz, c, BLOCK, c % 2 === 0);
  }

  const ir: MachineIR = {
    bodies, joints, clocks: [], chimes: [],
    surface: { bounce: 0.05, minBounceSpeed: 0.5, friction: 0.6 },
    world: { autoDisable: true, disableLinearSpeed: 0.05, disableAngularSpeed: 0.05, disableTime: 0.6, iterations: 24 },
  };
  const meta: SceneMeta = {
    title: t.name,
    description: `A trebuchet (${LONG + SHORT} m arm, ${t.counterweight} kg hinged counterweight, ${t.stone} kg stone, ${t.sling} m sling) and a ${t.castle} ${t.distance} m away. Remove the Latch joint from the collection to fire; remove Sling to release.`,
    info: 'Units: metres, kilograms, seconds, radians. Y up; it throws along +x.',
    generator: 'x3d-physx-bridge demos (src/demos/trebuchet-scene.ts)',
    shareShapes: true,
    viewpoints: [
      viewpoint('Trebuchet', 'The trebuchet', [-9, 6, 16], [0.5, 4, 0], 0.75),
      viewpoint('Field', 'The whole field', [t.distance / 2, 22, t.distance * 0.75], [t.distance / 2, 4, 0], 0.8),
      viewpoint('Castle', 'The castle', [t.distance - 16, 7, 18], [t.distance, 2.5, 0], 0.8),
    ].join('\n'),
  };
  return { ir, meta, idx: { arm, cw, stone, blocks } };
}

/** The stone's flight angle (degrees above the horizon) from its velocity. */
export const flightAngle = (vx: number, vy: number) => (Math.atan2(vy, vx) * 180) / Math.PI;
/** Release: moving forward, fast, and its flight angle has come down through the release angle. */
export const shouldRelease = (vx: number, vy: number, release: number) => vx > 2 && Math.hypot(vx, vy) > 5 && flightAngle(vx, vy) <= release;
