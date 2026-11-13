// SPEC section 7: analytic tests of the PhysX world (no X3D, no browser). Measured numbers go to evidence/p1-analytic.json.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { physx } from './physx-node.ts';
import { PhysXWorld } from '../src/bridge/world.ts';
import { BODY_STRIDE } from '../src/bridge/model.ts';
import type { JointModel, Quat } from '../src/bridge/model.ts';
import { axisAngleToQuat } from '../src/bridge/math.ts';
import { body, box, scene, sphere, surface } from './fixtures.ts';

const results: Record<string, unknown> = {};
after(() => writeFileSync(new URL('../evidence/p1-analytic.json', import.meta.url), JSON.stringify({ measured: new Date().toISOString(), results }, null, 1) + '\n'));

const g = 9.81, h = 1 / 240;
const state = (w: PhysXWorld) => w.readState(new Float64Array(w.bodyCount * BODY_STRIDE));

test('free fall: PhysX integrates semi-implicit Euler exactly; continuum error is ½·g·h·t', async () => {
  const ctx = await physx();
  const w = new PhysXWorld(ctx, scene([body(sphere(0.01), { p: [0, 10, 0], mass: 0.005 })], {}, h), { contacts: 'none' });
  w.step(240);
  const s = state(w), y = s[1], vy = s[8], n = 240, t = n * h;
  const discrete = 10 - g * h * h * n * (n + 1) / 2, continuum = 10 - 0.5 * g * t * t;
  results.freeFall = { t, y, vy, discrete, continuum, errVsDiscrete: y - discrete, errVsContinuum: y - continuum, predictedContinuumErr: -0.5 * g * h * t, errV: vy + g * t };
  assert.ok(Math.abs(y - discrete) < 1e-4, `vs discrete ${y - discrete}`);
  assert.ok(Math.abs(vy + g * t) < 1e-4, `velocity ${vy}`);
  assert.ok(Math.abs((y - continuum) - (-0.5 * g * h * t)) < 1e-4, 'continuum error is the integrator\'s ½·g·h·t');
  w.release();
});

function pendulumPeriod(w: PhysXWorld, bob: number, seconds: number) {
  const crossings: number[] = [];
  let prev = state(w)[bob * BODY_STRIDE];
  for (let k = 0; k < seconds / h; k++) {
    w.step(1);
    const x = state(w)[bob * BODY_STRIDE];
    if (prev < 0 && x >= 0) crossings.push((w.stepCount - 1 + (-prev) / (x - prev)) * h); // linear interpolation of the upward crossing
    prev = x;
  }
  const periods = crossings.slice(1).map((c, i) => c - crossings[i]);
  return { T: (crossings[crossings.length - 1] - crossings[0]) / (crossings.length - 1), n: periods.length, spread: Math.max(...periods) - Math.min(...periods) };
}

for (const type of ['BallJoint', 'SingleAxisHingeJoint'] as const) {
  test(`pendulum period (${type}): T = 2π√(I/(m g L)) within 0.5 %`, async () => {
    const ctx = await physx();
    const L = 0.5, r = 0.01, th0 = 0.05, m = 1;
    const anchor = body(box(0.02, 0.02, 0.02), { p: [0, 1, 0], fixed: true });
    const bob = body(sphere(r), { p: [-L * Math.sin(th0), 1 - L * Math.cos(th0), 0], mass: m });
    const j: JointModel = { index: 0, type, def: 'J', body1: 0, body2: 1, forceOutput: ['NONE'], fields: { anchorPoint: [0, 1, 0], axis: [0, 0, 1] } };
    const model = scene([anchor, bob], {}, h, [j]);
    const w = new PhysXWorld(ctx, model, { contacts: 'none' });
    const { T, n, spread } = pendulumPeriod(w, 1, 12);
    // physical pendulum: I about the pivot = m L² + 2/5 m r²; finite amplitude factor 1 + θ0²/16
    const expected = 2 * Math.PI * Math.sqrt((L * L + 0.4 * r * r) / (g * L)) * (1 + th0 * th0 / 16);
    const relErr = (T - expected) / expected;
    results[`pendulum_${type}`] = { L, r, theta0: th0, T, expected, relErr, periods: n, spread };
    assert.ok(Math.abs(relErr) < 0.005, `relErr ${relErr}`);
    w.release();
  });
}

test('restitution: rebound speed = e × (impact speed + g·h); apex ratio ≈ e² only for fast bounces; bodies come to rest', async () => {
  const ctx = await physx();
  const e = 0.6, h0 = 0.5, r = 0.01;
  const floor = body(box(1, 0.1, 1), { p: [0, -0.05, 0], fixed: true });
  const ball = body(sphere(r), { p: [0, h0 + r, 0], mass: 0.01 });
  const w = new PhysXWorld(ctx, scene([floor, ball], { surface: surface({ bounce: e, minBounceSpeed: 0.01, frictionCoefficients: [0, 0] }) }, h), { contacts: 'none' });
  const apex: number[] = [], bounces: { vIn: number; vOut: number; ratio: number; ratioWithGh: number }[] = [];
  const s = new Float64Array(2 * BODY_STRIDE);
  let prevVy = 0;
  for (let k = 0; k < 3 / h; k++) {
    w.readState(s); const v0 = s[BODY_STRIDE + 8];
    w.step(1); w.readState(s); const vy = s[BODY_STRIDE + 8];
    if (v0 < -0.05 && vy > 0) bounces.push({ vIn: v0, vOut: vy, ratio: -vy / v0, ratioWithGh: -vy / (v0 - g * h) });
    if (prevVy > 0 && vy <= 0 && vy > -0.05) apex.push(s[BODY_STRIDE + 1] - r);
    prevVy = vy;
  }
  const ratios = [apex[0] / h0, ...apex.slice(1, 5).map((a, i) => a / apex[i])];
  const rest = s[BODY_STRIDE + 1] - r;
  results.restitution = { e, h0, step: h, bounceThreshold: w.bounceThreshold, authoredMinBounceSpeed: 0.01, bounces: bounces.slice(0, 6), apexRatios: ratios, expectedApexRatio: e * e, finalHeight: rest, finalVy: s[BODY_STRIDE + 8],
    explanation: 'PhysX applies restitution to the pre-solver velocity, which already includes this step\'s g·h; the apex ratio exceeds e² by about 2gh/v_impact' };
  for (const b of bounces.slice(0, 5)) assert.ok(Math.abs(b.ratioWithGh - e) < 1e-3, `rebound ${b.ratioWithGh} vs e=${e}`);
  assert.ok(Math.abs(ratios[0] - e * e) / (e * e) < 0.05, `first apex ratio ${ratios[0]} vs ${e * e}`);
  assert.ok(Math.abs(rest) < 1e-4 && Math.abs(s[BODY_STRIDE + 8]) < 1e-3, `comes to rest (y ${rest}, vy ${s[BODY_STRIDE + 8]})`);
  w.release();
});

for (const [mu, label] of [[0.3, 'slides'], [0.7, 'holds']] as const) {
  test(`incline 30° with μ=${mu}: ${label}, a = g(sin θ − μ cos θ)`, async () => {
    const ctx = await physx();
    const th = Math.PI / 6, q: Quat = axisAngleToQuat(0, 0, 1, th);
    // incline: a 2 m slab tilted 30° about z (down-slope direction is -x along the slab)
    const slab = body(box(2, 0.1, 0.5), { p: [0, 0, 0], q, fixed: true });
    const n: [number, number] = [-Math.sin(th), Math.cos(th)];
    const blk = body(box(0.1, 0.1, 0.1), { p: [0.5 * Math.cos(th) + n[0] * 0.1, 0.5 * Math.sin(th) + n[1] * 0.1, 0], q, mass: 1 });
    const w = new PhysXWorld(ctx, scene([slab, blk], { surface: surface({ frictionCoefficients: [mu, mu], bounce: 0 }) }, h), { contacts: 'none' });
    w.step(Math.round(0.1 / h)); // settle onto the slope
    const along = (s: Float64Array) => -(s[BODY_STRIDE] * Math.cos(th) + s[BODY_STRIDE + 1] * Math.sin(th)); // distance down-slope
    const s0 = state(w), x0 = along(s0), v0 = -(s0[BODY_STRIDE + 7] * Math.cos(th) + s0[BODY_STRIDE + 8] * Math.sin(th));
    const T = 0.4; w.step(Math.round(T / h));
    const s1 = state(w), x1 = along(s1);
    const aMeasured = 2 * (x1 - x0 - v0 * T) / (T * T);
    const aExpected = Math.max(0, g * (Math.sin(th) - mu * Math.cos(th)));
    results[`incline_mu${mu}`] = { thetaDeg: 30, mu, aMeasured, aExpected, travelled: x1 - x0 };
    if (aExpected > 0) assert.ok(Math.abs(aMeasured - aExpected) / aExpected < 0.02, `a ${aMeasured} vs ${aExpected}`);
    else assert.ok(Math.abs(x1 - x0) < 1e-3, `should hold, moved ${x1 - x0}`);
    w.release();
  });
}

test('tunnelling: a marble at 5 m/s passes a 5 mm wall without CCD (control), never with CCD', async () => {
  const ctx = await physx();
  const N = 40, out: Record<string, number> = {};
  for (const ccd of [false, true]) {
    let tunnelled = 0;
    for (let k = 0; k < N; k++) {
      const wall = body(box(0.005, 0.2, 0.2), { p: [0.5, 0, 0], fixed: true });
      const marble = body(sphere(0.008), { p: [-5 * h * k / N, 0, 0], mass: 0.005, linearVelocity: [5, 0, 0] });
      const w = new PhysXWorld(ctx, scene([wall, marble], { gravity: [0, 0, 0], preferAccuracy: ccd }, h), { contacts: 'none' });
      w.step(Math.ceil(0.6 / 5 / h) + 10);
      if (state(w)[BODY_STRIDE] > 0.5) tunnelled++;
      w.release();
    }
    out[ccd ? 'withCCD' : 'withoutCCD'] = tunnelled;
  }
  results.tunnelling = { speed: 5, step: h, wall: 0.005, marbleRadius: 0.008, startPhases: N, tunnelled: out, note: 'contact offsets as the bridge sizes them (25 % of the smallest dimension)' };
  assert.equal(out.withCCD, 0);
  assert.ok(out.withoutCCD > 0, 'control must tunnel at least once, or the test proves nothing');
});

test('determinism: the same model stepped twice gives identical per-step state hashes', async () => {
  const ctx = await physx();
  const make = () => {
    const bodies = [body(box(1, 0.1, 1), { p: [0, -0.05, 0], fixed: true })];
    for (let i = 0; i < 20; i++) bodies.push(body(sphere(0.01), { p: [(i % 5) * 0.025 - 0.05, 0.05 + Math.floor(i / 5) * 0.025, (i % 3) * 0.01], mass: 0.005 }));
    return new PhysXWorld(ctx, scene(bodies, { preferAccuracy: true, surface: surface({ bounce: 0.3 }) }, h), { contacts: 'found' });
  };
  const a: number[] = [], b: number[] = [];
  const w1 = make(); w1.step(480, a); w1.release();
  const w2 = make(); w2.step(480, b); w2.release();
  const firstDiff = a.findIndex((x, i) => x !== b[i]);
  results.determinismSameProcess = { steps: a.length, identical: firstDiff < 0, firstDiff, lastHash: a[a.length - 1].toString(16) };
  assert.equal(firstDiff, -1);
});
