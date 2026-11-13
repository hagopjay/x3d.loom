# Ragdoll phase 1: the H-Anim humanoid as a PhysX articulation (2026-11-13)

Measured on this Mac unless marked. Tolerances (the user's rule: state them, log what falls outside, do not chase exactness):
poses 1 cm and 0.05 rad between engines and replays; joint limits 0.2 rad; model read from X3D vs built in Node 1e-5.

## What exists
- `tools/hanim-loa.py` → `src/ragdoll/hanim-all.json` → `src/ragdoll/hanim-loa1.ts`: H-Anim's joint and segment tables from the X3D 4.0
  XSD (x3d_mcp); the LOA-1 skeleton (18 joints) with H-Anim's default centres.
- `src/ragdoll/humanoid.ts`: an original crash-test dummy (78 kg) as standard HAnimHumanoid/HAnimJoint/HAnimSegment with `mass`,
  `centerOfMass`, `llimit`, `ulimit`; a cartoon person (same skeleton, other materials).
- `src/bridge/hanim.ts`: reads HAnimHumanoid into articulation links (segment geometry through Transforms as collision shapes) and writes
  HAnimJoint.rotation and HAnimHumanoid.translation/rotation back every frame. `src/bridge/world.ts`: builds the articulation in the same
  PhysX scene as the rigid bodies; links share the body index space (state, contacts, hashes, root teleports).
- `ragdoll.html` (`src/ragdoll/ragdoll.ts`, `stage.ts`): the dummy on a floor; drop, shove, swap character.

## Results
Node (`tools/ragdoll-sim.ts`; `ragdoll-drop-*.json`):

| start | NaN | joints apart (max) | rest | pelvis at the end | ms/step | limits beyond 0.05 rad (max) |
|---|---|---|---|---|---|---|
| 0.02 m, push 0 m/s | False | 4.88e-07 m | 0 m/s | 0.12 m | 0.3 | 0.17 rad |
| 1 m, push 1.5 m/s | False | 6.38e-07 m | 0.108 m/s | 0.23 m | 0.743 | 0.282 rad |
| 2 m, push 4 m/s | False | 9.49e-07 m | 0 m/s | 0.222 m | 0.346 | 0.427 rad |

Browsers (`probes/run-ragdoll.mjs`; `ragdoll-p1-<browser>.json` and screenshots): drop from 2 m with a spin, then a shove; a recorded drop
replayed; the model the bridge read from the X3D compared with the one Node builds.

| browser | links read | pelvis after landing | impacts | fps | physics steps/s | replay | model differences (1e-5) | errors |
|---|---|---|---|---|---|---|---|---|
| chromium 145.0.7632.6 | 18 | 0.13 m | 81 | 62 | 242 | 604 steps, 0 hash differences | 0 | 0 |
| firefox 146.0.1 | 18 | 0.13 m | 81 | 59 | 245 | 623 steps, 0 hash differences | 0 | 0 |
| webkit 26.0 | 18 | 0.13 m | 81 | 17 | 246 | 610 steps, 0 hash differences | 0 | 0 |

## Interpretations (also in the loss report)
- **Equal limits mean no limit.** X3D 4.0 (and X_ITE) default `llimit` and `ulimit` to `0 0 0`, so equal limits cannot mean "locked"
  without freezing every H-Anim figure that does not author limits. The bridge reads equal limits (the default included) as a free axis,
  a range under 0.01 rad as locked (the dummy locks with ±0.002 rad), anything else as limited. Found by the model comparison.
- One moving axis → revolute joint; none → fixed; otherwise spherical with per-axis box limits on PhysX's twist/swing coordinates.
- `stiffness` → a drive towards the bind pose; every moving axis also gets a little damping.

## Logged for later study
- Limit overshoot at hard impacts: up to 0.43 rad (shoulder, 2 m drop at 4 m/s) after the lock change; 0.17 before. Above the 0.2 rad
  tolerance in the hardest case.
- H-Anim's x-y-z limit axes vs PhysX's twist/swing coordinates: readings differ by up to 2 rad on large swings.
- A ragdoll started with limbs inside the floor goes to NaN: the bridge needs a teleport guard.
- A one-off 5.45 ms physics step at the first impact in Chromium; the page takes about 3 s to load; WebKit headless draws this page at
  about 13 fps (physics keeps 240 steps/s).
