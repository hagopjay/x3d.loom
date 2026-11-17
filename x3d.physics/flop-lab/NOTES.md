# Flop Lab: what the build found

**16 November 2026.** Every number below was measured in the build session (Node 22.23.4, V8 12.4; headless Chrome 153 on SwiftShader; one cloud machine) by the thread that wrote the code. None has been recomputed by a second reader, so each is **Likely** under law 44. The instrument is named with each.

## 1. The built-in trig is not the same in two hosts (failure mode 161)

- **Symptom.** Node and Chrome agreed on 0 of 300 step hashes of the default level. Before the first step every body matched; after step 1, 6 of 267 bodies differed, all in the tilted wrecking-ball chain.
- **Cause.** `test/math-sweep.mjs`, 200,000 arguments each: the two hosts disagree on 6,583 `Math.sin` results, 6,531 `cos`, 28,473 `atan2`, 19,291 `exp` and 19,540 `pow`; on 0 `sqrt`, 0 `hypot` and 0 results of plain arithmetic (`receipts/math-sweep.json`).
- **Fix.** `sin`, `cos`, `atan2` and `hyp` in `src/core.js`, built from + - * / and `Math.sqrt`. Largest difference from the built-ins over 400,000 arguments: 2.2e-16 (sin), 1.1e-16 (cos), 8.9e-16 (atan2). `sin(0)` is exactly 0, which the stack gates rely on.
- **After.** 300 of 300 step hashes agree. Cost: the default level went from about 0.9 to about 1.3 ms a step in Node.
- **Control.** The same shot with only the solver put back on the built-in sine and cosine: 282 of 300 hashes differ, first at step 18 (`receipts/crosshost.json`).

## 2. The Loom already had this rule, and it did not fire (failure mode 162)

`kit/loom pagetraps` has carried `sim-nonportable-math` since 6 November. It reads only files that start with `// loom:sim`. Flop Lab's three sim files were not marked and PLATFORMER.md was not read before building, so 33 lines that call the built-in sine, cosine, hypot or atan2 went unread.

Marking the files exposed two more things:
- `core.js` read `performance.now()` for the profiler. The clock is now lent by the page (`World.clock`); the simulation never reads one.
- The build glued sim and page code into one inline script, so the marker covered the whole page: 52 hits, all in view and bench code. The build now writes the sim files into their own script.

`kit/loom pagetraps` now reports `seen.sim_units`, the number of files and inline scripts that declared sim. Flop Lab reads 4 (three source files and one script of the built page), 0 errors.

## 3. Contacts

| Finding | Wrong version | Right version | Gate |
|---|---|---|---|
| Friction applied inside the push pass, corner by corner | one resting crate creeps 0.28 m in 6 s | a friction pass after all pushes: 0.00000 m | "one crate at rest" |
| A face contact solved one corner at a time (mode 164) | a 10-crate stack fell (tilt over 2 rad) while push-out was capped at 5 m/s; 0.015 rad of rocking with the present cap | both corners solved together, a 2 x 2 system: 0.00000 rad over 10 s | "10-crate stack", control caught |
| Friction pulled at each corner | a 3-crate stack at rest began to rock after about 4 s | one pull at the middle of the face | not gated: with the 2 x 2 push in place this control reads 0.0000 rad |
| Push-out speed kept as velocity (mode 166) | a ball with restitution 0.1 dropped 3 m rebounded 0.377 m; e^2 h is 0.03 | each push capped at this substep's approach plus 2 m/s of bleed: 0.025 m | "bounce e = 0.1" |
| The bleed has a floor | at 0.8 m/s and one iteration the 10-crate stack collapses | 1.2 m/s and above hold; the engine uses 2 | covered by the stack gate |

## 4. Joints

A hinge solved as one distance along its error direction ran a 3 m pendulum 3 % slow (2.0467 s against 1.9875 s). Solving both axes of the pin together gives 0.054 % (failure mode 165). The one-axis version is kept as the control (`controlHinge1D`): 2.95 %.

## 5. Checks that misled (failure mode 167)

- A check labelled as a passing control, "restitution 0 must not bounce to 0.75 m", was green while the ball rebounded 0.377 m. Its bar had nothing to do with the defect. It is now a gate on the rebound of the default material.
- After the push-out fix the corner-by-corner control no longer tipped the stack: 0.015 rad, under its own bar of 0.05. The run said "5 of 6 controls caught". The control is now judged by the gate's own limit (0.002 rad), which did not change. `test/limits.json` records this change in `_changes`.

So the limits were not all written before the run. The run record carries no `limits` block and says so.

## 6. The level as a file

- **Rounding (mode 168).** Four decimals turned a hinge compliance of 1e-5 into 0. The text round trip caught it. Numbers under 0.01 now keep four significant digits.
- **x3d_mcp (mode 171).** The first export was XSD valid with 253 semantic errors: a `Shape` inside `CollidableShape` needs `containerField='shape'`. Nine hinges had no second body; every prefab now names a static one. Now 0 errors, 0 warnings, 372 unused-DEF notes.
- **The model across hosts (mode 169).** The hashes agreed while the level's sha256 differed between Node and the page: collision groups were numbered by a process-wide counter, and the page had already built one level. Groups are now numbered per level; the sha256 is equal.

## 7. The harness

`page.evaluate` is exempt from a page's ban on eval. A probe run inside it said eval was allowed; the same probe from a timer said blocked. The first "works without eval" result for the Solver tab was therefore untested. The Apply button is now driven by a real click, and the inline-script fallback runs (failure mode 170).

## 8. Stays local (play)

- A bounce pad was cut short by the short-hop rule when jump was not held; a pad throw is now exempt until the hero starts to fall.
- In water there is no floor, so the hero may kick off the surface.
- Upright, the hero is too heavy for the fan; limp, the dummy flies. The hall says so.
- A bot that only holds right and hops clears halls 1 to 6 (`test/play.mjs`). Nobody has played it for fun yet.

## 9. Open

- Firefox and WebKit could not be installed in the build session (the download hosts were refused).
- No real GPU, phone or second machine.
- The curator was not run against a real model. Its tools were run directly.
- A second reader for every number here.
- The energy chart shows the total falling as things settle; no energy bound is gated.
