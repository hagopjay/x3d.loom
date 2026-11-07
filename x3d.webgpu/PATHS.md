# Paths from X3D to WebGPU

Date 2026-11-06. Status: options scored, recommendation made, nothing built. Every person-week figure is **S** (no milestone has been built and timed), so compare options by ratio, not by absolute weeks.

Grades: **C** is measured here with the named instrument, **L** is read or reasoned from sources, **S** is suspected. Requirement ids refer to [SPEC.md](SPEC.md); evidence is in [STATE.md](STATE.md).

**The answer.** Take **F, the hybrid**, on the **G** body: X_ITE stays the truth renderer and the validator's target, and a renderer-agnostic X3D runtime with a Babylon WebGPU body ([BABYLON.md](BABYLON.md)) renders showpieces, each one gated by pixel parity and event-trace equality against X_ITE. F scores 30 of 35 against 19 to 25 for every other option (L judgement, S efforts). Babylon is the default body only because it is the one surveyed engine with a GLSL-to-WGSL path (L, files present, not executed); gate G2 (a Collider ComposedShader compiled through it) must pass first, and three.js (C) is the lean fallback. D is blocked by coupling: X_ITE 16.7.0 has 1,396 direct `gl.*` call sites with no rendering layer between them (C). WebGL2 is not today's bottleneck for the project's music worlds: 59.7 fps median on the owner's UHD 620, vsync-capped (C for that machine, L as a conclusion and only for Loomsong).

## 1. The options

| id | option | what it is | where it is specified |
|---|---|---|---|
| A | Adopt | stay on X_ITE WebGL2; do nothing for WebGPU | STATE.md |
| B | Bridge | convert X3D to glTF and render it in a WebGPU glTF engine | this file |
| C | Runtime on three.js | the renderer-agnostic runtime with three.js r187 WebGPURenderer as the body | this file, BABYLON.md section 9 for the runtime |
| D | Upstream | a WebGPU backend inside X_ITE | STATE.md 1.3, section 6 below |
| E | Rust/wgpu | an own X3D browser in Rust on wgpu 30, wasm and native | [ARCHITECTURE.md](ARCHITECTURE.md) |
| F | Hybrid | X_ITE stays truth; showpieces go through the runtime on a WebGPU body (G by default, C as fallback), each gated by parity | this file |
| G | Runtime on Babylon | a renderer-agnostic TypeScript X3D runtime plus a thin Babylon SceneLoader plugin; 17.5 to 32 pw for the project's scenes, 25.5 to 52 with the long tail | [BABYLON.md](BABYLON.md) |
| (rejected) | WebGL2-on-WebGPU shim | run X_ITE's WebGL2 calls over WebGPU | keeps X_ITE's draw model and adds a translation step, so it gains nothing; no mature polyfill was found (S) |

## 2. Scorecard

Each criterion runs 1 to 5, where 5 is best (cheapest, fastest, safest). Scores are judgements (L); efforts are S.

| criterion | A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|---|
| effort to the project's scenes (pw) | 0 → 5 | 4-8 → 4 | 17.5-32 → 2 | 22-38 + review → 2 | 30-50 → 1 | 8.5-15 to the first showpiece → 3 | 17.5-32 → 2 |
| effort to about X_ITE's coverage (pw) | 0 | never (ceiling) | 25.5-52 | 30-50 | 60-100 | as G, grown over time | 25.5-52 |
| time to first WebGPU pixel | never → 1 | 1-3 days → 5 | 1-2 weeks → 3 | 4-8 weeks → 2 | 2-4 weeks → 2 | 1-2 weeks → 4 | 1-2 weeks → 3 |
| fidelity against X_ITE | 5 | 2 | 3 (GLSL shaders need a rewrite) | 5 | 3 | 5 (measured per showpiece) | 4 |
| semantic coverage | 5 | 2 | 4 | 5 | 3 | 5 | 4 |
| risk (5 = low) | 3 (stagnation) | 3 | 3 | 1 (one maintainer, weekly churn) | 1 | 4 | 3 |
| tether fit | 5 | 2 | 4 | 5 | 4 | 5 | 5 |
| WebGPU upside (compute, CPU cost) | 1 | 4 | 4 | 4 | 5 | 4 | 4 |
| **total /35** | 25 | 22 | 23 | 24 | 19 | **30** | 25 |

F's first showpiece (the Collider) needs these milestones of the G track: M0 parser and codegen 1.5-3, a static subset 2-3, ROUTE and time 2-4, shaders 2-4, the parity harness 1; 8.5 to 15 pw in all (S). By ratio, E costs about twice G for the same scenes, and D costs about the same as G but lands in someone else's repository.

On the tether question (can the validator still check what is shown?), only B fails outright: the validator checks the X3D source, but the viewer sees a derived glTF. C fails partly: on three.js r187's WebGPU path a valid GLSL ComposedShader has no material mapping and vanishes (C, StandardNodeLibrary.js), unless R-SHADER-04 reports it.

## 3. What each path keeps and loses

Key: Y kept, P partial, B baked (frozen at export), N lost. All L, reasoned from the component map and the glTF registry (C).

| feature | A | B | C | D | E (at MVP) | F | G |
|---|---|---|---|---|---|---|---|
| ROUTE and the cascade | Y | P (shim, or a KHR_interactivity subset) | Y | Y | Y | Y | Y |
| Script | Y | N (P with a page shim) | Y (sandbox) | Y | P (embedded JS) | Y | Y (sandbox) |
| PROTO, EXTERNPROTO | Y | B (expanded) | Y | Y | Y | Y | Y |
| sensors and picking | Y | P (TouchSensor by raycast) | Y (CPU BVH) | Y (async id buffer) | P | Y | Y (sync `scene.pick`) |
| interpolators | Y | Y (glTF animation, KHR_animation_pointer) | Y | Y | Y | Y | Y |
| H-Anim | Y | P (skin and keys; LOA meaning lost) | Y | Y | P | Y | Y |
| ParticleSystems | Y | N | P to Y (compute) | Y | P | Y | P to Y |
| NURBS | Y | B (tessellated) | Y | Y | P | Y | Y |
| Text, FontStyle | Y | B (mesh, no live strings) | Y (metrics differ) | Y | P | Y | Y |
| VolumeRendering | Y | N | P | Y | N | Y | P |
| GaussianSplats | Y | Y (KHR_gaussian_splatting) | Y (r186+ GaussianSplat) | Y | P | Y | Y (compute sorter) |
| RigidBodyPhysics | Y (Ammo) | N (KHR physics is a Review Draft) | P | Y | N | Y | P (Havok) |
| Sound, spatial audio | Y | N (KHR_audio_graph is a Proposal) | Y (Web Audio) | Y | P | Y | Y |
| Layering, Layout | Y | N | P | Y | N | Y | P |
| ComposedShader GLSL | Y | N (hand rewrite) | N on WebGPU (TSL rewrite or flag) | P (translate at run time) | P (pre-pass + naga) | Y truth / P showpiece | P (glslang + twgsl, untested: TBD-15) |
| X_ITE BlendMode, DepthMode | Y | N | P (CustomBlending ONE/ONE, `depthWrite:false`) | Y | P | Y | P (`alphaMode`, `disableDepthWrite`) |

## 4. Component map: X3D 4.0 (260 entries in 36 components) and 4.1 to WebGPU

Node counts per component are C (X3DUOM 4.0, SVN mirror, generated 2026-10-31). Strategy and difficulty (1 easy to 5 hard) are L. glTF carriers are C (glTF registry main, 2026-11-06). Key: RP render pipeline, CS compute shader, CPU on the CPU, WA Web Audio.

| component | nodes | WebGPU strategy | diff | glTF carrier | requirement |
|---|---|---|---|---|---|
| Core | 8 | CPU (metadata, ProtoInstance) | 1 (PROTO 3) | extras, KHR_xmp_json_ld; PROTO none | R-PARSE-08 |
| Grouping | 4 | CPU transforms into a storage or uniform buffer | 1 | nodes; Switch → KHR_node_visibility | R-SCENE-02 |
| Rendering (+ Tangent in 4.1, level 5) | 15 | RP; wide lines and big points as quads; ClipPlane by clip-distances or discard; strip restart | 3 | primitive modes; ClipPlane none | R-RENDER-04 to 09 |
| Shape | 10 | RP: Phong and PBR WGSL; Fill, Line and PointProperties | 3 | core PBR, KHR_materials_unlit; Phong lossy; TwoSided none | R-RENDER-03 |
| Geometry3D, Geometry2D | 7, 8 | CPU tessellation | 1 | baked mesh | R-RENDER-05 |
| Text (+ FontLibrary in 4.1) | 2 | CPU glyphs (X_ITE uses opentype) or MSDF | 3 | baked mesh | |
| Texturing (+ RenderedTexture in 4.1, level 4) | 10 | textures and samplers; MovieTexture through `importExternalTexture`; compute or blit mips; RenderedTexture as a render pass | 2 (MultiTexture 3) | KHR_texture_transform, KHR_texture_basisu; KHR_texture_video is an Initial Draft | R-RENDER-10, 11, 19 |
| Texturing3D | 7 | 3D textures | 2 | none | |
| CubeMapTexturing | 3 | cube textures; Generated = 6 passes | 2 | none | |
| Lighting (+ EnvironmentLight in 4.1) | 3 | lights in a storage buffer; shadow passes; IBL prefilter in CS | 2 | KHR_lights_punctual; EXT_lights_image_based | R-RENDER-18 |
| EnvironmentalEffects | 5 | background pass, fog in the shader | 2 | none | |
| Navigation | 7 | CPU camera, LOD, Billboard, Collision | 2 | cameras only | R-PICK-05 |
| Networking (+ InlineGeometry in 4.1) | 3 | CPU fetch, nested scenes | 1 | none | R-PARSE-10 |
| Time, Interpolation | 1, 13 | CPU (CS for coordinate morphs) | 1 | animation samplers, morph targets, KHR_animation_pointer | R-EVENT-04 |
| EventUtilities, Followers | 7, 14 | CPU | 1 | KHR_interactivity flow and variables, `pointer/interpolate` | R-EVENT-05 |
| PointingDeviceSensor | 4 | CPU ray cast; async id pass for coverage | 3 | TouchSensor → KHR_node_selectability; drag sensors none | R-PICK-01 to 04 |
| KeyDeviceSensor | 2 | DOM events | 1 | none | |
| EnvironmentalSensor | 3 | CPU; VisibilitySensor by frustum test or occlusion query | 2 | none | |
| Picking | 5 | CPU BVH or CS | 3 | none | |
| Scripting | 1 | JS sandbox and SAI | 3 | none, by design | R-SEC-01 |
| Shaders | 8 | RP; GLSL to WGSL; no WGSL or COMPUTE value in the spec | 5 | none | R-SHADER-01 to 10 |
| Layering, Layout | 3, 5 | per-layer passes; CPU layout | 2, 3 | none | |
| Sound | 21 | WA (not the GPU) | 2 | KHR_audio_graph (Proposal) | |
| HAnim (+ HAnimPose in 4.1) | 6 | vertex or CS skinning; Displacer → morph | 3 | skins and morphs | |
| NURBS | 13 | CPU or CS tessellation | 3 | baked | |
| Geospatial | 11 | CPU doubles, camera-relative rendering | 3 | KHR_accessor_float64 (Review Draft) | R-SCENE-08 |
| ParticleSystems | 10 | CS update, instanced billboards, GPU sort (X_ITE uses transform feedback) | 3 | none | |
| RigidBodyPhysics | 14 | CPU or WASM (X_ITE bundles Ammo, 2.19 MB) | 3 | KHR_physics_rigid_bodies, KHR_collision_shapes (Review Drafts) | |
| VolumeRendering | 13 | ray march in the fragment shader or CS over 3D textures | 4 | none | |
| CADGeometry | 6 | CPU | 1 | baked | |
| DIS | 6 | WebSocket on the CPU (X_ITE stubs all 6, L) | 2 | none | |
| TextureProjection | 2 | projective texturing in the material shader | 2 | none | |
| GaussianSplats (4.1) | 1 (X_ITE adds GaussianSplatsShape) | CS radix sort plus instanced quads | 3 | KHR_gaussian_splatting (ratified) | R-SPLAT-01 to 08 |
| X_ITE extensions (not standard) | 17 in code | PBR shader chunks; BlendMode and DepthMode → pipeline key; InstancedShape → instanced draws | 2 | the ratified KHR_materials_* set, EXT_mesh_gpu_instancing | R-RENDER-03 |

### 4.1 Field-level friction (X3D node.field against WebGPU)

WebGPU facts from gpuweb `spec/index.bs` and `wgsl/index.bs` on main, 2026-11-06 (C). Workarounds L. Two rows block a port outright: shaders and synchronous picking. Most of the rest already have fixes in X_ITE or Castle, because WebGL2 had dropped the matching GL features too.

| X3D node.field | GL-era assumption | WebGPU | workaround | severity |
|---|---|---|---|---|
| ComposedShader / ShaderPart `language`, `type` | GLSL; VERTEX, FRAGMENT | WGSL only; no enum value; no COMPUTE part | translate GLSL to WGSL; propose `WGSL` and `COMPUTE` | **blocker** |
| pointing sensors, SAI hit data | synchronous `readPixels` | async `mapAsync` | CPU BVH for same-frame events; id buffer a frame late | **high** |
| per-shape state (`solid`, `ccw`, `alphaMode`, BlendMode, DepthMode, topology) | dynamic GL state | baked into the pipeline | pipeline key and cache | high |
| shader uniforms by name | loose uniforms | bind groups (4), 16 sampled textures per stage | fixed `x3d_*` layout in groups 0 and 1 | high |
| LineProperties `linewidthScaleFactor` | nearest line width | 1 px lines | screen-space quads; X_ITE already expands wide lines in a transform-feedback shader (C); Chrome's GL range is already [1,1] (C, Collider study) | medium |
| PointProperties `pointSize*`, `attenuation` | `gl_PointSize` | 1 fragment per point | instanced billboards, attenuation in the vertex shader | medium |
| DepthMode `polygonOffset` (X_ITE) | `glPolygonOffset` | depthBias in the pipeline, must be 0 on points and lines | pipeline variants; z nudge in the vertex shader for lines | medium |
| ClipPlane `plane` | user clip planes | optional `clip-distances`, at most 8 | fragment discard fallback | medium |
| TextureProperties `generateMipMaps` | `glGenerateMipmap` | none | blit or compute mip chain | medium |
| colour space | UOM silent except GaussianSplats `colorSpace` | canvas bgra8unorm, rgba8unorm or rgba16float; sRGB through `viewFormats` | encode in the shader; ask the working group for a rule | medium |
| flat and integer attributes | last provoking vertex | first vertex (L); integer I/O must be flat (wgpu 30, C) | reorder or duplicate; test (TBD-09) | medium |
| LineProperties `linetype` (16 values) | stipple | none | texture pattern along `x3d_LengthSoFar` (X_ITE does this, C) | low |
| FillProperties `hatched`, `hatchStyle` (19) | polygon stipple | none | screen-space hatch textures (X_ITE ships PNGs, C) | none |
| wireframe (X_ITE `Shading` option; Castle `Shape.shading`) | `glPolygonMode` | none | edge index buffer (Castle precedent, C) | low |
| TriangleFanSet, IndexedTriangleFanSet | `GL_TRIANGLE_FAN` | no fan topology | triangulate at load | low |
| strip `-1` separators | restart index | strip restart always on | 0xFFFF or 0xFFFFFFFF | low |
| BlendMode `CONSTANT_ALPHA` (X_ITE) | `glBlendFuncSeparate` | `constant` only, no constant-alpha | blend constant set to (a,a,a,a) | low |
| TextureProperties `CLAMP_TO_BOUNDARY`, `borderColor` | GL border | no border mode | UV test in the shader | low |
| TextureProperties `anisotropicDegree` | EXT anisotropic | `maxAnisotropy` 1 to 16, linear filters only (L) | clamp | low |
| image origin | `UNPACK_FLIP_Y` | `flipY` on external-image copy | flip on upload | low |
| Viewpoint projection | NDC z in [−1,1] | z in [0,1] | new projection matrix, reverse-Z | low |
| X_ITE `Multisampling` | any count | 1 or 4 | clamp and report | low |
| two-sided lighting, flat shading, fog, MultiTexture | `gl_FrontFacing`, flat varyings, generated shaders | `front_facing`, `@interpolate(flat)`, shaders | direct | none |

### 4.2 KHR_interactivity against ROUTE

KHR_interactivity is ratified: the registry and `Specification.adoc` read "Complete, Ratified by the Khronos Group" (C, 2026-11-06). It defines 135 operations: 102 math, 11 flow, 6 event, 6 type, 3 pointer, 3 variable, 3 animation, 1 debug (C, grep). Babylon 9.35.0's glTF loader registers it (C); three.js r187's GLTFLoader does not (C). It is an export target for a subset, not a replacement for ROUTE (L).

| X3D | KHR_interactivity | gap |
|---|---|---|
| ROUTE (typed field-to-field dataflow) | execution flow plus `pointer/set` | no push dataflow, no timestamps, no one-event-per-field rule |
| TimeSensor | `event/onTick` plus math | cycle and loop logic by hand |
| interpolators | `animation/start` (with KHR_animation_pointer), `pointer/interpolate` | close |
| TouchSensor, `isOver` | `event/onSelect`, hoverability | drag sensors: none |
| ProximitySensor, VisibilitySensor, KeySensor | none | full gap |
| Script, `addRoute`, PROTO, bind stacks | none | full gap |

## 5. Porting ComposedShader GLSL to WGSL or TSL

The Collider puts one shared GLSL ES 3.00 program on each of up to about 8 particle species. Its shaders use the X_ITE built-ins `x3d_Vertex` (37 uses), `x3d_ProjectionMatrix` (25), `x3d_ModelViewMatrix` (25), `x3d_Color` (6), `x3d_Viewport` (5), `x3d_NormalMatrix` (4) and `x3d_Normal` (4), plus `gl_FragColor` (14), `gl_PointSize` (2) and `gl_PointCoord` (1) (C, grep of `kit/examples/hep`).

### 5.1 Routes

| route | status | grade |
|---|---|---|
| glslang (GLSL to SPIR-V) then twgsl (Tint in WASM, SPIR-V to WGSL) | Babylon's production path; WASM loaded from Babylon's CDN unless self-hosted (R-SHADER-08) | C files, L behaviour (TBD-15) |
| a rewrite pre-pass, then naga `glsl-in` | naga takes "GLSL 440+ and Vulkan semantics only": the pre-pass sets `#version 450`, wraps loose uniforms into blocks and adds `layout(location)` | C for naga's limit, L for the pre-pass |
| three.js TSL | hand rewrite, or `examples/jsm/transpiler` (GLSLDecoder to TSLEncoder), which says it "can only be used to convert GLSL into TSL right now"; `glslFn` runs on the WebGL backend only | C for the transpiler note, L for `glslFn`, S for coverage (TBD-17) |
| hand-written WGSL | kept as a second copy beside the GLSL truth (R-SHADER-09) | L |

### 5.2 What breaks

| issue | X_ITE GLSL | WebGPU / WGSL | fix | grade |
|---|---|---|---|---|
| loose uniforms | `uniform mat4 x3d_ModelViewMatrix` | bind-group uniform blocks | generate an X3D block and a Fields block from the ComposedShader's fields | L |
| attribute names | `x3d_Vertex`, FloatVertexAttribute `name` | `@location(n)` | a name-to-slot table | L |
| clip z | [−w, w] | [0, w] | remap, or a WebGPU projection (TSL supplies one) | L |
| `gl_FragCoord` | bottom-left origin | top-left | flip y | L |
| point size, line width | `gl_PointSize`, line width | 1 px only | instanced quads, ribbons | C |
| `mod` | floor-based | `%` truncates | helper function | L |
| reserved words | `active`, `meta`, `mod` legal | reserved (also `attribute`, `varying`, `precision`, `layout`, `highp`) | rename | C |
| `sin()` hashes | driver-specific | backend-specific | integer hash | L |
| spec enum | Cg, GLSL, HLSL; VERTEX, FRAGMENT | no WGSL, no COMPUTE | propose to Web3D (R-SHADER-05) | C |

### 5.3 Before and after (Collider track ribbon, abridged)

X_ITE GLSL (truth copy):
```glsl
#version 300 es
uniform mat4 x3d_ProjectionMatrix; uniform mat4 x3d_ModelViewMatrix; // X_ITE built-ins
uniform ivec4 x3d_Viewport; uniform float uWidth;                   // uWidth = ROUTE target
in vec4 x3d_Vertex; in vec4 x3d_Color; in vec4 aNext; in vec4 aMeta;
void main() { vec4 c0 = x3d_ProjectionMatrix * x3d_ModelViewMatrix * x3d_Vertex; /*...*/
  gl_Position = c0 + vec4(off / hv * c0.w, 0.0, 0.0); }
```

WGSL sketch (showpiece copy):
```wgsl
struct X3D { projection: mat4x4f, modelView: mat4x4f, viewport: vec4f };
struct Fields { width: f32, time: f32, grow: f32, exposure: f32 };   // ROUTE targets
@group(0) @binding(0) var<uniform> x3d: X3D;
@group(1) @binding(0) var<uniform> fld: Fields;
struct VIn { @location(0) vertex: vec4f, @location(1) color: vec4f,
             @location(2) next: vec4f, @location(3) info: vec4f };     // 'meta' is reserved
struct VOut { @builtin(position) pos: vec4f, @location(0) color: vec4f, @location(1) info: vec4f };
@vertex fn vs(i: VIn) -> VOut {
  let e0 = x3d.modelView * vec4f(i.vertex.xyz - i.info.x * vec3f(0.004, 0.0028, 0.0012), 1.0);
  let c0 = x3d.projection * e0;
  let c1 = x3d.projection * (x3d.modelView * vec4f(i.next.xyz, 1.0));
  let hv = x3d.viewport.zw * 0.5;
  var d = c1.xy / c1.w * hv - c0.xy / c0.w * hv;
  let l = length(d); d = select(vec2f(1.0, 0.0), d / l, l > 1e-5);
  var o: VOut;
  o.pos = c0 + vec4f(vec2f(-d.y, d.x) * i.info.x * fld.width / hv * c0.w, 0.0, 0.0);
  o.pos.z = 0.5 * (o.pos.z + o.pos.w);        // GL z to WebGPU z
  o.color = i.color; o.info = i.info; return o;
}
```

Porting the 9 programs of the pile-up scene by hand: 1 to 2 pw (S).

## 6. Option D in detail: what a WebGPU backend inside X_ITE needs

| work package | scale in 16.7.0 (C) | difficulty (L) | note |
|---|---|---|---|
| device and pipeline layer | 1,396 `gl.*` calls, 106 methods, 80 modules | high | global GL state becomes immutable pipelines; variant cache over 146 macros |
| built-in shaders to WGSL | 46 GLSL modules, 263 `x3d_*` built-ins | high | |
| user ComposedShader GLSL | spec enum Cg, GLSL, HLSL only | very high | translator in WASM, WebGL2 fallback, or a spec change |
| picking and collision readback | sync `readPixels` in PointingBuffer and TextureBuffer | medium | async readback shifts sensor timing |
| transform feedback to compute | particles, wide lines, ComposedShader TF | medium | a gain |
| splat sort to the GPU | 2,093-byte CPU WASM sort | medium | a gain |
| wireframe, mipmaps, texture compression | `WEBGL_polygon_mode`, `generateMipmap`, 6 compression families | medium | |
| WebXR | `XRWebGLLayer` | medium | depends on the WebXR/WebGPU binding (S) |

Estimate 22 to 38 pw plus review by a solo maintainer who ships weekly (S). The polite version is a seam, not a fork: a pluggable render-context interface behind `Browser/Core/Context.js` and the `PointingBuffer` readback, offered upstream with measured data (TBD-19).

## 7. Recommendation

| # | do | why | gate |
|---|---|---|---|
| 1 | Take F: keep X_ITE 16.x as the truth renderer and validator target; render showpieces through the runtime on a WebGPU body | 30/35; keeps every semantic and adds WebGPU only where measured (L) | G4, G5 |
| 2 | Default the body to Babylon (G), with self-hosted glslang and twgsl | the only surveyed GLSL-to-WGSL path (L); `KHR_interactivity` and a compute splat sorter ship (C) | G2: the Collider ComposedShader compiles through it at parity |
| 3 | Keep three.js r187 (C) as the lean fallback body | about 553 KB gzip -9 against 1.92 MB for Babylon's full UMD (C); automatic WebGL2 fallback | if G2 fails, ComposedShader goes to TSL by hand |
| 4 | Showpiece 1 is the Dirac collider | few node types (33), and a look that rests on shaders X_ITE's tone mapping does not touch (C) | BENCHMARK.md decision rule |
| 5 | Do not fork X_ITE; offer only the render-context seam upstream | coupling and churn (C) | TBD-19 |
| 6 | Use B only as an export (static subset plus the KHR_interactivity subset), validated with the Khronos glTF validator beside the X3D validator | B never carries the truth (L) | BABYLON.md M8 |
| 7 | Defer E (Rust/wgpu) until the runtime's intermediate representation exists | port the IR, not the spec, and get native and headless builds (L) | G6 |
| 8 | Write new GLSL in a WGSL-portable style now: no `active`, `meta` or `mod` identifiers, no `gl_PointSize`, no `gl_FragCoord` y assumption, per-object variation in attributes rather than programs | cheaper later ports (C for the reserved words) | R-TETHER-06 lint |
| 9 | Propose `WGSL` and `COMPUTE` to the Web3D X3D working group with an example scene | no X3D browser can move user shaders to WebGPU in a standard way without it (C for the enums) | TBD-11 |
