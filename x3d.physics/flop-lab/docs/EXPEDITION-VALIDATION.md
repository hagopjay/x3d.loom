# Expedition release evidence

Run date: 16 November 2026. This record scopes observations to the supplied
source plus this extension. It is not a formal Loom acceptance receipt.

## Automated checks executed

`node tools/check_release.mjs` ran the following eight Node suites successfully.
Its source identities, executor, elapsed times and actual stdout are retained in
`receipts/upgrade-checks.json`. Physics algorithms and inherited limits were not
changed by the Expedition extension. New dash impulses are an explicit gameplay
layer, and neutral Expedition hooks have a 300-step trajectory-equivalence check.

| Instrument | Fresh result | Domain |
|---|---|---|
| `test/core.test.mjs` | 22 assertions | Kernel and portable numerical operations |
| `test/gates.test.mjs` | 12 physical gates pass; six Node controls caught | Inherited authored fixtures and unchanged limits |
| `test/expedition.test.mjs` | 17 controls pass | Challenge state, ordering, records, ghosts and dash |
| `test/expedition-integration.test.mjs` | Eight controls pass | Actual Sim trajectories; mission lifecycle with DOM/view stubs |
| `test/x3dio.test.mjs` | 30 controls pass | Finite values, references, metadata, limits and bridge policy |
| `test/x3dio-dom.test.mjs` | 14 controls pass | Actual XML DOM parsing through Linkedom: four complete canonical round trips and five negative/repaired pairs |
| `test/recipes.test.mjs` | 27 controls pass | Seed identity, references, four-world finite stepping and argument refusal |
| `test/new-controls.state-scope.mjs` | Three expected-scope probes pass | Pose hash, snapshot and hidden-RNG limitations |

The First Flight integration trace settles 40 ticks, jumps on tick 41, flops
on tick 46 and holds jump through tick 70. It completes the 0.8 s objective at
approximately 1.55 s of simulation time. That establishes feasibility for one
ordinary stock-spawn trace, not a player-completion rate or browser input latency.

`python3 test/new-controls.validator.py` passed four adapter-boundary controls:
healthy input, unrelated module refusal, explicit over-budget refusal, and vendor
source corruption refusal in a temporary copy. `python3 tools/validate_levels.py`
passed actual XSD and implemented semantic checks for all four exported levels,
plus caught its paired XSD and semantic negative controls. Details and dependency
identities are in `receipts/upgrade-x3d.json`. XSD uses 4.0; upstream semantic
diagnostics use their separately recorded 4.1 UOM vocabulary. Informational
findings are retained, not suppressed. The adapter's own file budget is 2 MiB.

| Export | UTF-8 bytes | Authored bodies |
|---|---:|---:|
| `level/default-level.x3d` | 228,633 | 255 |
| `level/skyline-seed-7.x3d` | 49,629 | 40 |
| `level/cascade-seed-7.x3d` | 69,290 | 105 |
| `level/tidal-seed-7.x3d` | 99,210 | 86 |

The default export remains byte-identical to the attached baseline. Authored
body counts exclude runtime hero/ragdoll additions. `receipts/upgrade-levels.json`
records export identities. Neither XSD nor the DOM tests certify native X3D
physics equivalence; read `docs/X3D-CONTRACT.md` for the custom mapping.

The parent `python3 -I kit/tests/test_gates.py` also passed: 88 synthetic negative
controls caught in each of normal and optimized Python modes. This verifies the
kit's own trap controls, not acceptance of this game under a physics profile.

## Live browser observations

Direct browser controls, rather than the inherited Playwright script, exercised
the built page served by Python on loopback. These were interactive observations,
not a second full automated physics run.

- A native Chromium window using ANGLE/SwiftShader rendered the lit 2.5D course,
  architecture, local bloom, hero and stunt feedback. Jump, flop and get-up were
  observed. This was software rendering, not a hardware-GPU benchmark.
- A separate browser without usable WebGL rendered the explicitly labeled
  playable Canvas2D fallback, from the same simulation.
- World Forge generated Grapple Skyline. Its complete 49,629-byte X3D source was
  applied after changing gravity to `0 -18 0`. A second proposal containing NaN
  was refused with `X3D_VECTOR`; refreshing the editor retained the valid gravity
  and excluded the rejected proposal.
- Pose scrubbing displayed the review-only warning and hid live-state physics
  overlays. Return Live restored the retained live state and acknowledged it.
- The local lab partner identified itself as built-in commands with no model
  calls. Its no-flop explanation was consistent with that course session.
- At a narrow embedded viewport, document client width and scroll width both
  measured 375 CSS pixels. The guide opened with its expected title. This is a
  layout check, not touch-device or mobile-GPU certification.

## Evidence boundaries and remaining work

Historical receipts (`crosshost.json`, `math-sweep.json`, `gates.json`, original
run record) are retained unchanged. The release checker saves and restores the
two historical files that the original gate runner normally overwrites; its
fresh gate results are nested in `upgrade-checks.json`. Historical Node 22 /
Chrome 153 comparisons do not become fresh cross-host evidence for this build.

No fresh real-GPU benchmark, independent cross-host bit comparison, gamepad
hardware test, touch-device playtest, paid model call, strict-CSP browser run,
all-missions human completion survey or formal Loom profile acceptance was
performed. The inherited `test/browser.mjs` remains available but was not run
here. Node integration adapters are explicitly stubs where documented.

Best runs and ghosts live in the current course session. A source level is not
a savegame; a ghost is a bounded presentation trace; a pose fingerprint does not
cover complete physical/controller state. The solver uses compliant position
corrections but lacks the accumulated multiplier term of full XPBD. These are
declared scope boundaries, not properties established by green checks.

Next high-value measurements: timed human attempts on all six missions; real
gamepad and touch input; high/low graphics on hardware GPUs; a fresh two-host
input-trace comparison; and a versioned complete-state/input-log design before
branching replay or networked leaderboards.
