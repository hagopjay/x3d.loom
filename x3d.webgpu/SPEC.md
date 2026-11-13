# X3D on WebGPU: the renderer specification scaffold

Date 2026-11-06. Status: normative scaffold, docs only, nothing built. Requirement ids are stable; wording will change as the TBD items close.

Grades: **C** is measured here with the named instrument, **L** is read or reasoned from sources, **S** is suspected. Opening a primary file (npm tarball, raw spec source, X3DUOM) and counting or grepping it is the instrument; a search paraphrase alone is S. Sources are in [SOURCES.md](SOURCES.md); the evidence behind the rationale column is in [STATE.md](STATE.md) and [PATHS.md](PATHS.md).

The key words MUST, SHOULD and MAY are used as in RFC 2119. "An implementation" means an X3D runtime (parsers, scene, events, Script, SAI) plus a rendering body on WebGPU with a WebGL2 fallback. The spec is neutral about the body: the TypeScript runtime on Babylon in [BABYLON.md](BABYLON.md) (path G) and the Rust/wgpu design in [ARCHITECTURE.md](ARCHITECTURE.md) (path E) are both meant to satisfy it.

**The answer in one paragraph.** No X3D runtime ships a WebGPU renderer as of 2026-11-06 (C: 0 "webgpu" strings in X_ITE 16.7.0 and X3DOM 1.8.3; Castle's roadmap names Vulkan or BGFX). This scaffold defines what one must do to be trusted: 5 conformance levels from static Interchange (L0) to Immersive-plus (L4), and 106 numbered requirements in 11 groups. Two of them carry most of the risk: the GLSL-only shader contract (R-SHADER-01 to 05) and same-frame sensor picking without synchronous GPU readback (R-PICK-01). Every lossy step must be reported (R-TETHER-01), because valid is not the same as visible.

## 1. Goals

| id | goal | measured by |
|---|---|---|
| G-1 | Render X3D 4.0 and 4.1 content on WebGPU, with WebGL2 where WebGPU is absent, with the semantics of the pinned X_ITE | conformance levels (section 4), V-PIXEL, V-TRACE |
| G-2 | Keep the tether: a model writes, the validator says what is wrong, the browser shows, and the renderer reports what it could not show | R-TETHER-01 to 08 |
| G-3 | Gain where WebGPU actually helps: compute (splat sort, particles, skinning) and CPU submission cost on draw-heavy scenes | BENCHMARK.md decision rule |
| G-4 | Pages written against X_ITE's SAI port with small changes | R-SAI-01, V-TAPE on the project's game and music pages |
| G-5 | Claim nothing about speed that was not measured on a named real GPU | R-PERF-02, receipt schema |

## 2. Non-goals

| non-goal | why |
|---|---|
| Replacing X_ITE as the reference renderer | X_ITE stays the truth renderer and the parity oracle (PATHS.md, path F) |
| Forking X_ITE | 1,396 direct `gl.*` call sites, a solo maintainer and weekly releases (C, STATE.md) |
| Changing X3D unilaterally | spec changes go to the Web3D X3D working group as proposals; anything else is a flagged project extension (R-SHADER-05) |
| Pixel-identical output across GPUs | tolerance profiles instead (R-TETHER-04) |
| glTF as the internal representation | it loses Script, most sensors, PROTO and every custom shader (PATHS.md matrix) |
| Hardware ray tracing | WebGPU has no ray-tracing API (L); path-traced stills live in HYPER.md |
| Browsers without WebGL2 | X_ITE itself dropped WebGL 1 in 11.6 (C, 2025-07-13) |
| Frame rates from the cloud sandbox | it renders with SwiftShader on the CPU (C, probe); correctness only |
| Code in this folder now | this is a scaffold; the gates in [README.md](README.md) decide when building starts |

## 3. Terms

| term | meaning |
|---|---|
| X3DUOM | the X3D Unified Object Model XML. 4.0 lists 260 concrete entries, 4.1 lists 267 (C, SVN mirror, generated 2026-10-31) |
| runtime node | a UOM concrete entry other than ProtoInstance, which is syntax: 259 in 4.0, 266 in 4.1 (C, verdict scan) |
| runtime | the renderer-agnostic layer: parsers, scene store, PROTO expansion, event cascade, Script host, SAI facade, receipt |
| body | the rendering layer the runtime drives: Babylon (path G), three.js (path C) or the Rust renderer (path E) |
| backend | the GPU API under a body: WebGPU, or WebGL2 as fallback |
| truth renderer | X_ITE at a pinned version (16.7.0 today; the shipped pages pin 16.5.1) |
| showpiece | a project world rendered on the WebGPU path for display (first: the Dirac collider) |
| load receipt | JSON listing every node and field as mapped, approximated (code, reason) or dropped (code) |
| render report | JSON per frame (on request): backend, adapter, draws, pipelines, pixels per DEF, blank flag |
| pipeline key | the hash of X3D fields that fix a WebGPU render pipeline (R-RENDER-03) |
| parity | agreement with the truth renderer within a tolerance profile (R-TETHER-04) |
| cascade | the 19775-1 event cascade: one timestamp, at most one event per field per timestamp |
| floor machine | the slowest real machine the project measures on; today the owner's Intel UHD 620 PC, and only with his consent (BENCHMARK.md) |
| X_ITE extension | a node or field X_ITE adds outside the standard: BlendMode, DepthMode, InstancedShape, SpecularGlossinessMaterial, 13 material extensions, `X3DShapeNode.pointerEvents` on 4.0 files (C, X_ITEComponent.js 16.7.0) |

## 4. Conformance levels

Component levels are X_ITE's own profile table (C, `src/x_ite/Configuration/SupportedProfiles.js` on main, fetched 2026-11-06); the 19775-1 Annex tables were not opened (TBD-01). Node counts are a componentInfo filter over X3DUOM 4.0 (L).

| level | name | X3D profile | components (level) | runtime nodes | bar beyond the profile |
|---|---|---|---|---|---|
| **L0** | Static Interchange | Interchange, first frame only | Core 1, EnvironmentalEffects 1, Geometry3D 2, Grouping 1, Lighting 1, Navigation 1, Networking 1, Rendering 3, Shape 1, Texturing 2 (Time 1 and Interpolation 2 parsed, not run) | 52 for the full profile (L) | V-PIXEL on frame 1; load receipt; thumbnails, validator previews |
| **L1** | Animated Interchange | Interchange | + Time 1, Interpolation 2, ROUTE | 52 (L) | V-TRACE equal to X_ITE on animated worlds |
| **L2** | Interactive | Interactive | + EnvironmentalSensor 1, EventUtilities 1, Geometry3D 3, Grouping 2, KeyDeviceSensor 1, Lighting 2, Networking 2, PointingDeviceSensor 1 | TBD-02 | V-TAPE: pointer and key tapes give X_ITE's sensor sequences, same frame |
| **L3** | Immersive | Immersive | + Core 2, EnvironmentalEffects 2, EnvironmentalSensor 2, Geometry2D 1, Geometry3D 4, KeyDeviceSensor 2, Navigation 2, Networking 3, Scripting 1, Shape 2 (PhysicalMaterial), Sound 1, Text 2, Texturing 3 | 92 (L) | Script in the sandbox (R-SEC-01); the project's game and music pages run on the SAI facade |
| **L4** | Immersive-plus | Immersive + named components | + Shaders 1 (ComposedShader), ParticleSystems 2, HAnim 3, CubeMapTexturing 3, Texturing3D 2, and 4.1: GaussianSplats 1, Texturing 4 (RenderedTexture), Rendering 5 (Tangent), EnvironmentLight; optional compatibility flag for X_ITE's own `X_ITE` component 1 | TBD-02 | shader translation (R-SHADER), GPU splat sort (R-SPLAT-02), the Collider at parity |

Notes:
- The Collider's 18 scenes declare Immersive plus Shaders 3, ParticleSystems 2, Rendering 3 and X_ITE 1, and use 33 node types (C, grep). X_ITE's Full profile lists Shaders 1 (C). What Shaders level 3 means is TBD-03.
- The Collider depends on BlendMode and DepthMode, which are X_ITE-only (C, absent from X3DUOM 4.1). It is therefore not portable X3D today. An implementation claims L4 for it only with the X_ITE flag on, and the portability lint (R-TETHER-06) must say so.
- The rest of the Full profile (NURBS, Geospatial, RigidBodyPhysics, VolumeRendering, Layering, Layout, Followers, Picking, DIS, CAD) is the long tail (BABYLON.md M7) and has no level here yet.

A claim of level Ln names the implementation version, the body, the backend, the truth renderer pin, the browser and the GPU, and links the receipts.

## 5. Verification methods

| code | method |
|---|---|
| V-CORPUS | parse and render the Web3D example archives through the SVN mirror (Basic, ConformanceNist with its 12 categories, HumanoidAnimation, Savage, Vrml2.0Sourcebook, X3dForAdvancedModeling, X3dForWebAuthors) plus the project's worlds; count per node |
| V-TRACE | event traces (field, value, timestamp) compared with `x_ite-node` 2.3.2 on the pinned X_ITE |
| V-PIXEL | frames compared with the truth renderer at a fixed viewport, anti-aliasing off, under a tolerance profile (R-TETHER-04) |
| V-TAPE | recorded pointer and key tapes replayed; sensor event sequences compared (the `kit/loom play` pattern) |
| V-PROBE | an adapter and feature probe page served from file://, https or localhost (never about:blank or data:, where `navigator.gpu` is absent: C, re-probe) |
| V-BENCH | the [BENCHMARK.md](BENCHMARK.md) protocol and a receipt valid against [bench/receipt.schema.json](bench/receipt.schema.json) |
| V-LINT | a validator rule fires on a fixture and stays silent on its negative control |
| V-RECEIPT | the load receipt or render report carries the stated code |
| V-UNIT | a unit test in the implementation's suite |
| V-FUZZ | fuzzed inputs (shader sources, malformed files) |
| V-REVIEW | review of code or configuration (CSP header, dependency list) |

## 6. Requirements

Columns: **id**, **lvl** (lowest conformance level that needs it), **key**, the requirement, the rationale with its grade, and how it is verified.

### 6.1 R-PARSE: reading files

| id | lvl | key | requirement | rationale | verify |
|---|---|---|---|---|---|
| R-PARSE-01 | L0 | MUST | Read the XML encoding (`.x3d`) | the encoding models write and the validator checks (L) | V-CORPUS |
| R-PARSE-02 | L0 | MUST | Read ClassicVRML (`.x3dv`); SHOULD read VRML97 (`.wrl`) | archives and the `vrml97` crate's 1,150-file test set (C for the claim in its README) | V-CORPUS |
| R-PARSE-03 | L0 | SHOULD | Read the JSON encoding (`.x3dj`) against the X3D JSON schema 4.0 | 19776-5 is still a working draft (L) | V-CORPUS |
| R-PARSE-04 | L0 | MUST | Accept the gzip forms (`.x3dz`, `.x3dvz`) | common in archives (L) | V-UNIT |
| R-PARSE-05 | L0 | MUST | Generate node classes, fields, defaults, access types and containerField from X3DUOM 4.1 plus X_ITE's extension file; tag each node with its spec version; check the generated code in | 267 entries, 4,197 field declarations in 4.0 alone (C); hand-written tables drift | V-UNIT: regenerate and diff |
| R-PARSE-06 | L0 | MUST | Gate nodes by the file's declared version, profile and components, and emit a diagnostic for a node outside them (for example a 4.1 node in a 4.0 file) | X_ITE rejects 5 of the 4.1 nodes in a 4.0 file (L) | V-RECEIPT |
| R-PARSE-07 | L0 | MUST | Report every unknown node and field with a stable code; never drop one silently | X_ITE 16.7.0 drops `DepthMode readOnly` without a word (C) | V-RECEIPT |
| R-PARSE-08 | L0 | MUST | Support PROTO, EXTERNPROTO, IS, IMPORT, EXPORT, Inline and DEF/USE identity | core of the format (L) | V-CORPUS, V-TRACE |
| R-PARSE-09 | L0 | MUST | Load `data:` strings and pasted text by sniffing `<X3D`, `#X3D V` or a JSON `"X3D":` key | model output arrives without a file name (BABYLON.md 2.1, L) | V-UNIT |
| R-PARSE-10 | L0 | SHOULD | Hand an Inline that points at `.glb`, `.gltf`, `.spz`, `.ply` or `.sog` to the body's own loaders, parented under the Inline | X3D already points at glTF; reuse beats rewrite (L) | V-PIXEL |
| R-PARSE-11 | L0 | MUST | Treat every file as untrusted input: bound the parser's memory and time and report a limit hit | the libxml2 wall sits between 76,250 and 76,875 inline splats (S, project note) | V-FUZZ |

### 6.2 R-SCENE: the scene store

| id | lvl | key | requirement | rationale | verify |
|---|---|---|---|---|---|
| R-SCENE-01 | L0 | MUST | Keep one scene store (arena, shared node ids, multi-parent DEF/USE) as the source of truth; body objects are disposable views | DEF/USE is a DAG with shared field state; an ECS gives one entity per instance (L) | V-UNIT |
| R-SCENE-02 | L0 | MUST | Compose Transform as T·C·R·SR·S·(−SR)·(−C) | 19775-1 (L) | V-PIXEL |
| R-SCENE-03 | L0 | MUST | Be right-handed, Y-up; apply Viewpoint `fieldOfView` to the smaller screen side | X3D convention (L); Babylon needs `fovMode` switching (BABYLON.md) | V-PIXEL at two aspect ratios |
| R-SCENE-04 | L1 | MUST | Implement the Viewpoint, NavigationInfo, Background and Fog bind stacks with `bindTime` and `isBound` | spec (L) | V-TRACE |
| R-SCENE-05 | L0 | SHOULD | Draw shapes reached by USE with one instanced draw when geometry and appearance match | X_ITE 16.5.1 makes one draw per USE: 9,955 draws for 10,000 towers, 17 s to load (C, SwiftShader CPU time) | V-BENCH draws per frame |
| R-SCENE-06 | L1 | MUST | Flush changed fields to the body once per frame from a dirty set | per-field writes on large animated worlds (L) | V-UNIT |
| R-SCENE-07 | L0 | MUST | Support LOD, Switch, Billboard, Collision and Anchor grouping | Interchange to Immersive (C, profile table) | V-CORPUS |
| R-SCENE-08 | L0 | MUST | Report float32 precision loss for SFVec3d, MFVec3d and Geospatial; SHOULD render camera-relative | GPUs are float32 (L) | V-RECEIPT |
| R-SCENE-09 | L3 | MUST | Apply dynamic changes (createX3DFromString, addRoute, PROTO instances at run time) incrementally, without a full rebuild | dynamic worlds (BABYLON.md risk table, L) | V-TRACE |

### 6.3 R-EVENT: time and the cascade

| id | lvl | key | requirement | rationale | verify |
|---|---|---|---|---|---|
| R-EVENT-01 | L1 | MUST | Give every event in a cascade the initiating timestamp; let a node send at most one event per field per timestamp and one event per ROUTE per timestamp; use the same rule to break loops | 19775-1 V4.0 clauses 4.4.8.3 and 4.4.8.4 (C, clause text opened 2026-11-06) | V-TRACE, V-UNIT |
| R-EVENT-02 | L1 | MUST | Where the spec leaves fan-in order undefined, use X_ITE's recorded order | 19775-1 4.4.8.5 (C): fan-in order is not significant and conforming worlds must accept any order, so pinning X_ITE's order is a determinism choice for V-TRACE (L); TBD-05 | V-TRACE |
| R-EVENT-03 | L1 | MUST | Run each frame in this order: time, sensors, cascade until empty, Script `eventsProcessed`, bind stacks, sync, draw, `finishEvents` | 19775-1 4.4.8.3 (C) orders each timestamp as: camera from the bound Viewpoint, sensors, routes, repeat while events were generated, then particle systems, then physics; X_ITE 16.7.0's render callback steps (C, source read); the mapping is L | V-TRACE |
| R-EVENT-04 | L1 | MUST | Implement TimeSensor, the 13 interpolators and SFTime as seconds since 1970 | Time 1, Interpolation 2 (C, profile table) | V-TRACE |
| R-EVENT-05 | L2 | MUST | Implement the 7 EventUtilities nodes | Interactive (C) | V-TRACE |
| R-EVENT-06 | L3 | MUST | Call Script `initialize` on load, `shutdown` on removal and `eventsProcessed` after its events | spec (L) | V-TRACE |
| R-EVENT-07 | L2 | MUST | Deliver pointing-sensor events in the frame of the input that caused them; if a body can only answer a frame late, say so in the render report | async GPU readback shifts events by a frame (L); TBD-06 | V-TAPE |
| R-EVENT-08 | L1 | MUST NOT | Let an exception from a host callback or a Script stop routing; catch it, report it and continue | on X_ITE 16.5.1 one throw froze all routing at the 13th event (C, Collider study) | V-UNIT |
| R-EVENT-09 | L1 | SHOULD | Render on demand: idle when no event and no animation is pending | X_ITE does (C, 16.7.0); battery and fan (L) | V-UNIT, V-BENCH |

### 6.4 R-SAI: the scene access interface

| id | lvl | key | requirement | rationale | verify |
|---|---|---|---|---|---|
| R-SAI-01 | L1 | MUST | Expose X_ITE's shapes: `X3D.getBrowser`, `browser.currentScene`, `createX3DFromString`, `createX3DFromURL`, `getNamedNode`, `addFieldCallback(key, field, fn)` with the key first, `getCurrentTime`, `finishEvents`, `scene.routes` | pages port over (C for the names, `x_ite.d.ts` 16.7.0) | V-TAPE on the platformer, drift and music pages |
| R-SAI-02 | L1 | MUST | Keep the public API free of WebGL and WebGPU types | X_ITE's 24,153-line `d.ts` mentions WebGL once (C); the body must stay swappable | V-REVIEW |
| R-SAI-03 | L1 | MUST | Fire a `finishEvents` callback once per rendered frame | the only honest frame counter: X_ITE finished 17 frames per 19 page rAF calls (C, sandbox ratio) | V-UNIT |
| R-SAI-04 | L3 | SHOULD | Support `addRoute`, `deleteRoute`, `createNode` and `createProto` at run time | Script and page code use them (L) | V-TRACE |
| R-SAI-05 | L0 | MUST | Report the backend, adapter vendor and architecture, and active optional features through a browser property | the render report and every receipt need it (L) | V-RECEIPT |
| R-SAI-06 | L0 | SHOULD | Map `loseContext()` to `device.destroy()`; on `device.lost` recreate the device and fire `CONNECTION_ERROR`, as X_ITE 14 does for a lost WebGL context | (C for X_ITE 14's behaviour); no dimension covered device loss (gap) | V-UNIT |

### 6.5 R-RENDER: drawing

| id | lvl | key | requirement | rationale | verify |
|---|---|---|---|---|---|
| R-RENDER-01 | L0 | MUST | Use WebGPU only after `navigator.gpu.requestAdapter()` returns an adapter whose limits and features suffice; otherwise run the WebGL2 backend with the same runtime | stable Firefox on Linux and Android, Chrome on Windows ARM64 and most Linux GPUs lack WebGPU (C, gpuweb wiki 2026-11-06) | V-PROBE, both backends in V-PIXEL |
| R-RENDER-02 | L0 | MUST | Fit the core default limits with zero optional features; use an optional feature only behind a check | maxBindGroups 4, 16 sampled textures per stage, 8 storage buffers per stage, 128 MiB storage binding (C, spec) | V-PROBE with a limits-clamped device |
| R-RENDER-03 | L0 | MUST | Derive a pipeline key from topology, `solid` and `ccw` (cull, front face), alphaMode and BlendMode (blend), DepthMode (depth), clip-plane count, sample count and shader variant; cache pipelines by key; change only bind groups when a texture of the same format changes | WebGPU bakes this state into immutable pipelines (L); X_ITE has 146 `X3D_*` variant macros (C) | V-UNIT, render report pipeline count |
| R-RENDER-04 | L0 | MUST | Draw lines wider than 1 px and points larger than 1 px as screen-space quads (instanced or vertex-pulled) | WebGPU lines and points are 1 px (C, spec); WebGL2 points reach 1,023 px on the sandbox (C) | V-PIXEL on LineProperties and PointProperties fixtures |
| R-RENDER-05 | L0 | MUST | Triangulate TriangleFanSet and IndexedTriangleFanSet at load | no fan topology (C, spec) | V-PIXEL |
| R-RENDER-06 | L0 | MUST | Map the `-1` separators of strip and line sets to strip restart, or split the draw | restart is always on for strips (L) | V-PIXEL |
| R-RENDER-07 | L0 | MUST | Map clip-space depth to [0,1]; SHOULD use reversed-Z Depth32Float; map DepthMode `depthRange` to viewport min and max depth | GL uses [−1,1] (L); X_ITE has a logarithmic depth option (C) | V-PIXEL on depth-fighting fixtures |
| R-RENDER-08 | L0 | MUST NOT | Set depthBias on point-list, line-list or line-strip pipelines; offset lines in the vertex shader instead | the spec says these must be 0 (C) | V-UNIT (pipeline validation) |
| R-RENDER-09 | L2 | MUST | Implement ClipPlane with the `clip-distances` feature when present, else fragment discard; support at least 8 | optional feature, at most 8 in WGSL (C); spec minimum count TBD-07 | V-PIXEL with the feature masked |
| R-RENDER-10 | L0 | MUST | Generate mip chains with a blit or compute pass | no `generateMipmap` in WebGPU (C) | V-PIXEL |
| R-RENDER-11 | L0 | MUST | Emulate `CLAMP_TO_BOUNDARY` and `borderColor` in the shader or report an approximation code | no border address mode (C); WebGL2 lacks it too (X_ITE comments it out, C) | V-RECEIPT |
| R-RENDER-12 | L0 | MUST | Clamp a requested sample count to 1 or 4 and report the clamp | WebGPU MSAA is 1 or 4 (C); X_ITE's `Multisampling` is any SFInt32, default 4 (C) | V-RECEIPT |
| R-RENDER-13 | L0 | MUST | Write the colour pipeline down end to end: canvas format, sRGB through `viewFormats`, premultiplied alpha, linear or sRGB lighting per X_ITE's `ColorSpace` mode, tone mapping; and match the pinned X_ITE's defaults (16.7.0: ToneMapping NONE, ColorSpace LINEAR_WHEN_PHYSICAL_MATERIAL) | X3D 4.1 has no normative colour rule (C, UOM silent); X_ITE's docs and code disagree on defaults (C) | V-PIXEL on a colour chart scene; TBD-08 |
| R-RENDER-14 | L0 | MUST | Implement wireframe and POINT shading without polygon mode (edge index buffer, or barycentric) | no polygonMode (C); Castle already generates lines engine-side (C) | V-PIXEL |
| R-RENDER-15 | L0 | MUST | Flip image origin on upload (`flipY` on external-image copies) | framebuffer and image origins differ (L) | V-PIXEL |
| R-RENDER-16 | L0 | MUST | State a provoking-vertex rule for flat attributes and integer attributes and test it | WebGPU flat interpolation takes the first vertex, GL ES 3.0 the last (L); wgpu 30 requires integer shader I/O to be flat (C, CHANGELOG); TBD-09 | V-PIXEL on `colorPerVertex=false` and Shading FLAT fixtures |
| R-RENDER-17 | L0 | MUST | Sort transparent shapes back to front by default; SHOULD offer weighted-blended OIT | X_ITE has opt-in WBOIT with RGBA16F targets (C) | V-PIXEL |
| R-RENDER-18 | L4 | SHOULD | Run passes in this order: shadow maps, opaque, transmission copy with a mip chain, transparent, RenderedTexture, post and tone, id buffer | X_ITE 16.7.0's pass set (C) | V-PIXEL |
| R-RENDER-19 | L0 | MUST | Pick the KTX2 and Basis transcode target from adapter features (`texture-compression-bc`, `-etc2`, `-astc`), never PVRTC | PVRTC has no WebGPU counterpart (C) | V-PROBE |
| R-RENDER-20 | L0 | MUST NOT | Depend on multi-draw-indirect or bindless | experimental flag only, and a Draft proposal (C) | V-REVIEW |
| R-RENDER-21 | L0 | SHOULD | Keep vertex data in vertex buffers, not vertex-stage storage buffers | compatibility mode allows 0 storage buffers in the vertex stage (C, spec) | V-REVIEW |
| R-RENDER-22 | L0 | MAY | Use immediates for per-draw data where `wgslLanguageFeatures` has `immediate_address_space`; fall back to dynamic-offset uniforms | in the spec, on in Chromium 153 with no flag (C) | V-PROBE |
| R-RENDER-23 | L0 | SHOULD | Record per-mesh commands into render bundles and reuse them while the pipeline key and bindings hold | WebGPU costs about 6 to 10 API calls a mesh (S) | V-BENCH CPU per frame |
| R-RENDER-24 | L4 | SHOULD | Use the WebXR/WebGPU binding when it exists; until then run immersive sessions on the WebGL2 backend | X_ITE uses XRWebGLLayer only (C); binding status TBD-10 | V-PROBE on a headset |
| R-RENDER-25 | L0 | MUST | Report a blank frame (under 0.5% of pixels differ from the background) as a failure in the render report | valid is not visible (L) | V-RECEIPT |

### 6.6 R-SHADER: programmable shaders

| id | lvl | key | requirement | rationale | verify |
|---|---|---|---|---|---|
| R-SHADER-01 | L4 | MUST | Accept ComposedShader `language="GLSL"` (GLSL ES 3.00 as X_ITE accepts it) and translate it to WGSL: glslang to SPIR-V to Tint (Babylon's path, C), or a rewrite pre-pass into naga `glsl-in` | naga accepts only GLSL 440+ with Vulkan semantics (C, README) | V-PIXEL on the Collider's programs; gate G2 |
| R-SHADER-02 | L4 | MUST | Bind the X_ITE `x3d_*` built-ins through a fixed layout: group 0 for built-ins (matrices, viewport, lights), group 1 for the ShaderPart's own fields (the ROUTE targets) | 245 distinct `x3d_*` names in `x_ite.js`, 263 with components (C); the Collider needs 7 (C) | V-UNIT |
| R-SHADER-03 | L4 | MUST | Rename WGSL reserved words during translation (`meta`, `mod`, `active`, `attribute`, `varying`, `precision`, `layout`, `highp`) | reserved in WGSL (C); the Collider uses `aMeta` and `vMeta` (C) | V-FUZZ |
| R-SHADER-04 | L4 | MUST | Report a translation or compile failure per ShaderPart with a stable code and the compiler message; MUST NOT render it silently blank | on three.js r187 WebGPU a valid ComposedShader has no material mapping and vanishes (C, StandardNodeLibrary) | V-RECEIPT |
| R-SHADER-05 | L4 | SHOULD | Accept `language="WGSL"` as a flagged project extension, and propose `WGSL` for shaderLanguageValues and `COMPUTE` for shaderPartTypeValues to the Web3D working group | X3D 4.0 and 4.1 list only Cg, GLSL, HLSL and VERTEX, FRAGMENT (C); detail TBD-11 | V-LINT (extension flagged) |
| R-SHADER-06 | L4 | MUST NOT | Apply tone mapping to ComposedShader output | X_ITE leaves it untouched: max difference 2/255 (C, Collider study) | V-PIXEL |
| R-SHADER-07 | L4 | MUST | Compile byte-identical shader source once and share the pipeline | X_ITE builds 311 programs at N=300 (C) | render report pipeline count |
| R-SHADER-08 | L4 | MUST | Self-host any translator WASM (glslang, twgsl) and transcoders; never load them from a third-party CDN at run time | Babylon fetches twgsl from its CDN by default (C, `Tools.GetBabylonScriptURL`) | V-REVIEW |
| R-SHADER-09 | L4 | SHOULD | Keep GLSL as the truth copy for X_ITE and any hand-written WGSL as a second copy, both hashed in the receipt | the showpiece and the truth must stay comparable (L) | V-RECEIPT |
| R-SHADER-10 | L4 | MUST | Handle the semantic breaks a translator does not catch: GLSL `mod` (floor) vs WGSL `%` (truncate), `gl_FragCoord` origin, `gl_PointSize`, and `sin()`-based hashes that differ by backend | CrossTL: a program "can compile and still compute something else" (C, arXiv 2508.21256) | V-PIXEL, V-FUZZ |

### 6.7 R-SPLAT: Gaussian splats

| id | lvl | key | requirement | rationale | verify |
|---|---|---|---|---|---|
| R-SPLAT-01 | L4 | MUST | Render the X3D 4.1 GaussianSplats node from its 29 inline fields, SH degree 0 to 3 | the node has no url (C, X3DUOM 4.1) | V-PIXEL vs X_ITE |
| R-SPLAT-02 | L4 | MUST | Sort splats on the GPU (compute radix sort) on WebGPU; MAY use a CPU worker on WebGL2 | X_ITE sorts on the CPU in a 2,093-byte WASM worker (C); WebSplatter reports 1.2x to 4.5x over web viewers (C, author-reported, their hardware) | V-BENCH |
| R-SPLAT-03 | L4 | MUST NOT | Hold the scene's loading state on a splat node that is culled before its first sort | X_ITE 16.5.0 hangs `loadURL` this way (S; re-run on 16.7.0 is TBD-12) | V-UNIT |
| R-SPLAT-04 | L4 | MUST | Use the 4.1 defaults `pointerEvents` TRUE and `castShadow` TRUE | X_ITE 16.7.0's GaussianSplats node defaults both FALSE; its GaussianSplatsShape defaults TRUE (C) | V-UNIT |
| R-SPLAT-05 | L4 | SHOULD | Sort all splat nodes of a world together, across Transforms | separate sorts composite wrongly (L) | V-PIXEL |
| R-SPLAT-06 | L4 | SHOULD | Load external splats through Inline (`.spz`, `.ply`, `.glb` with `KHR_gaussian_splatting`) | the 4.1 node is inline only; KHR is ratified (C) | V-PIXEL |
| R-SPLAT-07 | L4 | MUST | Keep SH coefficients at float32 or report the quantisation | Babylon quantises SH to bytes (L) | V-RECEIPT |
| R-SPLAT-08 | L4 | MAY | Implement the proposed `url`, `kernel`, `projection`, `sortingMethod` and `splatBudget` fields behind a flag | KHR parity (HYPER.md sketch A) | V-LINT (flagged) |

### 6.8 R-PICK: picking, sensors and collision

| id | lvl | key | requirement | rationale | verify |
|---|---|---|---|---|---|
| R-PICK-01 | L2 | MUST | Produce pointing-sensor hits (`hitPoint`, `hitNormal`, `hitTexCoord`) in the same frame from a CPU ray cast over a BVH | WebGPU readback is async only (wgpu `Device::poll` Wait returns CantWait on the web, C); X_ITE reads synchronously with `readPixels` (C) | V-TAPE |
| R-PICK-02 | L2 | SHOULD | Keep a GPU id buffer for exact hits on vertex-displaced geometry and for per-DEF pixel coverage, a frame late, using `primitive-index` when present | Collider ribbons are widened in the vertex shader, which a BVH cannot see (C, builder) | V-RECEIPT coverage |
| R-PICK-03 | L2 | MUST | Treat `pointerEvents=false` as not pickable, and let a pointer pass through it to the shapes behind | on X_ITE, effect shapes hide a TouchSensor's shape (L); the field is 4.1 only (C) | V-TAPE |
| R-PICK-04 | L2 | MUST | Implement PlaneSensor, CylinderSensor and SphereSensor by intersecting the pick ray with the sensor's surface in its local frame | no GPU equivalent (L) | V-TAPE |
| R-PICK-05 | L3 | MUST | Implement Collision and terrain following without synchronous GPU readback | X_ITE uses `TextureBuffer.readDepth` (C) | V-TAPE on walk navigation |
| R-PICK-06 | L2 | MUST | Name in the render report every event class that arrives a frame late (sensor events: none) | timing is behaviour (L) | V-RECEIPT |

### 6.9 R-PERF: performance and measurement

| id | lvl | key | requirement | rationale | verify |
|---|---|---|---|---|---|
| R-PERF-01 | L0 | MUST NOT | Quote a frame rate from a software rasterizer | the sandbox's SwiftShader takes about 0.6 s a frame for X_ITE scenes (C) | V-REVIEW of every published number |
| R-PERF-02 | L0 | MUST | Name with every timing the hardware, OS, browser and version, flags, body and version, backend, truth pin and date | the project's number rule; receipt schema | V-BENCH |
| R-PERF-03 | L0 | MUST NOT | Claim to be faster than X_ITE until the Go rule in BENCHMARK.md holds | the only real-GPU number is a vsync-capped 59.7 fps median (C, one machine) | V-BENCH |
| R-PERF-04 | L0 | SHOULD | Set a size budget at M0 against the X_ITE baseline (`x_ite.min.js` 1,306,961 B raw, 280,795 B gzip -9) and fail the build when it grows past it | Babylon's full UMD is 1,918,028 B gzip -9, three.js core plus WebGPU about 553 KB (C) | V-BENCH |
| R-PERF-05 | L0 | MUST | Record time to first non-blank frame, cold and warm, apart from steady-state frame time | compile stalls hide in averages (L) | V-BENCH |
| R-PERF-06 | L0 | MUST NOT | Regress the Dirac hero scene by more than 10% in p95 frame time against X_ITE | decision rule clause 4 (BENCHMARK.md) | V-BENCH |
| R-PERF-07 | L0 | MUST | Run no measurement on the owner's machine without his explicit yes | he asked that his GPU not be used for metrics (S, project note, 28 Oct) | gate G0 in README |

### 6.10 R-TETHER: accountability

| id | lvl | key | requirement | rationale | verify |
|---|---|---|---|---|---|
| R-TETHER-01 | L0 | MUST | Emit a load receipt: every node and field mapped, approximated (stable code, reason, spec clause) or dropped (stable code) | a model must be told exactly what did not become visible (L) | V-RECEIPT |
| R-TETHER-02 | L0 | MUST | Emit on request a per-frame render report: backend, adapter, draws, pipelines, splats drawn, pixels per DEF from the id buffer, blank flag | the input every judge reads (HYPER.md idea 4) | V-RECEIPT |
| R-TETHER-03 | L0 | MUST | Use the validator's diagnostic shape (stable code, location, message) for receipts and reports | one loop, one vocabulary (L) | V-UNIT schema check |
| R-TETHER-04 | L0 | MUST | Pass parity against the pinned truth renderer under a named tolerance profile: `parity/look` mean absolute difference at most 4/255 and luma within 0.01 (BABYLON.md M1); `parity/strict` at most 2/255 and under 1% of pixels off by more than 16/255 (ARCHITECTURE.md M1); for the benchmark also SSIM at least 0.95 and PSNR at least 30 dB | the numbers are proposals; calibration is TBD-13 | V-PIXEL |
| R-TETHER-05 | L1 | MUST | Pass event-trace equality with `x_ite-node` on the named animated worlds | behaviour is part of visible (L) | V-TRACE |
| R-TETHER-06 | L0 | SHOULD | Ship a portability lint in the validator fork that warns, never rejects, on: ComposedShader with GLSL only; `linewidthScaleFactor` over 1; point size over 1; fan sets; `CLAMP_TO_BOUNDARY` or `borderColor`; `generateMipMaps`; more than 8 ClipPlanes; X_ITE-only BlendMode and DepthMode; GaussianSplats without explicit `pointerEvents` | valid is not portable (L) | V-LINT with negative controls |
| R-TETHER-07 | L0 | MUST | Pin the truth renderer's version per gate and record it | X_ITE shipped 7 releases between 2026-10-04 and 2026-10-31 (C, npm) | V-RECEIPT |
| R-TETHER-08 | L0 | MUST | Fail a gate on a blank or near-blank frame even when the file validates | the thesis (L) | V-PIXEL |

### 6.11 R-SEC: safety

| id | lvl | key | requirement | rationale | verify |
|---|---|---|---|---|---|
| R-SEC-01 | L3 | MUST | Default Script to a sandbox (an interpreter in WASM with an instruction budget and no DOM); offer `off`, and `page` only by explicit choice | X_ITE runs Script with `new Function` in the page realm (C); model-written code is untrusted | V-UNIT: a runaway loop is cut off and reported |
| R-SEC-02 | L0 | MUST | Document the page CSP: `wasm-unsafe-eval` where WASM runs; no `unsafe-eval` unless `page` Script mode is chosen | X_ITE needs both (L: 9 `new Function` sites by a strict regex, 3 WASM modules, C) | V-REVIEW |
| R-SEC-03 | L4 | MUST | Treat shader translation as an attack surface: bound shader source size, keep translators current, and let the browser's WebGPU validation run (no unsafe flags in production) | DarthShader fuzzes WebGPU shader translators as an attack surface (C, arXiv 2409.01824) | V-FUZZ |
| R-SEC-04 | L0 | MUST | Cap resources from a file: vertex and index counts, texture size at `maxTextureDimension2D`, buffers at `maxBufferSize`, splat counts; report a cap hit | untrusted scenes; defaults 8192 and 256 MiB (C) | V-FUZZ |
| R-SEC-05 | L0 | MUST | Fetch Inline, textures and audio under the page's origin rules, without credentials | ordinary web hygiene (L) | V-REVIEW |
| R-SEC-06 | L0 | MUST | Serve probe and test pages from a secure context | `navigator.gpu` is absent on about:blank (C, re-probe) | V-PROBE |
| R-SEC-07 | L0 | MUST | Keep run-time dependencies pinned to exact versions, with hashes in the receipt | Babylon ships about 141 releases a year, X_ITE about 69 (C, npm) | V-REVIEW |

**Count:** 11 + 9 + 9 + 6 + 25 + 10 + 8 + 6 + 7 + 8 + 7 = **106** requirements (R-PARSE 11, R-SCENE 9, R-EVENT 9, R-SAI 6, R-RENDER 25, R-SHADER 10, R-SPLAT 8, R-PICK 6, R-PERF 7, R-TETHER 8, R-SEC 7).

## 7. TBD register

Owners are left blank on purpose. "Hand fetch" means the source sits on a host this research could not reach.

| id | question | blocks | needs | owner |
|---|---|---|---|---|
| TBD-01 | The 19775-1 Annex profile tables, to confirm X_ITE's component levels | section 4 | hand fetch: web3d.org 19775-1 V4.0 | |
| TBD-02 | Runtime node counts for Interactive and Immersive-plus | section 4 | a `python3 -I` filter over X3DUOM 4.1 | |
| TBD-03 | What "Shaders 3" in the Collider's component list means when X_ITE's Full profile lists Shaders 1 | L4, Collider claim | X3DUOM componentInfo read | |
| TBD-04 | CLOSED 2026-11-06. Exact wording and clause numbers of the event model (cascade, loop breaking, fan-in) | R-EVENT-01 to 03 | opened: 19775-1 V4.0 Part 1 concepts.html, clauses 4.4.8.3 to 4.4.8.5 | |
| TBD-05 | X_ITE's fan-in and Script order within one timestamp | R-EVENT-02 | `x_ite-node` traces | |
| TBD-06 | Whether any body can deliver id-buffer hits within the frame, and how sensor timing changes if not | R-EVENT-07, R-PICK-02 | prototype | |
| TBD-07 | ClipPlane minimum count and line-width semantics in 4.1 prose | R-RENDER-09, R-RENDER-04 | hand fetch: 4.1 CD prose | |
| TBD-08 | A normative colour-space rule (sRGB vs linear lighting) for 4.1, and the canvas `toneMapping: "extended"` HDR mode | R-RENDER-13 | Web3D working group; probe | |
| TBD-09 | The provoking-vertex rule, tested on X_ITE flat shading and `colorPerVertex=false` | R-RENDER-16 | V-PIXEL fixture | |
| TBD-10 | Status of the WebXR/WebGPU binding in Chrome 156 and Safari | R-RENDER-24 | hand fetch: browser release notes | |
| TBD-11 | The WGSL proposal's detail: bind-group layout for `x3d_*`, an `entryPoint` field, how url and inline source form one module, when a COMPUTE part dispatches relative to the cascade and the render traversal; PackagedShader and ProgramShader | R-SHADER-05 | a written proposal with an example scene (asked for on x3d-public in April 2026, S) | |
| TBD-12 | Are the 13 silent stubs and the splat culling hang still in X_ITE 16.7.0? | R-SPLAT-03, STATE.md | field-guide harness re-run | |
| TBD-13 | Calibrate the tolerance profiles: X_ITE against itself on two GPUs and two browsers | R-TETHER-04 | two real machines | |
| TBD-14 | CLOSED 2026-11-07. Does Chrome 156 on the owner's UHD 620 grant an adapter, with which features and limits (shader-f16, timestamp-query)? Yes: hardware Intel gen-9 adapter, device ok, shader-f16 and timestamp-query on, subgroups off, 16,384 px 2D textures, 16 storage buffers per stage | R-RENDER-01, BENCHMARK | `bench/receipts/g1-probe-2026-11-07.json` | |
| TBD-15 | Does a Collider ComposedShader compile unchanged through Babylon's glslang plus twgsl? | gate G2, R-SHADER-01 | test with the Collider's programs | |
| TBD-16 | Does glslang with relaxed Vulkan rules accept loose uniforms and `x3d_*` names? Does naga accept rewritten GLSL ES 3.00 (combined samplers, precision)? | R-SHADER-01 | test | |
| TBD-17 | How much of full-stage GLSL ES 3.00 does three.js's GLSLDecoder to TSLEncoder transpiler handle? | path C | test | |
| TBD-18 | Which X_ITE files does `CC-BY-NC-4.0` cover? | reuse of X_ITE assets | hand look at the X_ITE repository | |
| TBD-19 | Would the X_ITE maintainer accept a render-backend seam behind `Context.js` and `PointingBuffer`? | path D | ask him | |
| TBD-20 | Did the X_ITE maintainer ever answer on WebGPU on x3d-public (2023-07, 2026-01, 2026-04 threads)? | STATE.md | hand fetch: web3d.org pipermail | |
| TBD-21 | Is there an unpushed or differently named WebGPU branch of X_ITE? | STATE.md | hand fetch: github.com branches page | |
| TBD-22 | What changed in X_ITE 16.6.0, 16.6.1 and 16.7.0 (release notes stop at 16.5)? | truth pin | tarball diff | |
| TBD-23 | The X3D 4.1 stage (CD or DIS) and the ISO stage of 19776-5 (JSON) | R-PARSE-03 | hand fetch: web3d.org/x3d/progress | |
| TBD-24 | Who published the `x3d`, `vrml` and `vrml97` crates, and is their wgpu port public? | path E | hand fetch: crates.io owner page | |
| TBD-25 | Real wasm size of a wgpu 30 triangle, WebGPU-only and WebGL2 | R-PERF-04, path E | a build, with approval to run third-party build scripts | |
| TBD-26 | Share of the audience on compatibility-mode-only devices (GLES 3.1, D3D11) | R-RENDER-21 | analytics or survey data | |
| TBD-27 | Chrome 156 stable date and the two-week cadence (S only) | receipts | hand fetch: Chrome release blog | |
| TBD-28 | QuickJS sandbox speed on the project's Script-heavy pages | R-SEC-01 | measurement | |
| TBD-29 | Babylon `ShadersWGSL` count: BABYLON.md counts 523 files, a re-count finds 335 `.js` modules (1,005 files with `.d.ts` and `.map`) | STATE.md | one stated counting method | |
| TBD-30 | KTX2 transcode targets per adapter, compute mip generation, and texture-format rows per node | R-RENDER-10, R-RENDER-19 | mapping table | |
| TBD-31 | Alpha-to-coverage, and OIT combined with MSAA | R-RENDER-12, R-RENDER-17 | design note | |
| TBD-32 | Why X_ITE submits about twice the triangle-list size per frame on the hero scene (123,822 vertices): two passes for `solid=false` transparent shapes? | BENCHMARK fairness | source read | |
