# Benchmark plan: X_ITE (WebGL2) against WebGPU bodies on the Dirac collider

Date 2026-11-06. Status: plan only. The scene, the counts and the sandbox check below were measured; no timing has been taken, and none may be taken on the owner's machine without his yes (gate G0).

Grades: **C** is measured here with the named instrument, **L** is read or reasoned from sources, **S** is suspected. Instruments: `sha256sum`; `python3 -I` with ElementTree over the rebuilt scenes; a WebGL2 prototype spy in headless Chrome for Testing 153.0.8010.12 (SwiftShader) driven by Playwright, at 1105x576, on a mirror of the public `hagopjay/dirac` page whose 66 files matched the manifest hashes.

**The answer.** The benchmark can be run with no paid services, but on the hero scene it would mostly measure fill rate, not the graphics API. The published dijet scene has 6 Shapes and about 20,300 triangles; with glow on, X_ITE 16.7.0 issues **17 draws and 123,822 vertices per frame** and shades a **1920x1080** glow target behind a **487x274** visible canvas at the owner's 1105x576 window, 15.5 times the visible pixels (C, sandbox spy, 2026-11-06). WebGPU cannot make the same fragment work cheaper (L). So the plan separates API from engine with a 2x2 of arms, adds a track ladder up to 100k that moves the bottleneck, and lets no timing count until a pixel-parity gate passes.

## 1. The scene, measured

| item | value | grade |
|---|---|---|
| hero source | `docs/scenes/dijet.xml` in `hagopjay/dirac`, 2,195,797 bytes, sha256 `59dfeb32e9efefebfcae2c8a716e7805e3858a06688cf74f47688345719ca400`; byte-identical to a fresh `build_event_scene.py --look v3 --bloom` build here and to `runs/hep-demo-v3-20261106/scenes.sha256` | C |
| drawn nodes | haze quad; shells (IndexedTriangleSet, 6,624 tris); muon stations (432); flash quad; `trkset_0` (TriangleStripSet, 456 strips, 9,394 vertices, 8,482 tris); `twrset_0` (2,399 needles, 4,798 tris); ParticleSystem (420 sparks max) | C |
| shaders | 5 DEF'd ComposedShaders (GLSL ES 3.00) and `bloomShader` over a RenderedTexture; X_ITE links 10 programs and compiles 20 shaders | C |
| per frame, glow on | 17 draws, 123,822 vertices or indices, identical over 6 sampled frames, on X_ITE 16.7.0 and the shipped 16.5.1 | C |
| why 123,822 | about twice the 61,000 triangle-list indices: probably two passes for `solid=false` additive shapes | L (TBD-32) |
| state | every Appearance additive (ONE/ONE), `depthMask` false, so draw order does not matter | C builder, L consequence |
| page clock | the page disables the X3D TimeSensor and writes `u_phase` into 5 shaders every rAF; 54 s wall-clock camera tour; `u_resolutionScale` = RT height / 900 | C, `docs/index.html` |
| quality tier | Adaptive starts at 1080 rows; after 12 s drops to 720 below 26 fps, back to 1080 above 56; fixed tiers 720 to 2160 | C |
| errors | 0 console, page or HTTP errors on both X_ITE versions | C |

## 2. Arms

| id | engine and version | backend | shader route | question |
|---|---|---|---|---|
| A `xite-webgl2` | X_ITE 16.7.0 (and the shipped 16.5.1) | WebGL2 | GLSL ES 3.00 as authored | the reference |
| B `three-webgpu` | three 0.187.0 WebGPURenderer | WebGPU | GLSL to TSL (three's transpiler) or hand WGSL via `wgslFn`, patches committed | headline against A |
| C `three-webgl2` | the same build, `forceWebGL: true` | WebGL2 | the same TSL as B | API effect (B vs C), engine effect (A vs C) |
| D `three-webgl-classic` | three 0.187.0 WebGLRenderer + RawShaderMaterial | WebGL2 | near-verbatim GLSL, renamed built-ins | did translation change the cost? |
| E `babylon-webgpu` | @babylonjs/core 9.35.0 WebGPUEngine | WebGPU | GLSL through glslang + twgsl, **self-hosted** | the path G body; required if F takes G |
| F `babylon-webgl2` | @babylonjs/core 9.35.0 Engine | WebGL2 | GLSL as authored | the 2x2 for Babylon: E vs F is the API, A vs F the engine |

Versions from registry.npmjs.org `.time` (C, 2026-11-06). Babylon fetches glslang and twgsl from its CDN by default (C, `Tools.GetBabylonScriptURL`); the bench serves them locally. An X_ITE WebGPU arm does not exist (C, 0 webgpu strings).

## 3. Scenes and the ladder

| id | tracks | track Shapes | strip vertices | XML (tracks) | status |
|---|---|---|---|---|---|
| hero | 456 | 1 | 9,394 | 0.85 MB | committed, witnessed (C) |
| pu7 | 2,738 | 5 | about 55k (L) | about 5 MB (L) | regenerate with Pythia 8.318, seed 31, and hash; Pythia is absent from the sandbox (C) |
| pu24 | 8,855 | 15 | about 180k (L) | about 17 MB (L) | same |
| L1k | 1,000 | 2 | 20.6k | 1.9 MB | new tiling script (L) |
| L10k | 10,000 | 17 | 206k | 18.7 MB | (L) |
| L10k-split | 10,000 | 10,000 | 206k | about 20 MB | draw-submission stress: if WebGPU wins anywhere, it is here (L) |
| L50k | 50,000 | 84 | 1.03M | 93 MB | the decision rung |
| L100k | 100,000 | 167 | 2.06M | 187 MB | load wall expected; DNF cap 300 s |

Ladder arithmetic from the hero's 20.6 strip vertices and 1.87 KB of XML per track, 64 bytes per vertex and TRK_CHUNK 600 (L). Tracks are tiled by a golden-angle rotation of the hero's tracks, so per-track statistics are identical across rungs; the detector, towers and glow stay fixed. X_ITE parses ribbon X3D at about 4.4 MB/s on the 4-vCPU sandbox (C there, Collider study), so the 100k rung means about 40 s or more of load (L). Load time is reported apart from steady state, and a DNF is a result.

## 4. The port: scripted, versioned, structure-preserving

A converter committed beside the bench reads the witnessed `.x3d` by hash and writes the engine's scene, buffers and shaders. Arms E and F use the path G runtime once its M5 exists; before that, the same converter targets Babylon `ShaderMaterial`.

| X3D | three.js | Babylon | fairness rule |
|---|---|---|---|
| Shape, TriangleStripSet | one Mesh per Shape, indexed triangle list | one Mesh per Shape | same chunking (600 tracks) |
| FloatVertexAttribute | BufferAttribute of the same name | `setVerticesData` | byte-equal buffers (hash) |
| ComposedShader GLSL | D: renamed built-ins; B and C: TSL or `wgslFn` | ShaderMaterial (GLSL) | per-shader hashes in the receipt |
| BlendMode ONE/ONE, DepthMode `depthMask` false | `CustomBlending` ONE/ONE, `depthWrite: false`, DoubleSide. Not AdditiveBlending, which is SRC_ALPHA,ONE unless premultiplied (C, three.webgpu.js) | `alphaMode` ALPHA_ONEONE, `disableDepthWrite` | |
| RenderedTexture + `bloomShader` | RGBA8 RenderTarget at the same size, full-screen quad with the same bloom math | RenderTargetTexture, same | BloomNode or Babylon's own bloom only in an "idiomatic" side arm, never in the decision |
| tone mapping | `NoToneMapping`, linear pass-through, output colour transform off (S) | image processing off | X_ITE writes raw values to ComposedShader output (C) |
| ParticleSystem | off in every arm | off | random, so no parity |
| page clock and tour | one shared driver writes `u_phase` and the camera | same | same poses |

## 5. Metrics

| metric | X_ITE | three.js, Babylon | note |
|---|---|---|---|
| frames | `finishEvents` callbacks | loop count | X_ITE finished 17 frames for 19 rAF calls in the sandbox (C, ratio only) |
| frame interval | rAF `performance.now()` deltas | same | p50, p95, p99; 1% low = 1000 / mean of the worst 1% |
| CPU per frame | `prepareEvents` to `finishEvents` | around `render()` | |
| GPU per frame | injected `TIME_ELAPSED_EXT` query (X_ITE has none of its own, C) | three `trackTimestamp` + `resolveTimestampsAsync`; Babylon GPU frame time | drop disjoint samples; Chrome rounds WebGPU timestamps to 100 µs without the developer-features flag (S) |
| draws, primitives | WebGL spy | spy, `info.render.drawCalls` | per frame, not cumulative (the LOOK-V2 `draws` counter is cumulative, C) |
| time to first non-blank frame | over 0.5% of pixels off the background | same | cold profile and warm profile |
| load, compile | `loadURL`, programs | `compileAsync`, pipelines | |
| memory | CDP JSHeapUsedSize; uploaded bytes via the spy | same | |
| parity | reference | SSIM, PSNR and the Loom image statistics on 3 views (end-on, three-quarter, side) at t = 6.5 s, frozen | gate before any timing |

## 6. Harness and protocol

| item | rule |
|---|---|
| driver | Playwright 1.65.0 (npm 2026-11-05, C) with `channel: 'chrome'`, or a self-running bench page (`?bench=1`) started from a launcher, so the owner only double-clicks |
| bench page mode | fixed quality tier, controls hidden, sparks off, frames from `finishEvents`, WebGL and WebGPU spies, timer queries, a JSON receipt saved to disk |
| browser flags | `--disable-gpu-vsync --disable-frame-rate-limit` (S that Chrome 156 honours them; a run pinned at 16.7 ms is Inconclusive), the WebGPU developer-features flag, a fresh `--user-data-dir` |
| page origin | file://, https or localhost; never about:blank or data: (C: `navigator.gpu` is absent there) |
| windows | 1105x576 and 1920x1080, device scale 1, fixed tiers 1080 and 720, MSAA 4 in every arm |
| runs | 10 s warm-up, then 3 runs of 60 s (one full tour each); arm order rotated; 30 s idle between runs |
| power | mains, best-performance mode; flag drift when the first and last 10 s medians differ by more than 10% |
| versions | every receipt pins X_ITE, three, Babylon, Playwright, the browser version and flags, converter and shader hashes (R-SEC-07) |

## 7. Hardware

| machine | role | timings? |
|---|---|---|
| the owner's PC: Windows, Chrome 156, Intel UHD 620 | floor machine. He asked that his GPU not be used for metrics (S, project note, 28 Oct): ask first with one decision card (his PC as a ratio-only floor machine, about 75 min unattended for tier A; another machine with a discrete GPU, if he has one; or wait) | only after his yes; ratios only |
| a discrete-GPU machine | unknown: ask | yes |
| the cloud sandbox (Chromium 153, SwiftShader WebGL2 and a WebGPU fallback adapter with timestamp-query) | port, parity, counts, receipt dry runs | **never** |

Tier A is 4 scenes x 4 arms x 3 runs at 1105x576 (L for the duration).

## 8. Fairness pitfalls

| pitfall | evidence | rule |
|---|---|---|
| on-demand rendering | X_ITE requests one rAF per browser event (C, 16.7.0 source) | count `finishEvents`; force a frame each rAF |
| vsync cap | 59.7 fps median on the owner's PC (C, FACTS.md) | vsync-off flags and GPU timers |
| 15x glow overdraw | 487x274 canvas, 1920x1080 RT (C) | pin the tier; log both sizes |
| Adaptive tier mid-run | drops below 26 fps after 12 s (C) | fixed tiers only |
| shader and pipeline caches | 10 programs per load in X_ITE (C) | cold and warm profiles; time only after compile |
| blend mismatch | three AdditiveBlending is not ONE/ONE (C) | CustomBlending ONE/ONE |
| colour pipeline | X_ITE ToneMapping does not reach ComposedShader (C) | no tone map anywhere |
| `preserveDrawingBuffer` | X_ITE creates its context with it (C); WebGPU has no equivalent | turn it off in arm A's bench mode, and record it (TBD) |
| thermal throttling | a 15 W integrated GPU (S) | rotate arm order, idle, drift flag |
| random sparks | ParticleSystem | off in every arm |
| version skew | owner Chrome 156, sandbox Chromium 153 (C, S for 156's stable date) | record both; assume no feature parity |

## 9. Decision rule

**Go** for a WebGPU body only when all four hold:

1. Parity: SSIM at least 0.95 and PSNR at least 30 dB on all three views (R-TETHER-04).
2. Headline: the WebGPU arm's p95 frame time is at most 0.70 times A's on pu24 or L50k, in all 3 runs, and the gap exceeds twice the run spread.
3. Attribution: the WebGPU arm is at most 0.85 times its own engine's WebGL2 arm (B vs C, or E vs F) on the same scene. If not, the gain is engine overhead, and the fix belongs in X_ITE, not in a new renderer.
4. No regression: the hero is not more than 10% slower in p95 (R-PERF-06), and the cold time to first frame is at most 1.5 times A's.

Anything else is **No-go**, or **Inconclusive** when the vsync cap holds or parity fails.

## 10. Receipt

One JSON object per scene x arm x window x run, schema `x3d.bench/1`: [bench/receipt.schema.json](bench/receipt.schema.json) (JSON Schema draft 2020-12). The frame-by-frame CSV is hashed into the receipt, and the receipt carries its own hash.

## 11. Results template

One row per scene x arm x window, median of 3 runs. Empty until gate G0 passes.

| scene | arm | window | canvas px | RT px | p50 ms | p95 ms | p99 ms | 1% low fps | GPU p50 ms | GPU p95 ms | CPU p95 ms | draws/frame | TTFP cold ms | TTFP warm ms | load ms | heap MB | SSIM min | PSNR dB | p95 / A | spread % | errors | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| hero | A | 1105x576 | | | | | | | | | | | | | | | ref | ref | 1.00 | | | |
| hero | B | 1105x576 | | | | | | | | | | | | | | | | | | | | |
| hero | E | 1105x576 | | | | | | | | | | | | | | | | | | | | |
| pu24 | A | 1105x576 | | | | | | | | | | | | | | | ref | ref | 1.00 | | | |
| pu24 | B | 1105x576 | | | | | | | | | | | | | | | | | | | | |
| pu24 | C | 1105x576 | | | | | | | | | | | | | | | | | | | | |
| pu24 | E | 1105x576 | | | | | | | | | | | | | | | | | | | | |
| pu24 | F | 1105x576 | | | | | | | | | | | | | | | | | | | | |
| L10k-split | A | 1105x576 | | | | | | | | | | | | | | | ref | ref | 1.00 | | | |
| L10k-split | B | 1105x576 | | | | | | | | | | | | | | | | | | | | |
| L50k | A | 1105x576 | | | | | | | | | | | | | | | ref | ref | 1.00 | | | |
| L50k | B | 1105x576 | | | | | | | | | | | | | | | | | | | | |
| L50k | E | 1105x576 | | | | | | | | | | | | | | | | | | | | |

## 12. Sandbox check (done; correctness only)

| field | X_ITE 16.5.1 | X_ITE 16.7.0 |
|---|---|---|
| page ready | yes, 0 errors | yes, 0 errors |
| shader nodes found | 5 of 5 | 5 of 5 |
| draws, vertices per frame | 17, 123,822 | 17, 123,822 |
| programs, shaders | 10, 20 | 10, 20 |
| rendered frames per rAF in 3 s | 14 / 17 | 17 / 19 |
| `EXT_disjoint_timer_query_webgl2` | present | present |
| WebGPU adapter | SwiftShader fallback with timestamp-query | same |
| frame rate | not quoted | not quoted |

## 13. Open items

| id | question | owner |
|---|---|---|
| B-1 | Does the owner allow his UHD 620 PC for this, and is there a discrete-GPU machine (make and model)? | |
| B-2 | Does his PC have Node (for Playwright) or only Python 3 (enough for the dirac `serve.py` and a self-running page)? | |
| B-3 | How much of the six collider shaders does three's GLSL-to-TSL transpiler handle (loops, the bloom's nested 12x6 taps, `x3d_Viewport` inside a RenderedTexture)? | |
| B-4 | Do the collider shaders compile through Babylon's glslang + twgsl unchanged (TBD-15)? | |
| B-5 | Are `--disable-gpu-vsync --disable-frame-rate-limit` still honoured by Chrome 156 on Windows? | |
| B-6 | Chrome's WebGPU developer-features page (timestamp quantisation): hand fetch | |
| B-7 | The X_ITE double submission (TBD-32): match it or not? | |
