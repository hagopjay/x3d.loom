# Second proof of concept: the H-Anim ragdoll (draft 0.2, 2026-11-13, phase 1 done)

A standard X3D H-Anim humanoid becomes a PhysX ragdoll in the browser, and slapstick follows. Same repository, bridge and demo shell as
the Marble Machine (`SPEC.md`). Grades as there: **Measured**, **Stated**, **Estimate**, **Conjecture**.

## 0. Decisions (the user, 2026-11-12)

| question | answer |
|---|---|
| which proof of concept | **H-Anim ragdoll** (option 3 of the first screener; the Marble Machine was option 1): "super interesting and fun and laughable" |
| who takes the falls | **pick per run**: a crash-test dummy and a bendy cartoon person, same H-Anim skeleton |
| contraptions | **all four**: stairs of doom, cannon and trampoline, bowling and wrecking ball, build-a-course |
| scoring | **Ouch-o-meter and replays**: points from real impact impulses, combos, BONK!/OOF! pop-ups at the hit points, slow-motion instant replay of the best crash |
| sound | **cartoon effects plus grunts**: synthesised boings, bonks, slide whistles, thuds, and formant-synthesised "oof"/"ow" |
| carried over from POC 1 | PhysX 5 WASM in the browser; standard X3D, no custom nodes; loss report; bit-exact record and replay; every control a button with a key; both looks; nothing published without the user's go |

Tone: cartoon slapstick. Nobody real, no blood or realistic injury: the dummy dents, the cartoon person sees stars.

## 1. The idea in standards terms

H-Anim 2.0 (ISO/IEC 19774, X3D 4.0's HAnim component) already carries what a ragdoll needs:
- `HAnimSegment.mass`, `centerOfMass`, `momentsOfInertia`: each segment's rigid-body properties;
- `HAnimJoint.center` (with the humanoid's binding pose): where each joint is;
- `HAnimJoint.llimit`, `ulimit`, `limitOrientation`: per-axis rotation limits; `stiffness`: per-axis resistance.

So the bridge reads a standard `HAnimHumanoid`, builds a PhysX **reduced-coordinate articulation** (one link per segment, spherical
joints with the H-Anim limits, joint drives from stiffness for posing and for "muscle tone"), and writes each joint's `rotation` (and the
root's translation and rotation) back every frame; X_ITE's own H-Anim skinning moves the character. The scene stays a plain H-Anim file:
any X3D browser shows the humanoid standing; with the bridge it falls. The environment (stairs, cannon, pins) is ordinary
RigidBodyPhysics, as in POC 1; the articulation and those bodies share one PhysX scene.

| H-Anim field | PhysX | status (to be measured) |
|---|---|---|
| HAnimSegment.mass / centerOfMass / momentsOfInertia | link mass, centre of mass, inertia tensor (diagonalised) | mapped |
| HAnimSegment children geometry | link collision shapes (capsule-like convex hulls) | approximated |
| HAnimJoint.center (bind pose) | joint frames | mapped |
| HAnimJoint.llimit / ulimit / limitOrientation | joint type and twist/swing limits | approximated: equal limits (X3D's default 0 0 0) = free axis; a range under 0.01 rad = locked; one moving axis = revolute; none = fixed (measured: see `evidence/RAGDOLL-PHASE-1.md`) |
| HAnimJoint.stiffness | joint drive stiffness (0 = limp) | interpreted |
| HAnimJoint.rotation, HAnimHumanoid.translation/rotation | written back each frame | output |

## 2. Phases (estimates)

1. **Ragdoll core**: an original LOA-1 humanoid generated from H-Anim names (dummy proportions, skin or segment geometry); reader for
   HAnimHumanoid → articulation model; worker builds it next to rigid bodies; write-back of joint rotations; Node tests (limits hold,
   no explosion, energy sane, settles); browser: it falls on a floor in three browsers; the first risks measured (below).
2. **Stairs of doom and the comedy layer**: push button, Ouch-o-meter (impulse per segment, combos), 3D pop-ups, best-crash instant
   replay in slow motion, cartoon sounds and grunts, follow camera, the two characters.
3. **Cannon and trampoline; bowling and wrecking ball**: aim and power, springy surfaces (bounce), pins, a ball on a joint.
4. **Build-a-course**: place ramps, bumpers, springs, banana peels (zero friction) on a grid; both looks; posing by dragging limbs.
5. **Verification**: browser suite, performance, validation, determinism of replays, docs.

## 3. Risks (to measure first)

| risk | first check |
|---|---|
| X_ITE's H-Anim skinning is too slow to update ~18 joint rotations every frame through SAI | phase 1: measure frame time with rotations written per frame |
| physx-js-webidl's articulation API (bound: PxArticulationReducedCoordinate, links, limits, drives) misbehaves in WASM | phase 1: Node drop test |
| H-Anim's per-axis Euler limits do not match PhysX's twist/swing limits | interpret and report in the loss report; tune the dummy's limits |
| an articulation's collisions with other bodies and itself (self-collision off between neighbours) | Node tests |
| bit-exact replay with an articulation | phase 1: hash articulation link states too |
