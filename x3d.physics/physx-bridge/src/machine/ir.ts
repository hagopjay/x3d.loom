// Machine intermediate representation: bodies, shapes, joints and clocks with world poses, produced by the piece library.
// Two outputs are derived from it: standard X3D text (x3d.ts) and, for Node tests and tuning, the bridge's SceneModel (toModel).
// The browser reader must recover the same SceneModel from the X3D text (checked in the browser test).
import { CONTRACT } from '../bridge/model.ts';
import type { BodyModel, GeomModel, JointModel, JointType, Pose, Quat, SceneModel, ShapeModel, Vec3 } from '../bridge/model.ts';
import { conePoints, cylinderPoints, quatMul, quatRotate } from '../bridge/math.ts';

export type VisualGeom =
  | { kind: 'box'; size: Vec3 }
  | { kind: 'sphere'; r: number }
  | { kind: 'cylinder'; r: number; h: number }
  | { kind: 'cone'; r: number; h: number }
  | { kind: 'mesh'; points: number[]; indices: number[] };

export interface IRShape {
  def: string; geom: VisualGeom; local: Pose; mat: string;
  /** CollidableShape.enabled at load (default true). */
  enabled?: boolean;
  /** Draw the visual inside a Switch DEF="<def>V", so the page can hide it together with its collidable (music-box pegs). */
  switchable?: boolean;
}

export interface IRBody {
  def: string;
  /** World pose (piece transform applied). */
  pose: Pose;
  /** Pose in the piece's frame (build mode draws pieces in their own frame). */
  pieceLocal: Pose;
  piece: number;
  fixed: boolean;
  mass?: number;
  role?: 'marble' | 'domino' | 'chime' | 'board' | 'cup' | 'bead' | 'block' | 'projectile' | 'hammer' | 'drum' | 'beam';
  /** Pitch hint for chimes (phase 4 sound): MIDI note. */
  note?: number;
  shapes: IRShape[];
  linearVelocity?: Vec3;
  angularVelocity?: Vec3;
  /** RigidBody autoDamp TRUE with these damping factors (fraction of velocity removed per second). */
  damping?: { linear: number; angular: number };
}

export interface IRJoint { type: JointType; def: string; body1: string | null; body2: string | null; fields: Record<string, number | boolean | number[]> }

/** A looping TimeSensor + PositionInterpolator (values) and/or OrientationInterpolator (rotations) driving a fixed body (kinematic in PhysX). */
export interface IRClock { def: string; cycle: number; body: string; keys: number[]; values?: Vec3[]; pieceLocalValues?: Vec3[]; rotations?: Quat[] }

export interface MachineIR {
  bodies: IRBody[];
  joints: IRJoint[];
  clocks: IRClock[];
  surface: { bounce: number; minBounceSpeed: number; friction: number };
  /** Shape DEFs inside the chimes CollisionSensor (bells, xylophone bars). */
  chimes: string[];
  /** RigidBodyCollection gravity (default 0 -9.81 0). */
  gravity?: Vec3;
  /** RigidBodyCollection settings beyond the defaults (sleeping of resting bodies, solver iterations). */
  world?: { autoDisable?: boolean; disableLinearSpeed?: number; disableAngularSpeed?: number; disableTime?: number; iterations?: number };
}

export const IDENTITY: Pose = { p: [0, 0, 0], q: [0, 0, 0, 1] };
export const zRot = (deg: number): Quat => { const a = (deg * Math.PI) / 360; return [0, 0, Math.sin(a), Math.cos(a)]; };
export function compose(a: Pose, b: Pose): Pose {
  const p = quatRotate(a.q, b.p);
  return { p: [a.p[0] + p[0], a.p[1] + p[1], a.p[2] + p[2]], q: quatMul(a.q, b.q) };
}
export function applyPose(a: Pose, v: Vec3): Vec3 { const p = quatRotate(a.q, v); return [a.p[0] + p[0], a.p[1] + p[1], a.p[2] + p[2]]; }

/** The GeomModel the reader derives from each X3D geometry (keep in step with reader.geometryOf). */
export function geomModel(g: VisualGeom, def: string): GeomModel {
  switch (g.kind) {
    case 'box': return { kind: 'box', half: [g.size[0] / 2, g.size[1] / 2, g.size[2] / 2] };
    case 'sphere': return { kind: 'sphere', radius: g.r };
    case 'cylinder': return { kind: 'convex', points: cylinderPoints(g.r, g.h, 24), from: 'Cylinder (24-sided hull)' };
    case 'cone': return { kind: 'convex', points: conePoints(g.r, g.h, 24), from: 'Cone (24-sided hull)' };
    case 'mesh': return { kind: 'mesh', points: g.points, indices: g.indices, from: `IndexedFaceSet ${def}` };
  }
}

/** Body DEFs whose shapes go straight under the RigidBody (one shape, identity local pose): the reader then gives them a zero offset. */
export const directShape = (b: IRBody) => b.shapes.length === 1 && b.shapes[0].local.p.every((x) => x === 0) && b.shapes[0].local.q[3] === 1;

export function toModel(ir: MachineIR, source = 'machine', fixedStep = 1 / 240): SceneModel {
  const index = new Map(ir.bodies.map((b, i) => [b.def, i]));
  const kinematic = new Set(ir.clocks.map((c) => c.body));
  let si = 0;
  const bodies: BodyModel[] = ir.bodies.map((b, i) => ({
    index: i, def: `${b.def}Body`, enabled: true, fixed: b.fixed, kinematic: b.fixed && kinematic.has(b.def),
    mass: b.mass ?? 1, centerOfMass: [0, 0, 0], inertia: [1, 0, 0, 0, 1, 0, 0, 0, 1], inertiaIsDefault: true, massDensityModel: null,
    pose: b.pose, linearVelocity: b.linearVelocity ?? [0, 0, 0], angularVelocity: b.angularVelocity ?? [0, 0, 0],
    autoDamp: !!b.damping, linearDampingFactor: b.damping?.linear ?? 0.001, angularDampingFactor: b.damping?.angular ?? 0.001, useGlobalGravity: true, force: [0, 0, 0], torque: [0, 0, 0],
    autoDisable: false, disableLinearSpeed: 0, disableAngularSpeed: 0, disableTime: 0, useFiniteRotation: false, finiteRotationAxis: [0, 1, 0],
    shapes: b.shapes.map((s): ShapeModel => ({ index: si++, def: s.def, local: directShape(b) ? IDENTITY : s.local, geom: geomModel(s.geom, s.def), enabled: s.enabled ?? true })),
  }));
  const joints: JointModel[] = ir.joints.map((j, k) => ({
    index: k, type: j.type, def: j.def, body1: j.body1 ? index.get(j.body1) ?? -1 : -1, body2: j.body2 ? index.get(j.body2) ?? -1 : -1,
    forceOutput: ['ALL'], fields: j.fields,
  }));
  const s = ir.surface, w = ir.world ?? {};
  return {
    contract: CONTRACT, source, fixedStep,
    collections: [{
      def: 'Machine', enabled: true, gravity: ir.gravity ?? [0, -9.81, 0], iterations: w.iterations ?? 10, preferAccuracy: true, errorCorrection: 0.8, constantForceMix: 0.0001,
      contactSurfaceThickness: 0, maxCorrectionSpeed: -1, autoDisable: w.autoDisable ?? false, disableLinearSpeed: w.disableLinearSpeed ?? 0, disableAngularSpeed: w.disableAngularSpeed ?? 0, disableTime: w.disableTime ?? 0,
      surface: { def: 'Surfaces', enabled: true, applied: ['BOUNCE', 'FRICTION_COEFFICIENT-2'], frictionCoefficients: [s.friction, s.friction], bounce: s.bounce, minBounceSpeed: s.minBounceSpeed,
        surfaceSpeed: [0, 0], slipFactors: [0, 0], softnessConstantForceMix: 0.0001, softnessErrorCorrection: 0.8, collidables: [] },
      bodies, joints, sensors: [],
    }],
  };
}

/** Axis-aligned bounds of a piece's shapes in the piece frame (build mode's selection box). */
export function pieceBounds(ir: MachineIR, piece: number): { center: Vec3; size: Vec3 } | null {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  const add = (p: Vec3) => { for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); } };
  for (const b of ir.bodies) if (b.piece === piece) for (const s of b.shapes) {
    const pose = compose(b.pieceLocal, s.local), g = s.geom;
    const pts: Vec3[] = [];
    if (g.kind === 'box') { for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) pts.push([x * g.size[0] / 2, y * g.size[1] / 2, z * g.size[2] / 2]); }
    else if (g.kind === 'sphere') { for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) pts.push([x * g.r, y * g.r, z * g.r]); }
    else if (g.kind === 'cylinder' || g.kind === 'cone') { for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) pts.push([x * g.r, y * g.h / 2, z * g.r]); }
    else for (let i = 0; i < g.points.length; i += 3) pts.push([g.points[i], g.points[i + 1], g.points[i + 2]]);
    for (const p of pts) add(applyPose(pose, p));
  }
  if (lo[0] === Infinity) return null;
  return { center: [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2) as Vec3, size: [0, 1, 2].map((k) => hi[k] - lo[k]) as Vec3 };
}
