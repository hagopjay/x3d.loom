# render/ : the render oracle

Draws one glb deterministically in headless Chromium with **three.js**, **Babylon.js** or **X_ITE**, and measures how much
the picture moved between an ORIGINAL glb and an OPTIMISED copy (meshopt, Draco, quantization, KTX2, GPU instancing)
in the SAME engine from the SAME camera. Absolute look across engines is not the point; original-vs-optimised inside one
engine is.

Instruments behind every number in this file (unless a row says otherwise):

| instrument | version |
|---|---|
| three.js | 0.187.0 (`three`) |
| Babylon.js | 9.32.0 (`babylonjs`, `babylonjs-loaders`, UMD builds) |
| X_ITE | 16.7.1 (`x_ite`, `dist/x_ite.js`) |
| Chromium | 153.0.8010.12 headless, driven by Playwright 1.63.0 |
| GL | WebGL 2.0, `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`, no GPU |
| glTF-Transform | 4.5.1, `meshoptimizer` 1.3.0, `draco3dgltf` 1.5.9, `ktx2-encoder` 0.6.0 (all variants are built with these) |
| inputs | `stilllife-addon.glb` (5 meshes, 27 560 triangles, 1 PNG texture, 3 lights), `prismatica-aurora-cathedral.glb` (1 218 mesh nodes sharing 10 meshes, 600 976 triangles, unlit materials, 10 lights) |

## Usage

```sh
# render one file (camera = framed from the ORIGINAL, so original and optimised share it)
node render/render.mjs --engine three|babylon|xite|playcanvas --glb OPT.glb --frame-from ORIG.glb --out OPT.png \
     [--size 512] [--json receipt.json] [--timeout-ms 60000]

# or pass the camera yourself (fov = vertical, radians)
node render/render.mjs --engine babylon --glb A.glb --out A.png \
     --camera '{"position":[3.1,1.2,5.7],"target":[0,-0.75,0],"up":[0,1,0],"fov":0.7854}'

# measure the move (mean |delta| on 0-255 over R,G,B; PSNR dB; fraction of pixels whose max-channel delta > 16)
node render/compare.mjs A.png B.png [--json] [--threshold 16]

# build variants of the two showpieces and print the engine x variant matrix (about 5 minutes)
node render/matrix.mjs [--size 256] [--out DIR] [--json m.json] [--md m.md] [--engines ..] [--sources ..] [--variants ..]

# tests (about 2 minutes; skipped, not failed, only when Chromium cannot launch)
node --test render/tests/render.test.mjs
```

Exit codes of `render.mjs`: `0` rendered; `1` usage error; `2` load or render failed (the receipt is still written, **no PNG**
is written and a stale PNG at `--out` is deleted); `3` Chromium cannot launch (receipt written).
`--size` is one integer: frames are square (X_ITE's `fieldOfView` applies to the smaller dimension, so square keeps all
three engines on the same vertical fov).

Modules other lanes may import: `render/frame.mjs` exports `frameCamera(bounds, opts) -> {position,target,up,fov,near,far}`,
`boundsOfGlb(path) -> {min,max}` (reads draco / meshopt / quantized / KTX2 files), `frameFromGlb(path)`, `normaliseCamera(c)`;
`render/render.mjs` exports `renderGlb(opts)`; `render/imgstats.mjs` exports `compareImages`, `backgroundStats`;
`render/variants.mjs` exports `buildVariant(src, name, out)` and `expectedGeometry(glb)`.

### Camera framing rule (`frame.mjs`)

`target` = centre of the world-space AABB (`getBounds(scene)` from `@gltf-transform/functions`, NodeIO with `ALL_EXTENSIONS`,
draco3dgltf + meshoptimizer decoders registered; boxes of `EXT_mesh_gpu_instancing` nodes are grown by the 8 local-AABB
corners of every instance). `fov` = 0.7854 rad vertical. Direction from the target to the camera = normalize(0.55, 0.35, 1), up = +Y.
`distance` = the smallest value for which all 8 AABB corners fit the frustum with every corner's screen extent inflated by
`margin` = 1.1 (about a 10 percent border): `max over corners of (margin * max(|x|,|y|) / tan(fov/2) - z)` in the camera basis.
`near = 0.01 * distance`, `far = 100 * distance`. Opt-in `{rule:'sphere'}` gives `margin * R / sin(fov/2)` with R = half the AABB
diagonal; it puts the camera about 6 percent further away than the default on the two showpieces. The camera is derived from the ORIGINAL and
then passed in; it is never re-chosen per file.

## What every engine is told to do

| | three | Babylon | X_ITE |
|---|---|---|---|
| canvas | `WebGLRenderer({antialias, preserveDrawingBuffer})`, pixel ratio 1 | `Engine(canvas, antialias, {preserveDrawingBuffer, adaptToDeviceRatio:false})`, hardware scaling 1 | `<x3d-canvas contentScale=1>`, `Antialiased` on (X_ITE default 4x multisampling) |
| glb wiring | `GLTFLoader` | `SceneLoader.ImportMeshAsync`, glTF animations off (`animationStartMode` NONE) | `<Inline url="model.glb"/>` in a generated X3D 4.0 wrapper (`/wrapper.x3d`, copy in the receipt as `xiteWrapper`) |
| camera | `PerspectiveCamera`, `lookAt` | `FreeCamera` + `upVector` + `setTarget`, `fov` vertical, `minZ/maxZ` | `Viewpoint` `position`, axis-angle `orientation` from the look-at, `fieldOfView`, `nearDistance`, `farDistance` |
| handedness | native right-handed | `scene.useRightHandedSystem = true` set **before** the load, so the loader inserts no handedness-flip node and the passed right-handed camera means the same thing as elsewhere | X3D is right-handed |
| tone mapping / colour | `NoToneMapping`, `outputColorSpace` sRGB, `ColorManagement` on | `toneMappingEnabled=false`, exposure 1, contrast 1, no vignette; PBR output is gamma encoded by the shader | `ToneMapping` NONE, `ColorSpace` LINEAR_WHEN_PHYSICAL_MATERIAL (X_ITE default), `DisplayColorSpace` SRGB, exposure 1 |
| background | `setClearColor(0x20242c)` | `scene.clearColor = #20242c` | `<Background skyColor=0.1255 0.1412 0.1725>` |
| glb has KHR_lights_punctual lights | used as the engine loads them | used as the engine loads them | used (X_ITE imports them as `DirectionalLight` / `PointLight`); `NavigationInfo headlight=false` |
| glb has no lights | `DirectionalLight(white, 2.2)` parented to the camera + `HemisphereLight(white, 0x808080, 1.0)` | `DirectionalLight(3.0)` along the view direction + `HemisphericLight(1.0, ground 0.5 grey)` | `NavigationInfo headlight=true` (white directional, intensity 1) + `EnvironmentLight(intensity 0.2)` with a uniform mid-grey diffuse cube map made of six 1x1 PNG data URIs (PhysicalMaterial has no other ambient term in X_ITE) |
| settled frame | load promise, then `requestAnimationFrame` x3 with an explicit render each, +1 | `scene.whenReadyAsync()`, then 3 render-loop frames + 1 rAF | `loadURL` + `LoadSensor.isLoaded`, then `browser.nextFrame()` x3 |
| picture | compositor screenshot of the viewport (`page.screenshot`), the corner pixel was observed to be exactly (32,36,44) in all three engines (test (i) asserts it within +-1) | | |

The whole run has a 60 s timeout (`--timeout-ms`). The `fallback` light intensities are tuned only so shading is visible;
they are the same for every file rendered in one engine.

## No network at render time

Everything is served by a tiny local HTTP server (`server.mjs`) on 127.0.0.1: `/pages/*` (the three engine pages),
`/nm/*` (only `x3d.gltf/node_modules`), `/model.glb`, `/wrapper.x3d`. Three of those layers keep the browser offline:
the server only knows those routes, the launch flags `--no-proxy-server --host-resolver-rules="MAP * ~NOTFOUND , EXCLUDE 127.0.0.1"`,
and a Playwright `context.route` that aborts every http(s)/ws(s) request that is not to our server (the abort is recorded in
`receipt.network.blocked`). **The flags alone were not enough**: in this sandbox a Babylon worker fetched
`https://cdn.babylonjs.com/v9.32.0/babylon.ktx2Decoder.js` and the transcoder wasm with HTTP 200 although the launch flags were
set; my first KTX2 matrix therefore silently used the internet. Only the route interception stopped it. Do not remove it.

## Decoder wiring (what each engine is pointed at, all inside `node_modules`)

| codec | three 0.187.0 | Babylon 9.32.0 | X_ITE 16.7.1 |
|---|---|---|---|
| Draco | `DRACOLoader.setDecoderPath('/nm/three/examples/jsm/libs/draco/gltf/')`: `draco_wasm_wrapper.js`, `draco_decoder.wasm`, `draco_decoder.js` (asm fallback). Counter: `DRACOLoader.decodeGeometry` | `DracoCompression.Configuration.decoder = {wasmUrl, wasmBinaryUrl, fallbackUrl}` pointing at the **same three files** (the babylonjs packages ship no Draco decoder; Babylon's defaults `draco_wasm_wrapper_gltf.js`, `draco_decoder_gltf.wasm`, `draco_decoder_gltf.js` are on cdn.babylonjs.com). Counter: `DracoDecoder._decodeMeshToGeometryForGltfAsync` (Babylon 9 renamed the class; the loader calls it once per primitive) | automatic, script-relative: `x_ite/dist/assets/lib/draco_decoder_gltf.js` |
| meshopt | `loader.setMeshoptDecoder(MeshoptDecoder)` from `three/examples/jsm/libs/meshopt_decoder.module.js` (wasm inlined). Counter: `decodeGltfBufferAsync` | `MeshoptCompression.Configuration.decoder = {url: '/nm/meshoptimizer/meshopt_decoder.cjs'}`. Babylon wants a classic script that defines a global `MeshoptDecoder`; the babylonjs packages ship none (default is cdn.babylonjs.com/meshopt_decoder.js). `meshoptimizer`'s `.cjs` is such a script (its `module.exports` is guarded). **`x_ite/dist/assets/lib/meshopt_decoder.js` is not usable here**: it is a function body ending in a top-level `return` (pageerror "Illegal return statement", then "MeshoptDecoder is not defined"). Counter: `MeshoptCompression.decodeGltfBufferAsync` | automatic: `x_ite/dist/assets/lib/meshopt_decoder.js` |
| KTX2 / Basis | `KTX2Loader.setTranscoderPath('/nm/three/examples/jsm/libs/basis/')` (`basis_transcoder.js/.wasm`, plus `zstddec.module.js`), `detectSupport(renderer)`. Counter: `KTX2Loader._createTexture` | **not wirable from node_modules.** Needs `babylon.ktx2Decoder.js` plus `ktx2Transcoders/*/msc_basis_transcoder.{js,wasm}` and a zstd wasm; none of them is in `babylonjs`, `babylonjs-loaders` (they belong to the separate `@babylonjs/ktx2decoder` package / the CDN, which is not installed). `KhronosTextureContainer2.URLConfig` is left at its default so the failure is observable | automatic: `x_ite/dist/assets/lib/libktx.js` + `libktx.wasm` |

The receipt (`decoders.{draco,meshopt,ktx2}`) carries `declaredInGlb`, `calls` (engine-side counter; `null` for X_ITE, which cannot
be observed from outside), `assetsFetched` (decoder files the local server really served) and `invoked`
(`calls > 0`, or for X_ITE: declared and decoder asset served and the load succeeded). For three the meshopt module is imported at page
load, so its `assetsFetched` is non-empty even for files that do not need it: read `calls` there.

## Receipt (`--json`)

`engine {name,id,package,version}`, `chromium`, `userAgent`, `webgl {renderer,vendor,version,compressedTextureExtensions}`,
`size`, `camera` (+ `source`), `background`, `glb` (bytes, `extensionsUsed`, declared lights/meshes/images, ...), `lighting`
(source `glb|fallback`, what was added), `colour`, `decoderConfig`, `decoders`, `stats {meshes, triangles, ...}` (what the engine
holds after load: three = sum over `Mesh` of `index.count/3` (or `position.count/3`) times `InstancedMesh.count`; Babylon = scene
meshes' `getTotalIndices()/3` times thin-instance count, `InstancedMesh` counted through its source; X_ITE = see limits),
`timing {loadMs, settleMs, totalMs}`, `console {errors, warnings}` (page console, page errors and worker console),
`network {failed, blocked, aborted, httpErrors}`, `loaded`, `degraded` (loaded but with console errors or failed/blocked/4xx
requests), `error`, `png`, `image` (non-background fraction, distinct colours, SHA-256), `notes`.
`loaded` means the engine's load promise resolved and the settled frames were produced; it does not mean "nothing went wrong":
check `degraded`, `console.errors` and `stats.triangles`.

## Measured results

All rows: 256 px, camera framed from the original, Chromium 153.0.8010.12, ANGLE/SwiftShader Vulkan, engines as in the first
table. "tris" is what the engine reports after load (`stats.triangles`); it equals the triangle count computed independently from
each file with glTF-Transform in every cell that loaded (27 560 and 600 976). Deltas are against the same engine's render of the
original (mean absolute delta on 0-255 / fraction of pixels with max-channel delta > 16).

### Determinism (the same file rendered twice, the second time in a freshly launched Chromium)

| engine | mean abs delta | PSNR | px > 16 | bytes identical |
|---|---:|---|---:|---|
| three 0.187.0 | 0.0000 | inf | 0 | yes |
| Babylon 9.32.0 | 0.0000 | inf | 0 | yes |
| X_ITE 16.7.1 | 0.0000 | inf | 0 | yes |

(stilllife, 256 px, SwiftShader; test (ii) asserts `< 0.5` and prints these numbers.) On this software rasteriser the renders are
bit-identical, so any non-zero delta between two files is a property of the files, not noise.

### Support matrix: loaded / triangles seen / mean abs delta vs original / px > 16

Variant recipes (`variants.mjs`): `meshopt` = `meshopt({encoder, level:'high'})` (EXT_meshopt_compression + KHR_mesh_quantization),
`meshoptMedium` = level `medium`, `draco` = `draco()` defaults (14-bit positions), `quantize` = `quantize()` (KHR_mesh_quantization only),
`dracoCoarse` = `draco({quantizePosition:5, quantizeNormal:4, quantizeTexcoord:6})` (deliberate damage), `instance` =
`instance({min:2})` + dedup + prune (EXT_mesh_gpu_instancing, 1 216 instances in 8 batches), `ktx2` = ktx2-encoder ETC1S,
`ktx2Uastc` = UASTC, `all` = instance + meshopt + ktx2 (instance and ktx2 only where applicable: stilllife has no repeated meshes, prismatica has no textures),
`nolights` = KHR_lights_punctual stripped (exercises the fallback lighting; no delta column because the lighting differs by design).

#### stilllife-addon.glb

| variant (file bytes; extensions) | three | Babylon | X_ITE |
|---|---|---|---|
| original (1 684 916) | yes / 27560 | yes / 27560 | yes / 27560 |
| meshopt (1 006 264; meshopt + quantization) | yes / 27560 / 0.031 / 0.024% | yes / 27560 / 0.028 / 0.031% | yes / 27560 / 0.024 / 0.026% |
| meshoptMedium (1 098 492) | yes / 27560 / 0.008 / 0.014% | yes / 27560 / 0.008 / 0.014% | yes / 27560 / 0.008 / 0.015% |
| draco (827 640) | yes / 27560 / 0.010 / 0.006% | yes / 27560 / 0.009 / 0.009% | yes / 27560 / 0.007 / 0.006% |
| quantize (1 385 940) | yes / 27560 / 0.008 / 0.014% | yes / 27560 / 0.008 / 0.014% | yes / 27560 / 0.008 / 0.015% |
| dracoCoarse (757 236) | yes / 27560 / **0.652** / **1.575%** | yes / 27560 / **0.581** / **1.283%** | yes / 27560 / **0.517** / **1.022%** |
| ktx2 ETC1S (1 107 284) | yes / 27560 / 0.005 / 0.000% | **NO: hangs, 60 s timeout** | yes / 27560 / 0.017 / 0.003% |
| ktx2Uastc (1 861 988) | yes / 27560 / 0.002 / 0.000% | **NO: hangs** | yes / 27560 / 0.017 / 0.005% |
| all = meshopt + ktx2 (349 292) | yes / 27560 / 0.035 / 0.024% | **NO: hangs** (the KTX2 part) | yes / 27560 / 0.041 / 0.031% |
| nolights (1 683 544) | yes / 27560 | yes / 27560 | yes / 27560 |

#### prismatica-aurora-cathedral.glb

| variant (file bytes; extensions) | three | Babylon | X_ITE |
|---|---|---|---|
| original (1 219 372) | yes / 600976 | yes / 600976 | yes / 600976 |
| meshopt (597 820) | yes / 600976 / 0.055 / 0.018% | yes / 600976 / 0.078 / 0.017% | yes / 600976 / 0.017 / 0.012% |
| meshoptMedium (653 336) | yes / 600976 / 0.054 / 0.018% | yes / 600976 / 0.074 / 0.017% | yes / 600976 / 0.013 / 0.012% |
| draco (519 312) | yes / 600976 / 0.022 / 0.008% | yes / 600976 / 0.020 / 0.008% | yes / 600976 / 0.009 / 0.008% |
| quantize (899 012) | yes / 600976 / 0.054 / 0.018% | yes / 600976 / 0.074 / 0.017% | yes / 600976 / 0.013 / 0.012% |
| dracoCoarse (457 112) | yes / 600976 / **0.946** / **2.565%** | yes / 600976 / **0.919** / **2.475%** | yes / 600976 / **0.566** / **2.090%** |
| instance (540 292; EXT_mesh_gpu_instancing) | yes / 600976 / 0.000 / 0.000% | yes / 600976 / 0.000 / 0.000% | yes / 600976 / 0.000 / 0.000% |
| all = instance + meshopt (188 848) | yes / 600976 / 0.055 / 0.018% | yes / 600976 / 0.078 / 0.017% | yes / 600976 / 0.017 / 0.012% |
| nolights (1 216 756) | yes / 600976 | yes / 600976 | yes / 600976 |

Reading the numbers: ordinary meshopt / Draco / quantization move the picture by less than 0.08 of 255 on average and by
under 0.04 percent of the pixels by more than 16 in every engine; the deliberately damaged `dracoCoarse` moves it 40 to 75 times
more (mean) and 140 to 320 times more (px > 16), so the oracle is sensitive, it is not just agreeing with itself (test (vi)
asserts a factor of at least 20 on the mean). The GPU-instanced file renders identically to the un-instanced original in all three
engines (0.000). Why the same meshopt/quantized/Draco files move X_ITE's picture 2 to 5 times less than three's and Babylon's on prismatica
was not investigated; the deltas only compare an engine with itself.

What the engines do with the instanced file (`stats`): three builds 10 `InstancedMesh` objects (meshes 10 instead of 1 218, same 600 976
triangles); Babylon builds 10 meshes with thin instances; X_ITE builds 8 `InstancedShape` + 2 `Shape` nodes.

### What each engine did with each compression (findings)

* **meshopt**: three and X_ITE fine out of the box. Babylon works only after pointing `MeshoptCompression.Configuration.decoder.url` at
  a classic-script build (`meshoptimizer/meshopt_decoder.cjs`). With the obvious candidate in `node_modules`
  (`x_ite/dist/assets/lib/meshopt_decoder.js`) the load fails with "MeshoptDecoder is not defined" and the only other evidence is a
  `pageerror: Illegal return statement`. With nothing configured Babylon requests `cdn.babylonjs.com/meshopt_decoder.js`.
* **Draco**: all three engines decode it. Babylon needs its three Draco URLs set (nothing shipped in `babylonjs*`); the files used are
  three's `draco/gltf` trio. Decoder calls: three 10, Babylon 10 (one per primitive), X_ITE not countable (decoder asset fetched).
* **KHR_mesh_quantization alone**: fine everywhere.
* **KTX2 (KHR_texture_basisu)**: three transcodes and uploads. **This Chromium 153 / SwiftShader exposes BC7 (`EXT_texture_compression_bptc`), S3TC, ETC and ASTC**
  (the brief assumed none), so three's `KTX2Loader` (which switches off ASTC/ETC on Linux) transcodes to `RGBA_BPTC_Format` and uploads it GPU-compressed
  (`receipt.ktx2.formats`, `compressedOnGpu: true`); there was no uncompressed fallback. X_ITE decodes through `libktx` (asset fetched, no error).
  **Babylon 9.32.0 cannot decode KTX2 from `node_modules`, and it fails by hanging**: its worker `importScripts` of
  `https://cdn.babylonjs.com/v9.32.0/babylon.ktx2Decoder.js` fails, the `loadAsync` promise never settles, no exception reaches the caller; the
  only evidence is two `pageerror` entries ("Failed to execute 'importScripts' ... failed to load", "ErrorEvent") and the blocked request. The oracle
  turns it into exit 2 after the timeout. (One accidental run before the network block existed let that Babylon worker reach the CDN: it
  then decoded the ETC1S and UASTC files fine, mean delta 0.004 / 0.002 at 256 px. That is how Babylon is meant to be used online; it is not
  reproducible offline.)
* **EXT_mesh_gpu_instancing**: all three draw it (see above).
* **Nothing drew a blank picture silently** in the final matrix. The failures that exist are loud (an exception) or a hang with page errors;
  each receipt has `loaded:false` and the reason. `notes` and the `image.nonBackgroundFraction` field exist to catch the quiet case (0 triangles,
  blank picture); they never fired (54 of 57 matrix renders loaded, all with zero console errors / failed / blocked requests, smallest non-background share 9.8 percent; the 3 that did not load are the Babylon KTX2 hangs).

### Other measurements and surprises

* **Cross-engine agreement is incidental.** On stilllife (256 px, original file): three vs Babylon mean delta 2.43, three vs X_ITE 2.48,
  **Babylon vs X_ITE 0.117**; on prismatica: three vs Babylon 0.557, three vs X_ITE 3.62 (7.0% of pixels > 16), Babylon vs X_ITE 3.38. Do not compare across engines.
* All three draw the stilllife unmirrored: gold sphere left, marble cube middle, vase right, torus in front (checked by eye on 512 px renders
  and by test (i): in the band of rows holding the objects, Babylon and X_ITE are 9.8x and 8.7x closer to three than to its mirror image).
* X_ITE logs `net::ERR_ABORTED` for its glb request(s) although the load succeeds (it drops its own fetch); these are recorded in
  `network.aborted`, not counted as failures. It also provokes the Chromium warning "GPU stall due to ReadPixels"; it stays in `console.warnings`.
* X_ITE does not reject `loadURL()` and never reports `isLoaded` when a buffer or texture cannot be fetched; it only logs
  `console.error("Couldn't load URL ...")`. `xite.js` turns that line into a rejection so a failed load fails in about 2 s instead of at the timeout.
* X_ITE's glTF importer turns `PBR` into `PhysicalMaterial`, `KHR_lights_punctual` into `DirectionalLight` / `PointLight` and `EXT_mesh_gpu_instancing`
  into `InstancedShape`. The Draco, meshopt, KTX2 and instanced files I checked (stilllife draco/meshopt/ktx2/all, prismatica draco/all) reach it as ordinary `IndexedTriangleSet` after decoding.
* Timings on this box (stilllife, `timing.loadMs`): three about 50 ms, Babylon about 80 to 110 ms, X_ITE about 1.0 to 1.2 s (its component scripts are loaded lazily);
  one CLI call including Chromium start is 1.3 s (three), 2.1 s (Babylon), 3.5 s (X_ITE).

## PlayCanvas, a fourth engine (28 Nov 2026)

`--engine playcanvas`: PlayCanvas engine **2.24.1** (`playcanvas`, UMD build, WebGL2), page `pages/playcanvas.js`, same
contract as the other three: shared camera (vertical fov), `TONEMAP_NONE`, `GAMMA_SRGB`, clear #20242c, glb lights or
the fallback (a white directional light of 2.2 on the camera, plus `scene.ambientLight` 0.5 grey because PlayCanvas
has no hemisphere light). Draco uses the same Google decoder as the three.js and Babylon pages; meshopt uses the
meshoptimizer package's decoder through `pc.meshoptInitialize` (call counter in the receipt); KTX2 is left unconfigured.
Rig: Chromium 158.0.8127.36 headless, ANGLE on SwiftShader, 256 px. Full four-engine run:
`receipts/render-matrix-4engines-20261128.{md,json}`.

| source | variants that load | mean delta vs original (meshopt / draco / quantize / dracoCoarse) | triangles reported |
|---|---|---|---|
| stilllife | 7 of 10 (not ktx2, ktx2Uastc, all) | 0.022 / 0.010 / 0.005 / **0.592** | 27 560 in every loaded cell |
| prismatica | 9 of 9 (instance: 10 mesh instances drawing 600 976 triangles, so EXT_mesh_gpu_instancing is honoured) | 0.056 / 0.022 / 0.054 / **0.938** | 600 976 in every loaded cell |

The coarse-Draco control moves the PlayCanvas picture 59x (stilllife) and 43x (prismatica) more than ordinary Draco, as
in the other engines. The render tests now include PlayCanvas: 25 tests, all pass.

**Findings (Confirmed by reading `playcanvas.js` 2.24.1 and by the picture):**
- PlayCanvas imports `KHR_lights_punctual` lights **switched off** (`createLight` sets `enabled: false`), and clamps
  their intensity to 0..2 (its own TODO, engine issue #3252). Loaded as is, the lit stilllife renders black
  (5 distinct colours). The page turns them on and records it (`lighting.importedDisabled`, `enabledByPage`).
- KTX2 fails with "Basis module not found": PlayCanvas needs its own Basis transcoder build, which the npm package
  does not ship. Recorded as a failure, like Babylon's CDN decoder; not hidden.

## Known limits

* Square frames only. Animation is not played (three: no mixer; Babylon: `animationStartMode` NONE; X_ITE: untested, none of the showpieces animates), skins and morph targets are not exercised.
* `frame.mjs` bounds come from `getBounds`: static pose, no skinning or morph targets; instanced nodes are covered conservatively by their local-AABB corners.
* X_ITE statistics: the Inline's internal scene is not reachable through X_ITE's public API, so `stats` come from a second parse of the same glb
  (`createX3DFromURL`) whose `Shape` / `InstancedShape` nodes are walked (IndexedTriangleSet, TriangleSet, IndexedFaceSet and the strip sets are counted; lines and points are reported separately).
  X_ITE decoder invocations cannot be counted from outside, only inferred from the decoder asset being fetched.
* Babylon Draco/meshopt decoder files are third-party builds from `three` and `meshoptimizer`, not Babylon's own CDN builds (the Draco wrapper is not byte-identical
  to Babylon's `draco_wasm_wrapper_gltf.js` copy); behaviour with Babylon's own files was not compared.
* KTX2 in Babylon: unsupported offline (above). To measure it, someone has to supply `babylon.ktx2Decoder.js` and the transcoders locally and set
  `KhronosTextureContainer2.URLConfig`; this lane deliberately does not.
* GPU-compressed KTX2 results are for a driver that exposes BC7/S3TC (SwiftShader here); on hardware with only ASTC or ETC the transcode target and the delta differ.
* The delta is a picture delta from one fixed viewpoint at 256 px: it cannot see damage that is hidden from that view (back faces, tiny features) and
  ordinary compression is far below what it resolves (determinism is exactly 0, so even 0.005 is real, but whether it matters is a judgement).
* The fallback lighting differs between engines by design (look is not compared across engines); the glb-lights path uses each engine's own import.
* `render/pages/*.js` run in the browser only; they use engine internals that may be renamed between releases (Babylon 9 renamed `DracoCompression` to `DracoDecoder`
  for the glTF path; the counters wrap whichever class owns the method).

## Files

`render.mjs` CLI + `renderGlb()`; `compare.mjs` CLI; `frame.mjs`; `imgstats.mjs`; `glbinfo.mjs` (GLB JSON chunk reader); `server.mjs`;
`browser.mjs` (Playwright + launch flags); `x3dwrap.mjs` (X_ITE wrapper, look-at to axis-angle); `variants.mjs` (glTF-Transform variants,
`expectedGeometry`); `matrix.mjs`; `pages/{three,babylon,xite}.{html,js}`; `tests/render.test.mjs`.
