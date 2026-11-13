# Neural Canvas v2: receipt

Date 2026-11-07. Asked for after x3d.loom PR 17 changed `brain/body.js` (an IndexedFaceSet without a Normal node read `face[0]` where it needed `face[0][0]`, so it had zero normals): re-run the brain and torso parity against X_ITE and, if it holds, publish the page as v2 without touching v1.

Grades: **C** is measured here with the named instrument; **L** is reasoned from sources.

## Parity (C: headless Chromium 153.0.8010.12, SwiftShader adapter, 640 x 360, X_ITE 16.6.0, correctness only, nothing is timed)

Instrument: `compare-normals-fix.sh` (this folder). Per row, ONE X_ITE render, and two Babylon renders (the brain sources as of x3d.loom main 5441ac0 "before", the current tree "after"). Same scenes, same Viewpoint, same Switch settings as `../webgpu-brain-20261107/compare-layers.sh`.

| row | PSNR after the fix | PSNR before the fix | pixels that differ, after vs before |
|---|---|---|---|
| everything on | 33.03 dB | 33.03 dB | 0 |
| glass cortex | 35.11 dB | 35.11 dB | 0 |
| wet cortex | 30.50 dB | 30.50 dB | 0 |
| deep structures | 31.49 dB | 31.49 dB | 0 |
| tracts | 22.51 dB | 22.51 dB | 0 |
| MRI slices | 25.74 dB | 25.74 dB | 0 |
| labels | 21.53 dB | 21.53 dB | 0 |
| activation (new row) | 34.75 dB | 34.75 dB | 0 |
| torso CT | 30.25 dB | 30.25 dB | 0 |

The first seven rows and the torso reproduce PR 13's receipt (the torso reads 30.25 here, 30.26 there: one rounding step). So the setup is the same instrument and the numbers hold.

**Why the fix changes nothing here (C):** all 18 IndexedFaceSets in the brain scene (stage 2, aura 1, MRI slices 6, activation 9) are textured quads with no material, so they are drawn unlit and never read a normal. The torso scene has no IndexedFaceSet. The fix matters for KANSEI (lit IndexedFaceSets without Normal nodes), not for this page.

## What v2 is, and what it is not

The pixels are v1's. A full-page screenshot of v2 with `?timing=0` and of a rebuild of v1 is identical (0 of 682,000 pixels differ), with no console errors. v2 differs from v1 in three things that do not draw anything:

1. The adapter request retries (default, options, low-power, then the fallback adapter) and records which one worked (`window.__adapterVia`); a fallback is labelled.
2. The start-up message names the Windows Chrome flag (`chrome://flags/#enable-unsafe-webgpu`).
3. The opt-in **Timing** button (lower right), the one KANSEI has. Nothing runs until pressed; nothing is uploaded. Headless check: it produced a result (schema `x3d.neural.timing/1`) and labelled the software adapter "these numbers do not count" and "too few frames".

Frame times: none quoted. G0 (timing on his own machines) has not passed, and the SwiftShader setup here says nothing about speed.

## Reproduce

Same scratch layout as `../webgpu-brain-20261107` (served over http, port 8125 by default); `sh compare-normals-fix.sh http://localhost:8125 out`. `check-v2.js` drives the built page (`node check-v2.js URL OUTPREFIX [click]`).

The page is built with `python3 -I x3d.webgpu/demo/src/build-brain.py --page x3d.brain/page --out PAGE.html --single`. The bundle id `window.__x3dBuild` is the first 12 hex of the sha256 of the parts.
