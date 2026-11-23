# Learnings: Giza Fall v4, Summit Duel (23 Nov 2026)

v1 to v3 of Giza Fall (x3d.demo `docs/demos/blender-giza-fall/`) replay one Bullet fall that Blender computed in advance. v4 simulates every duel live:
- two active H-Anim ragdolls with paintball pistols on Khufu's summit;
- a seeded deck of twelve omens (electrodynamic, supernatural, metaphysical, military, paint);
- a fall down the 203 courses under a time curve that changes every time;
- rewind, and a branching "Ankh" restore.

**Stack.** three.js 0.187 for the view, Rapier 0.21 (`@dimforge/rapier3d-deterministic-compat`) for contacts and joints, and the rest of the simulation in five JavaScript files marked `// loom:sim`. The view reads v3's own `fall.x3d` and baked textures through a small X3D loader (law 38: one master).

**Owner's brief.** Mixed tone (slapstick, military, mystical, metaphysical), CPU against CPU with the viewer as director, a playable game and a self-playing showcase at equal weight, and a PR kit plus this fold-back.

**Rig.** One Linux machine; Node 22.23.5; headless Chrome 153 with SwiftShader (no GPU). Every number below was read by the thread that built the demo, so it is **Likely** under law 44 until a second reader recomputes it. Records are in the demo's `receipts/`.

**Grades:**
- **C**, Confirmed: shown by a named tool or test in this work (here still self-read, see above).
- **L**, Likely.
- **S**, Suspected.

## 1. What was measured

| Check | Result | Where |
|---|---|---|
| Rapier's deterministic build plus portable JavaScript, Node against Chromium | 3,600 of 3,600 per-step hashes equal (seed 11); the same bits for 20,000 portable sines; same model sha256 first (pattern 21) | `receipts/duel-seed11.physics.json`, `browser.json` |
| `kit/loom physics` on that record | pass. Its wrong twin (one replay mismatch at step 1,800) fails `PHYS_HASH_DRIFT` | `receipts/loom-physics.json` |
| `kit/loom pagetraps` | pass, `sim_units` 5. Its wrong twin (one `Math.sin` added to `pmath.js`) fails `sim-nonportable-math` | `receipts/loom-pagetraps.json` |
| A complete checkpoint, then 2,000 more steps | identical hash; a Rapier snapshot is 150 to 167 KB with 22 bodies and 347 colliders | gate 9 |
| Restored without the JavaScript controllers / without the RNG | both diverge (2 of 2 controls caught) | gate 9 |
| Lorentz step as an exact rotation | turn error 1.3e-15 rad per step; the explicit-Euler twin gains 7.8 % speed in 60 steps | gate 4 |
| 16 seeded rounds | all end within 150 s; median fall at 61.5 s; Explorer 6, Pusher 9, draw 1 | gate 10 |
| In-page "Verify replay", after a branch | 19 of 19 hashes equal | `browser.json` |

## 2. Rules for the next agent

| # | Rule | Grade | Evidence |
|---|---|---|---|
| 1 | **Integrate a rotation as a rotation.** A magnetic (Lorentz) step written as `v += (q/m)(v × B) dt` grows speed by √(1 + (ωdt)²) every step. At ωdt = 0.05 that is 7.8 % in 60 steps, a visible spiral where the physics has a circle. Rotate the velocity by ω dt exactly, with portable sine and cosine, and gate both the turn per step and the speed. | C | gate 4 and its twin |
| 2 | **A portable function's error lives at its range-reduction seams; measure it at the arguments the simulation uses.** `pcos(x) = psin(x + π/2)` sends a small angle to the edge of the reduced range. There a degree-11 Taylor sine is worst (about 4e-8), and a 1e-9 turn limit failed at 1.8e-9. Degree 17 gives 1.3e-15. Compare against `Math.sin` only in tests, never in the sim. | C | gate 2; the first run of gate 4 |
| 3 | **A field that rescales time must act on whole articulated units.** The time eddy first scaled velocities body by body. Joints then joined slow bodies to fast ones and injected energy. Decide inside or outside per figure (its pelvis) and scale every part together. | C | the eddy rewrite in `sim.js` |
| 4 | **Coerce state flags before comparing them.** `inside = eddy && dist < r` is `null` when there is no eddy, and `null === false` is false. Every body was then "leaving" the eddy every step, and its velocity was multiplied by 4 each step: every round launched both duellists 3 to 9 km. A gate on round outcomes (fall drop, peak speed) caught it at once. | C | round gate, first run after the eddy change |
| 5 | **A moving pusher slower than its push carries what it pushes.** The Eye of Ra beam pushed whatever was inside its 1.4 m slab, and it moved at 1.84 m/s, so it pushed both duellists along with it and off the edge, again and again. Hit once per crossing (an impulse), then let it pass. | C | seed 3 trace: both fell 0.6 s apart, 4 of 8 rounds ended in a draw |
| 6 | **Gate that the game ends.** "Every seed ends within the cap" found stalls: 7 of 12 rounds without a fall at 150 s, and later one fall that started at 133 s. Fix it in the design (escalating knockback from 50 s), never by widening the cap. The seed count went from 12 to 16 after the first run, which is stricter. | C | gate 10; `test/limits.json` |
| 7 | **Two agents updated in a fixed order give the second one fresher information.** With index 0 always first, 12 seeds went Pusher 8, Explorer 3, draw 1. Alternating the order per step gave 9 to 6 on 16 seeds. That is within chance, and it is not shown that order was the cause. | S | gate 10 before and after |
| 8 | **An engine snapshot is not the state.** Rapier's `takeSnapshot` holds bodies, colliders and joints. The JavaScript controllers, omen timers, pellets in flight, paint, the RNG and the step counter live outside it. Checkpoint all of them; prove it with the continuation hash and with one incomplete-restore twin per domain (pattern 25 with an engine of its own). | C | gate 9 |
| 9 | **Record director inputs by the step that applies them, and replay them before that step's tick.** The in-page check re-simulates the viewer's whole session, branch included, from the seed and that log. It agreed 19 of 19 times. | C | `browser.json` |
| 10 | **Projectiles as rays, not bodies.** Pellets and shells integrated in the simulation's own state, with `castRayAndGetNormal` per step, cannot tunnel through a 4.5 cm forearm. They also keep the Rapier world, and its snapshot, small. | L | design; no tunnelling twin was run |
| 11 | **Per-tile friction needs a combine rule.** With Rapier's default average, a 0.035 "ice" tile under a 0.9 boot gives 0.47, which is not ice. Use `Min` for slippery paint and `Max` for glue. | C | `sim.js` `paintTile` |
| 12 | **A bake chosen for one camera path is wrong once the action can go anywhere.** v3 baked only the fall strip of the north face at high density; its other faces read grey and soft at a close chase camera. v4 lights those faces live (sun, shadows, triplanar grain) and keeps the strip's bake. | C | `shots/03-fall.jpg`; the before shot was in the build thread only |
| 13 | **A headless software renderer cannot pace a real-time page.** SwiftShader drew about 4 frames per second, so 12 s of wall time held 4.1 s of simulation. The checks step the simulation through a test hook (`fast(n)`) that bypasses the frame clock. Page timing was therefore not tested, and pattern 24 says what that leaves open. | C | `browser.json` and the first smoke run |

## 3. Traps (for the cheat-sheet)

- **Rapier 0.21 (JS, deterministic-compat):**
  - spherical joints have motors per axis but no limits in JS; revolute joints have `limits`;
  - a ray hit carries `timeOfImpact` (`toi` in older builds);
  - `World.restoreSnapshot` returns a new World: free the old one; handles stay valid;
  - friction combine rules are per collider (rule 11);
  - the compat build inlines its wasm, 4.4 MB.
- **three.js 0.187:**
  - `PCFSoftShadowMap` is removed (it warns and uses PCF);
  - `MeshBasicMaterial`'s vertex shader has no `objectNormal` (use `normal` in `onBeforeCompile`);
  - `build/` ships `three.module.js` plus `three.core.js`, and no minified files.

## 4. Not shown
- A second machine.
- Firefox and WebKit.
- A real GPU and the frame rate.
- A phone.
- A person playing.
- A second reader for any number above.
- Limits committed before the run: `test/limits.json` was written before the first suite run but not committed first, and the run record has no `limits` block.
