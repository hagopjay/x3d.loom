# Neural Canvas on Babylon WebGPU: receipt

Date 2026-11-07. Port #2 from the WebGPU port map (Pantheon splats was #1). Scope: draw the Brain Loom page (`x3d.brain/page`, "Neural Canvas") with Babylon.js in WebGPU mode through our own X3D reader, the page's own `app.js` unchanged. Spend $0. What was built, its traps and its limits are in [x3d.webgpu/demo/README.md](../../x3d.webgpu/demo/README.md#neural-canvas-on-babylon-webgpu-the-brain-port).

Grades: **C** is measured here with the named instrument; **L** is reasoned from sources; **S** is suspected.

## What was checked, and against what (C: headless Chromium 153.0.8010.12, SwiftShader adapter, correctness only, no timings)

The instrument is `compare-layers.sh` (this folder). For each row it loads the same scene file and the same Viewpoint (`VP_HOME`) with the same Switch settings in two pages and compares 640 x 360 frames: this port (Babylon 9.32.0, WebGPU) and X_ITE 16.6.0 (WebGL 2, `KHR_PBR_NEUTRAL` tone mapping, order-independent transparency off, which is how the Neural Canvas page itself runs X_ITE). PSNR is taken over the pixels where either frame has a channel above 14 of 255; the mean columns are over the same pixels. The scenes are the lite scenes in `x3d.brain/page/scenes`.

| layer | Switch settings (all others as the scene ships them) | PSNR | mean RGB, this port | mean RGB, X_ITE |
|---|---|---|---|---|
| everything on by default | none | 33.03 dB | 91.2 99.1 102.3 | 87.1 95.2 98.9 |
| glass cortex | `SW_DEEP:-1,SW_AURA:-1,SW_STAGE:-1` | 35.11 dB | 80.8 100.2 116.8 | 78.9 98.4 115.5 |
| wet cortex | `SW_CORTEX:-1,SW_AURA:-1,SW_DEEP:-1,SW_STAGE:-1,SW_WET:0` | 30.50 dB | 163.5 147.6 126.1 | 162.0 151.4 133.8 |
| deep structures | `SW_CORTEX:-1,SW_AURA:-1,SW_STAGE:-1` | 31.49 dB | 118.5 106.9 77.5 | 114.1 104.4 77.2 |
| tracts (one line set of 14,413 index entries) | the four above off, `SW_TRACTS:0` | 22.51 dB | 72.5 119.0 97.9 | 70.5 108.5 94.5 |
| MRI slices | the four above off, `SW_SLICES:0` | 25.74 dB | 119.3 163.5 195.5 | 102.4 142.9 172.9 |
| labels (Text, Billboard, lines) | the four above off, `SW_LABELS:0` | 21.53 dB | 59.8 71.8 76.7 | 66.1 80.3 88.4 |
| torso CT (16 ComposedShaders, cube-map light) | none, scene `torso_ct_lite.x3dz` | 30.26 dB | 16.8 23.8 32.4 | 14.2 23.6 34.4 |

How to read it: 30 dB or more is the same picture with small shading and edge differences; the three rows below that are drawn the same way but differ in detail. **Tracts**: the ribbons differ from X_ITE's lines in apparent width and end shape, and the greens differ by about 10 of 255 (C, from the table). **Slices**: this port's slice planes are about 15 percent brighter and the outline frames are not hidden behind the planes as X_ITE hides them. **Labels**: thin glyphs never line up to the pixel, and this port's are a little dimmer (this port draws each label as a glyph texture). None of these is hidden; the owner said small error is fine for this port, so they were left.

A page-level pass with the real HUD (`page-states.js`) drove: layer switches (tracts, slices, labels, wet cortex), a look change, a region pick by click (the page showed the picked region's card, the TouchSensor route fired and the region glow lit), the Inside view, and the Torso tab. The first run, before the two fixes below, drew everything except the torso (it threw on load); after the fixes the labels and the Torso tab were run again with zero page errors, and the torso scene logs one note ("Transform with center or scaleOrientation decomposed to TRS").

## Two bugs this pass found in its own work

- A Transform with `center` or `scaleOrientation` (the torso scene has them) threw `M.FromQuaternion is not a function`, so the Torso tab failed to load. Fixed in `body.js`.
- Labels were mirrored with the drop shadow drawn over the bright text. Babylon's billboard mode faces the wrong way in a right-handed scene; billboards are now oriented by the body each frame, and unlit text takes its colour from `emissiveColor`.

## Harness notes

- Headless shell cannot present a WebGPU swap chain here, so each page stubs the canvas context with an offscreen texture of the swap-chain format and reads it back through a copy to a buffer (`compare-babylon.html`, `page-states.js`; the same trick as `runs/webgpu-pantheon-splats-20261107/stub-swapchain.py`).
- **`requestAnimationFrame` must be slowed** (1.2 s here). Without it the page queued frames faster than the software adapter finished them, the read-back waited for the whole queue, and a multi-state run produced one screenshot in more than ten minutes. This was the longest delay of the pass.
- Layout of the scratch folder the scripts expect, served over http (default `http://localhost:8124`): `babylon.js` (a copy of `babylonjs@9.32.0/babylon.js`), `src` (a link to `x3d.webgpu/demo/src/brain`), `scenes` (a link to `x3d.brain/page/scenes`), `vendor/x_ite` (from `x3d.brain/tools/fetch_xite.sh`), plus `compare-babylon.html`, `compare-xite.html`, `grab.js`, `xshot.js` and `metrics.py` from this folder. `page-states.js` instead takes the URL of a page built by `build-brain.py` with its local Babylon copy in place of the CDN tag.
- Frame times from this setup mean nothing and none are quoted. Gate G0 (timing on the owner's own machine) is not passed, so "fast" is not claimed here. The Babylon body keeps the work on the GPU, which is the reason for the port, but that is a design statement (L), not a measurement.

## Not in this repository

The built page and its scene bytes are not committed (the lite cortex surfaces carry a Suspected source licence in `x3d.brain/page/NOTICE-BRAIN-DATA.md`); build with `python3 -I x3d.webgpu/demo/src/build-brain.py --page x3d.brain/page --out OUT.html`. No screenshots of the cortex are stored here for the same reason.
