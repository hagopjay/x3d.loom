# What CHASM teaches (17 Nov 2026)

Source: https://github.com/hagopjay/x3d.gamelab PR #1, branch `claude/project-thread-vk3u55` (commits a1ed571 = 1.0 as delivered, 29f56ac = 2.0 arcade + FX layer), folder `cavern/`. Rig for every number: Node v22.23.5, Python 3.13, pinned x3d_mcp `b5c9956` (x3d-4.0 XSD + semantic), Chromium 153.0.8010.12 on software GL (SwiftShader). None of it is a GPU measurement; nobody has played it on a pad yet.

The 1.0 delivery already carries ten physics lessons (`cavern/docs/FOLDBACK.md`: air-relative velocity, one shape for collision/render/export, pre-projection impact capture, one-time gate crossings, explicit assistance with per-channel manual priority, overload accounting, scoped X3D export). This file adds what the 2.0 pass taught.

## 1. Findings

| # | Finding | Grade | Evidence | Rule it suggests |
|---|---|---|---|---|
| 1 | **A game layer can sit on a validated model without moving it.** Every 2.0 change is behind `params.arcade`; with it off, the 16 1.0 tests pass unchanged and `windAt`/collision are deep-equal to 1.0 | C | `cavern/test/arcade.test.mjs` test 1; 23/23 | Put fun behind one flag on the model, test "flag off = old model" explicitly, then freeze both releases |
| 2 | **New hazards are cheapest as SDFs combined with the existing field.** Columns and light-bars are exact capsule distances `min`-ed with the wall field inside one `_boundary()`; the existing swept contact, impact capture and crash rules applied with zero new contact code | C | test 4: impact, crash, no particle inside a capsule | When a solver already consumes a distance field, add obstacles to the field, not as a second collision system |
| 3 | **Upward wind is a fair "boost" that cannot cheat physics.** Thermals add `w·exp(-r²/R²)` to the prescribed wind; at air density 0 the body stays exactly ballistic (vy error < 1e-6) | C | test 3 | Express pickups/boosts as environment (wind, density) so the no-hidden-thrust invariant stays testable |
| 4 | **Bullet time belongs to the clock, not the solver.** Focus multiplies the wall-time fed to the 120 Hz fixed clock by 0.32; ticks, determinism and telemetry are untouched | C | arcade-browser gate: Shift → timeScale < 0.6 | Slow-motion = scale the accumulator input; never change `h` |
| 5 | **A coach that only tracks the centreline is a weak medal baseline.** Gate-offset tracking plus column side-stepping took the bot from 7/15 to 14/15 gates with 0 impacts; medal lines were then set relative to it | C | Node bot runs, `cavern/docs/ARCADE.md` | Tune the bot first, then set medals as "beat the bot" (silver) and a margin above (gold); log that humans have not tested it |
| 6 | **A screenshot read can misidentify an effect.** What looked like "a beige rock pillar with a cut base" was the additive thermal column plus its vent; what looked like a wingtip trail smear was a point light on glossy rock | C | probe stills with objects hidden one at a time | Before tuning a bad-looking object, prove which object it is (hide-one probes or a scene dump) |
| 7 | **Additive ribbons near the camera fill the screen.** Fading alpha with view depth (smoothstep 4–16 m) removed the smear | C | before/after stills | Every additive near-camera effect needs a depth fade |
| 8 | **A grade/blur pass belongs between bloom and the output pass.** Inserted there it works in linear HDR before tone mapping; the browser gate asserts the order | C | `composer.passes` order check | Assert pass order in a test; it silently changes the look when wrong |
| 9 | **Test runs rewrite tracked receipts.** `npm test` in x3d.gamelab rewrote three Flop Lab receipt files with new timestamps | C | `git status` after the run | Restore generated receipts before committing work on another lane; never commit them by accident |

## 2. Reusable pieces
* `cavern/src/fx.js`: a self-contained Three.js FX layer (grade ShaderPass, ring-buffer spark pool, ribbon trails, shockwave pool, onBeforeCompile scan-pulse injection) that only reads the sim.
* `cavern/test/arcade-browser.mjs`: Pages-subpath server + file:// check for every frozen release, with a JSON receipt.
* Fast-forward probe: pause, step the fixed-step model to a z, resume, screenshot: cheap stills of any course region under SwiftShader.

## 3. What this does not prove
* No hardware GPU, Firefox, Safari, phone or gamepad; audio never listened to.
* Medal thresholds are bot-relative only. Gaps list: `cavern/docs/FX-GAPS.md` (14 items).
