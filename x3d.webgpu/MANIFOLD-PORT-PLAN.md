# Manifold of Emotion on Babylon / WebGPU: plan and scaffold

Status: plan v1, 7 Nov 2026. Scaffold only: nothing here is built, rendered or measured yet. Spend $0.
Grades: C = Confirmed (measured or read from source today), L = Likely (reasoned), S = Suspected.
Playbook followed: [BABYLON-BRIDGE-PLAYBOOK.md](BABYLON-BRIDGE-PLAYBOOK.md) (laws 38 to 40). Prior ports: brain (#13), KANSEI drift (in flight).

## 1. What the source is (C, read today)

| Item | Value | Where |
|---|---|---|
| Live page (X_ITE 16.5.1, WebGL) | the public Pages build of the x3d.STEM study | the page's own `vendor/x_ite` |
| Main repo copy | `hagopjay/x3d.STEM`, `studies/manifold` (scene, page code, builder) | per x3d.demo thread |
| Scene | `scenes/manifold.x3d`, 2,190,327 bytes, X3D 4.0, profile Immersive | census.py |
| Page code | `src/app.js` 32 KB, `math-core.js`, `field.js`, `labels.js`, `lens.js` | Pages build |
| Shaders | 8 GLSL blocks (common + 7), `shaders/*.glsl`, inlined as `data:` URLs in 7 ComposedShaders | scene |
| Provenance | public text says only "rebuilt from an existing WebGL page" | project note |

Node census of the scene (C, `manifold/census.py --site <site>`): ShaderPart 14, Shape 7, Appearance 7, ComposedShader 7, Coordinate 5, FloatVertexAttribute 3, Viewpoint 3, TriangleSet 2, ElevationGrid 2, PointSet 2, IndexedTriangleSet 1, Color 1, Transform 1, Material 1, TimeSensor 1, NavigationInfo 1, WorldInfo 1, MetadataSet/String 1/7.

Shader hash keys (FNV-1a of whitespace-collapsed GLSL, vertex-fragment; C):

| Shader | Key | Draws |
|---|---|---|
| SkyShader | `fae893dd-6e5177d1` | full-screen triangle at the far plane (haze, cloud band, aurora, stars) |
| SurfaceShader | `4ab8e2fd-7527f1ed` | the 513 x 513 ElevationGrid, re-evaluated per vertex from the live metric, GGX + iridescence + contours + caustics |
| VeilShader | `1aabd540-95625852` | second sheet lifted above the basins, rim/spectrum/fringes (screen-blended) |
| FlowShader | `4e3e809c-b8a2a89f` | geodesic ribbons, constant pixel width, vertex attributes `aPath`, `aRibbon` |
| FiberShader | `208a5a28-9fef8453` | five aerial filament arcs, twisting ribbons, attribute `aFiber` |
| NodeShader | `aa40821b-2e6d7745` | seven source sprites (gl_PointSize) |
| MoteShader | `3cb55e19-49662f42` | 900 motes (gl_PointSize), seeds in Coordinate + Color |

## 2. Verdict: a large port, but a mechanical one (L)

Everything hard is shader translation, not scene structure. The scene has 7 Shapes and no textures, no Text, no lights, no Inline. The bridge already has reader, SAI shim, camera, event loop, `ShaderMaterial` WGSL plumbing and the FNV hash table (brain, #13). New work, in order of risk:

| # | Work | Why it is not trivial | Effort (S) |
|---|---|---|---|
| 1 | WGSL port of `common` + 7 shaders (~18 KB GLSL) | `fwidth` -> `dpdx/dpdy`, `discard` before derivatives, `gl_FrontFacing`, `tanh`, `mod`/`fract` differences, loops over uniform arrays, `uniform vec4 uX[7]` | M |
| 2 | Point sprites (`gl_PointSize`) for Nodes and Motes | WebGPU has no point size: expand each point to a camera-facing quad (4 vertices + corner attribute), size in pixels computed in the vertex shader | S |
| 3 | Reader additions | `ElevationGrid`, `TriangleSet`, `PointSet`, `SFVec4f`/`MFVec4f` user fields, `FloatVertexAttribute` on non-indexed sets | S |
| 4 | SAI additions | `getFieldDefinitions()`, `MFVec4f.setValue(Float32Array)`, `MFFloat/MFInt32.setValue` on attributes and `IndexedTriangleSet.index`, `SFVec2f`, `getBrowserOption`, `getContext().canvas` (all used by `app.js`) | S |
| 5 | Blend: "standard alpha" light layers over an opaque surface; depth rules per layer; sky as its own rendering group, depth write off | brain/drift traps (see section 5) | S |
| 6 | Lens (bloom, vignette, grain) | `lens.js` reads X_ITE's WebGL frame through a 2D canvas; it cannot read a WebGPU swap chain. v1 leaves it off and says so on screen (law 40). A native Babylon bloom is an optional look layer later (law 39), not the scene's claim | gap |
| 7 | Harness + PSNR vs X_ITE | per layer, same file, same viewpoint | S |
| 8 | Page build, leak sweep, receipt, x3d.demo hand-off | playbook sections 5 and 6 | S |

Heavy GPU load is by design: the surface vertex shader calls the metric + surface function about 25 times per vertex (ambient occlusion, 8 directions x 3 radii) over 263,169 vertices (C: 513 x 513). SwiftShader will be slow (S: tens of seconds a frame); the harness already slows `requestAnimationFrame`. A smaller `?grid=` test mode is in the scaffold for fast iteration, never for the PSNR rows.

## 3. Design (renderer-agnostic runtime plus Babylon body)

```
scenes/manifold.x3d --> reader.js (+ manifold-reader-ext.js) --> body-manifold.js (Babylon meshes, WGSL ShaderMaterial per shader)
        |                                                              ^
        +--> sai.js (+ SAI additions) -- X3D.getBrowser('#scene') -----+   app.js runs UNCHANGED (any patch is a recorded finding)
shader nodes --> FNV-1a hash --> manifold-wgsl.js (hand-ported WGSL, one `common` prelude shared by all)
```

- `ManifoldBody extends Body` (brain `body.js` + `body-cam.js`): reuse init, camera, event loop, Viewpoint binding; override `materialsFor` and `makeMesh`.
- Uniform arrays: try `array<vec4f, N>` declared as Babylon uniforms with `setArray4`; fallback is N separate `vec4f` uniforms copied into a `var<private>` array at the top of each entry point. Decide on the first compile (S).
- The 7 ComposedShaders share ~40 uniforms (u* names); `refreshShader` is extended to push `MFVec4f`, `SFVec2f` and `SFVec4f`, and `uTime` etc. fan out to every material of the node DEF.
- X3D stays master (law 38). The page text, the on-screen note and the README state that the lens is not ported and the renderer is Babylon + WebGPU.

## 4. Scaffold in this PR (nothing is wired into a published page)

| File | State |
|---|---|
| `x3d.webgpu/MANIFOLD-PORT-PLAN.md` | this document |
| `demo/src/manifold/census.py` | working (run today; output in section 1) |
| `demo/src/manifold/README.md` | work breakdown, definition of done, harness recipe |
| `demo/src/manifold/manifold-wgsl.js` | `PRELUDE` (the shared `common` block, translated), port table with the 7 keys, one skeleton per shader marked `TODO(port)`; **untested** |
| `demo/src/manifold/manifold-reader-ext.js` | additive reader nodes (`ElevationGrid`, `TriangleSet`, `PointSet`, `MFVec4f`); **untested** |
| `demo/src/manifold/body-manifold.js` | `ManifoldBody` skeleton: mesh builders (grid, triangles with attributes, point-to-quad), render groups, uniform push; **untested** |
| `demo/src/build-manifold.py` | builder skeleton: checks the key table against the scene, bundles parts, inlines the scene, SRI-pinned Babylon 9.32.0; **untested** |
| `runs/webgpu-manifold-<date>/` | created when the build starts (RECEIPT, per-layer rows) |

## 5. Lessons to apply (from the KANSEI port, relayed 7 Nov 20:35Z, and the brain port)

1. `IndexedFaceSet` geometry used `face[0]` as an index (array), giving zero normals and black meshes; fixed as `face[0][0]` in the drift work. Re-check before reuse.
2. `IndexedTriangleSet` with no Normal needs `VertexData.ComputeNormals(..., { useRightHandedSystem: true })`. This scene's shaders compute their own normals, but the fallback material path will hit it.
3. Node ids from separate `parseX3D` calls collide (texture cache, `rec`, events). Offset them per parse; this scene loads once, but the page's saved-moment feature parses a second scene.
4. A far sky needs its own rendering group with depth write off; set camera `maxZ` from `NavigationInfo.visibilityLimit` (130 here); try `engine.useReverseDepthBuffer`.
5. Appearance alpha modes and `refreshPBR` resetting transparency: not used here (no PBR), noted for completeness.
6. Babylon tone mapping also touches skyboxes; this scene sets `ToneMapping NONE` and applies its own `display()` per fragment, so tone mapping must be off in the body (`setTone('none')`).
7. Harness: swap-chain stub, `requestAnimationFrame` at 1.2 s, and one long-lived page driven by command files (KANSEI `session-babylon.js`) to avoid a two-minute reload per experiment.
8. Brain traps still apply (section 2 of the playbook): sRGB vs linear (the shaders output display-space values: no conversion), CCW front face, `alphaIndex` default MAX_VALUE (set explicit indices: sky 0, surface 1, veil 2, flows 3, filaments 4, nodes 5, motes 6), zoom clamp.
9. Adapter: call `requestAdapter()` plain first, then the PR #14 fallbacks; show the `chrome://flags/#enable-unsafe-webgpu` tip and the adapter name (law 40).

## 6. Acceptance (definition of done for the build step)

- App.js unchanged (or the diff recorded as a finding); the page's moods, sliders, journey, click-to-perturb and `Save X3D` work.
- PSNR vs X_ITE 16.5.1 (the version the live page ships), same scene file, same Viewpoint, same 640 x 360, lens OFF in both, per layer: surface, veil, flows, filaments, nodes, motes, sky, and everything on, for the four moods. Rig named (SwiftShader, headless Chromium 153). Report lines (flows, filaments) and sprites separately: they differ in detail by construction (brain rows 21 to 26 dB). No tuning to the metric.
- Timings: none (G0 open). "Fast" is not claimed.
- On-screen notices: lens not ported (law 40), no-adapter tip, adapter name, any hash miss.
- Public publication only after a leak sweep of the served bytes (no model/vendor names, project ids, costs, private links, nothing about where the look came from beyond the line above). The scene and page code are already public in x3d.STEM, so the page may carry them.
- Hand-off: tell the coordinator; x3d.demo publishes a new `docs/demos/manifold-webgpu/v1/` (never overwrite).

## 7. Open questions for the owner (none block the scaffold)

1. Native bloom as an optional "Look" layer, or keep the lens gap as is for v1? (Recommend gap first, look layer in v2.)
2. Which machine for the G0-gated timing, when consent comes? (Not needed for v1.)

## 8. Resume checklist

- [ ] Wait for KANSEI to land (coordinator will message); fold its `drift-ext.js` lessons into `manifold-reader-ext.js` (shared reader changes, not a fork).
- [ ] Port `PRELUDE` + SurfaceShader first (compile on SwiftShader, one frame at `?grid=65`), then the rest in table order.
- [ ] Run the PSNR rows; write the RECEIPT; leak sweep; PR; hand-off.
