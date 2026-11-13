# Phase 5 evidence: verification and polish (2026-11-12)

All numbers **measured** on this Mac (Apple Silicon) unless marked. Browsers: Chromium 145, Firefox 146, WebKit 26 (Playwright 1.58.2).
The machine was **heavily loaded** during the later runs (load average 6–11 from other applications); timing results below depend on it.

## 1. The browser suite (`npm run smoke`: build, then `playwright test` on `vite preview`, three browsers, real WebGL)

33 tests (11 per browser): hub; side by side (PhysX and Bullet); build mode; 20 marbles into the cup; record and replay bit-exact plus
looks and sound; the exported machine on plain X_ITE; music box notes per turn; domino wave speed against the Node sweep; trebuchet
release and range against Node; Galton pour and shake; every demo's Export re-imported. Log: `p5-smoke-log.txt`, JSON: `p5-smoke.json`.

**Last run: 30 passed, 3 failed** (the user accepted that not all may pass):
- Galton board, Chromium and WebKit: 220 and 223 beads in the bins after one shake (threshold 225). A few stay wedged between pins.
- Music box, WebKit: 15 and 17 notes in two full turns instead of 18 and 18 (a standalone WebKit run earlier gave 36 of 36, and all
  three browsers gave 36 in the demo probes before the machine was loaded).

Found and fixed on the way:
- **X_ITE's `createX3DFromString` sometimes never resolves in WebKit** (1–2 of 4 back-to-back loads of the 266 KB Galton scene; with or
  without sound or downloads). Calling it again works. The bridge now uses a watchdog (3 s plus 1 s per 50 KB) and retries up to three
  times, counting stalls in `stats.createStalls`. All 12 test imports then completed.
- **Clocks now follow physics when physics falls behind.** Under load Firefox simulated the music box at 80 steps/s (240 needed); the
  drum's TimeSensor kept wall time, the bridge dropped lagging time, the drum jumped in PhysX and pegs skipped hammers (14–26 notes per
  turn instead of 18). Now, while physics is more than 0.1 s behind, the bridge pauses the scene's TimeSensors (X3D excludes paused time)
  and adds no wall time, resuming below 0.03 s: ROUTE-driven parts slow down with the simulation. Measured: Firefox at 98–170 steps/s
  played 18 of 18 notes in every turn (a turn took 8–12 s of wall time, 4.8–5.1 s simulated instead of 4.36: physics keeps stepping a
  little while the clocks are held). Counted in `stats.clockHolds`.
- Tests that waited by wall clock (Firefox runs some scenes at half speed) now wait in simulated time.

## 2. Performance (`probes/perf.mjs`; `p5-perf-*.json`): the full default machine, 93 bodies, 20 marbles, 40 dominoes

| | Chromium | Firefox | WebKit |
|---|---|---|---|
| physics only, every pair reporting contacts | 0.81 ms/step | 11.0 | 1.69 |
| physics only, no contact reports | 0.28 | 2.6 | 0.51 |
| real time, headless: X3D frames/s (median), physics steps/s | 40, 240 | 59, 128 (half real time) | 30 (headless cap), 245 |
| real time, visible window (Chromium, loaded machine) | 52.6 fps median (one stall to 0.7), 237–248 steps/s | | |

The 60 fps target is **not met** on this machine as measured (52.6 median in a visible window, under load). Contact reporting is most of
the physics cost; the bridge's `'sensed'` mode limits it to CollisionSensor collidables (Galton board: 4.0 → 1.3 ms/step).

## 3. Licences, validation, docs

- Third-party notices with the verbatim licence texts (PhysX BSD-3-Clause, physx-js-webidl MIT, X_ITE MIT, ammo.js zlib) in
  `THIRD_PARTY_NOTICES.md` and `licenses/`; the build copies them to `dist/legal`.
- `npm run validate`: all 27 scenes (machine, pieces, experiments, demo exports) XSD-valid with 0 errors and 0 warnings.
- 22 unit tests pass (`npm test`).
- README, SPEC (draft 1.0), `DEMOS.md` (the four demos added in this phase).

## 4. Still open

- Determinism **across machines** (the run files are the tool; not run here).
- A quieter-machine timing run for the 60 fps target.
