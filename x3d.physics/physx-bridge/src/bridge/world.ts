// Builder + fixed stepper: an engine-neutral SceneModel -> PhysX 5 (physx-js-webidl, WASM, CPU).
// No DOM, no X3D: runs in a Web Worker in the browser and in Node for the analytic tests.
import { BODY_STRIDE, CONTACT_STRIDE } from './model.ts';
import type { BodyModel, CollectionModel, GeomModel, HumanoidModel, Pose, Quat, SceneModel, ShapeModel, Vec3 } from './model.ts';
import { diagonaliseInertia, quatMul, quatRotate } from './math.ts';
import { axisKinds } from './hanim.ts';
import { JOINT_STRIDE, JointRec, applyJointForces, buildJoint, readJoint, setJointParam } from './joints.ts';
import type { JointHost } from './joints.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PX = any;

export interface BuildNote { def: string; node: string; field: string; status: 'approximated' | 'interpreted' | 'lost'; how: string }

export interface WorldOptions {
  /**
   * 'none': no contact reports; 'found': new touches only; 'all': new and persisting touches (CollisionSensor semantics);
   * 'sensed': only pairs with a shape in `reportShapes` (the bridge fills it with the collidables of the scene's CollisionSensors).
   */
  contacts?: 'none' | 'found' | 'all' | 'sensed';
  /** Shape indices whose pairs report contacts in 'sensed' mode. */
  reportShapes?: number[];
  /** Maximum contact records kept between two reads. */
  maxContacts?: number;
  /** Impact detector: a shape pair whose total impulse in a step exceeds this (N·s) and 3× its previous step's impulse. Default 2e-5. */
  impactImpulse?: number;
  /** Override the CCD decision (default: preferAccuracy of each collection). */
  ccd?: boolean;
  /** Number of sides used for Cylinder and Cone hulls. */
  hullSides?: number;
}

/** PhysX foundation + physics: created once per WASM instance (PhysX allows one foundation per process). */
export class PhysXContext {
  readonly P: PX;
  readonly physics: PX;
  readonly tolerances: PX;
  readonly cooking: PX;
  readonly version: string;
  constructor(P: PX) {
    this.P = P;
    const v = P.PHYSICS_VERSION;
    this.version = `${(v >> 24) & 0xff}.${(v >> 16) & 0xff}.${(v >> 8) & 0xff}`;
    const foundation = P.CreateFoundation(v, new P.PxDefaultAllocator(), new P.PxDefaultErrorCallback());
    this.tolerances = new P.PxTolerancesScale();
    this.physics = P.CreatePhysics(v, foundation, this.tolerances);
    P.InitExtensions(this.physics);
    this.cooking = new P.PxCookingParams(this.tolerances);
  }
}

interface BodyRec { model: BodyModel; actor: PX; dynamic: boolean; /** set for H-Anim ragdoll links: their articulation, whether this is its root, and its driven axes (PhysX axis, H-Anim axis) */ art?: PX; root?: boolean; driven?: [number, number][]; kinematic: boolean; scene: number; force: Vec3 | null; torque: Vec3 | null; target: Pose | null; from: Pose | null; path: { p: number[]; q: number[] } | null }
interface SceneRec { coll: CollectionModel; scene: PX; ccd: boolean }

const FNV_OFFSET = 0x811c9dc5, FNV_PRIME = 0x01000193;
/** Spherical articulation joints: limits are capped to ±this (rad). */
export const SPHERICAL_CAP = 1.9;
/** Stiffness 1 as a force drive: N·m per radian, and N·m·s per radian. */
export let DRIVE_KP = 4000, DRIVE_KD = 150;
export function setDriveGains(kp: number, kd: number) { DRIVE_KP = kp; DRIVE_KD = kd; }

export class PhysXWorld implements JointHost {
  readonly ctx: PhysXContext;
  readonly model: SceneModel;
  readonly h: number;
  readonly notes: BuildNote[] = [];
  readonly bodies: BodyRec[] = [];
  readonly scenes: SceneRec[] = [];
  stepCount = 0;
  bounceThreshold = 0;
  private impactImpulse = 0;
  /** Per shape pair: total impulse this step (with its first contact record), and a decaying peak of its recent impulses. */
  private pairNow = new Map<number, { imp: number; rec: number[] }>();
  private pairPeak = new Map<number, number>();
  /** An impact being reported: held while its impulse still grows (one strike often spans two steps), then emitted once at its peak. */
  private pending = new Map<number, { rec: number[]; age: number }>();
  /** Contacts touching after the last step (CollisionSensor), and new touches since the last takeContacts() (sound, counters). */
  private stepContacts: number[] = [];
  private eventContacts: number[] = [];
  private contactsDropped = 0;
  private readonly maxContacts: number;
  private readonly actorIndex = new Map<number, number>();
  private readonly shapeIndex = new Map<number, number>();
  readonly shapeDefs: string[] = [];
  /** 'sensed' contact mode: shapes whose pairs report (filter data word0 bit 0). */
  private reportSet: Set<number> | null = null;
  /** PxShape by shape index (CollidableShape.enabled toggles its simulation flags at run time). */
  private readonly shapeObjs: PX[] = [];
  private readonly tmpV: PX;
  private readonly tmpQ: PX;
  private readonly tmpT: PX;
  private readonly cpBuf: PX;
  private readonly keep: unknown[] = [];

  constructor(ctx: PhysXContext, model: SceneModel, opts: WorldOptions = {}) {
    this.ctx = ctx;
    this.model = model;
    this.h = model.fixedStep;
    this.maxContacts = opts.maxContacts ?? 4096;
    const P = ctx.P;
    this.tmpV = new P.PxVec3(0, 0, 0);
    this.tmpQ = new P.PxQuat(0, 0, 0, 1);
    this.tmpT = new P.PxTransform(this.tmpV, this.tmpQ);
    this.cpBuf = new P.PxArray_PxContactPairPoint(16);
    const mode = opts.contacts ?? 'found';
    if (mode === 'sensed') this.reportSet = new Set(opts.reportShapes ?? []);
    this.impactImpulse = opts.impactImpulse ?? 2e-5;
    model.collections.forEach((coll, ci) => {
      if (!coll.enabled) { this.note(coll.def, 'RigidBodyCollection', 'enabled', 'interpreted', 'FALSE: collection not simulated'); return; }
      const ccd = opts.ccd ?? coll.preferAccuracy;
      const scene = this.createScene(coll, ccd, mode);
      this.scenes.push({ coll, scene, ccd });
      const material = this.createMaterial(coll);
      for (const b of coll.bodies) this.addBody(b, coll, scene, this.scenes.length - 1, material, ccd, opts.hullSides ?? 24);
      void ci;
    });
    for (const h of model.humanoids ?? []) this.addHumanoid(h);
    for (const s of this.scenes) for (const j of s.coll.joints) {
      const r = buildJoint(this, j, this.joints.length);
      this.joints.push(r);
    }
  }

  note(def: string, node: string, field: string, status: BuildNote['status'], how: string) { this.notes.push({ def, node, field, status, how }); }

  // JointHost
  get P() { return this.ctx.P; }
  get physics() { return this.ctx.physics; }
  actor(i: number): PX | null { return i >= 0 ? this.bodies[i]?.actor ?? null : null; }
  private bodyModel(i: number): BodyModel | null { for (const c of this.model.collections) for (const b of c.bodies) if (b.index === i) return b; return null; }
  initialPose(i: number): Pose { return (i >= 0 && this.bodyModel(i)?.pose) || { p: [0, 0, 0], q: [0, 0, 0, 1] }; }
  pose(i: number): Pose {
    const r = i >= 0 ? this.bodies[i] : undefined;
    if (!r) return this.initialPose(i);
    if (!r.dynamic) return r.model.pose;
    const g = r.actor.getGlobalPose();
    return { p: [g.p.x, g.p.y, g.p.z], q: [g.q.x, g.q.y, g.q.z, g.q.w] };
  }
  angVel(i: number): Vec3 {
    const r = i >= 0 ? this.bodies[i] : undefined;
    if (!r || !r.dynamic) return [0, 0, 0];
    const w = r.actor.getAngularVelocity();
    return [w.x, w.y, w.z];
  }
  addTorque(i: number, t: Vec3) { const r = i >= 0 ? this.bodies[i] : undefined; if (r && r.dynamic && !r.kinematic) r.actor.addTorque(this.v3(t), this.ctx.P.PxForceModeEnum.eFORCE, true); }
  addForce(i: number, f: Vec3) { const r = i >= 0 ? this.bodies[i] : undefined; if (r && r.dynamic && !r.kinematic) r.actor.addForce(this.v3(f), this.ctx.P.PxForceModeEnum.eFORCE, true); }

  private createScene(coll: CollectionModel, ccd: boolean, mode: string): PX {
    const P = this.ctx.P;
    const sd = new P.PxSceneDesc(this.ctx.tolerances);
    sd.gravity = new P.PxVec3(...coll.gravity);
    sd.cpuDispatcher = P.DefaultCpuDispatcherCreate(0);
    sd.solverType = coll.preferAccuracy ? P.PxSolverTypeEnum.eTGS : P.PxSolverTypeEnum.ePGS;
    const surf = coll.surface;
    // PhysX applies restitution to the velocity after the step's gravity, so a ball bouncing below e·g·h/(1-e) never rests (a hop limit cycle,
    // measured in tests/analytic.test.ts). The bridge raises the threshold to twice that and reports it.
    const e = surf && surf.enabled && surf.applied.includes('BOUNCE') ? surf.bounce : 0;
    const gmag = Math.hypot(...coll.gravity);
    const floor = e > 0 && e < 1 ? (2 * e * gmag * this.h) / (1 - e) : 0;
    const authored = surf && surf.minBounceSpeed > 0 ? surf.minBounceSpeed : 0.2;
    sd.bounceThresholdVelocity = Math.max(authored, floor, 1e-4);
    this.bounceThreshold = sd.bounceThresholdVelocity;
    if (floor > authored) this.note(surf!.def, 'CollisionCollection', 'minBounceSpeed', 'approximated', `raised from ${authored} to ${floor.toFixed(4)} m/s (2·e·g·h/(1-e)) so resting bodies stop hopping`);
    if (coll.disableTime > 0) sd.wakeCounterResetValue = coll.disableTime;
    if (ccd) sd.flags.raise(P.PxSceneFlagEnum.eENABLE_CCD);
    const pf = P.PxPairFlagEnum;
    let flags = pf.eSOLVE_CONTACT | pf.eDETECT_DISCRETE_CONTACT | (ccd ? pf.eDETECT_CCD_CONTACT : 0);
    // Contact reports: every touching pair every step, with points and impulses. Impacts are detected by the bridge (see endStep):
    // PhysX's eNOTIFY_THRESHOLD_FORCE_FOUND never fires under the TGS solver in this build (measured: 0 events vs 21 under PGS),
    // and eNOTIFY_TOUCH_FOUND comes from the speculative contact, before any impulse (measured: 0).
    const report = pf.eNOTIFY_TOUCH_FOUND | pf.eNOTIFY_TOUCH_PERSISTS | pf.eNOTIFY_CONTACT_POINTS;
    if (mode !== 'none' && mode !== 'sensed') flags |= report;
    const fs = new P.PassThroughFilterShaderImpl();
    // Every pair collides (CollisionCollection membership is not a filter yet; reported in the mapping). In 'sensed' mode only pairs
    // with a sensed shape (filter word0 bit 0) report: a pile of beads resting in a bin costs nothing (measured: 4.0 -> 1.0 ms/step).
    fs.filterShader = mode === 'sensed'
      ? (_a0: number, w0a: number, _b: number, _c: number, _d: number, _a1: number, w0b: number) => { fs.set_outputPairFlags((w0a | w0b) & 1 ? flags | report : flags); return 0; }
      : () => { fs.set_outputPairFlags(flags); return 0; };
    P.setupPassThroughFilterShader(sd, fs);
    if (mode !== 'none') {
      const cb = new P.PxSimulationEventCallbackImpl();
      cb.onContact = (hdrPtr: number, pairsPtr: number, nbPairs: number) => this.onContact(hdrPtr, pairsPtr, nbPairs);
      cb.onConstraintBreak = () => {}; cb.onWake = () => {}; cb.onSleep = () => {}; cb.onTrigger = () => {};
      sd.simulationEventCallback = cb;
      this.keep.push(cb);
    }
    this.keep.push(fs);
    const scene = this.ctx.physics.createScene(sd);
    return scene;
  }

  private createMaterial(coll: CollectionModel): PX {
    const s = coll.surface;
    const applied = new Set(s?.applied ?? []);
    const useFriction = !!s && s.enabled && applied.has('FRICTION_COEFFICIENT-2');
    const useBounce = !!s && s.enabled && applied.has('BOUNCE');
    const mu = useFriction ? s!.frictionCoefficients[0] : 0.5;
    const e = useBounce ? s!.bounce : 0;
    if (!useFriction) this.note(s?.def ?? coll.def, 'CollisionCollection', 'frictionCoefficients', 'interpreted', 'FRICTION_COEFFICIENT-2 not applied: friction 0.5 (X_ITE default)');
    if (useFriction && s!.frictionCoefficients[1] !== s!.frictionCoefficients[0]) this.note(s!.def, 'CollisionCollection', 'frictionCoefficients', 'approximated', `second coefficient ${s!.frictionCoefficients[1]} ignored: PhysX friction is isotropic`);
    if (s) for (const p of s.applied) if (!['BOUNCE', 'FRICTION_COEFFICIENT-2'].includes(p)) this.note(s.def, 'CollisionCollection', 'appliedParameters', 'lost', `${p} has no PhysX equivalent here`);
    const m = this.ctx.physics.createMaterial(mu, mu, e);
    // One material per collection, so combine modes never mix two values; set them explicitly anyway.
    m.setFrictionCombineMode(this.ctx.P.PxCombineModeEnum.eAVERAGE);
    m.setRestitutionCombineMode(this.ctx.P.PxCombineModeEnum.eAVERAGE);
    return m;
  }

  private geometry(g: GeomModel, def: string, dynamic: boolean): PX {
    const P = this.ctx.P;
    switch (g.kind) {
      case 'box': return new P.PxBoxGeometry(Math.max(g.half[0], 1e-5), Math.max(g.half[1], 1e-5), Math.max(g.half[2], 1e-5));
      case 'sphere': return new P.PxSphereGeometry(Math.max(g.radius, 1e-5));
      case 'convex': return new P.PxConvexMeshGeometry(this.cookConvex(g.points));
      case 'mesh':
        if (dynamic) {
          this.note(def, 'CollidableShape', 'shape', 'approximated', `${g.from} on a dynamic body: convex hull of its ${g.points.length / 3} points`);
          return new P.PxConvexMeshGeometry(this.cookConvex(g.points));
        }
        return new P.PxTriangleMeshGeometry(this.cookMesh(g.points, g.indices));
    }
  }

  private vec3Array(points: number[]): PX {
    const P = this.ctx.P;
    const arr = new P.PxArray_PxVec3(points.length / 3);
    const v = new P.PxVec3(0, 0, 0);
    for (let i = 0; i < points.length / 3; i++) { v.x = points[3 * i]; v.y = points[3 * i + 1]; v.z = points[3 * i + 2]; arr.set(i, v); }
    P.destroy(v);
    return arr;
  }

  private cookConvex(points: number[]): PX {
    const P = this.ctx.P;
    const arr = this.vec3Array(points);
    const desc = new P.PxConvexMeshDesc();
    desc.points.count = points.length / 3; desc.points.stride = 12; desc.points.data = arr.begin();
    desc.flags = new P.PxConvexFlags(P.PxConvexFlagEnum.eCOMPUTE_CONVEX);
    const mesh = P.CreateConvexMesh(this.ctx.cooking, desc);
    P.destroy(desc); P.destroy(arr);
    if (!mesh || !mesh.ptr) throw new Error('convex cooking failed');
    return mesh;
  }

  private cookMesh(points: number[], indices: number[]): PX {
    const P = this.ctx.P;
    const arr = this.vec3Array(points);
    const idx = new P.PxArray_PxU32(indices.length);
    for (let i = 0; i < indices.length; i++) idx.set(i, indices[i]);
    const desc = new P.PxTriangleMeshDesc();
    desc.points.count = points.length / 3; desc.points.stride = 12; desc.points.data = arr.begin();
    desc.triangles.count = indices.length / 3; desc.triangles.stride = 12; desc.triangles.data = idx.begin();
    const mesh = P.CreateTriangleMesh(this.ctx.cooking, desc);
    P.destroy(desc); P.destroy(arr); P.destroy(idx);
    if (!mesh || !mesh.ptr) throw new Error('triangle mesh cooking failed');
    return mesh;
  }

  private tf(p: Vec3, q: Quat): PX {
    const t = this.tmpT;
    t.p.x = p[0]; t.p.y = p[1]; t.p.z = p[2];
    t.q.x = q[0]; t.q.y = q[1]; t.q.z = q[2]; t.q.w = q[3];
    return t;
  }

  private contactOffset(g: GeomModel, cst: number): number {
    let minDim: number;
    if (g.kind === 'box') minDim = 2 * Math.min(...g.half);
    else if (g.kind === 'sphere') minDim = 2 * g.radius;
    else {
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < g.points.length; i++) { lo[i % 3] = Math.min(lo[i % 3], g.points[i]); hi[i % 3] = Math.max(hi[i % 3], g.points[i]); }
      const ext = [0, 1, 2].map((k) => hi[k] - lo[k]).filter((x) => x > 1e-6);
      minDim = ext.length ? Math.min(...ext) : 0.01;
      if (g.kind === 'mesh') minDim = Math.max(minDim, 0.008); // open surfaces: no thickness to scale from
    }
    return Math.max(cst, Math.min(0.02, Math.max(1e-4, 0.25 * minDim)));
  }

  private addBody(b: BodyModel, coll: CollectionModel, scene: PX, si: number, material: PX, ccd: boolean, sides: number) {
    const P = this.ctx.P, phys = this.ctx.physics;
    void sides;
    if (!b.enabled) { this.note(b.def, 'RigidBody', 'enabled', 'interpreted', 'FALSE: not simulated'); return; }
    const dynamic = !b.fixed || b.kinematic;
    const t = this.tf(b.pose.p, b.pose.q);
    const actor = dynamic ? phys.createRigidDynamic(t) : phys.createRigidStatic(t);
    const flags = new P.PxShapeFlags(P.PxShapeFlagEnum.eSCENE_QUERY_SHAPE | P.PxShapeFlagEnum.eSIMULATION_SHAPE);
    let attached = 0;
    const off = new P.PxShapeFlags(0);
    for (const s of b.shapes) {
      // a disabled collidable is built without simulation flags, so CollidableShape.enabled can switch it on at run time
      const geom = this.geometry(s.geom, s.def, dynamic && !b.kinematic);
      const shape = phys.createShape(geom, material, true, s.enabled ? flags : off);
      shape.setLocalPose(this.tf(s.local.p, s.local.q));
      shape.setContactOffset(this.contactOffset(s.geom, coll.contactSurfaceThickness));
      shape.setRestOffset(0);
      if (this.reportSet) { const fd = new P.PxFilterData(this.reportSet.has(s.index ?? -1) ? 1 : 0, 0, 0, 0); shape.setSimulationFilterData(fd); P.destroy(fd); }
      actor.attachShape(shape);
      this.shapeIndex.set(shape.ptr, s.index ?? this.shapeDefs.length);
      this.shapeObjs[s.index ?? this.shapeDefs.length] = shape;
      this.shapeDefs[s.index ?? this.shapeDefs.length] = s.def;
      if (s.enabled) attached++;
    }
    if (!attached && !dynamic) { P.destroy(flags); actor.release(); return; }
    const rec: BodyRec = { model: b, actor, dynamic, kinematic: b.kinematic, scene: si, force: null, torque: null, target: null, from: null, path: null };
    if (dynamic) {
      if (b.kinematic) {
        actor.setRigidBodyFlag(P.PxRigidBodyFlagEnum.eKINEMATIC, true);
        this.note(b.def, 'RigidBody', 'fixed', 'interpreted', 'fixed TRUE and driven by a ROUTE: kinematic actor');
      } else {
        this.setMass(actor, b, attached);
        actor.setSolverIterationCounts(Math.max(1, Math.min(255, coll.iterations | 0)), 1);
        const lin = b.autoDamp ? -Math.log(Math.max(1e-9, 1 - Math.min(0.999999, b.linearDampingFactor))) : 0;
        const ang = b.autoDamp ? -Math.log(Math.max(1e-9, 1 - Math.min(0.999999, b.angularDampingFactor))) : 0;
        actor.setLinearDamping(lin); actor.setAngularDamping(ang);
        const auto = b.autoDisable || coll.autoDisable;
        if (!auto) actor.setSleepThreshold(0);
        else {
          const lv = b.autoDisable ? b.disableLinearSpeed : coll.disableLinearSpeed, av = b.autoDisable ? b.disableAngularSpeed : coll.disableAngularSpeed;
          actor.setSleepThreshold(0.5 * Math.max(lv * lv, av * av));
        }
        if (coll.maxCorrectionSpeed > 0) actor.setMaxDepenetrationVelocity(coll.maxCorrectionSpeed);
        if (!b.useGlobalGravity) actor.setActorFlag(P.PxActorFlagEnum.eDISABLE_GRAVITY, true);
        if (ccd) actor.setRigidBodyFlag(P.PxRigidBodyFlagEnum.eENABLE_CCD, true);
        actor.setLinearVelocity(this.v3(b.linearVelocity));
        actor.setAngularVelocity(this.v3(b.angularVelocity));
        if (b.force.some((x) => x !== 0)) rec.force = b.force.slice() as Vec3;
        if (b.torque.some((x) => x !== 0)) rec.torque = b.torque.slice() as Vec3;
      }
    }
    P.destroy(flags);
    scene.addActor(actor);
    this.actorIndex.set(actor.ptr, b.index);
    this.bodies[b.index] = rec;
  }

  /**
   * An H-Anim humanoid as a reduced-coordinate articulation: a link per segment (frame at its joint centre, axes along the humanoid's at
   * the bind pose), a joint per HAnimJoint typed from its limits (all axes locked: fixed; only one free: revolute; else spherical with
   * per-axis limits), a damping drive on each moving axis, and stiffness as a drive towards the bind pose.
   */
  private addHumanoid(h: HumanoidModel) {
    const P = this.ctx.P, phys = this.ctx.physics;
    const si = h.collection >= 0 ? this.scenes.findIndex((x) => x.coll === this.model.collections[h.collection]) : 0;
    const S = this.scenes[si];
    if (!S) { this.note(h.def, 'HAnimHumanoid', 'skeleton', 'lost', 'no enabled RigidBodyCollection to share a PhysX scene with'); return; }
    const material = this.createMaterial(S.coll);
    const art = phys.createArticulationReducedCoordinate();
    art.setSolverIterationCounts(Math.max(4, Math.min(255, h.iterations | 0)), 2);
    art.setSleepThreshold(0.002);
    const F = P.PxShapeFlagEnum, A = P.PxArticulationAxisEnum, M = P.PxArticulationMotionEnum, JT = P.PxArticulationJointTypeEnum;
    const flags = new P.PxShapeFlags(F.eSCENE_QUERY_SHAPE | F.eSIMULATION_SHAPE);
    const links: PX[] = [];
    let capped = 0;
    const place = (p: Vec3): Vec3 => { const r = quatRotate(h.pose.q, p); return [h.pose.p[0] + r[0], h.pose.p[1] + r[1], h.pose.p[2] + r[2]]; };
    const axes = [A.eTWIST, A.eSWING1, A.eSWING2];
    for (const L of h.links) {
      const link = art.createLink(L.parent >= 0 ? links[L.parent] : null, this.tf(place(L.center), h.pose.q));
      const driven: [number, number][] = [];
      link.setName?.(L.segment);
      for (const s of L.shapes) {
        const shape = phys.createShape(this.geometry(s.geom, s.def, true), material, true, flags);
        shape.setLocalPose(this.tf([s.local.p[0] - L.center[0], s.local.p[1] - L.center[1], s.local.p[2] - L.center[2]], s.local.q));
        shape.setContactOffset(this.contactOffset(s.geom, S.coll.contactSurfaceThickness)); shape.setRestOffset(0);
        if (this.reportSet) { const fd = new P.PxFilterData(this.reportSet.has(s.index ?? -1) ? 1 : 0, 0, 0, 0); shape.setSimulationFilterData(fd); P.destroy(fd); }
        link.attachShape(shape);
        this.shapeIndex.set(shape.ptr, s.index ?? -1); this.shapeObjs[s.index ?? this.shapeDefs.length] = shape; this.shapeDefs[s.index ?? this.shapeDefs.length] = s.def;
      }
      const com: Vec3 = [L.centerOfMass[0] - L.center[0], L.centerOfMass[1] - L.center[1], L.centerOfMass[2] - L.center[2]];
      if (L.shapes.length && L.inertiaIsDefault) P.PxRigidBodyExt.prototype.setMassAndUpdateInertia(link, Math.max(L.mass, 1e-6), this.v3(com));
      else { link.setMass(Math.max(L.mass, 1e-6)); link.setCMassLocalPose(this.tf(com, [0, 0, 0, 1])); const I = L.inertiaIsDefault ? [0.01, 0.01, 0.01] : [L.inertia[0], L.inertia[4], L.inertia[8]]; link.setMassSpaceInertiaTensor(this.v3(I as Vec3)); }
      if (L.parent >= 0) {
        const parent = h.links[L.parent], j = link.getInboundJoint();
        const lo = L.llimit, hi = L.ulimit, kinds = axisKinds(lo, hi);
        const moving = [0, 1, 2].filter((k) => kinds[k] !== 'locked');
        // a single moving axis becomes the revolute joint's twist (x) axis: turn the joint frame so that axis is x
        const frameQ: Quat = moving.length === 1 && moving[0] !== 0 ? quatMul(L.limitOrientation, moving[0] === 1 ? [0, 0, Math.SQRT1_2, Math.SQRT1_2] : [0, -Math.SQRT1_2, 0, Math.SQRT1_2]) : L.limitOrientation;
        j.setParentPose(this.tf([L.center[0] - parent.center[0], L.center[1] - parent.center[1], L.center[2] - parent.center[2]], frameQ));
        j.setChildPose(this.tf([0, 0, 0], frameQ));
        if (!moving.length) j.setJointType(JT.eFIX);
        else if (moving.length === 1) {
          const k = moving[0]; // the frame turn keeps the angle's sign: a positive twist is a positive turn about the H-Anim axis
          j.setJointType(JT.eREVOLUTE); j.setMotion(A.eTWIST, kinds[k] === 'limited' ? M.eLIMITED : M.eFREE);
          if (kinds[k] === 'limited') j.setLimitParams(A.eTWIST, new P.PxArticulationLimit(lo[k], hi[k]));
          j.setMaxJointVelocity(A.eTWIST, 40);
          j.setDriveParams(A.eTWIST, this.jointDrive(L.stiffness[k], L.mass)); driven.push([A.eTWIST, k]);
        } else {
          j.setJointType(JT.eSPHERICAL);
          for (const k of [0, 1, 2]) {
            if (kinds[k] === 'locked') { j.setMotion(axes[k], M.eLOCKED); continue; }
            j.setMotion(axes[k], kinds[k] === 'limited' ? M.eLIMITED : M.eFREE);
            // spherical limits beyond 1.9 rad are capped: PhysX's spherical joint coordinates blow up near a half turn (measured: NaN with ±2.6)
            const cap = (x: number) => Math.max(-SPHERICAL_CAP, Math.min(SPHERICAL_CAP, x));
            if (kinds[k] === 'limited') { if (cap(lo[k]) !== lo[k] || cap(hi[k]) !== hi[k]) capped++; j.setLimitParams(axes[k], new P.PxArticulationLimit(cap(lo[k]), cap(hi[k]))); }
            j.setMaxJointVelocity(axes[k], 40);
            j.setDriveParams(axes[k], this.jointDrive(L.stiffness[k], L.mass)); driven.push([axes[k], k]);
          }
        }
      }
      const model: BodyModel = { index: L.index, def: `${h.def}.${L.segment}`, enabled: true, fixed: false, kinematic: false, mass: L.mass, centerOfMass: L.centerOfMass, inertia: L.inertia, inertiaIsDefault: L.inertiaIsDefault, massDensityModel: null,
        pose: { p: place(L.center), q: h.pose.q }, linearVelocity: [0, 0, 0], angularVelocity: [0, 0, 0], autoDamp: false, linearDampingFactor: 0, angularDampingFactor: 0, useGlobalGravity: true, force: [0, 0, 0], torque: [0, 0, 0],
        autoDisable: false, disableLinearSpeed: 0, disableAngularSpeed: 0, disableTime: 0, useFiniteRotation: false, finiteRotationAxis: [0, 1, 0], shapes: L.shapes };
      this.bodies[L.index] = { model, actor: link, dynamic: true, kinematic: false, scene: si, force: null, torque: null, target: null, from: null, path: null, art, root: L.parent < 0, driven };
      this.actorIndex.set(link.ptr, L.index);
      links.push(link);
      if (S.ccd) link.setRigidBodyFlag(P.PxRigidBodyFlagEnum.eENABLE_CCD, true);
      link.setMaxDepenetrationVelocity(3); // crushed under falling stones, an unlimited push-out blew the articulation up (measured)
    }
    P.destroy(flags);
    S.scene.addArticulation(art);
    this.note(h.def, 'HAnimHumanoid', 'skeleton', 'interpreted', `ragdoll: a PhysX articulation of ${h.links.length} links (one per HAnimSegment), joints typed from HAnimJoint llimit/ulimit`);
    this.note(h.def, 'HAnimJoint', 'llimit', 'approximated', 'per-axis limits about the joint frame (limitOrientation): x as PhysX twist, y and z as swings (box limits on the twist/swing coordinates); equal limits (X3D\'s default 0 0 0) = no limit, a range under 0.01 rad = locked');
    if (capped) this.note(h.def, 'HAnimJoint', 'ulimit', 'approximated', `${capped} spherical limit(s) beyond ${SPHERICAL_CAP} rad capped (PhysX spherical joints are unstable near a half turn); joint speeds capped at 40 rad/s`);
    this.note(h.def, 'HAnimJoint', 'stiffness', 'interpreted', 'a drive towards the bind pose (0: limp); every moving axis also gets a little damping so limbs settle');
  }

  /** A one-off impulse (N·s) at a dynamic body's centre of mass (ragdoll links included): explosions, kicks. */
  applyImpulse(index: number, J: Vec3) {
    const r = this.bodies[index];
    if (!r || !r.dynamic || r.kinematic) return;
    r.actor.addForce(this.v3(J), this.ctx.P.PxForceModeEnum.eIMPULSE, true);
  }

  /** A one-off angular impulse (N·m·s) on a dynamic body or ragdoll link (a balance controller's correction). */
  applyAngularImpulse(index: number, L: Vec3) {
    const r = this.bodies[index];
    if (!r || !r.dynamic || r.kinematic) return;
    r.actor.addTorque(this.v3(L), this.ctx.P.PxForceModeEnum.eIMPULSE, true);
  }

  /** HAnimJoint.stiffness changed at run time: new drives on the link's moving axes (0 limp, 1 holds the bind pose). */
  setLinkStiffness(index: number, s: Vec3) {
    const r = this.bodies[index];
    if (!r?.art || !r.driven) return;
    const j = r.actor.getInboundJoint();
    for (const [axis, k] of r.driven) j.setDriveParams(axis, this.jointDrive(s[k], r.model.mass));
    r.art.wakeUp();
  }

  /** A ragdoll link's joint coordinates (PhysX twist, swing1, swing2, radians), or null for a root or a rigid body. */
  linkJointPositions(index: number): [number, number, number] | null {
    const r = this.bodies[index];
    if (!r?.art || r.root) return null;
    const j = r.actor.getInboundJoint(), A = this.ctx.P.PxArticulationAxisEnum;
    return [j.getJointPosition(A.eTWIST), j.getJointPosition(A.eSWING1), j.getJointPosition(A.eSWING2)];
  }

  /** Stiffness s (H-Anim, 0..1) as an acceleration drive towards the bind pose, plus a little damping. */
  private jointDrive(s: number, mass: number): PX {
    const P = this.ctx.P;
    void mass;
    const x = Math.max(0, Math.min(1, s));
    // force drives carry the load above a joint (acceleration drives scale with the link's own inertia: knees buckled, measured);
    // the limp part stays an acceleration drive (pure damping)
    if (x > 0) return new P.PxArticulationDrive(DRIVE_KP * x, DRIVE_KD * x, new P.PxPerformanceEnvelope(1e9, 1e9, 0, 0), P.PxArticulationDriveTypeEnum.eFORCE);
    return new P.PxArticulationDrive(1500 * x, 2 + 60 * x, new P.PxPerformanceEnvelope(1e9, 1e9, 0, 0), P.PxArticulationDriveTypeEnum.eACCELERATION);
  }

  private v3(v: Vec3): PX { this.tmpV.x = v[0]; this.tmpV.y = v[1]; this.tmpV.z = v[2]; return this.tmpV; }

  private setMass(actor: PX, b: BodyModel, attached: number) {
    const P = this.ctx.P;
    const m = Math.max(b.mass, 1e-9);
    const com = this.tf(b.centerOfMass, [0, 0, 0, 1]);
    if (b.massDensityModel) {
      const d = b.massDensityModel;
      let I: Vec3;
      if (d.kind === 'sphere') { const r = d.radius ?? 1; I = [0.4 * m * r * r, 0.4 * m * r * r, 0.4 * m * r * r]; }
      else if (d.kind === 'box') { const [x, y, z] = d.size ?? [2, 2, 2]; I = [(m / 12) * (y * y + z * z), (m / 12) * (x * x + z * z), (m / 12) * (x * x + y * y)]; }
      else { const r = d.bottomRadius ?? 1, h = d.height ?? 2; const t = m * (0.15 * r * r + 0.0375 * h * h); I = [t, 0.3 * m * r * r, t]; }
      actor.setMass(m); actor.setCMassLocalPose(com); actor.setMassSpaceInertiaTensor(this.v3(I));
    } else if (!b.inertiaIsDefault) {
      const { moments, frame } = diagonaliseInertia(b.inertia);
      actor.setMass(m); actor.setCMassLocalPose(this.tf(b.centerOfMass, frame)); actor.setMassSpaceInertiaTensor(this.v3(moments));
    } else if (attached) {
      P.PxRigidBodyExt.prototype.setMassAndUpdateInertia(actor, m, this.v3(b.centerOfMass));
      this.note(b.def, 'RigidBody', 'inertia', 'interpreted', 'default (identity) inertia: computed from the collision shapes, as X_ITE does');
    } else {
      actor.setMass(m); actor.setMassSpaceInertiaTensor(this.v3([1, 1, 1]));
    }
  }

  readonly joints: (JointRec | null)[] = [];

  /** Joint outputs (JOINT_STRIDE floats each, by joint index). */
  readJoints(out: Float64Array = new Float64Array(this.joints.length * JOINT_STRIDE)) {
    this.joints.forEach((r, k) => { if (r) readJoint(this, r, out, k * JOINT_STRIDE); });
    return out;
  }

  /** set_field on a joint input (MotorJoint torques, hinge2 drives, slider force). */
  setJointField(index: number, field: string, value: number) {
    const r = this.joints[index];
    return r ? setJointParam(this, r, field, value) : false;
  }

  /** A joint removed from RigidBodyCollection.joints at run time: released (a latch let go, a sling's loop slipping off its prong). */
  removeJoint(index: number) {
    const r = this.joints[index];
    if (!r) return;
    r.joint?.release();
    this.joints[index] = null;
    for (const b of [r.model.body1, r.model.body2]) this.wake(b);
  }

  /** RigidBodyCollection.gravity changed at run time. */
  setGravity(collection: number, g: Vec3) {
    const s = this.scenes[collection];
    if (!s) return;
    s.scene.setGravity(this.v3(g));
    this.bodies.forEach((r, i) => { if (r && r.scene === collection) this.wake(i); });
  }

  /** CollidableShape.enabled changed at run time: the shape joins or leaves collision detection (it keeps its place on its body). */
  setShapeEnabled(index: number, on: boolean) {
    const s = this.shapeObjs[index], F = this.ctx.P.PxShapeFlagEnum;
    if (!s) return;
    s.setFlag(F.eSIMULATION_SHAPE, on); s.setFlag(F.eSCENE_QUERY_SHAPE, on);
    this.bodies.forEach((_, i) => this.wake(i)); // bodies resting on (or against) it must notice
  }

  private wake(i: number) { const r = i >= 0 ? this.bodies[i] : undefined; if (r?.art) r.art.wakeUp(); else if (r && r.dynamic && !r.kinematic) r.actor.wakeUp(); }

  /** set_field on RigidBody.forces / .torques (sums, world frame). */
  setBodyLoad(index: number, kind: 'force' | 'torque', v: Vec3) {
    const r = this.bodies[index];
    if (!r || !r.dynamic || r.kinematic) return;
    r[kind] = v.some((x) => x !== 0) ? v.slice() as Vec3 : null;
  }

  private onContact(hdrPtr: number, pairsPtr: number, nbPairs: number) {
    const P = this.ctx.P;
    const hdr = P.wrapPointer(hdrPtr, P.PxContactPairHeader);
    const b1 = this.actorIndex.get(hdr.get_actors(0).ptr) ?? -1, b2 = this.actorIndex.get(hdr.get_actors(1).ptr) ?? -1;
    const helpers = (this as unknown as { _h?: PX })._h ??= P.NativeArrayHelpers.prototype;
    for (let i = 0; i < nbPairs; i++) {
      const pair = helpers.getContactPairAt(P.wrapPointer(pairsPtr, P.PxContactPair), i);
      const s1 = this.shapeIndex.get(pair.get_shapes(0).ptr) ?? -1, s2 = this.shapeIndex.get(pair.get_shapes(1).ptr) ?? -1;
      const n = pair.extractContacts(this.cpBuf.begin(), 16);
      let pairImpulse = 0, firstRec: number[] | null = null;
      for (let k = 0; k < n; k++) {
        const c = this.cpBuf.get(k);
        const imp = c.impulse;
        const rec = [b1, b2, s1, s2, c.position.x, c.position.y, c.position.z, c.normal.x, c.normal.y, c.normal.z, -c.separation, Math.hypot(imp.x, imp.y, imp.z), 0];
        if (this.stepContacts.length < this.maxContacts * CONTACT_STRIDE) this.stepContacts.push(...rec); else this.contactsDropped++;
        pairImpulse += rec[11];
        if (k === 0) firstRec = rec;
      }
      if (firstRec) {
        const key = s1 * 65536 + s2, cur = this.pairNow.get(key);
        if (cur) cur.imp += pairImpulse; else this.pairNow.set(key, { imp: pairImpulse, rec: firstRec });
      }
    }
  }

  /** Kinematic target for the next step(n) call; the pose is interpolated across its substeps. */
  setKinematicTarget(index: number, p: Vec3, q: Quat) {
    const r = this.bodies[index];
    if (!r || !r.kinematic) return;
    const g = r.actor.getGlobalPose();
    r.from = { p: [g.p.x, g.p.y, g.p.z], q: [g.q.x, g.q.y, g.q.z, g.q.w] };
    r.target = { p, q };
  }

  /** Kinematic path for the next step(n) call: one pose per step (p: 3n floats, q: 4n floats), sampled at each step's time by the bridge. */
  setKinematicPath(index: number, p: number[], q: number[]) {
    const r = this.bodies[index];
    if (r && r.kinematic) { r.path = { p, q }; r.target = r.from = null; }
  }

  /** Advance n fixed steps. Returns per-step state hashes when asked (record and replay). */
  step(n: number, hashes?: number[]) {
    const P = this.ctx.P;
    for (let k = 0; k < n; k++) {
      this.stepContacts.length = 0;
      for (const j of this.joints) if (j) applyJointForces(this, j);
      for (const r of this.bodies) {
        if (!r) continue;
        if (r.force) r.actor.addForce(this.v3(r.force), P.PxForceModeEnum.eFORCE, true);
        if (r.torque) r.actor.addTorque(this.v3(r.torque), P.PxForceModeEnum.eFORCE, true);
        if (r.path) {
          const i = Math.min(k, r.path.p.length / 3 - 1);
          r.actor.setKinematicTarget(this.tf(r.path.p.slice(3 * i, 3 * i + 3) as Vec3, r.path.q.slice(4 * i, 4 * i + 4) as Quat));
          if (k === n - 1) r.path = null;
        } else if (r.target && r.from) {
          const a = (k + 1) / n, f = r.from, t = r.target;
          const dot = f.q[0] * t.q[0] + f.q[1] * t.q[1] + f.q[2] * t.q[2] + f.q[3] * t.q[3];
          const sgn = dot < 0 ? -1 : 1;
          const q: Quat = [0, 1, 2, 3].map((i) => f.q[i] * (1 - a) + sgn * t.q[i] * a) as Quat;
          const qn = Math.hypot(...q);
          r.actor.setKinematicTarget(this.tf([0, 1, 2].map((i) => f.p[i] * (1 - a) + t.p[i] * a) as Vec3, q.map((x) => x / qn) as Quat));
          if (k === n - 1) r.target = r.from = null;
        }
      }
      for (const s of this.scenes) { s.scene.simulate(this.h); s.scene.fetchResults(true); }
      this.endStep();
      this.stepCount++;
      if (hashes) hashes.push(this.hash());
    }
  }

  /**
   * Impact detection: an event when a shape pair's impulse this step exceeds the threshold and 3× the pair's recent peak (decaying ×0.7
   * per step). The peak, not the previous step, because PGS alternates a resting contact's impulse between steps (measured: 194 events
   * for one ball coming to rest when compared with the previous step; 4 with TGS). Record: first point, total impulse, isNew 1.
   */
  private endStep() {
    if (!this.pairNow.size && !this.pairPeak.size && !this.pending.size) return;
    const T = this.impactImpulse;
    const emit = (rec: number[]) => { if (this.eventContacts.length < this.maxContacts * CONTACT_STRIDE) this.eventContacts.push(...rec); else this.contactsDropped++; };
    for (const [key, { imp, rec }] of this.pairNow) {
      const pend = this.pending.get(key);
      if (pend) {
        // still rising: keep the larger step (its point and impulse); falling or held for 3 steps: report the peak
        if (imp > pend.rec[11] && pend.age < 3) { rec[11] = imp; rec[12] = 1; this.pending.set(key, { rec, age: pend.age + 1 }); }
        else { emit(pend.rec); this.pending.delete(key); }
        continue;
      }
      const peak = this.pairPeak.get(key) ?? 0;
      if (imp > T && imp > 3 * peak) { rec[11] = imp; rec[12] = 1; this.pending.set(key, { rec, age: 0 }); }
    }
    for (const [key, pend] of this.pending) if (!this.pairNow.has(key)) { emit(pend.rec); this.pending.delete(key); }
    for (const [key, peak] of this.pairPeak) {
      const imp = this.pairNow.get(key)?.imp ?? 0, next = Math.max(imp, peak * 0.7);
      if (next < T * 0.05 && !this.pairNow.has(key)) this.pairPeak.delete(key); else this.pairPeak.set(key, next);
    }
    for (const [key, { imp }] of this.pairNow) if (!this.pairPeak.has(key)) this.pairPeak.set(key, imp);
    this.pairNow = new Map();
  }

  get time() { return this.stepCount * this.h; }
  get bodyCount() { return this.model.collections.reduce((n, c) => n + c.bodies.length, 0) + (this.model.humanoids ?? []).reduce((n, h) => n + h.links.length, 0); }

  /** Write every body's state (BODY_STRIDE floats each, by body index) into out. Fixed and missing bodies keep their authored pose. */
  readState(out: Float64Array) {
    for (const c of this.model.collections) for (const b of c.bodies) {
      const o = b.index * BODY_STRIDE, r = this.bodies[b.index];
      if (!r || !r.dynamic) {
        out.set(b.pose.p, o); out.set(b.pose.q, o + 3); out.fill(0, o + 7, o + 13);
        continue;
      }
      const g = r.actor.getGlobalPose();
      out[o] = g.p.x; out[o + 1] = g.p.y; out[o + 2] = g.p.z;
      out[o + 3] = g.q.x; out[o + 4] = g.q.y; out[o + 5] = g.q.z; out[o + 6] = g.q.w;
      const v = r.actor.getLinearVelocity(); out[o + 7] = v.x; out[o + 8] = v.y; out[o + 9] = v.z;
      const w = r.actor.getAngularVelocity(); out[o + 10] = w.x; out[o + 11] = w.y; out[o + 12] = w.z;
    }
    for (const h of this.model.humanoids ?? []) for (const L of h.links) {
      const r = this.bodies[L.index], o = L.index * BODY_STRIDE;
      if (!r) continue;
      const g = r.actor.getGlobalPose(), v = r.actor.getLinearVelocity(), w = r.actor.getAngularVelocity();
      out[o] = g.p.x; out[o + 1] = g.p.y; out[o + 2] = g.p.z; out[o + 3] = g.q.x; out[o + 4] = g.q.y; out[o + 5] = g.q.z; out[o + 6] = g.q.w;
      out[o + 7] = v.x; out[o + 8] = v.y; out[o + 9] = v.z; out[o + 10] = w.x; out[o + 11] = w.y; out[o + 12] = w.z;
    }
    return out;
  }

  /** FNV-1a 32-bit hash over the float32 bit patterns of every dynamic body's pose and velocities. */
  hash(): number {
    const f = (this as unknown as { _hf?: Float32Array })._hf ??= new Float32Array(13);
    const u = new Uint8Array(f.buffer);
    let h = FNV_OFFSET;
    for (const r of this.bodies) {
      if (!r || !r.dynamic) continue;
      const g = r.actor.getGlobalPose(), v = r.actor.getLinearVelocity(), w = r.actor.getAngularVelocity();
      f[0] = g.p.x; f[1] = g.p.y; f[2] = g.p.z; f[3] = g.q.x; f[4] = g.q.y; f[5] = g.q.z; f[6] = g.q.w;
      f[7] = v.x; f[8] = v.y; f[9] = v.z; f[10] = w.x; f[11] = w.y; f[12] = w.z;
      for (let i = 0; i < u.length; i++) { h ^= u[i]; h = Math.imul(h, FNV_PRIME) >>> 0; }
    }
    return h >>> 0;
  }

  /** Contacts touching after the last step, new touches since the last call (CONTACT_STRIDE floats each), and how many the cap dropped. */
  takeContacts(): { current: Float32Array; events: Float32Array; dropped: number } {
    const current = Float32Array.from(this.stepContacts), events = Float32Array.from(this.eventContacts);
    const dropped = this.contactsDropped;
    this.eventContacts.length = 0; this.contactsDropped = 0;
    return { current, events, dropped };
  }

  /** Teleport a dynamic body (reset, drop a marble). */
  setBodyState(index: number, p: Vec3, q: Quat, v: Vec3 = [0, 0, 0], w: Vec3 = [0, 0, 0]) {
    const r = this.bodies[index];
    if (!r || !r.dynamic) return;
    if (r.art) { // a ragdoll moves as a whole: its root link's pose and velocity (other links follow through the joints)
      if (!r.root) return;
      r.art.setRootGlobalPose(this.tf(p, q), true); r.art.setRootLinearVelocity(this.v3(v), true); r.art.setRootAngularVelocity(this.v3(w), true);
      // move every link with the root now (PhysX otherwise updates them only in the next simulate: contacts at the old places -> NaN, measured)
      const K = this.ctx.P.PxArticulationKinematicFlagEnum, f = new this.ctx.P.PxArticulationKinematicFlags(K.ePOSITION | K.eVELOCITY);
      r.art.updateKinematic(f); this.ctx.P.destroy(f);
      return;
    }
    r.actor.setGlobalPose(this.tf(p, q), true);
    if (!r.kinematic) { r.actor.setLinearVelocity(this.v3(v), true); r.actor.setAngularVelocity(this.v3(w), true); }
  }

  release() {
    for (const s of this.scenes) s.scene.release();
    this.scenes.length = 0;
  }
}

export type { ShapeModel };
