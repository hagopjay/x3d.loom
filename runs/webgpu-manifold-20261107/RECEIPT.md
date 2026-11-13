# Manifold of Emotion on Babylon WebGPU: receipt

Date 2026-11-07. Port #4 from the WebGPU port map (Pantheon splats, Neural Canvas, KANSEI came first). Scope: draw the Manifold page (the Riemannian emotional-field manifold, source in `hagopjay/x3d.STEM` `studies/manifold`) with Babylon.js 9.32.0 in WebGPU mode through our own X3D reader. The scene file is the master, the page's own HUD, math and `app.js` run through a scene-access shim, and the look chain is Babylon's own. Plan: [x3d.webgpu/MANIFOLD-PORT-PLAN.md](../../x3d.webgpu/MANIFOLD-PORT-PLAN.md).

The owner's brief, in his words: not pixel perfect, "all the engineering principles good", native Babylon bloom, "visual extreme graphics doesnt have to look like original", and "error tolerance ... acceptable levels let's just note everything and log more work to do later". This receipt is therefore short on rows and long on the later-work list.

Grades: **C** measured here with the named instrument; **L** reasoned from sources; **S** suspected.

## What was measured (C: headless Chromium 153, SwiftShader adapter, 640 x 360, bloom/lens OFF, correctness only, no timings)

Instrument: `compare-layers.sh` (this folder). Same scene file, same explicit camera (`az=.62 el=.69 dist=27.6 target=0,-1.5,0`), `paused=1`, `settle=1`, `t=41.3`; this port against the page's own X_ITE 16.5.1 build, whose frame is taken through the page's own Save-image button. PSNR over pixels where either frame has a channel above 14 (`metrics.py`).

| row | PSNR | mean RGB, this port | mean RGB, X_ITE |
|---|---|---|---|
| Reverie (mood 0), everything on | **49.34 dB** | 56.7 73.0 93.2 | 56.8 73.1 93.4 |
| Euphoria (mood 1), everything on | **48.47 dB** | 82.6 61.8 77.1 | 82.7 61.9 77.2 |

History of the first row inside this build (C): 35.79 dB when the aerial filaments, source sprites and motes drew nothing, 49.34 dB after the fix below. These are single frames of an animated field, so they say the shaders, the geometry and the uniforms agree at that frame, not that every moment agrees.

**Not run (logged, see the list):** Catharsis and Stillness moods, and the single-layer rows (surface, veil, flows, fibers). The script has them; each X_ITE reference frame takes 5 to 8 minutes on a software renderer. The owner chose to look at screenshots first and run them later.

## What the page does now (C: seen in headless runs; not seen on a real GPU)

All seven shaders are ported to WGSL by hand and keyed by the FNV hash of their GLSL (`build-manifold.py` refuses to build if the scene carries a shader with no port). Six layers draw: sky, surface (513 x 513 elevation grid), veil, geodesic ribbons, aerial filaments, source sprites and motes. Screenshots of all four moods with the Babylon look on: `/mnt/project-files/manifold-webgpu/` (attached to the thread).

Engineering choices the owner asked for: Babylon's `DefaultRenderingPipeline` (4x MSAA, bloom, vignette, grain, chromatic aberration), batched uniform and vertex updates once per frame in `onBeforeRender`, typed arrays end to end (the 263,169-height grid never becomes a JS array), hardware scaling for the quality tiers, adapter fallbacks as in PR #14, `EngineInstrumentation` for GPU time where the adapter has timestamp-query, and an opt-in **Timing** button (gate G0, opened by the owner for this demo in his typed words; same method and block as the KANSEI page, `manifold-timing.js`, `test-timing.js` passes 6 cases). The look is not X_ITE's: the original's 2D-canvas lens cannot read a WebGPU swap chain, so the lens switch now drives Babylon's chain, and "lens off" is the as-authored frame (law 39). The page says so on screen (law 40).

## Bugs and traps this pass found in its own work

- A Babylon mesh whose **first** `setVerticesData` call is a custom attribute silently drops it. Filaments, sprites and motes drew nothing for that reason. Set the position first (`fillMesh`).
- Babylon's final `imageProcessing` post process converts linear to gamma by default; these shaders already output display-referred colour, so its `fromLinearSpace` is switched off (washed-out first frames).
- The reader's `events.emit` only queued ROUTEs and never ran `addFieldCallback`; the page's per-frame tick listens to the Clock's `elapsedTime`, so nothing animated until `R.hooks.cb` was added (35.8 dB whole frame once fixed).
- Reading a 2.2 MB scene with 263k-number arrays through the SAI needed a non-copying `fieldView` and typed `MFVec4f`/`MFFloat` parse (`sai.js`, `manifold-reader-ext.js`; additive, rebased over KANSEI's `sai.js` changes in PR #17).
- No `gl_PointSize` in WGSL: point sprites are quads with a `corner` attribute.

## Findings

1. `app.js` is copied with **one** recorded patch (Save-image reads the WebGPU canvas always, because Babylon's bloom is already in it). Everything else is the page as shipped.
2. The Babylon look differs from the original by design; rows above are with it off.
3. The page has no audio, so nothing here touches sound.

## Later-work list (logged, not done)

1. Run the missing rows: Catharsis, Stillness, surface, veil, flows, fibers (`sh compare-layers.sh <built> <site> <out>`), and a second camera.
2. **Owner's Dell and Mac Timing blocks** (G0): paste them in; no frame time from this sandbox is quoted or claimed. Until then "fast" is not claimed.
3. Look pass on a real GPU: bloom threshold, kernel and weight were set by eye on a software frame. Candidates: Babylon glow layer on the filaments and sources, depth of field, lens flare on the two bright sources, a toggle to mix the original canvas-lens look.
4. Geometry refresh re-creates vertex buffers every 320 ms while the field runs (ribbons, filaments); update in place when the length is unchanged (`updateVerticesData`), and reuse the `Vector4` temporaries in `pushUniforms`.
5. `applyLook` and `fixOutputSpace` run every frame; apply on change.
6. Check the HUD at phone width (Timing button against the page's footer line); the page's own HUD is unchanged.
7. `build-manifold.py` needs the Pages folder of the source repository as `--site`; the built page is not committed here.
8. Run the shipped `.x3d` through the repository's validator and name the validator build next to the result; that was not done for this port.
9. Run the same acceptance pass once the owner's GPU numbers are in, then decide whether the Babylon look should become the default in a v2.

## Harness notes

- Headless shell cannot present a WebGPU swap chain here, so the canvas context is stubbed with an offscreen texture and read back through a buffer copy; `requestAnimationFrame` is slowed to 1.2 s (playbook section 3). `VIEW=1280x720` makes a bigger frame; `DOMSHOT=path` also saves the page's HUD.
- No timing from this setup is meaningful, and none is quoted.
- Source: the rig is `shot-babylon.js` (Babylon page), `shot-xite.js` (X_ITE reference), `compare-layers.sh`, `metrics.py`, `test-timing.js` in this folder. Babylon 9.32.0 is served from a local copy to the page route that asks the CDN for the pinned version.
