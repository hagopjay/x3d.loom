// The ragdoll's stage as X3D: ordinary RigidBodyPhysics (floor, the contraption, loose props) plus the H-Anim humanoid, which the bridge
// turns into an articulation. Pure: page and Node.
import type { IRBody, IRJoint, IRShape, MachineIR, SceneMeta } from '../machine/index.ts';
import type { Pose, Quat, SceneModel, Vec3 } from '../bridge/model.ts';
import { axisAngleToQuat } from '../bridge/math.ts';
import { toModel } from '../machine/index.ts';
import { buildHumanoid, indexHumanoid } from './humanoid.ts';
import type { Character } from './humanoid.ts';
import { viewpoint } from '../demos/view.ts';

export type Contraption = 'floor' | 'stairs' | 'cannon' | 'wrecking';
export interface Stage { character: Character; contraption: Contraption; /** the figure starts stiff (HAnimJoint.stiffness 1) */ stiff: boolean; /** 1-3: how hard (the wrecking ball's pull-back) */ level?: number }
export const defaultStage = (): Stage => ({ character: 'dummy', contraption: 'stairs', stiff: true });

/** Stairs of doom: N steps descending along +z from a landing; a rail on the figure's left only (so it can also fly off the right). */
export const STAIRS = { steps: 12, rise: 0.2, tread: 0.3, width: 1.4, landing: 1.6 };
export const stairsTop = () => STAIRS.steps * STAIRS.rise;
export const TNT_AT: Vec3 = [-0.55, 0.25, STAIRS.steps * STAIRS.tread + 0.55];

const q0: Quat = [0, 0, 0, 1];
const box = (def: string, size: Vec3, p: Vec3, mat: string, q: Quat = q0): IRShape => ({ def, geom: { kind: 'box', size }, local: { p, q }, mat });
const fixed = (def: string, shapes: IRShape[]): IRBody => ({ def, pose: { p: [0, 0, 0], q: q0 }, pieceLocal: { p: [0, 0, 0], q: q0 }, piece: -1, fixed: true, role: 'board', shapes });

export function figurePose(st: Stage): Pose {
  if (st.contraption === 'stairs') return { p: [0, stairsTop() + 0.002, -0.28], q: q0 };
  if (st.contraption === 'cannon') return { p: [1.6, 0.002, -2.2], q: yq(-0.6) }; // waiting beside the cannon
  if (st.contraption === 'wrecking') return { p: [0, 0.002, 0.42], q: yq(Math.PI) }; // facing the ball
  return { p: [0, 0.002, 0], q: q0 };
}
const yq = (a: number): Quat => axisAngleToQuat(0, 1, 0, a);
/** Where the TNT crate stands for each contraption. */
export function tntAt(st: Stage): Vec3 { return st.contraption === 'cannon' ? [0.7, 0.25, 22] : st.contraption === 'wrecking' ? [-0.5, 0.25, 2.6] : TNT_AT; }
/** The cannon: elevation, muzzle, speeds for levels 1-3. */
export const CANNON = { elevation: (35 * Math.PI) / 180, pivot: [0, 1.0, 0] as Vec3, length: 2.4, speeds: [12, 18, 26] };
export const cannonDir = (): Vec3 => [0, Math.sin(CANNON.elevation), Math.cos(CANNON.elevation)];
export const muzzle = (): Vec3 => { const d = cannonDir(); return [CANNON.pivot[0], CANNON.pivot[1] + d[1] * CANNON.length, CANNON.pivot[2] + d[2] * CANNON.length]; };
/** The wrecking ball: a 400 kg ball on a 7.5 m rod from a crane, pulled back 30° towards -z and pushed off at 3, 6 or 9 m/s
 * (pull-backs of 50° and 70° hit something before the figure and bounced back: logged, not chased). */
export const WRECK = { pivot: [0, 8.4, 0] as Vec3, rod: 7.5, mass: 400, r: 0.55, angle: 30, pushes: [3, 6, 9] };

/** A pyramid of cardboard boxes, `rows` at the bottom, centred at `at`. */
function stack(bodies: IRBody[], rows: number, at: Vec3) {
  let n = bodies.filter((b) => b.def.startsWith('Box')).length;
  for (let layer = 0; layer < rows; layer++) for (let i = 0; i < rows - layer; i++) {
    const p: Vec3 = [at[0] + (i - (rows - 1 - layer) / 2) * 0.42, 0.2 + layer * 0.401, at[2]];
    bodies.push({ def: `Box${n}`, pose: { p, q: q0 }, pieceLocal: { p, q: q0 }, piece: -1, fixed: false, mass: 1.5, role: 'block', shapes: [box(`Box${n++}S`, [0.4, 0.4, 0.4], [0, 0, 0], 'cardboard')] });
  }
}

export function buildStage(st: Stage) {
  const bodies: IRBody[] = [fixed('Floor', [box('FloorS', [80, 0.2, 260], [0, -0.1, 100], 'felt')])], joints: IRJoint[] = [];
  if (st.contraption === 'stairs') {
    const { steps, rise, tread, width, landing } = STAIRS, H = stairsTop();
    const shapes: IRShape[] = [box('Landing', [width, H, landing], [0, H / 2, -landing / 2], 'carpet')];
    for (let i = 1; i < steps; i++) { const top = H - i * rise; shapes.push(box(`Step${i}`, [width, top, tread], [0, top / 2, (i - 0.5) * tread], i % 2 ? 'carpet' : 'cardboard')); }
    // the rail on the figure's left (+x): posts and a sloped bar
    const slope = Math.atan2(H, steps * tread), len = Math.hypot(H, steps * tread);
    shapes.push(box('RailBar', [0.05, 0.05, len], [width / 2 + 0.03, H / 2 + 0.85, (steps * tread) / 2], 'rail', axisAngleToQuat(1, 0, 0, slope)));
    for (const k of [0, 4, 8, 12]) { const z = k * tread, top = H - k * rise; shapes.push(box(`Post${k}`, [0.05, 0.85, 0.05], [width / 2 + 0.03, top + 0.425, z], 'rail')); }
    bodies.push(fixed('Stairs', shapes));
    // the TNT crate, at the bottom on the figure's right (static until it goes off: the page then switches it off)
    bodies.push({ def: 'TNT', pose: { p: TNT_AT, q: q0 }, pieceLocal: { p: TNT_AT, q: q0 }, piece: -1, fixed: true, role: 'block', shapes: [box('TNTS', [0.5, 0.5, 0.5], [0, 0, 0], 'tnt')] });
    // cardboard boxes stacked at the bottom, waiting
    stack(bodies, 3, [0, 0, steps * tread + 1.4]);
  }
  if (st.contraption === 'cannon') {
    // a carriage and a barrel (static), raised 35° towards +z; boxes and the TNT downrange
    const d = cannonDir(), c: Vec3 = [CANNON.pivot[0], CANNON.pivot[1] + d[1] * CANNON.length / 2, CANNON.pivot[2] + d[2] * CANNON.length / 2];
    bodies.push(fixed('Cannon', [
      box('Carriage', [1.1, 0.6, 1.6], [0, 0.45, -0.2], 'wood'),
      { def: 'WheelL', geom: { kind: 'cylinder', r: 0.5, h: 0.15 }, local: { p: [0.65, 0.5, -0.2], q: axisAngleToQuat(0, 0, 1, Math.PI / 2) }, mat: 'iron' },
      { def: 'WheelR', geom: { kind: 'cylinder', r: 0.5, h: 0.15 }, local: { p: [-0.65, 0.5, -0.2], q: axisAngleToQuat(0, 0, 1, Math.PI / 2) }, mat: 'iron' },
      { def: 'Barrel', geom: { kind: 'cylinder', r: 0.32, h: CANNON.length }, local: { p: c, q: axisAngleToQuat(1, 0, 0, Math.PI / 2 - CANNON.elevation) }, mat: 'iron' },
    ]));
    stack(bodies, 4, [0, 0, 15]);
    bodies.push({ def: 'TNT', pose: { p: tntAt(st), q: q0 }, pieceLocal: { p: tntAt(st), q: q0 }, piece: -1, fixed: true, role: 'block', shapes: [box('TNTS', [0.5, 0.5, 0.5], [0, 0, 0], 'tnt')] });
  }
  if (st.contraption === 'wrecking') {
    // a crane: a post and an arm; the ball on a rod (one body, a BallJoint at the pivot), held back by a Latch joint
    const P = WRECK.pivot, a = (WRECK.angle * Math.PI) / 180;
    bodies.push(fixed('Crane', [box('CranePost', [0.5, P[1] + 0.6, 0.5], [2.2, (P[1] + 0.6) / 2, 0], 'iron'), box('CraneArm', [2.7, 0.4, 0.4], [1.05, P[1] + 0.2, 0], 'iron')]));
    const ball: Vec3 = [P[0], P[1] - WRECK.rod * Math.cos(a), P[2] - WRECK.rod * Math.sin(a)], q = axisAngleToQuat(1, 0, 0, -a);
    // a starting swing towards him (standard RigidBody linearVelocity/angularVelocity): it arrives while he is still standing
    const v0 = WRECK.pushes[(st.level ?? 2) - 1], lin: Vec3 = [0, -v0 * Math.sin(a), v0 * Math.cos(a)], ang: Vec3 = [-v0 / WRECK.rod, 0, 0];
    bodies.push({ def: 'Wrecker', pose: { p: ball, q }, pieceLocal: { p: ball, q }, piece: -1, fixed: false, mass: WRECK.mass, role: 'projectile', linearVelocity: lin, angularVelocity: ang, shapes: [
      { def: 'WreckerBall', geom: { kind: 'sphere', r: WRECK.r }, local: { p: [0, 0, 0], q: q0 }, mat: 'iron' },
      { def: 'WreckerRod', geom: { kind: 'cylinder', r: 0.04, h: WRECK.rod - WRECK.r - 0.3 }, local: { p: [0, (WRECK.rod + WRECK.r) / 2 - 0.15, 0], q: q0 }, mat: 'rail' },
    ] });
    joints.push({ type: 'BallJoint', def: 'WreckPivot', body1: 'Wrecker', body2: 'Crane', fields: { anchorPoint: P } });
    joints.push({ type: 'BallJoint', def: 'Latch', body1: 'Wrecker', body2: 'Crane', fields: { anchorPoint: ball } });
    stack(bodies, 3, [0, 0, 2.2]);
    bodies.push({ def: 'TNT', pose: { p: tntAt(st), q: q0 }, pieceLocal: { p: tntAt(st), q: q0 }, piece: -1, fixed: true, role: 'block', shapes: [box('TNTS', [0.5, 0.5, 0.5], [0, 0, 0], 'tnt')] });
  }
  const ir: MachineIR = { bodies, joints, clocks: [], chimes: [], surface: { bounce: 0.15, minBounceSpeed: 0.3, friction: 0.7 } };
  const human = buildHumanoid({ def: st.character === 'dummy' ? 'Dummy' : 'Buddy', character: st.character, pose: figurePose(st), stiffness: st.stiff ? 1 : 0, heat: true });
  const H = st.contraption === 'stairs' ? stairsTop() : 0;
  const meta: SceneMeta = {
    title: { stairs: 'Stairs of doom', cannon: 'The cannon', wrecking: 'The wrecking ball', floor: 'Ragdoll' }[st.contraption],
    description: `An H-Anim 2.0 humanoid (LOA 1)${st.contraption === 'stairs' ? ' at the top of twelve stairs' : ' on a floor'}; the x3d-physx bridge runs it as a PhysX articulation built from H-Anim's own mass, joint-limit and stiffness fields.`,
    info: 'Units: metres, kilograms, seconds, radians. Y up; the humanoid faces +z, down the stairs.', generator: 'x3d-physx-bridge ragdoll (src/ragdoll/stage.ts)',
    components: '  <component name="HAnim" level="1"/>\n', shareShapes: true,
    viewpoints: (st.contraption === 'cannon' ? [
      viewpoint('Side', 'From the side', [-9, 4, -2], [0, 1.6, 6], 0.85),
      viewpoint('Top', 'At the cannon', [-4, 2.6, -4.5], [0.5, 1.4, 1.5], 0.8),
      viewpoint('Bottom', 'Downrange', [5, 2.4, 25], [0, 1, 16], 0.8),
    ] : st.contraption === 'wrecking' ? [
      viewpoint('Side', 'From the side', [-11, 4.5, 1], [0, 2.5, 0.5], 0.8),
      viewpoint('Top', 'Under the crane', [-3.5, 2.2, 5], [0, 1.6, 0], 0.8),
      viewpoint('Bottom', 'Behind', [3, 2, 7], [0, 1, 1.5], 0.8),
    ] : [
      viewpoint('Side', 'From the side', [-8.2, H * 0.85 + 1.9, 1.6], [0, H * 0.6 + 0.5, 1.4], 0.75),
      viewpoint('Top', 'At the top', [-1.8, H + 1.6, -2.4], [0, H + 0.6, 0.2], 0.8),
      viewpoint('Bottom', 'At the bottom', [2.6, 1.2, 7.4], [0, 0.6, 3.6], 0.8),
    ]).join('\n'),
    extra: `  ${human.x3d}`,
  };
  return { ir, meta, human };
}

/**
 * The TNT blast as impulses (body index, N·s). Loose bodies within 3.5 m get a radial kick falling off with distance; the figure gets one
 * velocity change for all its links (away from the crate, through its pelvis, with a lift): it flies without tearing at its joints.
 */
export function blast(state: Float64Array, links: { index: number; mass: number }[], loose: number[], at: Vec3 = TNT_AT): [number, Vec3][] {
  const out: [number, Vec3][] = [];
  const pos = (i: number): Vec3 => [state[i * 13] - at[0], state[i * 13 + 1] - at[1], state[i * 13 + 2] - at[2]];
  for (const i of loose) {
    const d = pos(i), r = Math.hypot(...d);
    if (r > 3.5 || r < 1e-3) continue;
    const k = (1.5 * 9) / Math.max(0.6, r);
    out.push([i, [(d[0] / r) * k, (d[1] / r) * k + 6, (d[2] / r) * k]]);
  }
  if (links.length) {
    const d = pos(links[0].index), r = Math.hypot(...d);
    if (r < 3.5) {
      const dv = Math.min(9, 6 / Math.max(0.6, r)), u: Vec3 = [d[0] / r, Math.max(0.35, d[1] / r), d[2] / r], n = Math.hypot(...u);
      for (const l of links) out.push([l.index, [(l.mass * dv * u[0]) / n, (l.mass * dv * u[1]) / n + l.mass * 2.5, (l.mass * dv * u[2]) / n]]);
    }
  }
  return out;
}

/** The same scene as the bridge reads it, for Node. */
export function stageModel(st: Stage): SceneModel {
  const { ir, human } = buildStage(st);
  const m = toModel(ir, 'ragdoll');
  const bodies = m.collections[0].bodies, shapes = bodies.reduce((n, b) => n + b.shapes.length, 0);
  m.humanoids = [indexHumanoid(human, bodies.length, shapes)];
  return m;
}
