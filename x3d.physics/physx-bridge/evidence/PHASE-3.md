# Phase 3 evidence: the machine and build mode (2026-11-12)

All numbers **measured** on this Mac unless marked. Browsers: Chromium 145.0.7632.6, Firefox 146.0.1, WebKit 26.0 (Playwright 1.58.2, real WebGL). Paused once at the user's request and resumed.

| file | what |
|---|---|
| `p3-validation.txt` | x3d_mcp on the 14 piece fragments (`scenes/pieces/*.x3d`), the default machine (`scenes/marble-machine.x3d`) and its build view: all XSD valid, 0 errors, 0 warnings |
| `p3-roundtrip.json` | the browser reader's model of the generated X3D vs the generator's own model: 36 bodies, 0 differences |
| `p3-machine-{browser}.json` + `-build/-run/-end.png` | the Marble Machine page: run mode, Drop 20, flipper and launcher keys, counters (`probes/run-machine.mjs`) |
| `p3-build-{browser}.json` + `-dragged.png` | build mode with a real mouse: drag (PlaneSensor) and snap, rotate, undo (`probes/run-build.mjs`) |
| `p3-plain-xite-{browser}.json/.png` | the exported file in plain X_ITE, no bridge (`probes/plain-xite.html`) |

## Results

1. **Standard X3D throughout.** Each of the 14 piece types is its own valid X3D fragment; the default machine (93 rigid bodies, 65 of them moving: 20 marbles, 40 dominoes, every one of the 14 piece types; 6 joints, 1 kinematic elevator) and its build view validate with 0 errors and 0 warnings. The machine description travels inside the file as a WorldInfo MetadataString, so an exported machine can be imported and edited again (round trip tested, including quotes and markup in the name).
2. **Build mode with a real pointer** (three browsers): dragging the bell 3 holes left and 2 up with the mouse snaps it to exactly (2, 10); E rotates it to 15°; two undos restore rotation, then position. Fast edits had overlapped scene loads ("Replacing world aborted"); loads are now serialised and the error is gone.
3. **Run mode** (Drop 20, alternating hoppers): Chromium 18/20 in the cup at 16.8 s, Firefox 18/20 at 10.8 s of simulated time, WebKit 19/20 at 18.4 s; Node: 20/20 at 22 s (path A alone 20/20, path B alone 15/20). The wrecking ball topples its 28 dominoes (27/28 once in Firefox); pressing F swings the flipper (rotated −90° as a kicker) and topples the other 12.
4. **Physics cost** with every piece type, 20 marbles and 40 dominoes: Chromium 1.0–2.6 ms per step (keeps 240–250 steps/s), WebKit about 1 ms (240 steps/s), **Firefox 12 ms per step (128 steps/s, slower than real time)**; Node 0.9–1.1 ms. Phase 5 will look at Firefox.
5. **The same file in plain X_ITE** (Bullet, no bridge): it loads and runs in all three browsers, but only 2–5 of 20 marbles reach the cup and some **fall through the floor** (y about −1000 m after 15 s): X_ITE's Bullet has no CCD for thin parts. The bridge's PhysX run (CCD from preferAccuracy) loses none.

## Found and fixed on the way

- The import sanitiser snapped rotations to 15°, turning a tuned −8° ramp into −15°: the browser put 0/20 in the cup while Node put 20/20. The round-trip probe proved reader and generator agree, which pointed at the sanitiser.
- A zigzag gap of exactly one marble diameter wedged marbles; a paddle wheel turning the wrong way flung marbles into the frame (wheels now have a signed `spin`); a flipper's tip moves upward and cannot topple dominoes, but the same piece rotated −90° kicks sideways.
- X3D's `centerOfMass` defaults to the body origin, so moving parts put their body origin at their mass centre (a pendulum with its origin at the pivot would have no gravity torque).
- The undo stack was overwritten by the undo function (`Object.assign` on the page state), which also reverted drags.

## Limits

- One run per browser for most numbers; Node runs are deterministic.
- The default layout was tuned by a search in Node (`tools/tune-machine.ts`) with two drop-jitter patterns, not by hand; other drop timings can lose a marble or two.
- Elevator, launcher, half-pipe and curved ramp are on the board and work (they move, they are part of every collision), but no marble path uses them in the default machine yet.
