# Ragdoll phase 3: ideas, spikes, and what to build (2026-11-13, exploration before building)

Inputs: the user's wishes (cannon, trampoline and wrecking balls "definitely"; falling from a Jenga tower seen through the humanoid's
eyes, with ragdoll physics carrying torso and neck; "a few of those cartoon test dummies in a trebuchet getting hurled at a really
nice looking castle, causing major damage"); the coordinator's sketch (animated humanoid → ragdoll, active ragdoll, ragdoll Galton
board, Gravitron, human-scale marble machine, detachable limbs, crash-test mode, stunt mode, the PhysX-vs-Bullet race).
Grades: **Measured** (spike in this repo), **Estimate**, **Decision** (the user's call). Tolerances, per the user: no exactness gates.

## 1. What the spikes measured (Node, the browser's PhysX 5.12 WASM; `probes/node/spikes/`, `probes/spike-pov.mjs`)

| question | result |
|---|---|
| **First-person view** from the head (`spike-pov.mjs`, `evidence/spike-pov-*.png`) | **Works** in standard X3D: a Viewpoint under the skull HAnimSegment (where H-Anim's eye sites live) rides the head as the bridge writes joint rotations. The raw view is violent: head spin median 1.5 rad/s, 90th percentile 10.5, peak 31 rad/s during a stairs fall. Needs a stabilised camera option (below). |
| **How many ragdolls at once** (`pile.ts`) | Piles are **stable** up to 8 figures (no NaN in 5 s) once none starts inside another. Cost per physics step: 2 figures 0.8 ms, 3 → 2.5 ms, 5 → 5.2 ms, 8 → 7.5 ms (real time needs under 4.2 ms). So about **3 tumbling at once** in real time; more in slow motion, or in turns (sleeping piles are cheap). |
| **Teleporting a figure into occupied space** (`scale.ts`) | **NaN** at 5+ figures. The bridge needs a teleport guard (check the space, or spawn above the pile). |
| **Trampoline** in standard X3D (`trampoline.ts`) | X3D allows one bounce value per collection, so the bed is a platform on a SliderJoint whose `sliderForce` (live X3D) the page sets each frame as a spring. Frame-rate updates are stable and the **first bounce works** (pelvis back to 1.43 m after a 3 m drop), but the limp figure then **sinks through the rising bed** in 2 of 2 settings. Unresolved. |
| **Standing still** (stiff figure waiting on a tower top; `balance.ts`) | A stiff figure topples like a statue in 1.2–1.9 s; a root balance assist did not save it; acceleration drives let the knees buckle, so **stiffness now uses force drives** (4000 N·m/rad; joints hold the load above them; stairs sweep re-run: 60/60 stable). Standing indefinitely needs **pinning**: a fixed-base articulation released on impact (PhysX supports it: remove, clear `eFIX_BASE`, re-add). |
| **Gravitron** self-check (`gravitron.ts`) | **Works** once the floor turns with the drum (as on the ride): the figure stays pinned after the floor drops away and slides off as the drum slows, at **2.97 rad/s** against **2.22** predicted by μω²r = g (μ 0.7, r 2.85 m), with a slow creep before. 34 % gap logged for study (a limp body is not a point mass; PhysX friction is an approximation of Coulomb's law). |

## 2. The ideas, graded

| idea | fun | standards story | feasibility | estimate | recommendation |
|---|---|---|---|---|---|
| **Trebuchet dummy barrage** at a showpiece castle | very high | trebuchet already standard X3D; dummy is H-Anim | **green**: the sling cannot hold an articulation (X3D joints join RigidBody nodes only), so a dummy-weight stone flies and the ragdoll takes its place at release with its exact velocity; one figure flies at a time (cheap) | 1–2 days incl. a beautiful castle (crenellated walls, towers with conical roofs that topple, gate, banners, stone textures) | **build first** |
| **Cannon** with aim and power | very high | root velocity (page-driven, recorded) | **green** | ½ day | build |
| **Wrecking ball** on a chain from a crane | very high | BallJoint chain, latch removed from the collection | **green** (all parts already work) | ½ day | build |
| **Jenga tower, first person** | very high | Viewpoint under the skull segment; X3D's own camera binding | **amber**: tower stability to measure; standing on top needs pinning (above); camera needs stabilising | 1–2 days | build, with camera modes |
| **Trampoline** | high | SliderJoint + live sliderForce (or a bounce hint) | **amber/red**: sinks through after the first bounce | ½–2 days | spike one more route, then decide |
| **Gravitron** | high (and self-checking science) | kinematic drum on a TimeSensor; floor switched by `enabled` | **green/amber**: works, 34 % from theory | 1 day | build (shows measured vs predicted) |
| **Crash-test mode**: impact heat map on segments, head score | medium-high; good for educators | per-segment colours from the Ouch-o-meter's data; head acceleration from the state | **green** | ½ day | build (cheap, reuses scoring) |
| **Stunt mode** (ramp launch, spins, distance) | high | as cannon | **green** | ½ day | fold into the cannon |
| **Ragdoll Galton board** (do ragdolls obey Bernoulli?) | high (a real experiment) | as the Galton board | **amber**: ~3 at once in real time, so drops in turns, a long run, slow motion | 1 day | later in phase 3 |
| **Animated humanoid → ragdoll** (walk/idle, then a hit) and **active ragdoll** (drives toward the animation, limp past a torque) | very high | HAnimMotion animation; drives toward its pose; the standard question is where targets live while the bridge writes `rotation` | **amber**: drives work (force drives now); pin/unpin works in principle; needs a target channel | 2–3 days | phase 4 (the coordinator's PoC 3) |
| **Detachable limbs** (toy-style, no gore) | high | **Decision**: no X3D field for a break force; articulation joints cannot break; would need a metadata hint (bends "standard nodes only") or a proposed extension, plus splitting the articulation | **red-amber** | 2 days | decide later |
| **PhysX vs Bullet ragdoll race** | medium | Bullet needs the figure as RigidBodies and joints (maximal coordinates): a 3-way comparison (PhysX articulation, PhysX joints, Bullet joints) | **amber** | 1–2 days | later |
| **Human-scale marble machine** / 10 cm action figures in the existing machine | high | reuse pieces | **red**: big build; small masses next to heavy parts strain the solver (to test) | 3+ days | not in phase 3 |

## 3. Bridge work these need

1. Teleport guard for ragdolls (never into occupied space; measured NaN otherwise).
2. Pin/unpin a humanoid (fixed base until impact): needs a standard trigger. Candidates: the humanoid stands on a `fixed` RigidBody and is
   "attached" to it until an impulse above a threshold; or the coordinator's route (HAnimMotion-driven pose, flip on an event).
3. Force drives for stiffness (done in the spike, kept).
4. Ragdoll swap at release (page-level: teleport a parked figure with the stone's pose and velocity; the stone leaves the simulation).
5. Decisions pending: per-shape bounce (trampoline), breakable joints (limbs).

## 4. Proposed order

- **3a (the barrage):** cannon, wrecking ball, trebuchet dummy barrage at a new showpiece castle, crash-test heat map. All green.
- **3b (the vertigo):** Jenga tower with pinning and a first-person camera (raw, steadied, horizon-locked), wrecking ball through it.
- **3c (the rides):** Gravitron (measured vs predicted), trampoline (after one more spike), ragdoll Galton board.
- **Later (PoC 3):** animated → active → limp ragdoll; detachable limbs; PhysX vs Bullet ragdolls; human-scale marble machine.
