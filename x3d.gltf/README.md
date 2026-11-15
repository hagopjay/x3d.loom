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

{{README_TABLES}}

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
| `tools/` | `step-probe`, `summarize`, `corpus-manifest`, `make-demo-assets` |
| `receipts/` | recorded runs: corpus manifest, matrix cells and tables, the step probe |

## Limits

- Nothing is timed. These are sizes, counts and token comparisons, not frame times or load times, on any GPU.
- The validator, Draco and KTX2 run in Node. The browser bundle claims only the portable profiles and gates.
- The validator does not know meshopt, Draco, basisu or gpu_instancing; the lane validates the decoded canonical file as well and prints `extensionsNotValidated` next to every pass.
- The twelve-file corpus is from this project; rankings of profiles are about these files.
- `stock-instance` and `static-joined` exist to be measured. A `PASS` on a lossy contract means the bounds held, not that the X3D identity did; the CLI says so.

Docs: chapter 16 of the x3d.docs knowledge base (`docs/learn/16-gltf-tooling.md`). Demo: the glb Forge page in x3d.demo (`docs/demos/glb-forge/v1/`).
