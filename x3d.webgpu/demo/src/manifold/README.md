# Manifold of Emotion on Babylon / WebGPU

Plan and rationale: [../../MANIFOLD-PORT-PLAN.md](../../../MANIFOLD-PORT-PLAN.md) (kept as written; this folder is what was built). Playbook: [../../../BABYLON-BRIDGE-PLAYBOOK.md](../../../BABYLON-BRIDGE-PLAYBOOK.md). Receipt with the numbers: [../../../../runs/webgpu-manifold-20261107/RECEIPT.md](../../../../runs/webgpu-manifold-20261107/RECEIPT.md).

The page is the Manifold page's own HUD, math and `app.js` (one recorded patch, see `build-manifold.py`). **Babylon is the body, our X3D reader is the brain.** The scene file stays the master: the reader parses it, runs the clock and the routes, and keeps the node tree that `app.js` rewrites through the SAI; the body turns the tree into Babylon meshes and draws the seven shaders from their WGSL ports.

| File | What it is |
|---|---|
| `manifold-wgsl.js` | the shared WGSL prelude (metric, curvature, ripples, fold) and the seven ports (Sky, Surface, Veil, Flow, Fiber, Node, Mote), keyed by the same FNV hash of the GLSL that `build-manifold.py` checks |
| `manifold-reader-ext.js` | additive reader nodes: ElevationGrid, TriangleSet, PointSet, `MFVec4f`; reader-raised events reach `addFieldCallback` |
| `body-manifold.js` | the Babylon body: mesh builders (grid, triangle sets with custom vertex attributes, point sprites as quads), the ShaderMaterial factory, batched uniform and vertex updates, and Babylon's own look chain (`DefaultRenderingPipeline`: 4x MSAA, bloom, vignette, grain, chromatic aberration) |
| `boot-manifold.js` | start-up, the lens switch wired to Babylon's pipeline, on-screen notices (law 40), the opt-in Timing panel (gate G0) |
| `census.py` | node counts and shader keys for a scene; rerun after any scene change |
| `../build-manifold.py` | the page builder; refuses to build if the scene carries GLSL with no WGSL port |

Build: `python3 -I x3d.webgpu/demo/src/build-manifold.py --site <manifold Pages folder> --out <new folder>`, then serve the folder over http. The built page is not committed; it carries the 2.2 MB scene, which already lives in the source repository.

Harness (same as the brain port): headless Chromium with `--enable-unsafe-webgpu --use-angle=swiftshader --use-webgpu-adapter=swiftshader`, canvas context stubbed with an offscreen texture, `requestAnimationFrame` slowed to 1.2 s. X_ITE reference: the page's own 16.5.1 build, driven through its own Save-image button, lens off. Correctness only; the Timing panel is the one place numbers are measured, and only on the owner's own devices.

Traps found while building (also in the receipt): a Babylon mesh whose first vertex data is a custom attribute drops that data, so set the position first; Babylon's final image-processing pass converts linear to gamma by default, which double-encodes shaders that already output display-referred colour, so its `fromLinearSpace` is switched off; the reader's `emit` only queued ROUTEs and never called `addFieldCallback`, so the page's per-frame tick never ran until `R.hooks.cb` was added.
