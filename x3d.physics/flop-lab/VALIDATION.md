# Giggleworks Showtime release evidence

Current edition: 0.3.0. Local work date: 16 November 2026, America/New_York;
JSON timestamps use UTC and may fall on 17 November. This is a scoped development
record, not a formal Loom profile acceptance receipt or a measure of amusement.
The prior Expedition validation is retained in `docs/EXPEDITION-VALIDATION.md`.

## Executed Node controls

`node tools/check_release.mjs` runs twelve suites and records executor, source
identities, actual output, numerical physics results and source-drift checks in
`receipts/showtime-checks.json`. It saves/restores the historical files that the
original physics runner normally overwrites. Unchanged original physical
algorithms and authored limits remain separate from the new arcade puff.

| Instrument | Result scope |
|---|---|
| `core.test.mjs` | 22 core assertions |
| `gates.test.mjs` | 12 inherited physics gates and six caught Node controls |
| `expedition.test.mjs` | 17 Expedition controls |
| `expedition-integration.test.mjs` | Eight actual-Sim/lifecycle controls; DOM/view adapters are stubs |
| `x3dio.test.mjs` | 30 data/codec controls |
| `x3dio-dom.test.mjs` | 15 controls: five canonical XML DOM round trips plus five negative/repaired pairs through Linkedom |
| `recipes.test.mjs` | 33 recipe checks over five worlds, including 180 finite ticks each |
| `new-controls.state-scope.mjs` | Three expected-boundary probes; not a full-state replay implementation |
| `showtime.test.mjs` | 16 controls: legal/refused puffs, real motion, charge/cooldown bounds, neutral poses, banking, repeated hits, nonfinite refusal and state identity |
| `showtime-integration.test.mjs` | Eight actual-Sim/app-guard controls; exact observations are in the release report output and `docs/SHOWTIME-AUDIT.md` |
| `carnival.test.mjs` | 13 controls, including unchanged old-world identities, reachable ordinary inputs, puff twins and a forgiving cannon across four seeds |
| `presentation.test.mjs` | Ten controls: cosmetic/physics isolation, deduplication/caps, sensory controls, cleanup and actual fractional-goal binding functions; DOM/Canvas/audio adapters are stubs |

The report's final `status` and `source_drift` fields are authoritative for the
retained run. A green individual suite is not sufficient if source changed
while the whole release check ran. The finalized package retains the run whose
source identity is stable, after the integration edits stopped.

## Useful measured traces

- Ordinary stock spawn: settle 40 ticks, jump on 41, flop on 46, request upward
  puffs on 48/72/96, recover on 116. The actual Sim banks 510 Showtime points,
  observes 1.167 s of limp airtime and earns the three-puff sticker. No initial
  physical-state injection is used in this trace.
- Carnival's paired ordinary route: the same jump/flop trace gives approximately
  0.9167 s airborne without puffs and 1.9333 s with three legal puffs. It remains
  finite, uses no respawn and leaves the source level unchanged.
- Neutral Show hooks preserve 300 identical real-Sim pose fingerprints. A
  controlled 150-tick puff trace repeats on this executor; its disabled-mechanic
  twin differs on 148 ticks. That latter probe deliberately uses a named
  high-altitude starting fixture, and is not normal-course or cross-host proof.
- A legal puff gives all eleven active limbs the same normalized 6 m/s velocity
  increment. Repeated requests cannot exceed three applications in one flop;
  recovery followed by a new flop intentionally reloads the supply.
- Ordinary Carnival movement crosses the first bowling checkpoint. Stock cannon
  aiming reaches the generous goal in four declared seeds; premature fire is
  refused. These fixtures do not establish a human completion rate for all routes.

Showtime banking can occur on F recovery in midair. It is not a safe-grounded-
landing classifier. Session totals deliberately span different courses. Repeated
flop/recovery cycles can extend flight by design, so per-chain caps are not a
competitive anti-cheat policy. Original stunt-card points, Show style and
Expedition medals have separate domains.

## X3D model checks

`npm run export:levels` records current generator/tool identities in
`receipts/showtime-levels.json`. The four prior exported worlds remain byte-
identical. The new `level/carnival-seed-7.x3d` is 124,892 UTF-8 bytes with 100
source bodies, 121 source joints, 29 regions and 47 source parts. Runtime hero
and ragdoll additions are a different inventory.

`python3 tools/validate_levels.py --output receipts/showtime-x3d.json` passes
all five files through the actual pinned x3d_mcp XSD/implemented semantic
functions and catches its two paired negative controls. XSD 4.0 and upstream
semantic UOM vocabulary 4.1 are recorded separately. The adapter's 2 MiB cap,
manifest/file/module-origin checks and unchanged third-party source remain in
force. These checks certify neither native X3D physics parity nor visible
rendering or a full MCP transport. The optional Python adapter's four boundary
controls were established in the previous edition; they are not counted as a
fresh run here.

## Direct browser observations

The built application was served through Python on loopback and exercised with
real browser controls. The inherited Playwright browser script was not run.

- Native Chromium with ANGLE/SwiftShader displays the lit 3D Carnival, new
  mascot eyes/party hat, ragdoll, comic cards and confetti. A live jump/flop
  produces Show points; recovery banks a chain and completes the debut prompt.
  This was software rendering, not a hardware-GPU benchmark.
- A separate no-WebGL browser displays the labeled playable Canvas fallback.
  Through Pause/Step and actual F/Q keys, puff inventory changes from 3 to 2;
  recovery banks 260 points and completes the first prompt. Applying a puff in
  an active stock Expedition displays its practice notice.
- The live prompt completion exposed max=1 and one-decimal formatting for a
  0.35-second goal. The repaired browser binding reports max=0.35 and the
  two-decimal label; both 0.35 and 0.8 cases also have real-binding regression
  controls. No physics threshold was changed for this UI repair.
- Sound is initially off. Explicitly enabling it reports the browser's running
  synth state at 20%; disabling it returns to off. Reduced motion sets the calm
  presentation and the outfit control accepts Noodle antenna. This observes
  activation/UI state, not subjective audio quality or an audio-device latency.
- A narrow embedded viewport has client width and scroll width both 375 CSS
  pixels. This is not a physical touch-device/gamepad test.
- The complete 124,892-character Carnival X3D editor content applies successfully
  in the native browser parser, reporting 100 bodies/121 joints/29 regions.
  The self-contained Stunt Playbook opens with the expected heading, and the
  next-prompt control selects Express Biscuit Delivery.

## Limits and next evidence

Prior `upgrade-*` reports and historical cross-host/math/physics receipts remain
available with their original source identities. They are not retroactively
fresh for the Showtime application. Current evidence is named `showtime-*`.
No fresh hardware-GPU benchmark, cross-host bit comparison, gamepad hardware,
actual touch device, listening survey, paid model call, strict-CSP browser run,
all-prompts/all-stickers human completion study or formal Loom acceptance ran.

A visual pose review remains distinct from a complete-state checkpoint. The
actual app tick guard refuses live work during review. Source export is a
starting-level model, not a live savegame. Costume geometry is cosmetic. The
underlying solver still uses compliant position corrections rather than full
accumulated-multiplier XPBD. These boundaries stay explicit while the play grows.

Next evidence should include new-player hesitation/retry observations, route
readability, sound-off and reduced-motion preferences with actual users, touch
and gamepad controls, hardware graphics budgets, and a new two-host input-trace
comparison. Automated mechanics cannot establish that people giggle.
