// X3D 4.0 joints -> PhysX 5 joints (or applied torques, for MotorJoint), with the X3D joint outputs.
// Conventions (ODE's, which X3D's RigidBodyPhysics follows): anchors and axes are given in world coordinates at load;
// angles and separations are 0 at load and measure body1 relative to body2 (hinge, slider, motor);
// for the two-axis joints axis1 belongs to body1 and axis2 to body2.
import type { JointModel, Pose, Quat, Vec3 } from './model.ts';
import { quatConj, quatFromTo, quatMul, quatRotate, matToQuat } from './math.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PX = any;

/** Per-joint output record: angle1, rate1, angle2, rate2, angle3, rate3, separation, separationRate, body1Anchor(3), body2Anchor(3), body1Axis(3), body2Axis(3). */
export const JOINT_STRIDE = 20;

export interface JointHost {
  P: PX;
  /** Fixed step (s): PhysX drive force limits act as impulses per step here. */
  h: number;
  physics: PX;
  /** Actor of a body index, or null (world, or a body that is not simulated). */
  actor(i: number): PX | null;
  /** Authored (load-time) pose of a body; identity for the world. */
  initialPose(i: number): Pose;
  /** Current pose and velocities; the authored pose and zero for static bodies and the world. */
  pose(i: number): Pose;
  angVel(i: number): Vec3;
  /** Apply a torque / force (world frame) to a dynamic body for the coming step; ignored for others. */
  addTorque(i: number, t: Vec3): void;
  addForce(i: number, f: Vec3): void;
  note(def: string, node: string, field: string, status: 'approximated' | 'interpreted' | 'lost', how: string): void;
}

const num = (j: JointModel, k: string, d: number): number => { const v = j.fields[k]; return typeof v === 'number' ? v : d; };
const vec = (j: JointModel, k: string, d: Vec3): Vec3 => { const v = j.fields[k]; return Array.isArray(v) && v.length === 3 ? (v as number[]).slice() as Vec3 : d; };
const norm = (v: Vec3): Vec3 => { const n = Math.hypot(...v); return n > 1e-12 ? [v[0] / n, v[1] / n, v[2] / n] : [1, 0, 0]; };
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const toLocal = (pose: Pose, p: Vec3): Vec3 => quatRotate(quatConj(pose.q), sub(p, pose.p));
const toWorld = (pose: Pose, p: Vec3): Vec3 => add(pose.p, quatRotate(pose.q, p));
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Frame with the given unit x and (not necessarily orthogonal) y axis, as a quaternion. */
function frameXY(x: Vec3, yHint: Vec3): Quat {
  x = norm(x);
  let y = sub(yHint, scale(x, dot(yHint, x)));
  if (Math.hypot(...y) < 1e-6) y = Math.abs(x[0]) < 0.9 ? cross(x, [1, 0, 0]) : cross(x, [0, 1, 0]);
  y = norm(y);
  const z = cross(x, y);
  return matToQuat([x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]]);
}

export class JointRec {
  readonly model: JointModel;
  readonly index: number;
  joint: PX | null = null;
  /** Anchor in each body's frame, axes in their owners' frames. */
  anchor1: Vec3 = [0, 0, 0]; anchor2: Vec3 = [0, 0, 0];
  axis1Local: Vec3 = [1, 0, 0]; axis2Local: Vec3 = [1, 0, 0];
  /** MotorJoint: axes in body2's frame; load-time relative rotation of body1 in body2's frame. */
  motorAxes: Vec3[] = [];
  relRot0: Quat = [0, 0, 0, 1];
  /** Inputs that can change at runtime. */
  params: Record<string, number> = {};
  constructor(model: JointModel, index: number) { this.model = model; this.index = index; }
}

/** PxTransform of a world-frame (position, rotation) expressed in body i's load-time frame. */
function localFrame(h: JointHost, i: number, p: Vec3, q: Quat): PX {
  const P = h.P, pose = h.initialPose(i);
  const lp = toLocal(pose, p), lq = quatMul(quatConj(pose.q), q);
  return new P.PxTransform(new P.PxVec3(...lp), new P.PxQuat(...lq));
}

export function buildJoint(h: JointHost, j: JointModel, index: number): JointRec | null {
  const P = h.P, phys = h.physics;
  const r = new JointRec(j, index);
  const b1 = j.body1, b2 = j.body2;
  if (b1 < 0 && b2 < 0) { h.note(j.def, j.type, 'body1', 'lost', 'neither body is set: joint ignored'); return null; }
  const a1 = b1 >= 0 ? h.actor(b1) : null, a2 = b2 >= 0 ? h.actor(b2) : null;
  const anchor = vec(j, 'anchorPoint', [0, 0, 0]);
  const p1 = h.initialPose(b1), p2 = h.initialPose(b2);
  const setAnchors = (a: Vec3) => { r.anchor1 = toLocal(p1, a); r.anchor2 = toLocal(p2, a); };
  if (b1 < 0 || b2 < 0) h.note(j.def, j.type, b1 < 0 ? 'body1' : 'body2', 'interpreted', 'NULL: attached to the world (X_ITE creates no joint in this case)');

  switch (j.type) {
    case 'BallJoint': {
      setAnchors(anchor);
      r.joint = P.SphericalJointCreate(phys, a2, localFrame(h, b2, anchor, [0, 0, 0, 1]), a1, localFrame(h, b1, anchor, [0, 0, 0, 1]));
      break;
    }
    case 'SingleAxisHingeJoint': {
      setAnchors(anchor);
      const axis = norm(vec(j, 'axis', [0, 1, 0]));
      r.axis1Local = quatRotate(quatConj(p1.q), axis); r.axis2Local = quatRotate(quatConj(p2.q), axis);
      const q = quatFromTo([1, 0, 0], axis);
      r.joint = P.RevoluteJointCreate(phys, a2, localFrame(h, b2, anchor, q), a1, localFrame(h, b1, anchor, q));
      const lo = num(j, 'minAngle', -Math.PI), hi = num(j, 'maxAngle', Math.PI);
      if (lo <= hi && (lo > -Math.PI + 1e-6 || hi < Math.PI - 1e-6)) {
        const lim = new P.PxJointAngularLimitPair(Math.max(lo, -2 * Math.PI + 1e-3), Math.min(hi, 2 * Math.PI - 1e-3));
        lim.restitution = num(j, 'stopBounce', 0);
        r.joint.setLimit(lim);
        r.joint.setRevoluteJointFlag(P.PxRevoluteJointFlagEnum.eLIMIT_ENABLED, true);
      }
      break;
    }
    case 'SliderJoint': {
      // X3D gives no anchor for a slider; the frame sits at body1's load position (as X_ITE).
      const axis = norm(vec(j, 'axis', [0, 1, 0]));
      const at = b1 >= 0 ? p1.p : p2.p;
      setAnchors(at);
      r.axis1Local = quatRotate(quatConj(p1.q), axis); r.axis2Local = quatRotate(quatConj(p2.q), axis);
      const q = quatFromTo([1, 0, 0], axis);
      r.joint = P.PrismaticJointCreate(phys, a2, localFrame(h, b2, at, q), a1, localFrame(h, b1, at, q));
      const lo = num(j, 'minSeparation', 0), hi = num(j, 'maxSeparation', 1);
      if (lo <= hi) {
        const lim = new P.PxJointLinearLimitPair(lo, hi, new P.PxSpring(0, 0));
        lim.restitution = num(j, 'stopBounce', 0);
        r.joint.setLimit(lim);
        r.joint.setPrismaticJointFlag(P.PxPrismaticJointFlagEnum.eLIMIT_ENABLED, true);
      } else h.note(j.def, j.type, 'minSeparation', 'interpreted', 'minSeparation > maxSeparation: no stops');
      r.params.sliderForce = num(j, 'sliderForce', 0);
      break;
    }
    case 'DoubleAxisHingeJoint': {
      // ODE hinge2 (a steered wheel): axis1 on body1 (steering), axis2 on body2 (axle). D6: x = axle (twist), y = steering (swing1), swing2 locked.
      setAnchors(anchor);
      const ax1 = norm(vec(j, 'axis1', [0, 1, 0])), ax2 = norm(vec(j, 'axis2', [1, 0, 0]));
      r.axis1Local = quatRotate(quatConj(p1.q), ax1); r.axis2Local = quatRotate(quatConj(p2.q), ax2);
      const q = frameXY(ax2, ax1);
      const d6 = P.D6JointCreate(phys, a1, localFrame(h, b1, anchor, q), a2, localFrame(h, b2, anchor, q));
      const M = P.PxD6MotionEnum, A = P.PxD6AxisEnum;
      d6.setMotion(A.eTWIST, M.eFREE);
      d6.setMotion(A.eSWING2, M.eLOCKED);
      const lo = num(j, 'minAngle1', -Math.PI), hi = num(j, 'maxAngle1', Math.PI);
      if (lo <= hi && (lo > -Math.PI + 1e-6 || hi < Math.PI - 1e-6)) {
        d6.setMotion(A.eSWING1, M.eLIMITED);
        const lim = new P.PxJointLimitPyramid(Math.max(lo, -Math.PI + 1e-3), Math.min(hi, Math.PI - 1e-3), -0.01, 0.01);
        lim.restitution = num(j, 'stop1Bounce', 0);
        d6.setPyramidSwingLimit(lim);
      } else d6.setMotion(A.eSWING1, M.eFREE);
      d6.setAngularDriveConfig(P.PxD6AngularDriveConfigEnum.eSWING_TWIST);
      r.joint = d6;
      r.params.desiredAngularVelocity1 = num(j, 'desiredAngularVelocity1', 0);
      r.params.desiredAngularVelocity2 = num(j, 'desiredAngularVelocity2', 0);
      r.params.maxTorque1 = num(j, 'maxTorque1', 0);
      r.params.maxTorque2 = num(j, 'maxTorque2', 0);
      applyHinge2Drives(h, r);
      if (num(j, 'suspensionForce', 0) !== 0 || num(j, 'suspensionErrorCorrection', 0.8) !== 0.8)
        h.note(j.def, j.type, 'suspensionForce', 'approximated', 'suspension along axis1 is rigid in PhysX (linear axes locked)');
      h.note(j.def, j.type, 'type', 'approximated', 'ODE hinge2 as a PhysX D6 joint: axle = twist (free, velocity drive), steering = swing1 (free or limited), swing2 and translation locked');
      break;
    }
    case 'UniversalJoint': {
      setAnchors(anchor);
      const ax1 = norm(vec(j, 'axis1', [1, 0, 0])), ax2 = norm(vec(j, 'axis2', [0, 1, 0]));
      r.axis1Local = quatRotate(quatConj(p1.q), ax1); r.axis2Local = quatRotate(quatConj(p2.q), ax2);
      // D6: y = axis1, z = axis2 (orthogonalised), x = y × z locked (twist).
      const z = norm(sub(ax2, scale(ax1, dot(ax2, ax1))));
      const q = frameXY(cross(ax1, z), ax1);
      const d6 = P.D6JointCreate(phys, a1, localFrame(h, b1, anchor, q), a2, localFrame(h, b2, anchor, q));
      const M = P.PxD6MotionEnum, A = P.PxD6AxisEnum;
      d6.setMotion(A.eTWIST, M.eLOCKED); d6.setMotion(A.eSWING1, M.eFREE); d6.setMotion(A.eSWING2, M.eFREE);
      r.joint = d6;
      h.note(j.def, j.type, 'type', 'approximated', 'PhysX D6 with twist about axis1×axis2 locked: a constant-velocity joint, not a Hooke joint (they differ at large angles)');
      break;
    }
    case 'MotorJoint': {
      // ODE AMotor: no constraint, only torques about up to three axes (+τ on body1, −τ on body2); X3D 4.0 gives no stop angles.
      const n = Math.max(0, Math.min(3, Math.round(num(j, 'enabledAxes', 1))));
      for (let k = 1; k <= 3; k++) r.motorAxes.push(quatRotate(quatConj(p2.q), norm(vec(j, `motor${k}Axis`, k === 1 ? [1, 0, 0] : k === 2 ? [0, 1, 0] : [0, 0, 1]))));
      r.relRot0 = quatMul(quatConj(p2.q), p1.q);
      r.params.enabledAxes = n;
      r.params.autoCalc = j.fields.autoCalc === false ? 0 : 1;
      for (let k = 1; k <= 3; k++) { r.params[`axis${k}Torque`] = num(j, `axis${k}Torque`, 0); r.params[`axis${k}Angle`] = num(j, `axis${k}Angle`, 0); }
      setAnchors(b1 >= 0 ? p1.p : p2.p);
      break;
    }
  }
  if (r.joint) r.joint.setName(j.def);
  return r;
}

function applyHinge2Drives(h: JointHost, r: JointRec) {
  const P = h.P, d6 = r.joint;
  const D = P.PxD6DriveEnum;
  // Measured: PxD6JointDrive.forceLimit behaves as an impulse per step in this build (no eDRIVE_LIMITS_ARE_FORCES flag), so X3D's maxTorque (N·m) is passed as maxTorque·h.
  const drive = (maxTorque: number) => new P.PxD6JointDrive(0, maxTorque > 0 ? 1e9 : 0, Math.max(0, maxTorque) * h.h, false);
  d6.setDrive(D.eTWIST, drive(r.params.maxTorque2));
  d6.setDrive(D.eSWING1, drive(r.params.maxTorque1));
  // PhysX's D6 drive velocity is actor0 relative to actor1 (measured: +5 gave the axle −5 rad/s), so negate to drive body2 relative to body1.
  d6.setDriveVelocity(new P.PxVec3(0, 0, 0), new P.PxVec3(-r.params.desiredAngularVelocity2, -r.params.desiredAngularVelocity1, 0));
}

/** Runtime change of an input field (set_field command). Returns false if the field is not live-editable. */
export function setJointParam(h: JointHost, r: JointRec, field: string, value: number): boolean {
  if (!(field in r.params)) return false;
  r.params[field] = value;
  if (r.model.type === 'DoubleAxisHingeJoint') applyHinge2Drives(h, r);
  return true;
}

/** Forces and torques the joint applies itself (MotorJoint torques, SliderJoint force), before each step. */
export function applyJointForces(h: JointHost, r: JointRec) {
  const b1 = r.model.body1, b2 = r.model.body2;
  if (r.model.type === 'MotorJoint') {
    const q2 = h.pose(b2).q;
    let t: Vec3 = [0, 0, 0];
    for (let k = 0; k < r.params.enabledAxes; k++) t = add(t, scale(quatRotate(q2, r.motorAxes[k]), r.params[`axis${k + 1}Torque`]));
    if (t[0] || t[1] || t[2]) { h.addTorque(b1, t); h.addTorque(b2, scale(t, -1)); }
  } else if (r.model.type === 'SliderJoint' && r.params.sliderForce) {
    const a = quatRotate(h.pose(b2).q, r.axis2Local);
    const f = scale(a, r.params.sliderForce);
    h.addForce(b1, f); h.addForce(b2, scale(f, -1));
  }
}

/** Fill JOINT_STRIDE output values for one joint. */
export function readJoint(h: JointHost, r: JointRec, out: Float64Array, o: number) {
  const j = r.model, b1 = j.body1, b2 = j.body2;
  const P1 = h.pose(b1), P2 = h.pose(b2);
  out.fill(0, o, o + JOINT_STRIDE);
  out.set(toWorld(P1, r.anchor1), o + 8); out.set(toWorld(P2, r.anchor2), o + 11);
  const ax1 = quatRotate(P1.q, r.axis1Local), ax2 = quatRotate(P2.q, r.axis2Local);
  out.set(ax1, o + 14); out.set(ax2, o + 17);
  const w1 = h.angVel(b1), w2 = h.angVel(b2);
  switch (j.type) {
    case 'SingleAxisHingeJoint': out[o] = r.joint.getAngle(); out[o + 1] = r.joint.getVelocity(); break;
    case 'SliderJoint': out[o + 6] = r.joint.getPosition(); out[o + 7] = r.joint.getVelocity(); break;
    case 'DoubleAxisHingeJoint':
      out[o] = r.joint.getSwingYAngle(); out[o + 1] = dot(ax1, sub(w2, w1));
      out[o + 2] = r.joint.getTwistAngle(); out[o + 3] = dot(ax2, sub(w2, w1));
      break;
    case 'MotorJoint': {
      // angle of body1 relative to body2 about each motor axis (twist decomposition), 0 at load; rate = axis · (ω1 − ω2)
      const rel = quatMul(quatConj(P2.q), P1.q), d = quatMul(rel, quatConj(r.relRot0));
      for (let k = 0; k < 3; k++) {
        const a = r.motorAxes[k];
        if (r.params.autoCalc) {
          out[o + 2 * k] = wrap(2 * Math.atan2(d[0] * a[0] + d[1] * a[1] + d[2] * a[2], d[3]));
          out[o + 2 * k + 1] = dot(quatRotate(P2.q, a), sub(w1, w2));
        } else out[o + 2 * k] = r.params[`axis${k + 1}Angle`];
      }
      break;
    }
  }
}

/** Which X3D output fields a joint type has, with their slot in the output record and arity. */
export const JOINT_OUTPUTS: Record<string, [string, number, number][]> = {
  BallJoint: [['body1AnchorPoint', 8, 3], ['body2AnchorPoint', 11, 3]],
  SingleAxisHingeJoint: [['angle', 0, 1], ['angleRate', 1, 1], ['body1AnchorPoint', 8, 3], ['body2AnchorPoint', 11, 3]],
  SliderJoint: [['separation', 6, 1], ['separationRate', 7, 1]],
  DoubleAxisHingeJoint: [['hinge1Angle', 0, 1], ['hinge1AngleRate', 1, 1], ['hinge2Angle', 2, 1], ['hinge2AngleRate', 3, 1], ['body1AnchorPoint', 8, 3], ['body2AnchorPoint', 11, 3], ['body1Axis', 14, 3], ['body2Axis', 17, 3]],
  UniversalJoint: [['body1AnchorPoint', 8, 3], ['body2AnchorPoint', 11, 3], ['body1Axis', 14, 3], ['body2Axis', 17, 3]],
  MotorJoint: [['motor1Angle', 0, 1], ['motor1AngleRate', 1, 1], ['motor2Angle', 2, 1], ['motor2AngleRate', 3, 1], ['motor3Angle', 4, 1], ['motor3AngleRate', 5, 1]],
};

/** Input fields the bridge forwards while running (set_field). */
export const LIVE_JOINT_FIELDS: Record<string, string[]> = {
  SliderJoint: ['sliderForce'],
  DoubleAxisHingeJoint: ['desiredAngularVelocity1', 'desiredAngularVelocity2', 'maxTorque1', 'maxTorque2'],
  MotorJoint: ['axis1Torque', 'axis2Torque', 'axis3Torque', 'axis1Angle', 'axis2Angle', 'axis3Angle', 'enabledAxes'],
};
