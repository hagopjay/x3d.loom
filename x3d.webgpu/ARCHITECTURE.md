# Architecture: an X3D browser in Rust on wgpu (path E)

Date 2026-11-06. Status: design scaffold, docs only, nothing built. This is path E in [PATHS.md](PATHS.md), deferred until the runtime's intermediate representation exists (gate G6). Its layers mirror the TypeScript runtime in [BABYLON.md](BABYLON.md) section 9 on purpose, so the scene IR, the event engine and the receipt format can be shared or ported. Both must satisfy [SPEC.md](SPEC.md).

Grades: **C** is measured here with the named instrument, **L** is read or reasoned from sources, **S** is suspected. Crate versions and dates are from the index.crates.io sparse index (`pubtime`, fetched 2026-11-06, C). Every engineer-week figure is S.

**The answer.** A Rust X3D browser on wgpu can be built on today's stack: wgpu and naga 30.0.1 were published 2026-08-22T02:53Z, with WebGPU and WebGL2 for the web and Vulkan, Metal and DX12 native (C). The problem is spec breadth, not the GPU API: X3DUOM 4.0 has 260 concrete entries in 36 components and 4,197 field declarations, 4.1 has 267 (C). Interchange is 52 nodes, the Collider uses 33 node types and Immersive is 92 (L, componentInfo filter). Someone already published an X_ITE-faithful Rust parser (`vrml97`, `vrml`, `x3d` 0.1.0, 2026-10-11, MIT, C), and its README claims an unpublished wgpu port (S; crates.io lists no repository or homepage link for it and 11 downloads, C, 2026-11-06). Evaluate it first. M0 to M4 is about 40 to 70 engineer-weeks (S).

## 1. Prior art

| project | version, date | backend | fit | grade |
|---|---|---|---|---|
| `vrml97`, `vrml`, `x3d` crates | 0.1.0, 2026-10-11 14:50 to 14:56Z, MIT, no repository field | none published | X_ITE-faithful classic-encoding parser and writer, PROTO/IS/ROUTE parse, a node table from X_ITE 16.5.0 (263 types), about 7,482 lines; README says it was tested on about 1,150 VRML97 files and promises a port with events, Scripts on QuickJS and a wgpu renderer | C for the tarball text, S for the port (TBD-24) |
| `x3d-rs`, `vrml-parser`, `x3d_parser` and similar names | 404 | n/a | nothing else found | C |
| rend3 | 0.3.0, 2022-02-12 | wgpu | repository archived | C date, S archive |
| three-d | 0.19.0, 2026-04-17 | glow (GL, WebGL2) | not wgpu | C |
| kiss3d | 0.47.0, 2026-10-04 | wgpu 30, wasm | a toy renderer | C |
| Bevy | 0.20.1, 2026-10-28 | wgpu 30 (`bevy_render` ^30), MSRV 1.97.1 | heavy ECS engine; `webgpu` and `webgl2` features are exclusive, so two wasm builds | C |
| Fyrox | 1.0.1, 2026-03-28 | fyrox-graphics-gl | GL, not wgpu | C |
| naga | 30.0.1 | in: SPIR-V, WGSL, **GLSL 440+ Vulkan semantics only**; out: SPIR-V, WGSL, MSL, HLSL SM 5.0+, GLSL 330+ and ES 300+ | the shader hub | C (naga README, trunk) |

Firefox's WebGPU is itself built on wgpu (C, gpuweb wiki). The crate name `x3d` is taken, so this design uses the prefix `x3dio-` (C that the name is taken).

## 2. Layers

```
 .x3d XML | .x3dv/.wrl | .x3dj | .gltf/.glb | .spz/.ply | KTX2
      |          |          |          |
 [x3dio-parse-*]-+----------+    [x3dio-assets]
      |  typed nodes from [x3dio-uom]  (codegen from X3DUOM 4.1 + X_ITE extension file)
      v
 [x3dio-scene]  arena: NodeId slots, multi-parent DEF/USE, PROTO expander, Inline loader
      |                      |                          |
 [x3dio-events]        [x3dio-sai]                 [x3dio-tether]
 cascade, ROUTE graph   wasm-bindgen, X_ITE-shaped   load receipt (mapped |
 one timestamp,         JS API; Script: host JS      approximated | dropped)
 one event per field    shim (web) | QuickJS (native) + render report per frame
      |                                                 ^
 [x3dio-extract]  dirty flags -> flat render world      | pixels per DEF, blank flag
      |   (USE expanded into instances; pipeline keys)  |
      v                                                 |
 [x3dio-render]  frame graph (section 5)  ---- id buffer +
 [x3dio-shader]  WGSL modules; ComposedShader GLSL ES -> rewrite -> naga -> WGSL | GLSL ES 300
 [x3dio-compute] particles, splat radix sort, H-Anim skinning (WebGPU); CPU on WebGL2
      v
 wgpu 30:  WebGPU (browser) | GLES -> WebGL2 (browser, second build) | Vulkan, Metal, DX12 (native)
```

## 3. Crate layout

| crate | job | key dependencies (version, publish date, C) |
|---|---|---|
| x3dio-uom | xtask codegen from X3DUOM 4.0 and 4.1: node structs, defaults, access types, containerField, component and level, spec version tag; generated code checked in (R-PARSE-05) | roxmltree 0.21.2 (2026-10-24) |
| x3dio-fields | SF and MF types, f32 and f64 math, X_ITE number formatting for round trips | none |
| x3dio-parse-xml, -vrml, -json | three encodings into one AST; reuse `vrml97` if its licence and tests hold | quick-xml 0.42.0 (2026-08-22), vrml97 0.1.0, serde_json |
| x3dio-scene | arena store, DEF/USE, PROTO and EXTERNPROTO, Inline, IMPORT and EXPORT | slotmap 1.1.1 (2025-12-06) |
| x3dio-events | the 19775-1 event model (section 4) | none |
| x3dio-sai | JS API through wasm-bindgen | wasm-bindgen 0.2.130 (2026-10-30) |
| x3dio-script | web: the page's JS engine behind an SAI shim; native: embedded QuickJS | rquickjs 0.14.0 (2026-09-18) or boa_engine 0.22.0 (2026-08-28) |
| x3dio-render, -shader, -compute | frame graph, PBR, shader translation, compute | wgpu and naga 30.0.1, naga_oil 0.23.0 (2026-07-14), encase 0.13.0 (2026-09-19) |
| x3dio-assets | glTF, KTX2, Basis | gltf 1.4.1 (**2024-05-10, stale**), ktx2 0.5.0 (2026-04-19, reader only), basis-universal 0.3.1 (2023-11-02, C++) |
| x3dio-text, -audio | glyph atlas; Web Audio bridge | fontdue 0.9.5 (2026-10-19) or glyphon 0.12.0 (2026-07-09); web-sys; web-audio-api 1.7.0 (2026-08-08) native |
| x3dio-tether | load receipt and render report as JSON in the validator's diagnostic shape | serde_json |
| x3dio-web, x3dio-native | an `<x3d-canvas>` element; a winit viewer and a headless CI renderer | winit |

## 4. Event model and SAI

### 4.1 One frame

| step | what runs | requirement |
|---|---|---|
| 1 | time advances: `now` is SFTime (seconds since 1970), one value per frame | R-EVENT-04 |
| 2 | sensors: TimeSensor ticks; pointer events from the CPU ray cast; Proximity and Visibility from the camera pose; Key and String from DOM events | R-PICK-01 |
| 3 | cascade until the queue is empty: breadth-first ROUTE propagation, one timestamp, at most one event per field per timestamp; fan-in in X_ITE's recorded order | R-EVENT-01, 02 |
| 4 | Script `eventsProcessed`; `initialize` on load, `shutdown` on removal | R-EVENT-06 |
| 5 | bind stacks: Viewpoint, NavigationInfo, Background, Fog; transitions | R-SCENE-04 |
| 6 | extract: dirty fields into the flat render world, once | R-SCENE-06 |
| 7 | draw (section 5) | |
| 8 | `finishEvents` callbacks; render report if requested | R-SAI-03, R-TETHER-02 |

The 19775-1 V4.0 clause text is now opened (4.4.8.3 to 4.4.8.5, C, 2026-11-06): one timestamp per cascade, at most one event per field and per ROUTE per timestamp, the same rule breaks loops, and fan-in order is not significant. The spec's own per-timestamp order is camera, sensors, routes (repeated while events were generated), then particle systems, then physics; the table above maps that onto a renderer frame (L). A throw out of a host callback or a Script is caught, reported and routing continues (R-EVENT-08): on X_ITE 16.5.1 one such throw froze all routing at the 13th event (C, Collider study).

### 4.2 SAI facade

| X_ITE name (C, `x_ite.d.ts` 16.7.0) | here |
|---|---|
| `X3D.getBrowser(selector?)` | `#[wasm_bindgen]` entry returning a Browser handle |
| `browser.currentScene`, `getNamedNode(name)` | arena lookups by DEF |
| `createX3DFromString(text)`, `createX3DFromURL(url)` | parse into a new execution context |
| `addFieldCallback(key, field, fn)` (key first) | callback table keyed by (node, field, key); every call wrapped |
| `getCurrentTime()`, `finishEvents()` | step 1 value; step 8 hook |
| `scene.routes`, `addRoute`, `deleteRoute` | the ROUTE graph |
| `getBrowserProperty` | adds backend, adapter and feature names (R-SAI-05) |

## 5. Renderer passes

| # | pass | WebGPU | WebGL2 build | notes |
|---|---|---|---|---|
| 1 | shadow maps | depth-only pipelines; `depth-clip-control` when present | same | per light, as X_ITE's `shadowMapSize` |
| 2 | opaque | reversed-Z Depth32Float; pipeline cache keyed by the X3D fields (R-RENDER-03); render bundles per mesh | depth 24 | auto-instancing of USE'd shapes (R-SCENE-05): X_ITE draws once per USE (C) |
| 3 | transmission copy | copy plus a compute mip chain | blit mips | X_ITE mipmaps its transmission buffer (C) |
| 4 | transparent | sorted by default; weighted-blended OIT option with RGBA16F targets | same | X_ITE has the same OIT, off by default (C) |
| 5 | RenderedTexture and post | offscreen targets; bloom; tone mapping that skips ComposedShader output | same | the Collider's glow is a RenderedTexture (4.1) |
| 6 | id buffer | object and primitive id (`primitive-index` when present) into an R32Uint MRT; async readback | same, one frame late | coverage per DEF, displaced geometry (R-PICK-02) |
| C | compute | particles, splat radix sort, H-Anim skinning, IBL prefilter | CPU fallbacks | WebGL2 has no compute shaders (L); `@interpolate(linear)` is rejected on GLES adapters (C, wgpu CHANGELOG) |

Picking runs twice by design: a **CPU BVH** for sensor events in the same frame, because the WebGPU backend cannot wait (`Device::poll` with Wait returns `PollError::CantWait`, C, wgpu CHANGELOG PR #10218), and the **GPU id buffer** for coverage and shader-displaced geometry, which a BVH cannot see.

ComposedShader path: strip the `data:` prefix, set `#version 450`, hoist loose uniforms into blocks (X3D built-ins in group 0, the node's fields in group 1), add `layout(location)`, map `x3d_*` names, rename WGSL reserved words, then naga `glsl-in` to WGSL (WebGPU) or GLSL ES 300 (WebGL2). Start with the 7 built-ins the Collider needs (245 exist in `x_ite.js`, C) and fuzz on shaders from the example archives (R-SHADER-01 to 10).

## 6. Tether hooks

| hook | where | output | requirement |
|---|---|---|---|
| load receipt | parse, codegen gate, extract | every node and field: mapped, approximated (code, reason, clause) or dropped (code) | R-TETHER-01 |
| profile gate | parse | a 4.1 node in a 4.0 file, a node outside the declared components | R-PARSE-06 |
| shader report | x3dio-shader | per ShaderPart: translated, failed (compiler message), hashes of the GLSL and WGSL copies | R-SHADER-04, 09 |
| render report | end of frame, on request | backend, adapter, draws, pipelines, splats drawn, pixels per DEF from the id buffer, blank flag (under 0.5% changed) | R-TETHER-02, R-RENDER-25 |
| event trace | x3dio-events | (field, value, timestamp) stream for comparison with `x_ite-node` | R-TETHER-05 |
| limits report | device creation | adapter info, optional features used, clamps applied (sample count, texture size) | R-RENDER-12, R-SEC-04 |

All JSON in the validator's diagnostic shape (R-TETHER-03), so a hosted model reads one vocabulary from the validator and the renderer.

## 7. Milestones and gates

Engineer-weeks are S (inferred from node counts, no calibration). The baseline for every parity gate is X_ITE 16.7.0, pinned, anti-aliasing off, 960x540.

| M | scope | gate | eng-weeks |
|---|---|---|---|
| M0 | a triangle as wasm and native | renders on WebGPU and on forced WebGL2 on a real GPU; wasm raw, gzip and brotli sizes measured per backend against `x_ite.min.js` 1,306,961 B raw / 280,795 B gzip -9 (C); TBD-25 | 1-3 |
| M1 | static Interchange (52 nodes) + PhysicalMaterial (Shape 2) | 50 scenes from ConformanceNist and Basic under `parity/strict` (mean absolute difference at most 2/255, under 1% of pixels off by more than 16/255); a load receipt on every scene | 10-16 |
| M2 | TimeSensor, interpolators, EventUtilities, ROUTE | event traces equal X_ITE's on the ConformanceNist Interpolators and Sensors subset | 6-10 |
| M3 | Collider parity: 33 node types; Immersive + Shaders, ParticleSystems 2, X_ITE 1 (BlendMode, DepthMode), RenderedTexture bloom | the hep-event witness passes; dijet end-on luma, blue and cyan within the look v3 bands; frame time on the floor machine at least X_ITE's (with consent; X_ITE measured there first) | 8-14 |
| M4 | Immersive subset (92): Script, Sound, Text, pointing sensors, Inline, LOD, Collision | ConformanceNist Sensors and Sounds + Vrml2.0Sourcebook: every scene matches or the receipt names the gap; 0 silent failures | 16-28 |
| M5 | glTF, KTX2, GaussianSplats with GPU sort, H-Anim skinning | the HumanoidAnimation archive; a 562,348-splat tile loads and sorts (S, project note) | 10-18 |
| M6 | native viewer, headless CI, SAI port of `x_ite-tests` (a vitest suite, C) | SAI subset green | 8-14 |

Conformance corpus (C, SVN directory pages): Basic, ConformanceNist (12 categories: Appearance, BindableNodes, GeometricProperties, Geometry, GroupingNodes, Interpolators, Lights, Miscellaneous, STEP, Sensors, Sounds, SpecialGroups), HumanoidAnimation, Savage, Vrml2.0Sourcebook, X3dForAdvancedModeling, X3dForWebAuthors, plus create3000/x_ite-tests.

| program gate | condition |
|---|---|
| G6 (start E) | the TypeScript runtime's IR exists and passed its M2 (BABYLON.md), or a decision to go native first is recorded |
| crate reuse | `vrml97` evaluated: licence, tests rerun, author contacted about the port (TBD-24) |
| backend budget | M0 wasm sizes inside the budget the owner sets (R-PERF-04) |

## 8. Risk register

| risk | evidence | likelihood x impact | mitigation |
|---|---|---|---|
| spec size | 260/267 entries, 4,197 field declarations (C) | H x H | codegen, profile-gated scope, receipts name the gaps |
| Script node | X_ITE is JS-native (ScriptingComponent 9,716 B minified, C); the X3D JS classes must be rebuilt | H x M | web: host JS shim over the SAI; native: rquickjs |
| PROTO expansion | nested PROTO, IS, EXTERNPROTO fetch | M x H | reuse `vrml97`'s tested parser; trace tests |
| wasm size | no current figure; 2021 WebGPU-only wgpu about 708 KB raw / 222 KB compressed (S) | H x M | separate WebGPU and WebGL2 builds, `-Oz` and wasm-opt, budget gate at M0 |
| WebGPU on the floor machine | Chrome on Windows since 113 (C); Chromium's default blocklist has **no Intel rule** (C; corrects an earlier claim that it matches Intel by driver); Dawn turns `subgroups` off on Gen9 (C); the owner's probe on 2026-11-07 got a hardware gen-9 adapter with `shader-f16` and `timestamp-query`, without `subgroups` (C) | L x H | WebGL2 build still required for other visitors; design without subgroups |
| no compatibility mode in wgpu | issue #8124, not implemented (C) | M x M | reach below core goes through the WebGL2 build |
| wgpu churn | majors 2025-10-01, 2025-12-17, 2026-03-18, 2026-07-01 (C) | H x L | pin; one upgrade a quarter |
| moving parity target | 7 X_ITE releases between 10-04 and 10-31 (C) | H x M | pin X_ITE per gate (R-TETHER-07) |
| GLSL long tail | ES 1.00 and 3.00 sources, 245 built-ins | M x M | rewriter fuzzed on archive shaders |
| asset crates | gltf last published 2024; Basis is C++; X_ITE ships libktx.wasm 2,528,007 B (C) | M x M | own glTF loader on gltf-json; JS-side transcoder on the web |
| consent for real-GPU runs | the owner asked not to use his GPU for metrics (S, project note) | certain x M | decision card first (README gate G0); a second machine |
| no GPU in the sandbox | SwiftShader, about 0.6 s a frame for X_ITE scenes (C) | certain x M | pixel and trace tests only there; frame times only on real machines |
