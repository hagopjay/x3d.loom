# Phase 2 evidence: joints and sensors (2026-11-12)

All numbers **measured** on this Mac unless marked. Browsers: Chromium 145.0.7632.6, Firefox 146.0.1, WebKit 26.0 (Playwright 1.58.2, real WebGL).

| file | what |
|---|---|
| `p2-outputs-probe-{chromium,firefox,webkit}.json` | can SAI write outputOnly fields? how to stop X_ITE's CollisionSensor (`probes/outputs.html`) |
| `p2-joints.json` | joint, contact and kinematic unit tests (`npm test`, `tests/joints.test.ts`) |
| `p2-joints-{chromium,firefox,webkit}.json` + `*-t0/mid/end.png` | `scenes/joints-and-sensors.x3d` on PhysX (bridge) and Bullet (X_ITE), every output observed through SAI (`probes/run-joints.mjs`) |
| `p2-loss-ode-only-fields-chromium.json` | loss report of `scenes/experiments/ode-only-fields.x3d` (11 authored ODE-only fields) |

## Results

1. **Writing X3D outputs.** SAI refuses assignments to outputOnly fields; `getField(name).setValue(v)` emits them and ROUTEs fire (three browsers). X_ITE 16.7 prints a deprecation warning for `getField`; a fallback to X_ITE's internal field is in place.
2. **Taking over X_ITE's engine.** Besides `RigidBodyCollection.enabled`: X_ITE's CollisionSensor resets `isActive` every frame unless `enabled = FALSE` is followed by a `collider` re-assignment; X_ITE's joints write their own outputs unless `forceOutput` is NONE. Both handled; authored values kept by the bridge.
3. **Joints** (unit tests, 18/18 with phase 1): hinge limit holds (stops at −0.300, output equals geometry within 1e-3 rad); slider stops at −0.200 (y 0.800); sliderForce 2 N on 0.5 kg gives 2.000 m/s after 0.5 s; MotorJoint τ/I within 1 % and back to rest after reversal; hinge2 axle spin-up 0.20833 rad/s per step (= maxTorque·h/I) and 5.000 rad/s held, under PGS and TGS; ball and universal anchors coincide (≤ 4e-7 m); universal joint: D6 twist 0, Hooke deviation 0.18 rad/s at large angles (declared approximation).
4. **Two PhysX surprises, corrected in the mapping**: the D6 drive velocity sign (actor0 relative to actor1) and `forceLimit` acting as an impulse per step.
5. **Contacts**: impact impulse m(1+e)(v+g·h) within 0.5 % (PGS 0.01275 vs 0.01275, TGS 0.01296 vs 0.01302 N·s); 3 impacts for a ball coming to rest under both solvers. PhysX's threshold-force reports never fire under TGS and touch-found reports carry no impulse, so the bridge detects impacts itself.
6. **The bench in three browsers**: every joint output arrives as an X3D event (e.g. 299 `motor1Angle` events in 5 s); seesaw stops at its 0.3 rad limit; the flipper (MotorJoint torque reversed through set_field) rises to its 0.8 rad limit and throws its marble to 0.25 m; the paddle wheel holds −2.000 rad/s; the launcher stops at 0.080 m and throws its marble to 0.36–0.38 m; `CollisionSensor.isActive` switches the lamp by ROUTE; Contact nodes carry bodies, geometries and the collection's surface fields. PhysX costs 0.15–0.6 ms per step for 18 bodies and 6 joints with contact reports (Chromium; Firefox and WebKit worker clocks have 1 ms resolution).
7. **Bullet on the same file**: the UniversalJoint rod falls to the floor (not implemented in X_ITE), the flipper hangs (no MotorJoint), the launcher never fires (sliderForce ignored), the paddle wheel snaps flat (single-hinge DoubleAxisHinge).
8. **Kinematic elevator**: in PhysX the cube rests 0.0260–0.0274 m above the platform centre (0.026 nominal) through two cycles in all three browsers, after three measured fixes (clocks restarted at load and held at phase 0; a target per physics step sampled from the X3D trajectory; catching up instead of dropping time). The X3D platform leads the PhysX platform by 5–16 mm while physics catches up after a stall.
9. **Loss report**: `ode-only-fields.x3d` lists all 11 authored fields PhysX cannot honour (errorCorrection, constantForceMix, stopErrorCorrection, per-body disableTime, useFiniteRotation, surfaceSpeed, slipFactors, both softness fields, CollisionSpace collidables and useGeometry) plus build notes for SLIP-1 and ERROR_REDUCTION; the bench and marble scenes list none. A phase-1 bug was found on the way: the scene walk skipped initializeOnly fields (it treated 1 as inputOnly), which hid `RigidBodyCollection.collider` from the report.

## Limits

- One run per browser per configuration for most numbers; the elevator was run 5–8 times while fixing it, the final version 3 times (one per browser).
- The Bullet side has no observable simulation time; it is compared at wall time.
- Slow motion with clocks following physics is not handled yet (the X3D clocks would still run at full speed).
