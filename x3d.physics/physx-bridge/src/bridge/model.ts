// Engine-neutral model of an X3D 4.0 RigidBodyPhysics scene (contract x3d-physx/0.1).
// Plain data (structured-clone safe): the reader produces it on the main thread, the PhysX world consumes it in a worker or in Node.

export type Vec3 = [number, number, number];
/** Quaternion, PhysX order x, y, z, w. */
export type Quat = [number, number, number, number];
export interface Pose { p: Vec3; q: Quat }

export const CONTRACT = 'x3d-physx/0.1';

export interface SceneModel {
  contract: typeof CONTRACT;
  /** Scene URL, for provenance. */
  source: string;
  collections: CollectionModel[];
  /** Fixed physics step in seconds (bridge hint; default 1/240). */
  fixedStep: number;
  /** H-Anim humanoids simulated as PhysX articulations (ragdolls); their links follow the collections' bodies in the body index space. */
  humanoids?: HumanoidModel[];
}

/**
 * An HAnimHumanoid as a ragdoll: one articulation link per HAnimSegment, one articulation joint per HAnimJoint, from H-Anim 2.0's own
 * physical fields (segment mass, centerOfMass, momentsOfInertia; joint center, llimit, ulimit, limitOrientation, stiffness).
 */
export interface HumanoidModel {
  def: string;
  name: string;
  /** Collection whose PhysX scene, gravity and surface it joins (-1: the first enabled collection). */
  collection: number;
  /** HAnimHumanoid translation and rotation at load (its frame is the H-Anim bind frame). */
  pose: Pose;
  /** Parents before children. */
  links: LinkModel[];
  /** Articulation solver iterations. */
  iterations: number;
}

export interface LinkModel {
  /** Global body index (state buffer, contacts, hashes). */
  index: number;
  /** HAnimSegment name, and the HAnimJoint that carries it. */
  segment: string;
  joint: string;
  /** Parent link (an index into links), -1 for the root. */
  parent: number;
  /** Joint centre in the humanoid frame (bind pose); the link's frame sits here, axes along the humanoid's. */
  center: Vec3;
  mass: number;
  /** Centre of mass in the humanoid frame (bind pose). */
  centerOfMass: Vec3;
  /** Row-major 3x3 inertia about the centre of mass (H-Anim momentsOfInertia); computed from the shapes when inertiaIsDefault. */
  inertia: number[];
  inertiaIsDefault: boolean;
  /** Collision shapes; `local` is the pose in the humanoid frame (bind pose). */
  shapes: ShapeModel[];
  /** Joint frame for the limits (HAnimJoint.limitOrientation). */
  limitOrientation: Quat;
  /** Per-axis rotation limits about the joint frame's x, y, z (radians); equal values lock an axis; empty = free. */
  llimit: number[];
  ulimit: number[];
  /** Per-axis stiffness 0..1 (HAnimJoint.stiffness): 0 is limp; higher holds the bind pose. */
  stiffness: Vec3;
}

/** Surface parameters of one CollisionCollection (X3D applies one set to every contact in the collection). */
export interface SurfaceModel {
  def: string;
  enabled: boolean;
  /** appliedParameters as authored, e.g. ["BOUNCE", "FRICTION_COEFFICIENT-2"]. */
  applied: string[];
  frictionCoefficients: [number, number];
  bounce: number;
  minBounceSpeed: number;
  surfaceSpeed: [number, number];
  slipFactors: [number, number];
  softnessConstantForceMix: number;
  softnessErrorCorrection: number;
  /** DEF names of the collidables listed in the collection (shapes outside every collection do not collide in X3D). */
  collidables: string[];
}

export interface CollectionModel {
  def: string;
  enabled: boolean;
  gravity: Vec3;
  iterations: number;
  preferAccuracy: boolean;
  errorCorrection: number;
  constantForceMix: number;
  contactSurfaceThickness: number;
  maxCorrectionSpeed: number;
  autoDisable: boolean;
  disableLinearSpeed: number;
  disableAngularSpeed: number;
  disableTime: number;
  surface: SurfaceModel | null;
  bodies: BodyModel[];
  joints: JointModel[];
  /** CollisionSensor DEFs whose collider is this collection's surface. */
  sensors: string[];
}

export type GeomModel =
  | { kind: 'box'; half: Vec3 }
  | { kind: 'sphere'; radius: number }
  /** Convex hull of points (cylinder, cone, or a mesh on a dynamic body). */
  | { kind: 'convex'; points: number[]; from: string }
  /** Triangle mesh (static and kinematic bodies only). */
  | { kind: 'mesh'; points: number[]; indices: number[]; from: string };

export interface ShapeModel {
  /** Global shape index (Contact.geometry1/2, CollisionSensor filters). */
  index?: number;
  /** DEF of the CollidableShape (or a generated name). */
  def: string;
  /** Pose of the shape in the body frame. */
  local: Pose;
  geom: GeomModel;
  enabled: boolean;
}

export interface MassDensityModel { kind: 'sphere' | 'box' | 'cone'; radius?: number; size?: Vec3; bottomRadius?: number; height?: number }

export interface BodyModel {
  index: number;
  def: string;
  enabled: boolean;
  fixed: boolean;
  /** fixed TRUE but position or orientation is driven by a ROUTE: a kinematic actor (interpreted). */
  kinematic: boolean;
  mass: number;
  centerOfMass: Vec3;
  /** Row-major 3x3 inertia tensor as authored. */
  inertia: number[];
  /** TRUE when inertia was left at its default (identity): the bridge computes it from the shapes, as X_ITE does. */
  inertiaIsDefault: boolean;
  massDensityModel: MassDensityModel | null;
  pose: Pose;
  linearVelocity: Vec3;
  angularVelocity: Vec3;
  autoDamp: boolean;
  linearDampingFactor: number;
  angularDampingFactor: number;
  useGlobalGravity: boolean;
  force: Vec3;
  torque: Vec3;
  autoDisable: boolean;
  disableLinearSpeed: number;
  disableAngularSpeed: number;
  disableTime: number;
  useFiniteRotation: boolean;
  finiteRotationAxis: Vec3;
  shapes: ShapeModel[];
}

export type JointType = 'BallJoint' | 'SingleAxisHingeJoint' | 'DoubleAxisHingeJoint' | 'SliderJoint' | 'UniversalJoint' | 'MotorJoint';

export interface JointModel {
  /** Global joint index (order of the joint output records). */
  index: number;
  type: JointType;
  def: string;
  /** Body indices in the collection; -1 = the world. */
  body1: number;
  body2: number;
  /** forceOutput values as authored ("ALL", "NONE" or output field names). */
  forceOutput: string[];
  /** Remaining fields by name (numbers, vectors, booleans), as authored. */
  fields: Record<string, number | boolean | number[] | string[]>;
}

/** Per-body state in a state buffer: position(3), quaternion xyzw(4), linear velocity(3), angular velocity(3). */
export const BODY_STRIDE = 13;
/** Per-contact record in a contact buffer: body1, body2, shape1, shape2, position(3), normal(3), depth, impulse, isNew. */
export const CONTACT_STRIDE = 13;
