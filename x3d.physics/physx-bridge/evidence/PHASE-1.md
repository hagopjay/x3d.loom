# Phase 1 evidence: bridge core (2026-11-12)

All numbers below were **measured** on this Mac (Apple silicon, macOS 26) unless marked otherwise. Browsers: Playwright 1.58.2 with Chromium 145.0.7632.6 (full browser, real WebGL), Firefox 146.0.1, WebKit 26.0.

| file | what |
|---|---|
| `p1-enabled-probe-{chromium,firefox,webkit}.json` | does `RigidBodyCollection.enabled = FALSE` stop X_ITE's Bullet? (`probes/enabled.html`) |
| `p1-ccd-sweep.txt` | tunnelling with and without CCD, 50 start phases per row, two contact offsets (`probes/node/ccd-sweep.mjs`) |
| `p1-analytic.json` | the analytic tests of SPEC section 7 (`npm test`) |
| `p1-sidebyside-{chromium,firefox,webkit}.json` + `*-t0/mid/end.png` | `scenes/marble-minimal.x3d` on PhysX (bridge) and Bullet (X_ITE), trajectories every frame (`probes/run-sbs.mjs`) |
| `p1-sbs-marble-minimal-chromium.json`, `p1-sbs-marble-minimal-friction2-zero-chromium.json` | the rolling-friction control experiment |

## Results

1. **X_ITE's engine can be switched off.** With `enabled = FALSE`: 0 position events in 120 frames, writes from the bridge stick, ROUTEs carry them to the Transform. One leak: `loadURL()` resolves after one Bullet step (y 0.32 → 0.319974–0.319989). `createX3DFromURL` → disable → `replaceWorld` leaks nothing (y = 0.32 after 120 frames). Same in all three browsers.
2. **Analytic tests** (`npm test`, 9/9 pass): free fall within 1.5e-6 m of the discrete solution (continuum error 0.020436 m = ½·g·h·t); pendulum period −0.0014 % (ball joint and hinge, L = 0.5 m, θ0 = 0.05); incline 30° μ = 0.3 slides at g(sin θ − μ cos θ) within 2 %, μ = 0.7 holds; restitution law rebound = e·(v + g·h) to 1e-7; tunnelling: control tunnels, CCD never (40 phases); same-process determinism: 480 steps × 20 marbles, identical hashes.
3. **Restitution limit cycle** (found by the test): below `minBounceSpeed` ≈ e·g·h/(1−e) a ball never rests. The bridge raises the threshold to 2·e·g·h/(1−e) and reports it.
4. **Side by side** (`marble-minimal.x3d`, Chromium): PhysX 0.1–0.25 ms/step, 238–244 steps/s; marble in the cup at 0.86 s. Bullet: in the cup at 1.13–1.28 s, 299 mm behind PhysX at 0.7 s, 32 mm sideways drift in z. Firefox and WebKit: same PhysX outcome (final x 0.4386–0.4392 m at 719–721 steps).
5. **Control experiment**: setting the second friction coefficient (X_ITE: Bullet rolling friction) to 0 did not make Bullet faster. A pure time shift (0.28–0.39 s) leaves 35–61 mm RMS, so X_ITE's step warm-up explains part of the gap, not all. Open for the race (phase 4).

## How measured, and limits

- The Bullet side's simulated time is not observable through SAI; comparisons use wall time since Run. PhysX's sim time is exact (step count × 1/240 s).
- Firefox and WebKit clamp `performance.now()` in workers to 1 ms, so their per-step physics times are coarse.
- Headless WebKit drew far fewer frames (91 in 3 s) than Chromium (~360); PhysX still kept real time.
- One run per configuration; run-to-run variation of the Bullet side is visible (cup entry 1.13 vs 1.28 s in two runs of near-identical scenes).
