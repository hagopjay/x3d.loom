# SpringBoneChain: behaviour specification (draft 0.1, 28 November 2026)

Spring bones give a rig secondary motion: hair, ponytails, tails, ears, cloth strips, chains, antennae and soft-body jiggle that follow the animation late and settle by themselves. This document is the behaviour the solver in `src/springbone-core.js` implements, written in our own words so that any engine can implement it again. The X3D binding is in section 7.

## 0. Provenance (clean room)

HagopJay owns a licence to a well-known Unity Asset Store spring-bone package. We read his copy only to learn **what the parameters mean**, so that a rig tuned there carries over by name. Nothing from it is in this repository or any other: no source, no demo assets, no text. The package zip was unpacked outside every git tree and is not committed. The arithmetic below is the textbook position-based method (Verlet integration followed by constraint projection); the tuning maths in section 4, the FORCE model, the exact tapered capsule, the FIXED time mode, angle limits, stretch, wind, replay hashing and the X3D binding are ours. Parameter **names** (damping, elasticity, stiffness, inert, friction, radius, end length, end offset, gravity, force, freeze axis) are kept for interoperability; they are descriptive words, not code.

## 1. The particle tree

* A chain is one or more **trees** of bones. Each tree starts at a root bone and takes every child bone below it (in X3D: children whose node type is listed in `boneTypes`, minus `exclusions` and what is below them).
* Every bone carries one **particle**, placed at the bone's **pivot**: the bone's world matrix applied to its `center` (for an X3D Transform or HAnimJoint, the point its rotation turns about). A leaf bone gets one extra **tip particle** when `endLength > 0` (the last bone continued by that share of its own length, in the leaf's frame) or else when `endOffset` is not zero (that offset, in the leaf's frame).
* Each particle has a **depth** from 0 (root) to 1 (the farthest particle of its tree), measured as path length along the bones at the first frame. Every per-particle value is the base value times its **curve** at that depth. A curve is a list of (depth, factor) keys, linear between keys, flat outside; an empty curve is 1.
* The root particle is not simulated: it is placed at the root bone's animated pivot every step.

## 2. Each frame

1. **Animated pose.** Read every bone's local fields as the scene (or an animation) set them, not as the solver wrote them last frame. Compose world matrices from the roots' parent frame (`ancestors`) down. This gives each particle its animated place.
2. **Reference motion.** The reference frame (`reference`, default the roots' parent) has moved by `m` since the last solver step. `inert` carries that share of `m` rigidly into the particles.
3. **How many steps.**
   * `FIXED` (default): add `dt` to an accumulator; take steps of `h = 1/updateRate` while it holds one; at most `maxSubsteps` in one frame (the remainder is dropped and added to `droppedTime`). A frame with no step changes no state; it shows the last state carried along with the reference. When one frame takes several steps, the root particles move to their new places in even shares across them (`substepRoots`). With these two rules the state after step *k* does not depend on how fast the page draws (witness W4: bitwise identical at 60, 120 and 240 fps).
   * `VARIABLE` (the Unity asset's default): one step per frame with time scale `tv = dt * updateRate`. Results depend on the frame rate (W4b measures 71 mm of tip disagreement between 30 and 240 fps in one scene).
4. **Steps** (section 3), then **write the bones** (section 6).

## 3. One step

For every particle except the roots, parents before children:

**Move.** `v = x - x_prev`; `x_prev = x + inert * m` (first step of a frame only); `x = x + (1 - d) v + F + inert * m`, where `d` is damping (plus friction if the particle touched a collider on its previous step, capped at 1) and `F` is the external displacement of this step:
* `g` = gravity. With `gravityRestCompensation`, remove the part of gravity that the rest pose already holds: take the gravity direction as seen by the root at the first frame, turn it with the root's current world rotation, project it on today's gravity direction, and subtract that projection when positive. A rig standing as it was built then feels no net gravity; turned upside down it feels it all.
* `F = (g + force + wind * (1 + turbulence * gust(t, depth))) * scale * tv`, where `scale` is the reference frame's scale. In `PER_STEP` units (the asset's) these vectors are metres per step; in `M_PER_S2` they are accelerations and are multiplied by `h^2`.

**Shape.** With `r` the rest place (the parent's simulated position plus the animated offset of this particle in the parent's animated frame) and `L` the animated bone length:
* elasticity `e`: `POSITION` model `x += e * tv * (r - x)`; `FORCE` model `x += e * tv * (r - x_before)` where `x_before` is the position at the start of this step.
* stiffness `s'` = lerp(1, stiffness, weight): if `|r - x| > 2 L (1 - s')`, pull `x` toward `r` until it is that far.

**Collide.** Push the particle (radius `radius * scale`) out of (or into) every enabled collider, in order; remember whether it touched (section 5).

**Freeze axis.** If `freezeAxis` is X, Y or Z, project `x` onto the plane through the parent's particle whose normal is the parent's animated axis.

**Keep length.** Move `x` along the line to the parent's particle so the distance is `L`, by the share `1 - stretch`.

**Angle limit.** If `angleLimit > 0` and the bone points further than that from its animated direction, turn it back onto the cone.

## 4. Tuning maths (what damping and elasticity mean)

For small motion of one particle with stiffness off, `y = x - r` follows a two-term linear recurrence `y[n+1] = S y[n] - P y[n-1]`:

| Model | S | P | from (frequency f, damping ratio ζ) at step h |
|---|---|---|---|
| POSITION | (1-e)(2-d) | (1-e)(1-d) | e = 1 - (S - P), d = 1 - P / (S - P) |
| FORCE | 2 - d - e | 1 - d | d = 1 - P, e = 1 + P - S |

with `S = 2 exp(-ζωh) cos(ωh sqrt(1-ζ²))`, `P = exp(-2ζωh)`, `ω = 2πf` (ζ < 1; real roots for ζ ≥ 1). Setting `frequency > 0` computes damping and elasticity this way, so the solver's samples equal the continuous oscillator's samples exactly (witness W2: 3e-16 m over 10 s). The PROTO's outputs `equivalentFrequency` and `equivalentDampingRatio` run the map the other way for any (d, e).

Two findings fall out (grade Confirmed by W2b and W3b, Node 22.23.5):
* **POSITION has a damping floor.** Because the pull also scales the carried velocity, at 2 Hz and 60 Hz no POSITION setting goes below ζ = 0.104 (asking for 0.1 needs d = -0.0019). The asset's default (d = 0.1, e = 0.1) behaves like 3.2 Hz at ζ = 0.31. FORCE reaches any ζ ≥ 0.
* **Rigid bones lose energy by themselves.** Keep-length by projection is first order and dissipative: a 30° pendulum with damping 0 keeps 48 % of its swing after 6 s at 60 Hz and 83 % at 240 Hz (W3b); the period converges at order 0.96 to the exact elliptic-integral answer (W3).

## 5. Colliders

A collider rides on a frame (`ancestors` of the collider, outermost first); sizes scale with that frame's x-axis scale.

* **SPHERE** `center`, `radius`.
* **CAPSULE** along `direction` (X, Y or Z of the frame), total length `height` with caps included, so the two sphere centres are `height - radius - radius2` apart; `radius2 > 0` makes it a **round cone** (tapered capsule). The nearest swept sphere is found exactly: with axis coordinate `t'`, radial distance `q` and taper `k = (r0 - r1)/len`, the nearest sphere sits at `t = t' - k q / sqrt(1 - k²)`, clamped to the segment (W6: 2,000 points land on the surface to 1.5e-9 m by brute force; the tempting shortcut of interpolating the radius at the nearest axis point misses by 10 mm).
* **PLANE** through `center` with normal = the frame's `direction` axis.
* `bound` OUTSIDE keeps particles out; INSIDE keeps them in (a skirt inside a hoop, a tail inside a tube).

## 6. Writing the bones

Root to tip, each bone with exactly one simulated child (or, with `branchMode MEAN`, several) is turned by the shortest rotation that takes its animated child direction onto the simulated one, computed with the parent already turned. The new local rotation is `conj(qA) * Q * qA * r_anim`, where `qA` is the parent's world rotation (the parent's world matrix must be a similarity: rotation times uniform scale). `weight < 1` slerps between the animated and simulated local rotations. With `stretch > 0` the child's `translation` is also written so its pivot lands on its particle. Bones with several children and `branchMode SKIP` are left as animated (the asset's rule).

## 7. X3D binding

`x3d/SpringBone.x3d` declares two PROTOs (X3D 4.0, XSD-valid):

* **SpringBoneChain**: every parameter above is an `inputOutput` field with the default shown; `roots`, `ancestors`, `reference`, `colliders`, `exclusions` are MFNode fields holding USE references; `set_reset` rebuilds; `set_time` steps when `clock` is FALSE; outputs `stateHash`, `steps`, `droppedTime`, `collided`, `positions`, `equivalentFrequency`, `equivalentDampingRatio`. Its body is a TimeSensor and one Script (`springbone-script.js`, built from `src/`).
* **SpringBoneCollider**: `shape`, `bound`, `center`, `radius`, `radius2`, `height`, `direction`, `ancestors`, `enabled`.

The Script reads standard fields only (`translation`, `center`, `rotation`, `scale`, `scaleOrientation`, `children`) and tells the animation's writes from its own by comparing each bone's rotation with what it wrote last frame. An interpolator that writes **after** the solver in the same frame is seen one frame late (Suspected; not yet measured).

## 8. Differences from the Unity package (for people moving rigs across)

| Topic | Unity package (as we read its documented behaviour) | SpringBoneChain |
|---|---|---|
| Time | Default mode: one step per frame, scaled by dt; fixed mode keeps at most 3 steps and drops the rest silently | `FIXED` default, `maxSubsteps` settable, dropped time reported, roots moved in shares |
| Frames without a step | particles carried with the object and lengths re-kept (state changes) | state unchanged; carry only on display |
| Curves | Hermite AnimationCurve | linear MFVec2f keys (the Unity bridge samples the curve at 11 depths) |
| Capsule | radius, height, optional second radius | same meaning; the tapered case solved exactly |
| Bone writing | rotation, and world position of every bone | rotation; translation only when `stretch > 0` (HAnim joint offsets stay as authored) |
| Weight | blend weight | stiffness lerp as theirs, plus slerp of the written rotation |
| Extras | | FORCE model, physical tuning, angle limits, stretch, wind and gusts, teleport reset, MEAN branches, replay hash, outputs |
| Not carried | distance-based disable, multithreading, negative-scale mirroring | use `enabled` from a ProximitySensor or LOD; X3D frames with mirrors are not supported |

## 9. Rigs from Daz Studio (Genesis 8 and 9)

Daz figures arrive through FBX or the Blender add-on as armatures. The bones people usually make springy are listed in `profiles/daz-genesis.json` with suggested parameters; **every bone name there is Suspected until checked against a real Genesis export**. The design needs nothing Daz-specific: a chain is just roots, ancestors and colliders, so a Genesis rig is one more profile.

## 10. Witnesses

`node test/witnesses.mjs` (14 rows, 11 with planted controls that must fail) and `node browser/live.mjs` (X_ITE 16.8.1 in Chromium: the example scene runs, and a 300-frame replay through `set_time` gives the same state hashes as the Node core). Results: `results/`.
