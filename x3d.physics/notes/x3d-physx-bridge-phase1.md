# x3d-physx-bridge: phase 1 (2026-11-12)

Repo: ~/Projects/x3d/work/x3d-physx-bridge (local git, main, HEAD 532d9b6; no remote). Read evidence/PHASE-1.md and SPEC.md (draft 0.2).

- Installed (user OK): physx-js-webidl 2.9.1, x_ite 16.7.0, vite 7.3.2, typescript 5.9.3, esbuild, @playwright/test 1.58.2 (95 MB). Browsers were already cached.
- Node 24 keg-only: export PATH=/opt/homebrew/opt/node@24/bin:$PATH. `npm test` 9/9. Dev: `npx vite` → :5181/sidebyside.html.
- physx-js-webidl is a web-only Emscripten build; tests/physx-node.ts shims it for Node. Its npm package has no LICENSE file.
- X_ITE RigidBodyCollection.enabled=FALSE stops Bullet; loadURL leaks one step; createX3DFromURL → disable → replaceWorld leaks none (3 browsers).
- X_ITE Bullet: variable step (moving average from 0), frictionCoefficients.y = rolling friction, inertia ignored, joints need both bodies, anchors in world coords.
- PhysX: restitution applies to v+g·h → hop limit cycle below e·g·h/(1−e); bridge raises minBounceSpeed. Default contact offset 2 cm hides tunnelling; bridge sizes offsets per shape.
- Open: Bullet vs PhysX gap only partly explained by X_ITE's step warm-up (35–61 mm RMS left).
- Next: phase 2 (all joints + outputs, MotorJoint, CollisionSensor → Contact nodes, kinematic bodies end-to-end).

## Phase 2 (same day): joints and sensors done
- HEAD after phase 2: see git log in the repo; evidence/PHASE-2.md. npm test 18/18.
- SAI cannot write outputOnly fields; getField(name).setValue works (X_ITE warns it is deprecated).
- X_ITE: CollisionSensor ignores enabled until collider is re-assigned; joints write outputs unless forceOutput NONE; no UniversalJoint/MotorJoint; TimeSensor pauseTime ignored before live; enabled F/T coalesce in one turn.
- PhysX: D6 drive velocity sign inverted, forceLimit = impulse per step; threshold-force contact reports never fire under TGS.
- Kinematic elevator: per-step paths + catch-up + clocks restarted at load. Next: phase 3 (piece library, pegboard, build mode, export).

## Phase 3 paused (user's request, approaching usage limit)
- WIP committed; read evidence/PHASE-3-WIP.md for done/open. Default machine path A: 20/20 in cup in Node, 0/20 in browser (reader vs IR mismatch to debug first).
- User decision relayed 2026-11-12: keep both phase-1 defaults (inertia from shapes; minBounceSpeed raised). Recorded in SPEC section 0.

## Phase 3 done (resumed after the pause)
- evidence/PHASE-3.md. Browser/Node mismatch was the import sanitiser snapping −8° to −15°. Default machine 18–19/20 in browsers, 20/20 Node; all 16 generated scenes valid (0/0); export runs in plain X_ITE (Bullet loses marbles through the floor). Firefox 12 ms/step on the full machine (phase 5).

## Phase 4 done
- evidence/PHASE-4.md. Replay bit-exact in Chromium, Firefox, WebKit, Node. Race via Inline + IMPORT. Sound measured at the WebAudio destination (no ears). EnvironmentLight is X3D 4.1: added at runtime only. Bug class to watch: Object.assign of functions onto page state (hit twice); expose() now guards.

## Phase 5, part 1 (2026-11-12): four more demos at the user's request
Music box, draw-a-domino run, trebuchet vs castle, Galton board, on a shared demo shell; a hub page (index.html). Bridge gained live joint
removal, live gravity, live CollidableShape.enabled, contacts 'sensed', peak-merged impacts. All pass in Chromium/Firefox/WebKit; all
exports validate 0/0. Evidence: evidence/DEMOS.md. Still open in phase 5: the Playwright test suite (npm run smoke), final SPEC.

## Phase 5 done (2026-11-12)
Playwright suite (npm run smoke, 33 tests, 3 browsers, production build): last run 30/33 under heavy machine load (user accepted). Bridge
fixes: WebKit createX3DFromString watchdog+retry; scene clocks pause while physics catches up. 60 fps not met under load (52.6 median).
Evidence: evidence/PHASE-5.md. SPEC draft 1.0. Next, with the user's approval: the 2nd proof of concept.

## Second proof of concept: H-Anim ragdoll (paused 2026-11-12, usage limit)
User chose: H-Anim ragdoll; character picked per run (crash-test dummy, cartoon person); all four contraptions; Ouch-o-meter with
replays; cartoon effects plus grunts. Plan: SPEC-RAGDOLL.md. Phase 1 core works (H-Anim fields -> PhysX articulation, write-back to
HAnimJoint rotations; Node stable; Chromium 59 fps). Hand-over and open items: evidence/RAGDOLL-PROGRESS.md.
Also pending the user's yes: a separate session to fold the bridge's lessons into Loom v1 (~/Projects/x3d/loom/v1, its fold-back kit).
