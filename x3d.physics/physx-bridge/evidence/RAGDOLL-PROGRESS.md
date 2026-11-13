# H-Anim ragdoll: progress at the pause (2026-11-12)

Phase 1 is done: see `RAGDOLL-PHASE-1.md`. This note was the hand-over at the pause. Plan and decisions: `SPEC-RAGDOLL.md`.

## Done and measured
- **The skeleton from the standard.** `tools/hanim-loa.py` extracts H-Anim's joint and segment tables (index, parent, LOA, default
  centre) from the X3D 4.0 XSD in the x3d_mcp server; `src/ragdoll/hanim-loa1.ts` is the LOA-1 skeleton (18 joints, nearest LOA-1
  parents). `src/ragdoll/humanoid.ts` builds an original crash-test dummy on it (78 kg, Winter-style mass fractions, capsules and boxes,
  per-axis limits) as standard X3D (HAnimHumanoid / HAnimJoint / HAnimSegment with mass, centerOfMass, llimit, ulimit) and as the
  bridge's model.
- **The bridge reads H-Anim** (`src/bridge/hanim.ts`): skeleton walked depth first; each HAnimJoint + HAnimSegment becomes an
  articulation link; segment geometry through Transforms becomes collision shapes; joints are typed from the limits (all axes locked:
  fixed; one moving axis: revolute; else spherical with per-axis limits); stiffness becomes a drive to the bind pose; a little damping on
  every moving axis. Links share the body index space (state, contacts, hashes, teleports of the root). Each frame it writes every
  HAnimJoint.rotation (child relative to parent) and HAnimHumanoid.translation/rotation; X_ITE's H-Anim draws the figure.
- **Node** (`tools/ragdoll-sim.ts`, evidence `ragdoll-drop-*.json`): drops from 0.02, 1 and 2 m, upright starts and shoves: no NaN;
  joints stay together within 1 µm; the figure crumples and comes to rest; 0.17–0.65 ms per step for 18 links; PhysX joint coordinates
  stay within the limits within 0.06–0.17 rad at hard impacts.
- **Chromium** (`probes/run-ragdoll.mjs`, `ragdoll-p1-chromium.json` and `ragdoll-p1-*-chromium.png`): the page reads 18 links from the
  X3D, the dummy drops and lands lying down (pelvis 0.13 m), 59 fps, no errors; the H-Anim fields follow physics.
- 22 unit tests still pass.

## Logged for later study (tolerances, per the user: do not chase exactness)
- **Limits are soft**: up to 0.17 rad beyond a limit during hard impacts. Tolerance used: 0.2 rad.
- **H-Anim's per-axis limits vs PhysX's twist/swing coordinates**: an x-y-z angle reading of the same joint differs from PhysX's joint
  coordinates by up to 2 rad on large swings, so H-Anim limits are only approximately PhysX's. Visuals are unaffected (the write-back
  uses quaternions). Needs a careful mapping study.
- **Starting with limbs inside the floor sends the articulation to NaN** (found through a bug in the test, which teleported the pelvis
  to the feet's height). The bridge should guard teleports of a ragdoll (keep the figure above the ground) or detect NaN and reset.
- **A physics spike in the browser**: 5.45 ms per step for a moment during the first impact (Node: under 0.7). To measure.
- **Loading the ragdoll page takes about 3 s** (the H-Anim component and the scene); not yet broken down.

## Next (when work resumes)
1. Run `probes/run-ragdoll.mjs` in Firefox and WebKit; a replay check (bit-exact hashes include the links).
2. A browser check that the reader's model equals the Node model (as for the machine).
3. Commit phase 1 evidence (`evidence/RAGDOLL-PHASE-1.md`), then phase 2: stairs of doom, Ouch-o-meter, pop-ups, instant replay,
   cartoon sounds and grunts, the cartoon character, follow camera.

## Phase 2 (stairs of doom and the comedy layer), 2026-11-13
Done: stairs stage (12 steps, rail on one side, cardboard boxes, TNT crate); live HAnimJoint.stiffness (stiff at the top, limp on the
push); Ouch-o-meter from impact impulses (`src/ragdoll/ouch.ts`); 3D pop-up words (X3D Text on Billboards); cartoon sounds and
formant-synthesised grunts; power flicker (random rigid/floppy via stiffness, with power-up/down sounds); plank mode; TNT blast
(page-driven impulses, recorded); slow-motion instant replay with sound and words; follow camera; the cartoon person (60 kg, bendier, eyes).
Measured: Node sweep of 2 characters × 3 pushes × 5 wobbles, with and without the blast: 60/60 stable (`tools/stairs-sim.ts`,
`probes/node/stairs-wobble.ts`). Chromium: shove 4,710 points (TNT set off), flicker+launch 5,213, instant replay, cartoon nudge; 0 errors.
Fixed on the way: a per-link blast tore the articulation (now one velocity change for the whole figure); spherical limits beyond 1.9 rad
went to NaN (bridge caps them, joint speed capped at 40 rad/s; both in the loss report); a stiff figure cannot balance, so physics waits
for the push. Logged: pop-up density tuned by eye; Firefox/WebKit not yet run for phase 2; the user asked for "some error and sloppiness
tolerance": no exactness gates.
Declined: an "opioid" character (it would mock real addiction); the same random rigid/floppy mechanic shipped as the dummy's power flicker.

## Phase 3a so far (2026-11-13): the dummy barrage
Spikes and concept doc: `CONCEPTS-RAGDOLL-PHASE3.md`. Built: `barrage.html` (three trebuchets, three toon dummies, a 331-stone castle with
towers, conical roofs and banners). At release the ball leaves (CollidableShape.enabled) and a parked ragdoll is teleported into its place
with its velocity. Explosive dummies (default on): the first hard hit on the castle blasts stones within 4.5 m.
Measured (Chromium, loaded machine): plain dummies knocked out 5 of 331 stones; explosive dummies 195 of 331 (59 %); no errors; physics
17-34 ms/step once the castle wakes (plays as bullet time). Node: no NaN through three shots.
Bridge fixes found here: a ragdoll teleport now updates every link's kinematics at once (PhysX moved only the root until the next step:
NaN within 4 steps, measured); ragdoll links' push-out speed capped at 3 m/s (crushed under stones: NaN, measured).

### 3a: cannon and wrecking ball (commit e7902f0)
Contraption picker on `ragdoll.html` (J/N/W). Cannon 12/18/26 m/s (up to 87 m in Node); wrecking ball 400 kg on a 7.5 m rod, released by
removing its Latch joint from the collection. Chromium: cannon 6,081 points, wrecking 2,467; Node 12/12 stable, every swing connects.

### 3a: crash-test heat map (2026-11-13)
`src/ragdoll/crashtest.ts`, on both `ragdoll.html` and `barrage.html` (key T, default on).
- **Heat map**: each segment has its own PhysicalMaterial (`buildHumanoid({ heat: true })`, DEF `<prefix>HeatMat_<joint>`). Every
  segment carries a virtual accelerometer: |Δv| / Δt between state samples, in g, peak kept. Untouched segments read cool grey (thermal-
  camera style, so the yellow dummy's own colour is not mistaken for heat), then yellow at 30 g, orange at 80 g, red at 200 g, with a
  glow at the hot end and a short flash on each scored hit.
- **Why not the contact impulse** (first attempt, measured): in an articulation one contact can stop the whole body, so impulse over the
  segment's mass read 141 m/s on a 7.5 kg thigh. The segment's own velocity change is what it felt.
- **Head score**: HIC-style (window ≤ 36 ms) from the skull's velocity samples: a lower bound (|Δv| ≤ ∫|a|), smoothed by frame-rate
  sampling. Gaps longer than a window still count (some 36 ms window inside has at least their mean). Unit test: a 50 g, 36 ms square
  pulse reads 619 at 1 ms sampling against 636 by hand (−3 %, the sampling edges); frame-rate samples read lower, never zero.
  Cartoon reading: fine / sees stars / sees planets / sees whole galaxies (100, 400, 1000). Not an injury verdict.
- **Launch is not a crash**: the first 0.12 s after a reset only primes the samples (a cannon takes the body to 26 m/s in one step);
  the barrage resets each dummy at the swap.
- **Measured, Chromium** (`probes/run-crashtest.mjs`, `evidence/heat-*.png`, `evidence/crashtest-chromium.json`), one run each, run-to-run
  spread large (the scale is by eye, per the user's tolerance guidance):

  | run | head score | head peak | worst segment |
  |---|---|---|---|
  | stairs launch | 29-108 | 15-41 g | hand / foot, 25-67 g |
  | cannon 26 m/s | 935-8,058 | 79-248 g | toes, 138-470 g |
  | wrecking ball, hard | 12-1,311 | 10-120 g | arm / hand, 45-197 g |
  | barrage (three toons, explosive) | 659-1,770 | – | hands, 57-85 g |

- Barrage castle damage on re-runs: 195 and 178 of 331 (59 %, 54 %): timing differences between runs, logged.
- Logged for study: peaks depend on the state sample spacing (frame rate, and bullet time in the barrage at 19-39 ms per step);
  light segments (hands, toes) peak highest when they snap against joint limits. A per-step accelerometer in the worker would be
  steadier.
- **Firefox and WebKit** (`BROWSER=firefox|webkit node probes/run-crashtest.mjs`, `probes/run-barrage.mjs`; `evidence/crashtest-*.json`,
  `evidence/barrage-*.json`, `evidence/heat-browsers-strip.webp`):
  - WebKit: stairs, cannon, wrecking ball and the barrage all run with no errors; heat map and head score work; barrage 209 of 331 stones.
    Peaks: cannon head score 1,189, hands 91-113 g.
  - Firefox (headless): stairs, cannon, wrecking ball run with no errors; heat map renders. Physics ran at about a third of real time
    (sim 5.3 s in 16 s wall), so state samples were further apart and peaks read lower (cannon head score 92, toes 46 g): the
    sample-spacing effect logged above. The barrage in headless Firefox ran at 4 fps (57 ms/step) and the dummies were still in flight at
    the probe's 2-minute limit: logged, as with earlier headless-Firefox slowness; not chased.
  - A first Firefox run lost `window.__rag` mid-run: the dev server's hot reload, because a source file was edited during the run. The
    re-run was clean.
  - Frame-rate minimums include the scene reload that the wrecking ball does on each attempt (down to 2-5 fps for a moment).
