# State of play: X_ITE, the X3D field, comparables and WebGPU

Date 2026-11-06. Status: research record for the spec scaffold, docs only. Every row was checked once by an adversarial pass; refuted claims are corrected here and the corrections are marked.

Grades: **C** is measured here with the named instrument, **L** is read or reasoned from sources, **S** is suspected. Instruments: `curl` on registry.npmjs.org and raw.githubusercontent.com, `grep`, `wc`, `gzip -9` and `python3 -I` on unpacked npm tarballs (never executed), ElementTree on X3DUOM from the Web3D SVN mirror, and Playwright 1.63.0 with headless Chromium 153.0.8010.12 for the sandbox probe.

**The answer.** There is no sign WebGPU is coming to X_ITE. Version 16.7.0 (npm, 2026-10-31T10:14Z) makes one `getContext("webgl2")` call with no fallback, and "webgpu" appears 0 times in its bundle, its main and development source, the GitHub index of its issues, PRs, commits and code, and its release notes (C, 2026-11-06). No other X3D runtime ships a WebGPU renderer either (C for X3DOM 1.8.3 and Castle's roadmap). WebGPU itself is on by default in all three browser engines (C, gpuweb wiki), and the cloud sandbox can test it for correctness only, through a SwiftShader CPU adapter (C).

## 1. X_ITE today

### 1.1 Scorecard (16.7.0)

| capability | status | evidence | grade |
|---|---|---|---|
| WebGPU backend | absent | 0 `webgpu`, `navigator.gpu`, `GPUDevice`, `wgsl` in the whole dist; 39 lines match `webgl2` | C |
| WebGL 1 fallback | absent since 11.6 (npm 11.6.0, 2025-07-13) | what's-new.md line 225; `Context.js` throws "Couldn't create WebGL context." | C |
| X3D node names | 4.0: 259 of 259 runtime nodes; 4.1: 266 of 266 (ProtoInstance is syntax, not a node) | registration scan of 16.7.0 | C (corrected) |
| silent stubs | 13 (6 DIS, MotorJoint, UniversalJoint, 3 shader containers, 2 Stream audio) | field-guide runs on 16.4.3 and 16.5.0 only | L |
| components registered | **39**, including GaussianSplats, WebXR and X_ITE; Annotation ships as a file but is commented out in SupportedComponents and in Full | `SupportedComponents.add` calls | C (corrected from 40) |
| X_ITE extension nodes | `dist/X3DUOM.xml`: 12 `*MaterialExtension` + BlendMode, DepthMode, InstancedShape, SpecularGlossinessMaterial + ImageTextureAtlas = 17 new; the code registers 13 extensions (adds RetroreflectionMaterialExtension), so its own UOM lags its code by one | python ElementTree; X_ITEComponent.js | C (corrected from 15) |
| MSAA | `renderbufferStorageMultisample` + `blitFramebuffer`; Multisampling 4, Antialiased true | BrowserOptions lines 20180, 20203 | C |
| transparency | weighted-blended OIT, RGBA16F accum/revealage, off by default | line 20206 | C |
| passes | shadow maps, transmission (mipmapped), volume scatter, main MSAA, OIT compose | RenderPass.js | C |
| tone mapping, colour | NONE (default), 3 ACES variants, KHR_PBR_NEUTRAL; ColorSpace LINEAR_WHEN_PHYSICAL_MATERIAL; DISPLAY_P3; log depth | line 20211, 20191 | C |
| tone map on ComposedShader | not applied (max difference 2/255) | Collider feasibility, 16.5.1 | C |
| GPU picking | `PointingBuffer`: three 1x1 RGBA32F MRT attachments, synchronous `readPixels`; 10 `readPixels` and 6 `getBufferSubData` sites in the dist | lines 64791 to 64865 | C |
| collision | `TextureBuffer.readDepth`, synchronous | source | C |
| compute stand-in | transform feedback for particles (7 interleaved outputs), wide lines, ComposedShader TF | ParticleSystemsComponent.js | C |
| splats | CPU counting sort, 2,093-byte WASM in a Worker (from GaussianSplats3D); instanced draw | `dist/assets/lib` | C |
| splat defaults | GaussianSplats node: `pointerEvents` and `castShadow` FALSE (4.1 says TRUE); GaussianSplatsShape: TRUE | GaussianSplatsComponent.js 1003-1004, 897-898 | C |
| splat loading | `loadURL` can hang when a node is culled before its first sort | 16.5.0 run | S for 16.7.0 |
| WebXR | `XRWebGLLayer`, `makeXRCompatible`; no multiview; default IMMERSIVE_VR | WebXRComponent.js | C |
| DepthMode | `polygonOffset`, `depthRange`, `depthTest`, `depthFunction`, `depthMask`; `readOnly` does not exist and is dropped silently | X_ITEComponent.js 690-694 | C |
| render loop | on demand; MaximumFrameRate 80 | line 20200 | C |
| idle after | about 4 frames (empty scene), about 64 (drawing scene) | 16.5.0 measurement only | L (corrected from C) |
| GPU timing | no timer queries (0 `createQuery`, 0 `EXT_disjoint_timer_query`) | grep | C |
| CSP | needs `unsafe-eval` and `wasm-unsafe-eval`: **9** `new Function` sites (4 core, 5 components) and 3 WASM modules (libktx 2,528,007 B, mikktspace 44,694 B, sorter 2,093 B) | strict regex; CSP need seen on 16.4.3 | L (count corrected from 10) |
| size | `x_ite.min.js` 1,306,961 B raw, 282,227 B gzip default, 280,795 B gzip -9; components folder 9.5 MB | `wc`, `gzip` | C |
| docs vs code | browser-services.md says Antialiased false and ToneMapping KHR_PBR_NEUTRAL; code says true and NONE | lines 257, 287 vs code | C |
| real-GPU speed | median 59.7 fps, 1% lows 58.8 and 58.0, 2 of 4,363 frames over 33 ms, on a Loomsong world, X_ITE 16.5.1 pin, Windows, Chrome 156, Intel UHD 620, 1105x576 | x3d.music `docs/FACTS.md` (3 Nov 2026) | C for that machine; vsync-capped, so no headroom figure |

### 1.2 Release cadence (C, npm `.time`, fetched 2026-11-06)

| year | releases | median gap | Sundays |
|---|---|---|---|
| 2023 | 100 | n/a | n/a |
| 2024 | 57 | 6.79 d | 38 |
| 2025 | 65 | 6.65 d | 47 |
| 2026 to 6 Nov | 58 | 6.27 d | 36 |

305 versions since 2017-08-29; 69 in the last 365 days; sole npm maintainer create3000 (C). Majors 1 to 3, 7 and 13 were never published to npm (C). Recent: 16.4.2 (10-04), 16.4.3 (10-05), 16.5.0 (10-11), 16.5.1 (10-13), 16.6.0 (10-21), 16.6.1 (10-27), 16.7.0 (10-31) (C). The reading, a one-person weekly rhythm, is L.

| major | first on npm | note (what's-new.md) |
|---|---|---|
| 11 | 2024-12-12 | 11.6.0 (2025-07-13) drops WebGL 1 |
| 12 | 2025-08-08 | breaking change |
| 14 | 2026-01-25 | a lost WebGL context now fires CONNECTION_ERROR |
| 15 | 2026-05-03 | 15.1.0 (2026-05-31) adds Gaussian splats |
| 16 | 2026-07-27 | Vitest suite, jQuery removed; 16.3 retroreflection |

### 1.3 Where the WebGL lives (C, grep of the 16.7.0 dist; denominators corrected)

| measure | value |
|---|---|
| direct `gl.method(` call sites | **1,396**: 920 in `x_ite.js`, 476 in component bundles |
| modules with calls | 80: 43 of 475 core module headers and 37 of 275 component module headers (750 `;// ./src/` headers in all); the component calls sit in 9 of 23 `*Component.js` bundles. The earlier "of 619" was not reproduced and is dropped |
| distinct gl methods | 106 (97 in core) |
| `gl.CONSTANT` references | 1,181 (705 core, 476 components) |
| largest areas | Components/Rendering 171, Shaders 169, ParticleSystems 136, MultiSampleFramebuffer 133, Browser/Rendering 83, GaussianSplats 76 |
| modules with the most calls | X3DProgrammableShaderObject 156, MultiSampleFramebuffer 133, X3DLineGeometryNode 106; lights call GL themselves (SpotLight 20, PointLight 17, DirectionalLight 15) |
| shaders | GLSL ES 3.00 from JS templates: 46 shader source modules, 21 `#version 300 es` headers (13 core), 146 `X3D_*` macros, 112 `options.push` variant sites |
| built-in identifiers | 245 distinct `x3d_*` in `x_ite.js`, 263 with the component bundles |
| public API | `x_ite.d.ts`: 24,153 lines, 80 classes, 366 interfaces, 283 concrete node types; WebGL mentioned once (`loseContext`); shader `language` typed `"Cg" \| "GLSL" \| "HLSL"` |

### 1.4 Roadmap evidence

| source | finding | grade |
|---|---|---|
| bundle grep | 0 webgpu; 1 `getContext("webgl2")` | C |
| GitHub search, create3000/x_ite | webgpu: 0 issues, 0 PRs, 0 commits, 0 code. Controls: 203 issues in all, `webgl is:issue` 10 | C |
| branches | `development` serves 16.7.0 and is webgl2-only; `webgpu/package.json` 404; other branch names not ruled out (the branches page is blocked) | L |
| what's-new.md (1,535 lines, newest section 16.5), features.md, README | WebGL only; README "uses WebGL for 3D rendering"; 2026 work: glTF materials, splats, imported nodes, sound, tests | C |
| site tagline | "Ready for X3Dv4.1 and WebXR!" | C |
| x3d-public 2023-07 "GPU APIs and X3D"; 2026-01; 2026-04 | exploratory; no X_ITE commitment found; one member guessed X_ITE hesitates over shader interfaces | S (TBD-20) |
| forecast | no WebGPU backend in the next 12 months | L |

## 2. The X3D runtime field

| runtime | maintainer | graphics API | last release (date) | X3D level | WebGPU plan | grade |
|---|---|---|---|---|---|---|
| X_ITE | create3000 (Holger Seelig) | WebGL2 | 16.7.0 (2026-10-31) | 4.0 + all 7 4.1 nodes + own X_ITE component | none in code | C |
| Sunrize (editor) | create3000 | via X_ITE, Electron ^45.2.1 | 2.6.6 (2026-10-31), 315 versions | as X_ITE | none | C |
| x3d-tidy, x3d-image, x_ite-node | create3000 | none, Electron, nogl + skia-canvas | 3.2.2, 3.2.2, 2.3.2 (all 2026-10-31) | as X_ITE | n/a | C |
| Titania | create3000 | OpenGL | discontinued ("use Sunrize") | 3.3-era | n/a | C |
| X3DOM | x3dom org | tries webgl2, webgl, experimental-webgl, moz-webgl, webkit-3d | npm 1.8.3 (2023-08-01); master 1.8.4-dev adds 3D Tiles 1.1, FontLibrary | 3.3 + parts of 4.0 | none (0 webgpu) | C |
| Castle Game Engine | Michalis Kamburelis | OpenGL/GLES; web is WebGL 1.0 + optional 2.0 (WASM) | 7.0-alpha.3 (Aug 2024, S); master continuous | broad 4.0 | "Vulkan renderer (maybe; alternative: use BGFX)"; 0 webgpu | C |
| FreeWRL | SourceForge team | OpenGL/GLES (L) | `freeWRL_desktop_x64_670.msi` (2024-04-20) | most of 4.0 (S) | none known | C/S |
| Instant Reality | Fraunhofer IGD | OpenGL (L) | 2.5.1 (2015-06-18) | 3.x | none | S |
| X3D-Edit | Don Brutzman (NPS) | none | SVN directory last change 2025-06-29 | 4.0/4.1 via X3DUOM | n/a | C |
| x3d.py | Brutzman, Peitso | none | 4.0.65.8 (2026-11-01), 91 releases | built from X3DUOM 4.1 | n/a | C |
| three.js VRMLLoader | three.js | three's renderers | 0.187.0 (2026-10-30) | VRML97 only; no X3DLoader (404) | indirect | C |
| three-x3d-loader | J. Kello | three | 0.4.0 (2017-07-25) | subset | abandoned | C |
| Babylon.js | none | none | no X3D loader on npm | none | none | L |
| ES3D (`@es3d/es3d`) | bitilia | WebGPU + WebGL2 fallback | 1.1.2 (2026-11-05), first 2026-10-15, Apache-2.0 | not X3D; README lists X3D as an import and an export format | native | C (corrected from S; behaviour untested) |

### 2.1 Spec status

| item | status | grade |
|---|---|---|
| X3D 4.0 | ISO/IEC 19775-1:2023 (about 2023-12-19) | L |
| X3D 4.1 | draft; x3d.py links `ISO-IEC19775-1v4.1-CD`; SVN head **r40447 as of 2026-11-06 22:16** (r40446 "X3D 4.1" at 15:34) | C link and revision, L stage |
| JSON encoding 19776-5 | still WD1 | L |
| X3DUOM counts | 4.0: 260 concrete (259 runtime), 72 abstract, 36 components, 4,197 field declarations; 4.1: 267 (266), 73, 37 | C |
| 4.1 additions | EnvironmentLight (Lighting 1), FontLibrary (Text 2), GaussianSplats (GaussianSplats 1), HAnimPose (HAnim 2), InlineGeometry (Networking 4), RenderedTexture (Texturing 4), Tangent (Rendering 5), plus X3DTangentNode; none removed; 13 nodes gain fields | C |
| shader enums, 4.0 and 4.1 | Cg, GLSL, HLSL; VERTEX, FRAGMENT. No WGSL, no COMPUTE; 0 "WebGPU", "WebGL" or "gamma" strings | C |
| glTF alignment | 0 glTF mentions in 4.0, 5 in 4.1 (GaussianSplats `colorSpace` cites KHR_gaussian_splatting; EnvironmentLight `diffuseCoefficients` matches glTF irradiance) | C |
| BlendMode, DepthMode | not standard X3D; X_ITE's own component | C |
| glTF registry | KHR_interactivity ratified ("Complete, Ratified by the Khronos Group", 135 operations); KHR_gaussian_splatting ratified; physics, collision shapes, float64 accessors in Review Draft; audio graph a Proposal; texture video an Initial Draft | C |
| WebGPU on x3d-public | threads 2019-05, 2023-07, 2026-04; no working-group decision | S |

## 3. Comparables

### 3.1 Versions and WebGPU posture (2026-11-06)

| engine | latest (date) | WebGPU on the web | fallback | licence | grade |
|---|---|---|---|---|---|
| three.js | 0.187.0 (10-30) | WebGPURenderer, opt-in via `three/webgpu`; TSL emits WGSL and GLSL | automatic WebGLBackend; `forceWebGL` | MIT | C |
| Babylon.js | @babylonjs/core 9.35.0 (11-06T19:55Z) | WebGPUEngine; GLSL through glslang + twgsl (Tint in WASM) | app picks Engine via `IsSupportedAsync` | Apache-2.0 | C |
| PlayCanvas | 2.23.3 (10-15) | opt-in `deviceTypes:['webgpu']` | webgl2 always appended | MIT | C |
| Filament | release notes v1.80.1; npm web 1.53.4 (2024-08-09) | native-only WebGPU; web is WebGL 2.0 | n/a | Apache-2.0 | C |
| Bevy | **0.20.1 (2026-10-28) on wgpu 30, MSRV 1.97.1** | `webgpu` cargo feature | separate `webgl2` build (features exclusive) | MIT/Apache | C (corrected: was 0.19.1 on wgpu 29) |
| wgpu | v30.0.1 (CHANGELOG 2026-08-21; crate 2026-08-22T02:53Z) | default `webgpu` feature | opt-in `webgl` | MIT/Apache | C |
| Godot | 4.8 beta on master | none: web builds GLES3/WebGL2 only | n/a | MIT | C |
| Unity | 6.6 (about 2026-09-01) | non-experimental, not default | WebGL2 default | proprietary | S |
| Unreal | 5.x | third parties only | n/a | proprietary | S |
| Needle Engine | 6.0.0-alpha.7 (10-12) / stable 5.1.16 (10-14) | behind `ExperimentalWebGPU` | WebGL | not open source | C |
| model-viewer | 4.4.0 (10-09); three ^0.183.0 as a **peer** dependency | none | n/a | Apache-2.0 | C |
| Spark (splats) | 2.4.0 (10-20) | none: ShaderMaterial-based | n/a | MIT | L |

Cadence, stable npm releases in 12 months (C): Babylon 141 (majors each late March: 2024-03-28, 2025-03-27, 2026-03-26), X_ITE 69, PlayCanvas 56, three 12. wgpu majors: v27 2025-10-01, v28 2025-12-17, v29 2026-03-18, v30 2026-07-01 (C; the CHANGELOG's "v28.0.1 (2025-03-01)" is probably a typo for 2026).

### 3.2 Measured internals (npm tarballs, 2026-11-06)

| item | value | grade |
|---|---|---|
| three r187 WebGPU stack | renderers/webgpu 40 files, common 69, webgl-fallback 12, nodes 221: 362 files, 2.50 MB, 97,210 lines | C |
| three r187 WebGPU material map | 13 classic materials; no ShaderMaterial or RawShaderMaterial, so hand-written GLSL does not run under WebGPURenderer | C |
| three r187 splats | native `GaussianSplat` (TSL + compute CountingSort), new in r186 | C |
| three core + webgpu build | 2,825,693 B raw; **about 553 KB gzip -9** (552,607 to 554,411 B by gzip build); WebGL path about 418 KB | C (range from two measurements) |
| Babylon Engines/WebGPU | 81 `.js`, including `webgpuShaderProcessorsGLSL.js` and `webgpuTintWASM.js` | C |
| Babylon ShadersWGSL / Shaders | **335** `.js` WGSL modules (1,005 files with `.d.ts` and `.map`) / 347 GLSL. BABYLON.md counts 523 files by another method (TBD-29) | C |
| Babylon FrameGraph / NodeMaterial / FlowGraph / Compute | 187 / 271 / 219 / 8 modules | C |
| Babylon GaussianSplatting | 18 modules; GPU sorter with 14 ComputeShader references | C |
| Babylon KHR_interactivity | registered in `@babylonjs/loaders` 9.35.0 (`glTF/2.0/Extensions/KHR_interactivity.js`) | C (upgraded from L) |
| Babylon glslang and twgsl location | `Tools.GetBabylonScriptURL`: Babylon's CDN unless reconfigured | C |
| babylon.js UMD (everything) | 8,876,104 B raw, 1,918,028 B gzip -9 (tree-shaken ES imports: not measured) | C |
| playcanvas.min.mjs | 2,550,945 B raw, 654,805 B gzip -9; 28 WebGPU modules, 290 WGSL lib modules, 33 gsplat-unified modules | C |

### 3.3 Scorecard (0 to 5 per criterion; judgement S, inputs C)

| target | WebGPU | scene graph | PBR/glTF | compute | splats | events | size | licence | X3D fit | total /45 |
|---|---|---|---|---|---|---|---|---|---|---|
| Babylon.js 9.35.0 | 5 | 5 | 5 | 5 | 5 | 4 | 2 | 5 | 5 | 41 |
| three.js r187 | 4 | 4 | 5 | 4 | 3 | 2 | 4 | 5 | 4 | 35 |
| PlayCanvas 2.23.3 | 3 | 4 | 4 | 3 | 5 | 3 | 3 | 5 | 3 | 33 |
| X_ITE 16.7.0 (baseline) | 0 | 5 | 4 | 0 | 3 | 5 | 4 | 4 | 5 | 30 |
| Bevy 0.20.1 | 4 | 4 | 4 | 4 | 1 | 3 | 2 | 5 | 2 | 29 |
| wgpu 30.0.1 (API only) | 5 | 0 | 0 | 5 | 0 | 0 | 3 | 5 | 3 | 21 |
| Godot 4.8 beta (web) | 0 | 5 | 3 | 0 | 1 | 4 | 1 | 5 | 2 | 21 |

The weights are a judgement and nothing has been run, so "Babylon is the best target" is **S** (regraded from L). What stands at **L**: Babylon is the only surveyed engine with a GLSL-to-WGSL path, so it alone can keep X3D ComposedShader content on WebGPU (files present, not executed; gate G2 tests it).

## 4. WebGPU platform matrix

### 4.1 Browsers (C, gpuweb Implementation-Status wiki, fetched 2026-11-06, unless marked)

| browser | version | OS / GPU | on by default? |
|---|---|---|---|
| Chrome, Edge | 113 (May 2023) | Windows x86/x64 (D3D12), macOS (Metal), ChromeOS (Vulkan) | yes |
| Chrome Android | 121 | Android 12+, ARM, Qualcomm, Intel | yes |
| Chrome Android | 139 | Imagination, Android 16+ | yes |
| Chrome Android | TBD | Samsung Xclipse, others | no |
| Chrome, compatibility mode | 146 (25 Feb 2026) | OpenGL ES 3.1, opt-in `featureLevel` | opt-in (L) |
| Chrome Linux | 144 | Intel Gen12+ | yes |
| Chrome Linux | 147 | NVIDIA 535.183.01+, Wayland | yes |
| Chrome Linux | flag | AMD, older Intel, X11 NVIDIA | no |
| Chrome, Edge | flag | Windows ARM64 | no |
| Firefox | 141 (22 Jul 2025) | Windows | yes |
| Firefox | 145 (11 Nov 2025) / 147 (13 Jan 2026) | Apple Silicon, macOS 26+ / all macOS | yes |
| Firefox | Nightly only | Intel Mac, Linux (stable is 159, 27 Oct 2026, L) | no |
| Firefox | flag | Android | no |
| Safari | 26 (Sep 2025) | macOS, iOS, iPadOS, visionOS 26 | yes |
| Safari | 27.0 (Sep 2026) | adds WGSL `clip_distances` | yes on 26+ (L/S) |

W3C status: WebGPU Candidate Recommendation Draft 15 Sep 2026, WGSL 21 Sep 2026 (L, Wikipedia). Chromium is built on Dawn, Firefox on wgpu (C).

### 4.2 The owner's machine (Windows, Chrome 156, Intel UHD 620, D3D12)

| question | finding | grade |
|---|---|---|
| does Chromium's default blocklist block it? | no: on Windows the Intel, AMD and Microsoft cases fall through with no reason; the default pattern list holds only Qualcomm and `*:*:PowerVR*25.1*`; CPU adapters and D3D11 are blocked separately; Finch or the command line can override | C (corrects an earlier "matches Intel by driver" claim) |
| is the UHD 620 Gen9 to Dawn? | yes: Dawn's `gpu_info.json` Gen 9 masks (0x5900, 0x3E00, 0x8700, 0x9B00) cover every UHD 620 SKU | C |
| what it loses | `subgroups` is off on Gen9 and Gen9.5 unless the `enable_subgroups_intel_gen9` toggle is set (crbug 391680973); `shader-f16` needs SM 6.2 and native 16-bit ops (driver-dependent) | C for the code, S for this driver |
| WebGPU on by default there? | probably | L until a probe runs on the machine (TBD-14) |
| version skew | Chrome 156 reached stable about 2026-10-20 (S); the sandbox is Chromium 153, three releases behind | S |

### 4.3 Features and limits that matter

| feature or limit | spec | sandbox SwiftShader (Chromium 153) | D3D12 / Dawn | X3D use |
|---|---|---|---|---|
| timestamp-query | optional | yes | yes if the queue supports it | benchmark timing |
| shader-f16 | optional | no | driver-dependent | half-precision splats |
| subgroups | optional | yes (size 4) | off on Gen9 | splat sort prefix sums |
| clip-distances | optional, at most 8 | yes | yes | ClipPlane |
| dual-source-blending | optional | no | yes | blending |
| primitive-index | optional | no | yes | id-buffer picking, wireframe |
| float32-filterable / -blendable | optional | yes | yes | HDR, VolumeRendering, WBOIT |
| texture-compression-bc / -etc2 / -astc | optional | yes / yes / yes | yes / no / no (L) | KTX2 targets |
| multi-draw-indirect | not in the enum (experimental flag) | absent | Dawn-native only | do not depend on it |
| bindless | proposal at Draft | experimental only | n/a | do not design on it |
| maxBindGroups | 4 | 4 | | layout of `x3d_*` built-ins |
| maxStorageBuffersInVertexStage | 8 core, **0 compat** | 10 | | vertex pulling |
| maxTextureDimension2D | 8192 core, 4096 compat | 8192 | | texture caps |
| maxBufferSize / maxStorageBufferBindingSize | 256 MiB / 128 MiB | 1 GiB / 1 GiB | | splat and track buffers |
| maxColorAttachments | 8 core, 4 compat | 8 | | WBOIT, id buffer MRT |
| maxImmediateSize | 64 | 64 | | per-draw data |

Spec facts (C, gpuweb `spec/index.bs` main): 25 GPUFeatureName entries; 5 topologies, no triangle fan; points and lines are 1 px with no `lineWidth`; no `polygonMode`, `logicOp`, `borderColor` or `generateMipmap`; blend factors include `constant` and `src1` but no constant-alpha; address modes clamp-to-edge, repeat, mirror-repeat; MSAA 1 or 4; depthBias must be 0 on point and line pipelines; canvas formats bgra8unorm, rgba8unorm, rgba16float (sRGB through `viewFormats`), alpha opaque or premultiplied. Proposals: bindless Draft, texel-buffers Draft, pipeline-statistics-query Inactive; subgroups, primitive-index and immediate-data Merged.

## 5. Sandbox probe (C, Playwright 1.63.0, Chromium 153.0.8010.12 headless, Linux x86_64, no GPU; re-measured by the adversarial pass)

| launch flags | adapter | compute | offscreen triangle | canvas present |
|---|---|---|---|---|
| none | `navigator.gpu` present on file://, `requestAdapter()` null ("No available adapters"; CPU adapters are blocklisted) | n/a | n/a | n/a |
| `--enable-unsafe-webgpu` | vendor google, architecture swiftshader, `isFallbackAdapter` true, empty device and description, 21 features, timestamp-query, no multi-draw | correct | 1,352 red / 2,744 blue pixels | device lost |
| `--enable-unsafe-webgpu --enable-features=Vulkan --use-vulkan=swiftshader --use-angle=swiftshader` | same | correct | same | correct in an element screenshot |

Details (C): dropping any of the last three flags breaks canvas presentation; `drawImage(webgpuCanvas)` into a 2D canvas always reads back transparent, so pixel checks use `copyTextureToBuffer` or screenshots; asking for `featureLevel: "compatibility"` returns the same core adapter; `wgslLanguageFeatures` includes `immediate_address_space` in every config; **on about:blank or data: pages `navigator.gpu` is absent in every config** (new in the re-probe). WebGL2 there reports `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`, line width range [1,1], point size range [1,1023], and exposes `EXT_disjoint_timer_query_webgl2`, `WEBGL_multi_draw`, `WEBGL_clip_cull_distance` and `WEBGL_polygon_mode`.

Use: correctness, parity and receipt dry runs. Never timings.
