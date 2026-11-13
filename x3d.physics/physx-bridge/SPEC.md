# X3D ⇄ PhysX bridge and the Marble Machine: specification (draft 1.0, 2026-11-12, after phase 5)

A standard X3D 4.0 scene, authored with the RigidBodyPhysics component, runs on NVIDIA PhysX 5 in the browser. The demo is a marble machine you build, run, race, hear and replay.
Grades: **Measured** (checked here), **Stated** (a source says so, not re-run), **Estimate**, **Conjecture**.

## 0. Decisions (the user's screeners, 2026-11-12)

| question | answer |
|---|---|
| demo | **Marble machine** (a Rube Goldberg marble run) |
| engine | **PhysX 5 in the browser (WASM)**, CPU |
| X3D side | **Standard RigidBodyPhysics nodes** (no custom nodes, no physics metadata) mapped to PhysX, with a loss report |
| relation to the MuJoCo bridge | **Separate bridge**; borrows its ideas (authority split, revisions and acknowledgements, loss reports, provenance) |
| features | **all four**: build mode, PhysX vs Bullet race, contact sound, record and replay |
| look | **both, switchable**: photoreal toy (PhysicalMaterial, image-based light, shadows) and the Loom gold-on-dark style |
| first proof of concept | **the full machine** with every feature |
| home | **its own repository** (created only with the user's go; the demo page links to it) |
| phase-1 interpretations (decided 2026-11-12, after phase 2) | **keep both defaults**: inertia left at the identity is computed from the collision shapes; `minBounceSpeed` below 2·e·g·h/(1−e) is raised and reported in the loss report |

## 1. What the proof of concept must show

1. **Standard X3D is enough to author real rigid-body physics**: one `.x3d` file using only X3D 4.0 RigidBodyPhysics nodes drives PhysX, and the same file still runs unmodified in plain X_ITE on its built-in engine.
2. **The engine is swappable under a standard scene**: PhysX and Bullet run the same file side by side, and their disagreements become visible (the ghost marble) and measurable (trajectory divergence).
3. **The mapping is honest**: every X3D field is mapped, approximated or reported as lost, per scene, in a machine-readable loss report.
4. **It is fun**: building and running a marble machine, with sound, is a toy people want to play with.
5. **Runs are reproducible**: a recorded run replays exactly. **Measured in phase 4**: bit-for-bit identical (every step's state hash) across Chromium, Firefox, WebKit and Node on this Mac; across machines still open (the saved run files are the experiment).

## 2. Facts checked so far

| fact | grade |
|---|---|
| X_ITE 16.7.0 ships a RigidBodyPhysics component built on **ammo.js (Bullet)**, registering all 14 nodes (BallJoint, CollidableOffset, CollidableShape, CollisionCollection, CollisionSensor, CollisionSpace, Contact, DoubleAxisHingeJoint, MotorJoint, RigidBody, RigidBodyCollection, SingleAxisHingeJoint, SliderJoint, UniversalJoint); RigidBodyCollection has an `enabled` switch with a handler | Measured (read in the component file) |
| X_ITE is MIT-licensed | Measured (package licence file) |
| `physx-js-webidl` 2.9.1: MIT JavaScript/WASM bindings for **NVIDIA PhysX 5.12.0**, published 24 Oct 2026, ~10 MB unpacked (fabmax/physx-js-webidl) | Measured (npm registry metadata; not downloaded) |
| PhysX itself is open source under BSD-3-Clause | Stated (NVIDIA); to confirm in the package's notices |
| PhysX GPU features (PBD particles, FEM soft bodies, GPU rigid bodies) need CUDA and are **not** available in WASM | Stated; the demo uses CPU rigid bodies only |
| `scenes/marble-minimal.x3d` (marble, ramp, cup, standard RigidBodyPhysics) validates with the user's x3d_mcp fork: XSD valid, 0 errors, 0 warnings (after it caught a missing `Shape` component declaration for PhysicalMaterial) | Measured |
| The same file **runs on X_ITE 16.7.0's built-in Bullet**: the marble rolled down the ramp (x from −0.25 to 0.45 m in about 1.2 s), launched and flew past the cup (the scaffold has no floor; a geometry issue, not physics) | Measured (one run, Chromium on this Mac) |
| Field names of all 14 nodes checked against the official X3D 4.0 Unified Object Model | Measured |
| **`RigidBodyCollection.enabled = FALSE` stops X_ITE 16.7's Bullet**: 0 position events in 120 frames, bridge writes stick, re-enabling resumes from the written pose (Chromium 145, Firefox 146, WebKit 26). **But `loadURL()` resolves after Bullet has already stepped once** (y 0.32 → 0.319974–0.319989). Loading with `createX3DFromURL` → disable → `replaceWorld` leaks no step (y stays 0.32 for 120 frames, all three browsers). The bridge loads that way | Measured (`evidence/p1-enabled-probe-*.json`) |
| X_ITE's Bullet steps once per frame with **dt = 15-frame moving average of 1/frame-rate, starting from 0**; with `preferAccuracy` it splits each frame into `iterations` substeps. Its results therefore depend on the frame rate (WebKit headless ran twice as many frames and the marble ended 3.8 m lower in the probe) | Read in the source; frame-rate dependence Measured |
| X_ITE maps `frictionCoefficients` x → Bullet friction, **y → Bullet rolling friction**; recomputes inertia from the shapes (the `inertia` field has no effect); links a top-level collidable's translation/rotation to the body pose (both ways); creates no joint unless both bodies are set; reads joint `anchorPoint`/`axis` in world coordinates at load | Read in the source (`RigidBodyPhysicsComponent.js`) |
| `physx-js-webidl` 2.9.1 is a **web-only** Emscripten build (refuses Node); it runs in Node with a 15-line shim (worker environment + `wasmBinary`), which the unit tests use. The npm package ships **no LICENSE file** (README, .mjs, .d.ts, .wasm only) | Measured |
| PhysX 5.12.0 WASM in a worker: loads in 141–150 ms (Chromium), 333 ms (Firefox), 595 ms (WebKit); `marble-minimal.x3d` builds in 8–12 ms and steps in **0.1–0.25 ms** (Chromium; Firefox and WebKit worker clocks have 1 ms resolution); keeps 238–244 steps/s in all three browsers | Measured (`evidence/p1-sidebyside-*.json`) |
| PhysX's default contact offset (0.02 m at the default tolerance scale) is larger than a marble; speculative contacts then hide tunnelling. With offsets sized to the shapes, a marble at 5 m/s tunnels a 5 mm wall in 20 of 50 start phases without CCD and in 0 of 50 with CCD | Measured (`evidence/p1-ccd-sweep.txt`, `tests/analytic.test.ts`) |
| PhysX applies restitution to the velocity **after** the step's gravity: rebound = e·(v_impact + g·h) to 1e-7. Consequence: with `minBounceSpeed` below about e·g·h/(1−e) a resting ball hops forever (a limit cycle at 0.53 mm, measured with e = 0.6) | Measured |
| `marble-minimal.x3d` (now with a floor and a walled cup built from CollidableOffset) runs on PhysX through the bridge and on X_ITE's Bullet side by side; the PhysX marble enters the cup at 0.86 s, the Bullet marble at 1.13–1.28 s, 299 mm behind at 0.7 s; Bullet's marble drifts up to 32 mm in z on a symmetric ramp, PhysX's stays at z = 0. A time shift of 0.28–0.39 s aligns them best but leaves 35–61 mm RMS: the warm-up of X_ITE's step is part of the cause, not all of it; setting the second friction coefficient (Bullet rolling friction) to 0 did **not** speed Bullet up | Measured (Chromium; `evidence/p1-sbs-*.json`) |
| **SAI refuses assignments to outputOnly fields** (joint angles, `CollisionSensor.contacts`, `isActive`) in all three browsers; `node.getField(name).setValue(v)` emits them and ROUTEs fire. X_ITE 16.7 warns that `getField` is deprecated, so the bridge falls back to X_ITE's internal field if it disappears | Measured (`evidence/p2-outputs-probe-*.json`) |
| X_ITE's CollisionSensor subscribes to frame updates when it goes live and never re-reads `enabled`; while subscribed it resets `isActive` to FALSE every frame (no Bullet contacts). `enabled = FALSE` followed by re-assigning its own `collider` unsubscribes it | Measured |
| X_ITE's joints recompute and write their outputs on every change of a body whenever `forceOutput` is not NONE, independent of the collection's `enabled`; the bridge sets `forceOutput` NONE in X_ITE and keeps the authored list | Read in the source |
| X_ITE 16.7 implements **no UniversalJoint and no MotorJoint** (no constraint, no torques); its DoubleAxisHingeJoint is a single hinge aligning axis1 on body1 with axis2 on body2; its hinge ignores minAngle/maxAngle; its slider assigns `frameInA` twice and `frameInB` never and ignores `sliderForce`. In the bench scene the Bullet UniversalJoint rod falls to the floor, its flipper hangs, its launcher never fires | Read in the source; outcomes Measured (`evidence/p2-joints-*.json`) |
| PhysX D6 drive: the drive velocity is actor0 relative to actor1 (+5 rad/s gave −5), and `forceLimit` acts as an **impulse per step** (a limit of 0.0005 raised the axle 0.5 rad/s per step = 0.0005/I); the bridge passes maxTorque·h and the analytic torque-limited spin-up then matches to 0.0001 % (PGS and TGS) | Measured (`tests/joints.test.ts`) |
| PhysX contact reports: `eNOTIFY_TOUCH_FOUND` comes from the speculative contact, before any impulse (impulse 0); `eNOTIFY_THRESHOLD_FORCE_FOUND` never fires under the TGS solver in this build (0 events vs 21 under PGS). The bridge detects impacts itself from per-step pair impulses (above 2e-5 N·s and 3× the pair's decaying recent peak): one ball coming to rest gives 3 impacts under both solvers, the first equal to m(1+e)(v+g·h) within 0.5 % | Measured |
| X_ITE TimeSensor (X3D time = `Date.now()/1000`; the SAI exposes no current time): `pauseTime` is ignored before the sensor is live; `enabled` FALSE then TRUE in one JavaScript turn collapse into one event; `startTime` is ignored while active (as X3D says); a looping sensor with `startTime 0` runs in the epoch's phase, so at load a ROUTE-driven platform is wherever `now mod cycleInterval` puts it | Measured (`probes/clock-probe.mjs`) |
| Kinematic bodies end to end: an elevator (fixed RigidBody moved by PositionInterpolator ROUTEs) carries a cube through two cycles in Chromium, Firefox and WebKit; in PhysX the cube rests at 0.0260–0.0274 m above the platform centre (0.026 at rest). It needed three fixes, each measured: clocks restarted at load and paused at phase 0, a kinematic path sampled at every physics step's time, and catching up lost time instead of dropping it (dropping time after a 300 ms stall threw the cube 2 cm). The X3D platform and the PhysX platform differ by 5–16 mm while physics catches up | Measured |

## 3. Architecture

```
 marble-machine.x3d  (standard X3D 4.0: geometry, PhysicalMaterial, lights, sound, RigidBodyPhysics, ROUTEs)
        │ loaded by
        ▼
 X_ITE 16.7 (renderer) ──── its own RigidBodyPhysics (Bullet) ── switched OFF for the PhysX run (RigidBodyCollection.enabled = FALSE)
        │ SAI: read nodes, fields, ROUTEs                         stays ON for the ghost run (race mode)
        ▼
 x3d-physx bridge (TypeScript)
   reader   : RigidBodyCollection / RigidBody / CollidableShape / CollidableOffset / joints / CollisionCollection / CollisionSpace → an engine-neutral model + loss report
   builder  : model → PxScene, PxRigidDynamic / PxRigidStatic / kinematic, PxShape, PxMaterial, PxJoint
   stepper  : fixed step (1/240 s default), accumulator, CCD, sleeping
   writer   : RigidBody.position / orientation / linearVelocity / angularVelocity, joint outputs (angle, separation, ...),
              CollisionSensor.contacts / intersections / isActive (as Contact nodes)   ── standard ROUTEs move the Transforms
   recorder : command log + per-step state hash; replay
        │
        ▼
 PhysX 5.12 (physx-js-webidl, WASM, CPU), in a Web Worker (transferable buffers; no SharedArrayBuffer, so it works on GitHub Pages without COOP/COEP headers)
```

**Taking over X_ITE's engine** (before `replaceWorld`, authored values kept by the bridge): `RigidBodyCollection.enabled` FALSE (stops Bullet), `CollisionSensor.enabled` FALSE plus a `collider` re-assignment (X_ITE re-reads `enabled` only then), joint `forceOutput` NONE (X_ITE would write its own joint outputs). Optional *clocks follow physics*: the scene's running TimeSensors restart at load, pause at phase 0, and pause and resume with physics, so ROUTE-driven parts move on the physics clock.

**Authority**: PhysX owns dynamic body state and contacts; X3D owns presentation, authoring intent and input. The bridge writes only *output* fields and the RigidBody pose fields, never the author's geometry. Structural edits (build mode) rebuild the PhysX scene; target changes keep state (as in the MuJoCo bridge).

**Coordinates and units**: X3D is Y-up, metres, kilograms, seconds, radians; PhysX has no built-in up axis, so the bridge uses X3D's frame directly (gravity from `RigidBodyCollection.gravity`). No change of basis is needed, unlike MuJoCo. Rotations: X3D axis-angle ⇄ PhysX quaternions (xyzw).

## 4. Contract `x3d-physx/0.1`

- **Scene**: any X3D 4.0 file whose physics is expressed only with RigidBodyPhysics nodes. No extensions are required. Optional `WorldInfo` metadata may carry *bridge hints* (for example a fixed step); the scene must run without them.
- **Identity**: DEF names (scene URI + DEF; PROTO and Inline instance paths in a later version). PhysX handles are never persisted.
- **Commands** (as the MuJoCo bridge): `run`, `pause`, `step(n)`, `reset`, `set_field(def, field, value)`, `rebuild`, `drop_marble(position)`, `record`, `replay(log)`, each with an id, an expected scene revision and an acknowledgement. Built so far: run, pause, step, reset (= rebuild), teleport, and `set_field` for the live inputs (MotorJoint torques, angles and enabled axes; DoubleAxisHingeJoint drives; SliderJoint force; RigidBody forces and torques), forwarded from X3D field events, so a ROUTE or a script drives them in standard X3D.
- **Observations**: per frame: time, step count, the poses of moving bodies, joint outputs, the contacts touching after the last step and the impact events since the last frame (first point, total impulse); per run: a trajectory and a state hash per step.
- **Loss report**: per scene, every node and field: `mapped` / `approximated (how)` / `ignored (why)`.

## 5. Mapping X3D 4.0 RigidBodyPhysics → PhysX 5

The table is machine-readable in `src/bridge/mapping.ts`; `tests/mapping.test.ts` checks it covers every field of the 14 nodes in the official X3DUOM 4.0 and nothing else.

| X3D node.field | PhysX | status |
|---|---|---|
| RigidBodyCollection.gravity | PxScene gravity | mapped |
| .iterations | solver position iterations per actor (`setSolverIterationCounts`) | mapped |
| .preferAccuracy | **enables CCD on every dynamic body** (scene, body and pair flags; the default filter shader has no CCD flag, so the bridge installs its own) and the TGS solver | interpreted (declared) |
| .errorCorrection, .constantForceMix | ODE's ERP and CFM: no PhysX equivalent | lost (reported) |
| .contactSurfaceThickness | lower bound of each shape's contactOffset; offsets are otherwise sized from the shape (25 % of its smallest dimension, at most 2 cm), because PhysX's 2 cm default is larger than a marble | approximated |
| .maxCorrectionSpeed | `setMaxDepenetrationVelocity` per actor | mapped |
| .autoDisable, .disableLinearSpeed, .disableAngularSpeed, .disableTime | sleeping (`setSleepThreshold`, wake counter) | approximated |
| .enabled | bridge on/off (and X_ITE's own engine off) | mapped |
| .set_contacts | not needed: PhysX resolves its own contacts; the ROUTE from CollisionSensor is honoured as a no-op | reported |
| RigidBody.mass, .centerOfMass, .inertia (3×3) | mass, `setCMassLocalPose`, inertia diagonalised into principal axes plus a frame rotation; **inertia left at the default identity is computed from the collision shapes** (as X_ITE does; a literal 1 kg·m² on a 5 g marble would stop it rolling) | mapped / interpreted |
| .massDensityModel (Sphere/Box/Cone) | `PxRigidBodyExt::setMassAndUpdateInertia` from the given shape | mapped |
| .position, .orientation, .linearVelocity, .angularVelocity | global pose, velocities (written back every frame as outputs) | mapped |
| .fixed TRUE | PxRigidStatic; **if the scene drives its position or orientation by ROUTE, a kinematic PxRigidDynamic with `setKinematicTarget`**, one target per physics step sampled from the X3D trajectory at that step's time (elevators, moving paddles; X_ITE teleports such bodies) | interpreted (declared) |
| .linearDampingFactor, .angularDampingFactor, .autoDamp | linear and angular damping | mapped |
| .forces, .torques | `addForce` / `addTorque` each step | mapped |
| .finiteRotationAxis, .useFiniteRotation | ODE-specific | lost (reported) |
| .useGlobalGravity FALSE | actor flag `eDISABLE_GRAVITY` | mapped |
| CollidableShape.shape: Box / Sphere | PxBoxGeometry (half extents) / PxSphereGeometry | mapped |
| Cylinder / Cone | convex mesh (N-sided) | approximated (N declared) |
| IndexedFaceSet / IndexedTriangleSet on a fixed body | PxTriangleMesh (ramps, spirals, funnels) | mapped |
| the same on a dynamic body | convex hull (or a decomposition) | approximated |
| CollidableShape / CollidableOffset .translation, .rotation | directly under a RigidBody: follows the body (zero offset, X_ITE's reading); nested inside a CollidableOffset: the local offset. Portable scenes put offsets on the inner collidable | interpreted (declared) |
| CollisionCollection.frictionCoefficients, .bounce, .minBounceSpeed | PxMaterial static and dynamic friction (first coefficient; PhysX friction is isotropic), restitution, `bounceThresholdVelocity` raised to at least 2·e·g·h/(1−e) so resting bodies stop hopping (reported when raised) | mapped / approximated |
| .slipFactors, .softnessConstantForceMix, .softnessErrorCorrection | no direct equivalent | lost (reported) |
| .surfaceSpeed (conveyor) | needs contact modification (not exposed in the WASM bindings, to verify); fallback: a kinematic belt | approximated or lost |
| CollisionSpace | collision filtering groups | approximated |
| CollisionSensor.contacts, .intersections, .isActive | contacts touching after the last step (separation ≤ 0.5 mm), filtered by the sensor's CollisionCollection, → pooled Contact nodes (position, contactNormal, depth, body1, body2, geometry1, geometry2, surface fields copied from the collection), 16 per sensor per frame by default | mapped |
| BallJoint | PxSphericalJoint; anchor in world coordinates at load (X_ITE's reading) | mapped (built in phase 1) |
| SingleAxisHingeJoint (anchorPoint, axis, minAngle, maxAngle, stopBounce; outputs angle, angleRate) | PxRevoluteJoint with an angular limit pair (restitution) | mapped (built in phase 1, outputs in phase 2); stopErrorCorrection lost |
| DoubleAxisHingeJoint (two axes, desiredAngularVelocity1/2, maxTorque1/2, suspension; X3D 4.0 limits only axis 1: minAngle1/maxAngle1) | PxD6Joint: axle (axis2) = twist, free, velocity drive; steering (axis1) = swing1, free or pyramid-limited; swing2 and translation locked (suspension rigid); drive limits passed as maxTorque·h | approximated |
| SliderJoint (axis, minSeparation, maxSeparation, sliderForce; outputs separation, separationRate) | PxPrismaticJoint with a linear limit (min > max: no stops); sliderForce applied as +F on body1, −F on body2 each step | mapped |
| UniversalJoint | PxD6Joint (two swing axes free, twist about axis1×axis2 locked): a constant-velocity joint, not a Hooke joint; they differ at large angles (0.18 rad/s about the locked direction in the test) | approximated |
| MotorJoint (motor1Axis to motor3Axis, axis torques and angles, enabledAxes, autoCalc) | ODE AMotor semantics: no constraint, +τ on body1 and −τ on body2 about each axis every step (axes attached to body2); outputs motorNAngle (twist since load) and rate; X3D 4.0 gives no stop angles, so stops and axisNAngle move nothing | mapped (the draft's "D6 drives" was wrong: a D6 drive would add a constraint X3D does not have) |
| any joint .forceOutput | selects which output fields are written ("ALL", "NONE", names); the draft's "force readback" misread the field | mapped |
| all joints | anchors and axes in world coordinates at load; angles and separations 0 at load, body1 relative to body2 (ODE); NULL body = the world | interpreted (declared) |

## 6. The Marble Machine

**Board**: a vertical pegboard (a grid of holes every 4 cm, 33 × 25 snap points) behind a glass front, with two hoppers at the top (Drop alternates between them), a shelf of 20 parked marbles, and a goal cup at the bottom (walls 0.1 m: marbles leave a funnel still moving sideways and cleared 0.06 m walls). Pieces live in the 5 cm slot between pegboard and glass. Built in phase 3: `src/machine/` (pieces, IR, X3D writer), `machine.html`.

**Pieces** (each is a small standard X3D fragment: a Transform, a Shape, a RigidBody and, where needed, a joint; build mode inserts and removes them):
| piece | physics |
|---|---|
| straight ramp, curved ramp, half-pipe | fixed triangle mesh |
| funnel, spiral | funnel: two fixed boxes; **spiral replaced by a zigzag switchback** (a helix cannot live on a flat board between pegboard and glass) |
| flipper (key F or button) | SingleAxisHingeJoint with limits, driven by MotorJoint torque; rotated −90° it is a kicker (its tip then moves sideways: the default machine topples 12 dominoes with it) |
| seesaw | SingleAxisHingeJoint, free |
| pendulum and wrecking ball | SingleAxisHingeJoint with a heavy bob, starting raised (a hinge keeps it in the slot) |
| dominoes (row of 10 to 40) | dynamic boxes |
| spring launcher | SliderJoint with a force |
| paddle wheel | DoubleAxisHingeJoint axle motor (a velocity drive with a torque limit; `spin` signed) |
| elevator lift | fixed body moved by TimeSensor + PositionInterpolator ROUTEs (kinematic in PhysX) |
| zigzag | three fixed boards and two end walls (replaces the spiral: SPEC section 0 note) |
| bell, xylophone bars | fixed shapes inside a CollisionSensor: they ring |

**Modes and controls** (every control is a visible button, with a keyboard shortcut):
- **Build**: pick a piece from the palette, drag it on the pegboard (PlaneSensor, snapped to the grid), rotate in 15° steps, change its parameter (length, count, height, start angle, note, spin), delete, undo/redo. Physics off: build mode shows a physics-free X3D blueprint generated from the same description; the machine is a standard X3D scene at every moment (Export .x3d, with the description in a WorldInfo MetadataString so Import can edit it again).
- **Run**: drop 1, 5 or 20 marbles, pause, step, slow motion (×0.1 to ×1), reset; counters: marbles in the cup, time, contacts per second.
- **Race**: the same scene runs on PhysX (solid marbles) and on X_ITE's Bullet (ghost marbles), started together; a live divergence readout (distance between twin marbles) and a plot after the run. Built: the ghost is the same machine generated for Bullet, loaded with an `Inline` and reached through `IMPORT`/`EXPORT` (standard X3D); each marble and its ghost are dropped together; the plot has a crosshair and a table view.
- **Sound**: X3D 4.0 Sound component (AudioClip and SpatialSound, through X_ITE's WebAudio): each contact plays a sample chosen by material pair (glass on wood, glass on brass, glass on glass), with loudness from the contact impulse, positioned at the contact point; the bells and xylophone bars are tuned. Mute, volume. Built: six synthesised samples (`tools/make-sounds.ts`; bell and bar within 0.06 cents), 4 SpatialSound voices per sample in the run scene (not in exports), impacts from the bridge's detector (PhysX's own threshold reports do not fire under TGS).
- **Record and replay**: record the command log and a hash of the full state at every step; replay re-simulates from the log and checks each hash (bit-exact on the same machine); export and import runs as a small JSON file; compare a run recorded on one machine with its replay on another (the determinism experiment).
- **Look**: a toggle between the photoreal toy (PhysicalMaterial glass, brass, oak; EnvironmentLight from an HDR image; shadows; tone mapping) and the Loom style (dark, gold outlines, glowing marble trails). Built, with one change: no HDR image (none may be third-party), a procedural studio cube map instead; EnvironmentLight is **X3D 4.1**, so it is added at runtime through SAI and exported files stay X3D 4.0.
- **Info panels**: what each piece is in X3D (its nodes), what PhysX does with it (the mapping row), the loss report for the current machine, and the measured frame time and physics time.

## 6b. More demos (added in phase 5, at the user's request: "more interesting and fun and tinkerable demos, same polish")

All four are standard X3D 4.0 scenes generated from a page description, built on one shared shell (`src/demos/shell.ts`: run, step, reset,
speed, record and replay, both looks, contact sound, Export/Import with the description in a MetadataString, loss report, `?` lists every
shortcut). Each has a pure scene module that Node tools simulate in the browser's own PhysX world (`tools/*-sim.ts`); evidence in
`evidence/DEMOS.md`. All four exports validate (XSD and semantic: 0 errors, 0 warnings).

| demo | X3D it exercises | what the physics showed (Measured) |
|---|---|---|
| **Physics music box** | TimeSensor + OrientationInterpolator turning a kinematic drum; 10 SingleAxisHingeJoint hammers; pegs as CollidableShapes switched with `enabled` while running | every peg gives exactly one note, on its own bar, at 60, 120 and 200 BPM (12 Node runs), after two fixes: square-edged pins (round ones let the foot slide down slowly, so strikes varied 6×) and a check rail (stop at 0.1 rad); the earlier tuning had leaned on an accidental contact between each hammer and its pivot rod |
| **Draw-a-domino run** | PlaneSensor drawing on the table; one RigidBody per domino; sleeping | the toppling wave in v/√(gH) against gap/H next to Larham's real dominoes (arXiv:1302.3311, Stated): friction decides PhysX's speed (μ 0.1: 1.75–1.47 for gaps 0.1–0.5 H, real peak 1.53; μ 0.2, the default: 1.46–1.05); PhysX misses the slow-down real dominoes show at the tightest gap (1.07 at 0.04 H) |
| **Trebuchet vs castle** | hinged counterweight, BallJoint sling, a latch; joints removed from `RigidBodyCollection.joints` to fire and to release | release within 0.2° of the asked angle (stepping one physics step at a time near it); 65 % of the counterweight's drop becomes the stone's speed; sling length has an optimum (3 m: 88 m, 5 m: 168 m, 7 m: 155 m); Node and Chromium agree to 0.2 m in 166 m |
| **Galton board** | CollisionSensor on the pins; `RigidBodyCollection.gravity` changed live (tilt, shake) | ideal pins are not coins: wide spacing makes beads stair-step (σ up to 5.7 bins), tight spacing makes them zigzag (1.1); 8 mm pins at 19 mm give a bell, still wider than binomial (σ 2.3–2.7 vs 1.73); a gravity-fed 2D hopper narrow enough for single file jams, so beads are metered into a chute; tilting flattens the bell more than it shifts it |

Bridge features these needed (all standard X3D semantics, added to the mapping table):
- a joint removed from `RigidBodyCollection.joints` at run time is released (matched by DEF name); added joints wait for a reload;
- `RigidBodyCollection.gravity` and `CollidableShape.enabled` are live (disabled collidables are built without simulation flags);
- contacts mode `'sensed'`: only pairs touching a CollisionSensor's collidables report (PhysX filter data): the Galton board 4.0 → 1.3 ms/step;
- the impact detector reports a strike once, at its peak step (a strike often spans two steps); one step (4 ms) later than before;
  the phase-2 contact evidence is unchanged (3 events, same impulses);
- emitter: generic scene metadata, OrientationInterpolator clocks, switchable shapes, collection gravity and sleeping, optional DEF/USE
  sharing of identical Shapes; the Marble Machine's files are unchanged byte for byte. X_ITE's `shadowMapSize` (not X3D 4.0) is set only
  in the browser, never in exports.

## 7. Verification

| test | expectation | how |
|---|---|---|
| free fall | y matches the **discrete** semi-implicit Euler solution y0 − g·h²·n(n+1)/2 within 1e-4 m at 1 s (measured 1.5e-6); its distance from the continuum y0 − ½gt² is the integrator's ½·g·h·t = 0.0204 m at h = 1/240 s (measured 0.020436), so the draft's "1e-4 m from ½gt²" was unattainable for any first-order integrator at this step | unit test, PhysX alone |
| pendulum period | T = 2π√(L/g) (small angle) within 0.5 % | unit test |
| restitution | rebound speed = e·(impact speed + g·h) within 1e-3 (PhysX's law); first apex ratio within 5 % of e² (later bounces exceed e² by about 2gh/v); the ball comes to rest | unit test |
| incline with friction | sliding acceleration g(sin θ − μ cos θ) | unit test |
| tunnelling | a marble at 5 m/s does not pass through a 5 mm wall with CCD on, over 40 start phases; does in some of them without (control) | unit test |
| joints | hinge and slider limits hold (hinge stops within 0.02 rad, output equals geometry within 1e-3 rad; slider stops within 2 mm); sliderForce gives F/m within 1 %; MotorJoint torque gives τ/I within 1 % and reverses at runtime; the hinge2 motor spins up at maxTorque/I and holds the target velocity within 1 % (PGS and TGS); universal and ball anchors coincide within 1 mm | unit tests (measured, `evidence/p2-joints.json`) |
| contacts and kinematics | impact impulse m(1+e)(v+g·h) within 3 %, a few impacts per ball (not one per resting step), resting contacts reported; a kinematic platform carries a box | unit tests |
| joints and sensors in the browser | `scenes/joints-and-sensors.x3d`: every output arrives as an X3D event; CollisionSensor.isActive switches a lamp by ROUTE; flipper and launcher fire through set_field; the elevator carries its cube | browser, three engines' worth of evidence |
| mapping | every field of the 14 nodes has exactly one row (`tests/mapping.test.ts`); the loss report lists every authored field that is lost (`scenes/experiments/ode-only-fields.x3d`: all 11 listed) | unit test + browser |
| standard scenes | every exported machine validates with the x3d_mcp fork (XSD and semantics) and still runs in plain X_ITE | **measured in phase 3**: 14 piece fragments + machine + build view: 0 errors, 0 warnings; the export loads and runs in plain X_ITE in three browsers (2–5/20 in the cup on Bullet, some marbles fall through the floor there) |
| build mode | drag with a real pointer snaps to the grid; rotate; undo | browser, three engines (`probes/run-build.mjs`) |
| default machine | marbles reach the cup | Node 20/20 (test); browsers 18–19/20 at 11–18 s |
| race | divergence is measured and shown, not hidden | browser: **measured** (25–31 cm mean after 11–14 s; PhysX 12–19 in the cup, Bullet 10–12) |
| replay | same machine: every step hash identical; across machines and browsers: measured and reported | **measured**: identical in Chromium, Firefox, WebKit and Node (1918 and 969 steps); across machines not yet run |
| sound | the impact sounds play | **measured as signal** at the WebAudio destination (peaks 0.51–0.74 in three browsers); tuning by spectrum (≤ 0.06 cents) |
| performance | 60 fps with 20 marbles, 40 dominoes and every piece type, on this Mac in Chromium; physics time per step logged | **measured in phase 5, not met under load**: 52.6 fps median in a visible Chromium window (load average 6–8), physics 237–248 steps/s; headless Firefox simulates the full machine at half real time (contact reporting: 11.0 vs 2.6 ms/step) |
| browsers | Chromium, Firefox, WebKit (Playwright, real WebGL) | **`npm run smoke`**: 33 tests on the production build; last run 30 passed, 3 failed under load (Galton 220/223 beads binned vs 225; WebKit music box 15 and 17 of 18 notes per turn); `evidence/PHASE-5.md` |

## 8. Work plan (full machine, as decided; estimates)

1. **Bridge core** (about 1 week): reader, builder, stepper, writer; free fall, pendulum, restitution, friction, CCD tests; `marble-minimal.x3d` running on PhysX and on Bullet side by side.
2. **Joints and sensors** (about 1 week): all joint types, MotorJoint drives, CollisionSensor contacts, kinematic interpretation, loss report.
3. **Machine and build mode** (about 1–2 weeks): piece library (each piece its own validated X3D fragment), pegboard, drag and snap, export.
4. **Race, sound, record and replay, looks, info panels** (about 1–2 weeks).
5. **Verification and polish** (about 1 week): three-browser tests, performance, the determinism experiment, README, licences.
Installs it needs (asked before each): Node 24, `physx-js-webidl` (~10 MB), `x_ite` 16.7, Vite and TypeScript, Playwright browsers, sound samples (recorded or synthesised; synthesised by default).

## 9. Risks

| risk | mitigation |
|---|---|
| ~~X_ITE's RigidBodyCollection still steps Bullet when disabled, or overwrites RigidBody fields~~ | **resolved in phase 1**: it does not, except one step before `loadURL` resolves; the bridge disables before `replaceWorld` |
| SAI cannot create Contact nodes fast enough for many contacts | cap contacts reported per frame; pool Contact nodes |
| Fast marbles tunnel | CCD (via `preferAccuracy`), 1/240 s step, minimum ramp thickness rule in build mode |
| WASM PhysX download (~10 MB) slows the first load | load it in a worker while the scene appears; cache |
| The bindings lack contact modification (surfaceSpeed) | kinematic conveyor fallback; reported |
| Bullet and PhysX differ in friction and restitution models | that difference *is* the race's content; show it, explain it |
| Sound licences | synthesise the impact sounds (as the Mashtots score did), no third-party samples |
| The race compares engines **and** clocks: X_ITE's Bullet steps with the frame rate, PhysX with a fixed 1/240 s | report the clock difference beside the divergence; offer a time-aligned view |
| X_ITE may remove `sfnode.getField(name)` (deprecated in 16.7), the only SAI way to emit outputOnly events | fallback to X_ITE's internal fields is in place; pin X_ITE; report upstream |
| Firefox runs the full machine at 12 ms per physics step (128 steps/s, slower than real time; Chromium 1–2.6 ms, WebKit about 1 ms) | **measured in phase 5**: contact reporting is most of it (Firefox 11.0 ms/step with every pair reporting, 2.6 with none; Chromium 0.81 vs 0.28); the `'sensed'` mode limits reports to CollisionSensor collidables |
| Contact reports for every touching pair every step (needed for impacts under TGS and for CollisionSensor) cost JavaScript callbacks | measure in phase 5 with 20 marbles and 40 dominoes; offer `contacts: 'none'` for scenes without sensors or sound |
| Physics lags the X3D clock by one batch (5–16 mm on a moving platform while catching up) | acceptable; visible only on ROUTE-driven parts. **Phase 5**: when physics falls more than 0.1 s behind, the bridge pauses the scene's TimeSensors until it catches up (ROUTE-driven parts slow down with it instead of jumping) |
| X_ITE's `createX3DFromString` sometimes never resolves in WebKit (measured) | watchdog and retry in the bridge (`stats.createStalls`); report upstream |
| `physx-js-webidl` has no licence file in its package | take the MIT text from the upstream repository and PhysX's BSD-3 from NVIDIA's for the notices (phase 5) |

## 10. Open questions

1. Repository name and licence (Apache-2.0 like the MuJoCo bridge? PhysX is BSD-3, X_ITE MIT, the bindings MIT).
2. Marble count ceiling for the target devices (laptops only, or phones too?).
3. Should a built machine be shareable as a link (the scene encoded in the URL) or only as a downloaded `.x3d`?
4. Later: a native PhysX backend (GPU) behind the same contract, and the MuJoCo bridge as a third engine in the race.
