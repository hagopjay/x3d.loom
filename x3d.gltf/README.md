# x3d.gltf: glTF tooling that keeps X3D identity

An optimiser for the glb files the X3D-to-Blender pipeline writes, and the gates that prove what it kept. It wraps glTF-Transform, meshoptimizer, Draco and Basis/KTX2 behind nine profiles, and it checks every result for the thing a size check cannot see: whether each DEF name, camera, light, material and animation channel of the X3D scene is still in the glb (the tether: *X3D is the 3D format an AI can be held accountable to*).

| tool | version | job |
|---|---|---|
| glTF-Transform | 4.5.1 | read, transform and write glb |
| meshoptimizer | 1.3.0 | vertex reorder, `EXT_meshopt_compression` |
| draco3dgltf | 1.5.9 | `KHR_draco_mesh_compression` |
| ktx2-encoder | 0.6.0 | `KHR_texture_basisu` (UASTC, ETC1S) |
| Khronos glTF-Validator | 2.0.0-dev.3.10 | structure of the delivered and the decoded file |
| esbuild | 0.25.12 | the browser bundle |

```bash
npm ci
node bin/x3dgltf.mjs profiles                                  # the nine profiles and their contracts, plus two traps
node bin/x3dgltf.mjs inspect model.glb                         # draw calls, triangles, resident bytes, byte table, gzip, brotli
node bin/x3dgltf.mjs validate model.glb                        # validator on the file and on its decoded canonical form
node bin/x3dgltf.mjs optimize model.glb out.glb --profile web  # optimise, then run every gate; exit 1 if one fails
node bin/x3dgltf.mjs verify model.glb out.glb --profile web    # the gates alone, on two files you already have
node bin/x3dgltf.mjs matrix --files a.glb,b.glb --profiles web,draco,instanced --out run --md run.md --expect-fail static-joined
npm test                                                       # 13 lane tests and 4 browser byte-parity tests
```

## What it promises

A profile has a written contract (`src/profile-contract.mjs`), and `verify` fails if the output breaks it.

| contract | identity | profiles |
|---|---|---|
| `exact` | every name and every `x3d_*` extra survives, none added | `lossless`, `meshopt-lossless`, `quantized`, `web`, `web-filter`, `draco`, `web-ktx2`, `web-ktx2-etc1s` |
| `mapped` | tags survive inside `extras.x3d_instances` of the new batch node | `instanced` |
| `lossy` | loss is allowed, counted and printed | `static-joined`, `stock-instance` (measured, never shipped) |

Geometry is held to the profile's bound: `exact` within one float32 ULP (1e-7 of the scene diagonal), 14-bit quantization within 2^-13 (1.22e-4), 12-bit within 4.88e-4. The gates are identity, triangles, centroids (a k-d tree over triangle centroids, source against output), normals, areas and bounds, materials, animation, the Khronos validator on the delivered and the decoded file, and the KTX2 container. Every gate has a test that makes it fail (`tests/lane.test.mjs`).

## What it found

Numbers below are read from `receipts/`; the instrument is this CLI at glTF-Transform 4.5.1, the validator above, Node v22.23.4, gzip level 9 and brotli level 11. Twelve glbs, listed with sha256 and origin in `receipts/corpus.json`.

**Profile totals** (sum over the twelve files; `receipts/summary.md` has the per-file and per-trap tables, `receipts/matrix/` every cell)

| profile | files | gates pass | KiB before | KiB after | % of before | gzip % | brotli % | identity tokens lost |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| lossless | 12 | 12/12 | 17180.6 | 17702.4 | 103.0% | 106.5% | 102.6% | 0 |
| meshopt-lossless | 12 | 12/12 | 17180.6 | 11652.3 | 67.8% | 88.8% | 106.4% | 0 |
| quantized | 12 | 12/12 | 17180.6 | 9965.3 | 58.0% | 74.4% | 73.2% | 0 |
| web | 12 | 12/12 | 17180.6 | 6154.1 | 35.8% | 50.2% | 60.6% | 0 |
| web-filter | 12 | 12/12 | 17180.6 | 5646.1 | 32.9% | 44.7% | 54.3% | 0 |
| draco | 12 | 12/12 | 17180.6 | 7690.4 | 44.8% | 57.5% | 69.7% | 0 |
| web-ktx2 | 12 | 12/12 | 17180.6 | 6327.5 | 36.8% | 52.6% | 63.9% | 0 |
| web-ktx2-etc1s | 12 | 12/12 | 17180.6 | 5590.4 | 32.5% | 42.5% | 50.3% | 0 |
| instanced | 12 | 12/12 | 17180.6 | 5515.1 | 32.1% | 49.2% | 58.8% | 0 |
| static-joined | 12 | 8/12 | 17180.6 | 10696.8 | 62.3% | 40.8% | 43.8% | 5945 |
| stock-instance | 12 | 12/12 | 17180.6 | 16768.7 | 97.6% | 104.7% | 100.9% | 4150 |

**Per file: the smallest profile that passed every gate**

| glb | KiB source | gzip KiB | brotli KiB | smallest passing (raw) | KiB | % | smallest passing (brotli) | brotli KiB | % | draw calls source -> instanced | identity tokens |
|---|---:|---:|---:|---|---:|---:|---|---:|---:|---|---:|
| asterion.glb | 4404.4 | 624.0 | 359.9 | web-filter | 420.9 | 9.6% | draco | 112.2 | 31.2% | 284 -> 284 | 587 |
| lumen.glb | 2689.1 | 1252.2 | 550.8 | draco | 231.3 | 8.6% | web-filter | 106.3 | 19.3% | 34 -> 34 | 86 |
| prismatica-aurora-cathedral.glb | 1190.8 | 525.5 | 384.8 | instanced | 445.4 | 37.4% | draco | 125.3 | 32.6% | 1218 -> 10 | 1251 |
| stilllife-addon.glb | 1645.4 | 1098.8 | 908.5 | web-ktx2-etc1s | 509.1 | 30.9% | web-ktx2-etc1s | 368.3 | 40.5% | 5 -> 5 | 27 |
| stars-view.glb | 40.7 | 25.7 | 22.5 | web | 20.6 | 50.7% | web | 12.5 | 55.6% | 1 -> 1 | 8 |
| prismatica-aurora-cathedral-animated.glb | 4630.0 | 2557.1 | 2289.0 | web-filter | 1857.8 | 40.1% | quantized | 1261.0 | 55.1% | 1218 -> 1218 | 1251 |
| prismatica-aurora-cathedral-static.glb | 1072.1 | 521.3 | 390.8 | instanced | 341.0 | 31.8% | draco | 123.0 | 31.5% | 1218 -> 10 | 1251 |
| prismatica-aurora-cathedral-static-instanced.glb | 844.0 | 487.8 | 366.4 | draco | 159.9 | 19.0% | draco | 101.4 | 27.7% | 10 -> 10 | 43 |
| thalassa-exhibition.glb | 480.3 | 96.4 | 75.6 | instanced | 175.2 | 36.5% | instanced | 37.4 | 49.4% | 1719 -> 8 | 1737 |
| thalassa-exhibition-instanced.glb | 122.3 | 38.8 | 33.3 | draco | 85.8 | 70.1% | draco | 31.9 | 95.9% | 8 -> 8 | 26 |
| docs__demos__blender-x3d-io__v1__scenes__annotation-standard.glb | 37.7 | 16.3 | 9.9 | draco | 11.0 | 29.1% | web-filter | 4.7 | 47.6% | 5 -> 5 | 16 |
| docs__demos__blender-x3d-io__v1__scenes__lights-before.glb | 23.7 | 12.4 | 8.3 | draco | 6.6 | 27.6% | draco | 3.7 | 45.0% | 3 -> 3 | 13 |

Stock glTF-Transform steps that change identity (`receipts/step-probe.md`, one step at a time, 108 probe rows):

| step | measured on the PRISMATICA cathedral glb (1,251 identity tokens, 1,218 draw calls) |
|---|---|
| `instance({min:2})` | 1,216 tokens lost; 1,218 draw calls become 10 |
| `join()` | 1,208 tokens lost; 1,190.8 KiB becomes 16,482.7 KiB |
| `palette({min:5})` | 10 tokens lost, 5 added |
| stock `dedup()` | loses name-only duplicates (2 on the `identity-dup` fixture) |
| stock `quantize()` and `meshopt()` | on an animated node, 1 of 3 channels loses its target |

The lane's `instanceWithIdentity` and `quantizeKeepingIdentity` wrappers get the same draw-call and size wins with 0 tokens lost and 0 channels unmatched.

## Layout

| path | what |
|---|---|
| `src/` | the library: `profiles-core.mjs` (portable profiles), `profiles.mjs` (adds Draco and KTX2), `gates.mjs` and the modules it uses (`identity`, `geometry`, `materials`, `animation`), `validate.mjs`, `ktx2check.mjs`, `measure.mjs`, `verify.mjs`, `optimize.mjs` |
| `bin/x3dgltf.mjs` | the CLI |
| `web/forge.mjs`, `tools/build-web.mjs` | the browser bundle (400 KiB) that the glb Forge demo page runs; same bytes as the CLI for the portable profiles |
| `render/` | the render oracle: one glb loaded in three.js r187, Babylon.js 9.32.0 and X_ITE 16.7.1 with local decoders, original against optimised |
| `fixtures/`, `tests/` | deterministic fixtures built on the fly (no Blender, no network) and the tests, including negative controls |
| `tools/` | `step-probe`, `summarize`, `corpus-manifest`, `make-demo-assets`, `build-web` |
| `receipts/` | recorded runs: corpus manifest, matrix cells and tables, the step probe, `render-matrix` (oracle on the source glbs) and `render-profiles` (oracle on every profile output) |

## Limits

- Nothing is timed. These are sizes, counts and token comparisons, not frame times or load times, on any GPU.
- The validator, Draco and KTX2 run in Node. The browser bundle claims only the portable profiles and gates.
- The validator does not know meshopt, Draco, basisu or gpu_instancing; the lane validates the decoded canonical file as well and prints `extensionsNotValidated` next to every pass.
- The twelve-file corpus is from this project; rankings of profiles are about these files.
- The `static-joined` normals check samples about 400 triangles, and one corpus file animates (the animated cathedral: 1 animation, 1 channel); the multi-channel animation gate is exercised by fixtures (`tests/lane.test.mjs`) only.
- `stock-instance` and `static-joined` exist to be measured. A `PASS` on a lossy contract means the bounds held, not that the X3D identity did; the CLI says so.

Docs: chapter 19 of the x3d.docs knowledge base (`docs/learn/19-gltf-tooling.md`). Demo: the glb Forge page in x3d.demo (`docs/demos/glb-forge/v1/`).
