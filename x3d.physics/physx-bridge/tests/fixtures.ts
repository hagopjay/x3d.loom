// Builders for engine-neutral test scenes (what the reader would produce from X3D).
import { CONTRACT } from '../src/bridge/model.ts';
import type { BodyModel, CollectionModel, GeomModel, JointModel, Quat, SceneModel, SurfaceModel, Vec3 } from '../src/bridge/model.ts';

export function surface(o: Partial<SurfaceModel> = {}): SurfaceModel {
  return { def: 'S', enabled: true, applied: ['BOUNCE', 'FRICTION_COEFFICIENT-2'], frictionCoefficients: [0.5, 0.5], bounce: 0, minBounceSpeed: 0.1,
    surfaceSpeed: [0, 0], slipFactors: [0, 0], softnessConstantForceMix: 0.0001, softnessErrorCorrection: 0.8, collidables: [], ...o };
}
let n = 0;
export function body(geom: GeomModel, o: Partial<BodyModel> & { p?: Vec3; q?: Quat } = {}): BodyModel {
  const { p = [0, 0, 0], q = [0, 0, 0, 1], ...rest } = o;
  return { index: 0, def: `B${n++}`, enabled: true, fixed: false, kinematic: false, mass: 1, centerOfMass: [0, 0, 0], inertia: [1, 0, 0, 0, 1, 0, 0, 0, 1], inertiaIsDefault: true,
    massDensityModel: null, pose: { p, q }, linearVelocity: [0, 0, 0], angularVelocity: [0, 0, 0], autoDamp: false, linearDampingFactor: 0.001, angularDampingFactor: 0.001,
    useGlobalGravity: true, force: [0, 0, 0], torque: [0, 0, 0], autoDisable: false, disableLinearSpeed: 0, disableAngularSpeed: 0, disableTime: 0,
    useFiniteRotation: false, finiteRotationAxis: [0, 0, 0], shapes: [{ def: `C${n}`, local: { p: [0, 0, 0], q: [0, 0, 0, 1] }, geom, enabled: true }], ...rest };
}
export function scene(bodies: BodyModel[], o: Partial<CollectionModel> = {}, h = 1 / 240, joints: JointModel[] = []): SceneModel {
  bodies.forEach((b, i) => (b.index = i));
  joints.forEach((j, i) => (j.index = i));
  let si = 0; for (const b of bodies) for (const s of b.shapes) s.index = si++;
  const coll: CollectionModel = { def: 'C', enabled: true, gravity: [0, -9.81, 0], iterations: 10, preferAccuracy: false, errorCorrection: 0.8, constantForceMix: 0.0001,
    contactSurfaceThickness: 0, maxCorrectionSpeed: -1, autoDisable: false, disableLinearSpeed: 0, disableAngularSpeed: 0, disableTime: 0,
    surface: surface(), bodies, joints, sensors: [], ...o };
  return { contract: CONTRACT, source: 'test', collections: [coll], fixedStep: h };
}
export function joint(type: JointModel['type'], body1: number, body2: number, fields: JointModel['fields'] = {}): JointModel {
  return { index: 0, type, def: `${type}#${n++}`, body1, body2, forceOutput: ['ALL'], fields };
}
export const sphere = (radius: number): GeomModel => ({ kind: 'sphere', radius });
export const box = (x: number, y: number, z: number): GeomModel => ({ kind: 'box', half: [x / 2, y / 2, z / 2] });
