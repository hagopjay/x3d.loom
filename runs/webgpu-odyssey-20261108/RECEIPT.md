# Material Odyssey on Babylon.js 9.32.0 WebGPU (port #6)

8 Nov 2026. A third engine on the Material Odyssey film page (`odyssey/site/`): Babylon.js 9.32.0 on WebGPU reads the film's own `odyssey.x3d` through our x3d reader and SAI shim. The X_ITE and three.js engines on the page, and their vendor folders, are untouched; only `index.html` gains a Babylon button, a Look switch and the adapter.

Rig for every number: headless Chromium (Playwright), SwiftShader software WebGPU for Babylon (swap chain stubbed with an offscreen texture and read back, requestAnimationFrame slowed), SwiftShader WebGL2 for X_ITE 16.4.3, 1280x536 picture, quality high. Correctness only, no timings, no real GPU. The three.js engine could not be captured by this rig (G10).

## What was built (x3d.loom, `x3d.webgpu/demo/src/`)
- `build-odyssey.py --site <odyssey/site> --out <dir>`: copies the site, patches `index.html` by exact one-time string replaces (the build stops if the page drifts), writes `babylon/bundle.js`.
- `odyssey/odyssey-ext.js`: the four things this film needed that earlier ports did not (below). `odyssey/babylon-adapter.js`: the X_ITE adapter's twin; the page writes to `Film`, the 124 interpolators and `DroneCam` the same way for both. `odyssey/odyssey-boot.js`: starts the body on demand. Babylon loads from the pinned CDN copy with SRI only when the Babylon engine is picked; `window.X3D` is handed back to X_ITE after the bundle loads, so the engines can be switched both ways.

## What the film taught the body
1. **Light scope is the light budget (Confirmed).** 59 of 60 lights are `global="false"`: each lights only the group it sits in. Each light gets `includedOnlyMeshes` = the meshes under its parent group. A shape answers to at most 6 lights (measured 6 = the count from the file), so the material cap of 8 is never reached. 74 Babylon lights for 62 placements: a USE'd group and two USE'd lights are second placements.
2. **A USE is a placement, not the node (Confirmed).** Keying per-placement state by node id made surfaces black (the first run). Scope is now kept per light, with the transform node of the group it sits in.
3. **Light units (Confirmed).** glTF punctual falloff, `range = radius`, spot `angle = 2 x cutOffAngle`, `innerAngle = 2 x beamWidth`, intensity passed through unchanged. Mean brightness of the hall at 33 s matches X_ITE within 1 grey level (23.2 vs 24.0).
4. **Emissive textures add in Babylon and multiply in X3D (Confirmed).** The corridor flooded pink and the sky glowed. Fix: texture to the diffuse slot with lighting off, colour stays in emissiveColor.
5. **Primitives are already wound for Babylon (Confirmed).** The body's counter-clockwise flag turned the shelf spheres inside out.
6. metallic-roughness maps (glTF packing), data maps linear, glTF normal convention, specular anti-aliasing for the fine normal maps.

## Numbers (As authored, Look off; X_ITE 16.4.3 as reference)
| Film time | PSNR | mean grey X_ITE / Babylon |
|---|---|---|
| 10.2 s shelf | 30.4 dB | 12.6 / 12.2 |
| 33 s hall | 26.3 | 24.0 / 23.2 |
| 62 s | 30.6 | 4.5 / 6.3 |
| 90 s | 30.7 | 4.9 / 5.4 |
| 105.5 s corridor | 25.5 | 8.8 / 9.5 |
| 125 s white room | 25.7 | 115.9 / 119.0 |
Look on: 18.4 to 28.2 dB (it adds reflections, bloom, shadows, grain, dust). `compare-sheet.jpg`: X_ITE | Babylon As authored | Babylon Look, six times. Not a target; no tuning to X_ITE was done (G14 lists the one place where it differs visibly).

Scene facts from the run: 286 meshes, 286 materials, 143 textures, 74 lights, first frame 5.9 s (load 0.9 s, compile 3.7 s, software GPU).

Gaps: `GAPS.md` (G1 to G16). Page checks: `odyssey-play.js` (play, Look switch, scrub, fly, engine switches both ways, About, errors). Hear: the film has no audio. Not done: DOF, light shafts, Safari and Firefox, real-GPU numbers.

## Page play test (odyssey-play.js, play-result.json; SwiftShader, correctness only)
Default engine Babylon; badge reads Babylon.js 9.32.0, WebGPU, look on. Film time advanced 5.4 to 11.4 s. Look off and on switch (aria-pressed follows). Scrub to 40 s lands the camera at -60.4 on the film path. Fly mode moves the camera and returns to the film pose. About panel reports 286 meshes, 74 lights, light scope 73 scoped, 1 global, 0 empty, at most 6 on any shape. Switch to X_ITE (film time carried over, 47.9 s) and back to Babylon (50.3 s, one canvas, 286 meshes) works. Page errors: only the X_ITE linetypes 404 (G17). Not exercised: pause by Space (G18).
