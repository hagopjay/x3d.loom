// SPEC section 7 "joints" (+ contacts, kinematic bodies, set_field): the PhysX world alone. Measured numbers -> evidence/p2-joints.json.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { physx } from './physx-node.ts';
import { PhysXWorld } from '../src/bridge/world.ts';
import { BODY_STRIDE, CONTACT_STRIDE } from '../src/bridge/model.ts';
import { JOINT_STRIDE } from '../src/bridge/joints.ts';
import { body, box, joint, scene, sphere, surface } from './fixtures.ts';

const results: Record<string, unknown> = {};
after(() => writeFileSync(new URL('../evidence/p2-joints.json', import.meta.url), JSON.stringify({ measured: new Date().toISOString(), results }, null, 1) + '\n'));
const h = 1 / 240;
const st = (w: PhysXWorld) => w.readState(new Float64Array(w.bodyCount * BODY_STRIDE));
const J = (w: PhysXWorld, k = 0) => w.readJoints().subarray(k * JOINT_STRIDE, (k + 1) * JOINT_STRIDE);
const noG = { gravity: [0, 0, 0] as [number, number, number] };

test('SingleAxisHingeJoint: limits hold; angle output = body1 relative to body2 about the axis', async () => {
  const ctx = await physx();
  const frame = body(box(0.02, 0.02, 0.02), { p: [0, 1, 0], fixed: true });
  const bob = body(sphere(0.02), { p: [0.5, 1, 0], mass: 1 });
  const w = new PhysXWorld(ctx, scene([bob, frame], {}, h, [joint('SingleAxisHingeJoint', 0, 1, { anchorPoint: [0, 1, 0], axis: [0, 0, 1], minAngle: -0.3, maxAngle: 0.3, stopBounce: 0 })]), { contacts: 'none' });
  let minAngle = 0, maxErr = 0;
  for (let k = 0; k < 480; k++) {
    w.step(1);
    const s = st(w), a = J(w)[0];
    minAngle = Math.min(minAngle, a);
    const geom = Math.atan2(s[1] - 1, s[0]); // bob's angle about +z from +x
    maxErr = Math.max(maxErr, Math.abs(geom - a));
  }
  const final = J(w)[0];
  results.hingeLimit = { limit: [-0.3, 0.3], minAngle, final, maxAbsDiffOutputVsGeometry: maxErr };
  assert.ok(minAngle > -0.3 - 0.02, `overshoot ${minAngle}`);
  assert.ok(Math.abs(final + 0.3) < 0.01, `rests on the limit: ${final}`);
  assert.ok(maxErr < 1e-3, `angle output vs geometry ${maxErr}`);
  w.release();
});

test('SliderJoint: limits hold; separation output; sliderForce gives a = F/m', async () => {
  const ctx = await physx();
  { // vertical slider under gravity, stops at minSeparation
    const frame = body(box(0.02, 0.02, 0.02), { p: [0, 1, 0], fixed: true });
    const blk = body(box(0.05, 0.05, 0.05), { p: [0, 1, 0], mass: 1 });
    const w = new PhysXWorld(ctx, scene([blk, frame], {}, h, [joint('SliderJoint', 0, 1, { axis: [0, 1, 0], minSeparation: -0.2, maxSeparation: 0.1 })]), { contacts: 'none' });
    let minSep = 0;
    for (let k = 0; k < 480; k++) { w.step(1); minSep = Math.min(minSep, J(w)[6]); }
    const s = st(w), sep = J(w)[6];
    results.sliderLimit = { limit: [-0.2, 0.1], minSeparation: minSep, final: sep, blockY: s[1], expectedY: 0.8 };
    assert.ok(minSep > -0.2 - 0.005, `overshoot ${minSep}`);
    assert.ok(Math.abs(sep + 0.2) < 0.002 && Math.abs(s[1] - 0.8) < 0.002, `rests at the stop: ${sep}, y ${s[1]}`);
    w.release();
  }
  { // horizontal slider, no stops, sliderForce 2 N on 0.5 kg, no gravity
    const frame = body(box(0.02, 0.02, 0.02), { p: [0, 0, 0], fixed: true });
    const blk = body(box(0.05, 0.05, 0.05), { p: [0, 0, 0], mass: 0.5 });
    const w = new PhysXWorld(ctx, scene([blk, frame], noG, h, [joint('SliderJoint', 0, 1, { axis: [1, 0, 0], minSeparation: 1, maxSeparation: 0, sliderForce: 2 })]), { contacts: 'none' });
    w.step(120);
    const out = J(w), T = 0.5;
    results.sliderForce = { F: 2, m: 0.5, T, separation: out[6], separationRate: out[7], expectedRate: 4 * T, expectedSeparationContinuum: 0.5 * 4 * T * T };
    assert.ok(Math.abs(out[7] - 4 * T) / (4 * T) < 0.01, `rate ${out[7]}`);
    assert.ok(Math.abs(out[6] - 0.5 * 4 * T * T) < 0.01, `separation ${out[6]}`);
    w.release();
  }
});

test('MotorJoint: axis torque τ spins a wheel at α = τ/I; outputs agree with the hinge; set_field changes τ at runtime', async () => {
  const ctx = await physx();
  const r = 0.05, m = 2, I = 0.4 * m * r * r, tau = 0.01;
  const frame = body(box(0.02, 0.02, 0.02), { p: [0, 0, 0], fixed: true });
  const wheel = body(sphere(r), { p: [0, 0, 0], mass: m });
  const joints = [
    joint('SingleAxisHingeJoint', 0, 1, { anchorPoint: [0, 0, 0], axis: [0, 0, 1] }),
    joint('MotorJoint', 0, 1, { enabledAxes: 1, motor1Axis: [0, 0, 1], axis1Torque: tau, autoCalc: true }),
  ];
  const w = new PhysXWorld(ctx, scene([wheel, frame], noG, h, joints), { contacts: 'none' });
  const T = 0.5; w.step(Math.round(T / h));
  const hinge = J(w, 0), motor = J(w, 1), alpha = tau / I;
  results.motor = { I, tau, T, expectedRate: alpha * T, hingeAngleRate: hinge[1], motor1AngleRate: motor[1], hingeAngle: hinge[0], motor1Angle: motor[0], expectedAngleContinuum: 0.5 * alpha * T * T };
  assert.ok(Math.abs(motor[1] - alpha * T) / (alpha * T) < 0.01, `rate ${motor[1]} vs ${alpha * T}`);
  assert.ok(Math.abs(hinge[1] - motor[1]) < 1e-4 && Math.abs(hinge[0] - motor[0]) < 1e-3, 'motor and hinge outputs agree');
  // runtime change: reverse the torque for the same time -> back to rest
  assert.equal(w.setJointField(1, 'axis1Torque', -tau), true);
  w.step(Math.round(T / h));
  const back = J(w, 1)[1];
  (results.motor as Record<string, unknown>).rateAfterReversal = back;
  assert.ok(Math.abs(back) < 1e-3 * alpha * T + 1e-6, `rate after reversal ${back}`);
  w.release();
});

for (const solver of ['PGS', 'TGS'] as const) test(`DoubleAxisHingeJoint (${solver}): the axle motor spins up at maxTorque2/I and holds desiredAngularVelocity2`, async () => {
  const ctx = await physx();
  const chassis = body(box(0.1, 0.02, 0.1), { p: [0, 0, 0], fixed: true });
  const wheel = body(sphere(0.05), { p: [0.1, 0, 0], mass: 1 });
  const target = 5, maxT = 0.05, I = 0.4 * 1 * 0.05 * 0.05;
  const j = joint('DoubleAxisHingeJoint', 0, 1, { anchorPoint: [0.1, 0, 0], axis1: [0, 1, 0], axis2: [1, 0, 0], desiredAngularVelocity2: target, maxTorque2: maxT, minAngle1: 0, maxAngle1: 0 });
  const w = new PhysXWorld(ctx, scene([chassis, wheel], { ...noG, preferAccuracy: solver === 'TGS' }, h, [j]), { contacts: 'none' });
  const tReach = target * I / maxT; // torque-limited spin-up time: 0.1 s
  const rates: number[] = [];
  for (let k = 0; k < 120; k++) { w.step(1); rates.push(J(w)[3]); }
  const atHalf = rates[Math.round(tReach / 2 / h) - 1], expectedHalf = target / 2;
  const rate = rates[rates.length - 1], steer = J(w)[0];
  results[`hinge2Motor_${solver}`] = { target, maxTorque2: maxT, inertia: I, expectedSpinUpTime: tReach, firstStepGain: rates[0], expectedFirstStepGain: maxT * h / I, rateAtHalfSpinUp: atHalf, expectedAtHalf: expectedHalf, finalRate: rate, steeringAngle: steer };
  assert.ok(Math.abs(rates[0] - maxT * h / I) / (maxT * h / I) < 0.02, `first-step gain ${rates[0]} vs ${maxT * h / I}`);
  assert.ok(Math.abs(atHalf - expectedHalf) / expectedHalf < 0.03, `ramp ${atHalf} vs ${expectedHalf}`);
  assert.ok(Math.abs(rate - target) / target < 0.01, `final rate ${rate}`);
  assert.ok(Math.abs(steer) < 0.02, `steering locked by minAngle1 = maxAngle1 = 0: ${steer}`);
  w.release();
});

test('UniversalJoint: rotation about axis1 × axis2 stays locked; BallJoint anchors coincide', async () => {
  const ctx = await physx();
  const base = body(box(0.02, 0.02, 0.02), { p: [0, 0, 0], fixed: true });
  const rod = body(box(0.02, 0.2, 0.02), { p: [0, -0.1, 0], mass: 1, angularVelocity: [2, 0, 1.5] });
  const w = new PhysXWorld(ctx, scene([base, rod], noG, h, [joint('UniversalJoint', 0, 1, { anchorPoint: [0, 0, 0], axis1: [1, 0, 0], axis2: [0, 0, 1] })]), { contacts: 'none' });
  let maxTwist = 0, maxGap = 0, maxD6Twist = 0;
  for (let k = 0; k < 240; k++) {
    w.step(1);
    const out = J(w), s = st(w);
    maxD6Twist = Math.max(maxD6Twist, Math.abs(w.joints[0]!.joint.getTwistAngle()));
    const w2: [number, number, number] = [s[BODY_STRIDE + 10], s[BODY_STRIDE + 11], s[BODY_STRIDE + 12]];
    // locked direction = body1Axis × body2Axis (current)
    const a1 = [out[14], out[15], out[16]], a2 = [out[17], out[18], out[19]];
    const c = [a1[1] * a2[2] - a1[2] * a2[1], a1[2] * a2[0] - a1[0] * a2[2], a1[0] * a2[1] - a1[1] * a2[0]];
    const n = Math.hypot(...c) || 1;
    maxTwist = Math.max(maxTwist, Math.abs((c[0] * w2[0] + c[1] * w2[1] + c[2] * w2[2]) / n));
    maxGap = Math.max(maxGap, Math.hypot(out[8] - out[11], out[9] - out[12], out[10] - out[13]));
  }
  results.universal = { maxD6TwistAngle: maxD6Twist, hookeViolation_maxRateAboutAxis1xAxis2: maxTwist, maxAnchorGap: maxGap,
    note: 'initial spin 2 rad/s about axis1 and 1.5 rad/s about axis2; D6 keeps its swing-twist twist at 0 (a constant-velocity joint); a Hooke joint would keep the rate about axis1×axis2 at 0: the difference is the declared approximation' };
  assert.ok(maxD6Twist < 1e-3, `D6 twist ${maxD6Twist}`);
  assert.ok(maxGap < 1e-3, `anchor gap ${maxGap}`);
  w.release();
  const ball = new PhysXWorld(ctx, scene([body(box(0.02, 0.02, 0.02), { p: [0, 1, 0], fixed: true }), body(sphere(0.02), { p: [0.3, 0.8, 0.1], mass: 1 })], {}, h,
    [joint('BallJoint', 1, 0, { anchorPoint: [0, 1, 0] })]), { contacts: 'none' });
  let gap = 0;
  for (let k = 0; k < 480; k++) { ball.step(1); const o = J(ball); gap = Math.max(gap, Math.hypot(o[8] - o[11], o[9] - o[12], o[10] - o[13])); }
  results.ballJoint = { maxAnchorGap: gap };
  assert.ok(gap < 1e-3, `ball anchor gap ${gap}`);
  ball.release();
});

for (const solver of ['PGS', 'TGS'] as const) test(`contacts (${solver}): one impact event at impact with impulse m(1+e)v; touching contacts after it`, async () => {
  const ctx = await physx();
  const e = 0.3, m = 0.005, h0 = 0.2, r = 0.008;
  const floor = body(box(1, 0.1, 1), { p: [0, -0.05, 0], fixed: true });
  const ball = body(sphere(r), { p: [0, h0 + r, 0], mass: m });
  const w = new PhysXWorld(ctx, scene([floor, ball], { preferAccuracy: solver === 'TGS', surface: surface({ bounce: e, minBounceSpeed: 0.05 }) }, h), { contacts: 'all' });
  const events: number[][] = [];
  // the detector reports an impact once, at its peak step, so the event can arrive a step after the bounce: use the fastest approach seen
  let firstImpactV = 0, minV = 0, touchingAt2s = 0;
  for (let k = 0; k < 480; k++) {
    if (!events.length) minV = Math.min(minV, st(w)[BODY_STRIDE + 8]);
    w.step(1);
    const { current, events: ev } = w.takeContacts();
    for (let o = 0; o < ev.length; o += CONTACT_STRIDE) { events.push(Array.from(ev.subarray(o, o + CONTACT_STRIDE))); if (events.length === 1) firstImpactV = minV; }
    if (k === 479) touchingAt2s = current.length / CONTACT_STRIDE;
  }
  const first = events[0];
  const expectedImpulse = m * (1 + e) * Math.abs(firstImpactV - 9.81 * h);
  results[`contacts_${solver}`] = { impactEvents: events.length, impactImpulses: events.slice(0, 6).map((x) => +x[11].toExponential(3)), first: { bodies: [first[0], first[1]], position: first.slice(4, 7), normal: first.slice(7, 10), depth: first[10], impulse: first[11] }, expectedImpulse, touchingAt2s };
  assert.ok(Math.abs(first[11] - expectedImpulse) / expectedImpulse < 0.03, `impulse ${first[11]} vs ${expectedImpulse}`);
  assert.ok(events.length >= 2 && events.length <= 12, `a few bounces, not one event per resting step: ${events.length}`);
  assert.ok(Math.abs(Math.abs(first[8]) - 1) < 1e-3, 'normal along y');
  assert.ok(touchingAt2s >= 1, 'resting contact reported (CollisionSensor semantics)');
  w.release();
});

test('kinematic body: a ROUTE-driven fixed platform carries a box (targets interpolated across substeps)', async () => {
  const ctx = await physx();
  const plat = body(box(0.4, 0.02, 0.4), { p: [0, 0, 0], fixed: true, kinematic: true });
  const blk = body(box(0.05, 0.05, 0.05), { p: [0, 0.036, 0], mass: 0.2 });
  const w = new PhysXWorld(ctx, scene([plat, blk], { surface: surface({ frictionCoefficients: [0.8, 0.8] }) }, h), { contacts: 'none' });
  w.step(24);
  const v = 0.1; let y = 0, gaps: number[] = [];
  for (let f = 0; f < 60; f++) { // 60 frames of 4 steps, the platform rising at 0.1 m/s and drifting in x at 0.05 m/s
    y += v * 4 * h;
    w.setKinematicTarget(0, [0.05 * (f + 1) * 4 * h, y, 0], [0, 0, 0, 1]);
    w.step(4);
    const s = st(w); gaps.push(s[BODY_STRIDE + 1] - s[1]);
  }
  const s = st(w);
  results.kinematic = { platformY: s[1], expected: y, blockVelocity: [s[BODY_STRIDE + 7], s[BODY_STRIDE + 8]], expectedVelocity: [0.05, v], gapMinMax: [Math.min(...gaps), Math.max(...gaps)] };
  assert.ok(Math.abs(s[1] - y) < 1e-4, 'platform follows the targets');
  assert.ok(Math.abs(s[BODY_STRIDE + 8] - v) < 0.01 && Math.abs(s[BODY_STRIDE + 7] - 0.05) < 0.01, `block rides along: ${s[BODY_STRIDE + 7]}, ${s[BODY_STRIDE + 8]}`);
  w.release();
});
