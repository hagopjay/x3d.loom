# How hard is a three.js port of the X3D bridge? (estimate, 14 Nov 2026)

Short answer: **easy to moderate**, easier than the Babylon port was, because the Babylon port already did the hard 80 percent (the reader) in a form that does not know which engine draws.
About 30 percent of the nodes cost nothing, about 50 percent are a direct mapping onto three.js objects, and about 20 percent are real work (volume, particles, HAnim skinning, text, layering).
Effort numbers are person-days of one engineer who knows the reader, grade **[S]** (a judgement, not a measurement). Everything else here is **[C]** and names its instrument.

Instruments: `x3d.loom@ed1bed8` (read and run 14 Nov 2026), three.js r187 (WebGL2, `three@0.187.0`), X_ITE 16.6.0, Chromium 153.0.8010.12 with SwiftShader (software GL), 320 x 240 shots, `tools/driver.py status`.

## 1. What is engine-neutral and what is not [C, read and run]

| layer | where | lines | engine calls | ported? |
|---|---|---|---|---|
| parser, ROUTEs, event queue, sensors, interpolators, PROTO | `demo/src/brain/reader.js` | 388 | 0 `BABYLON` | shared, untouched |
| SAI shim | `demo/src/brain/sai.js` | 319 | 1 `BABYLON` mention (not run by the three.js body) | shared, untouched |
| bridge kit (`BR.node`, field tables, hooks) | `bridge/src/kit.js` | 648 | 4 mentions, inside Babylon-side hooks | shared, untouched |
| 150 node files (reader half, field tables, behaviour) | `bridge/src/nodes/*.js` | 5882 | 19 files name the engine | shared; the 19 are the port list |
| Babylon drawing: core | `demo/src/brain/body.js`, `body-cam.js` | 518 + 234 | 62 + 17 | replaced by `src/body-three.js` (461 lines after batch 2, plus `src/nodes/Geometry.js`; 284 lines for the 12 core nodes of the first scaffold) |
| Babylon drawing: bridge nodes | `bridge/src/body-br.js` | 919 | 53 | replaced node by node, each with a fixture |

The node hooks that remain to be ported, counted in `bridge/src/nodes/` at `x3d.loom@ed1bed8`: 15 `geometry` hooks (all 15 return plain vertex data, so they port by wrapping the arrays in a `BufferGeometry`), 61 `build` hooks (43 only call methods of `Body`; 18 name Babylon directly) and 61 `changed` hooks (47 and 14).
`Body.geometryData` already returns `{pos, nrm, uv, idx}`; `tools/bundle.js` lifts it out of Babylon's `body.js` at bundle time, so the triangulation rules have one copy.

## 2. Difficulty by node group [S on effort, C on node counts from `NODES.json`]

| group | nodes now | status here | what three.js gives | what it lacks or does differently | difficulty | person-days |
|---|---|---|---|---|---|---|
| Events, followers, interpolators, triggers, time, metadata | 79 | `reader`; 29 re-run vs X_ITE through the three.js bundle, 29 of 29 pass or are a documented X_ITE difference | nothing needed | nothing | free | 0 |
| Sound (Web Audio) | 21 | 17 `reader`, 4 need a hook | the browser's Web Audio; three has `PositionalAudio` but the bridge uses its own graph | listener pose from the bound Viewpoint | free to easy | 1 |
| Core graph: Group, Transform, Switch, Shape, Appearance, Box, Sphere, Cone, Cylinder, IndexedFaceSet, Material, DirectionalLight, Viewpoint, NavigationInfo | 15 | **drawn**, fixtures pass vs X_ITE | `Mesh`, `MeshPhongMaterial`, `MeshPhysicalMaterial`, lights, `PerspectiveCamera` | Transform with scaleOrientation is exact here (matrix), Babylon drops the shear | done | 0 |
| More core, done in batch 1: PointLight, SpotLight, Fog, ImageTexture, PixelTexture, TextureTransform, TextureCoordinate | 8 | **drawn**, 8 fixtures pass vs X_ITE | `Fog`, `SpotLight`, `PointLight`, `TextureLoader`, `DataTexture`, `Texture.matrix` | the formulas differ and were patched into the shader chunks (README choice 8) | done | 0 |
| More core, done in batch 2: Billboard, LOD, ClipPlane, IndexedTriangleSet, ElevationGrid, Extrusion, Anchor, Collision, StaticGroup, UnlitMaterial, PhysicalMaterial (fixture), Normal | 12 | **drawn**, fixtures pass vs X_ITE (Extrusion rides on the Hall reader's IndexedFaceSet; PhysicalMaterial is reference-only) | `Group`, `Material.clippingPlanes`, `Plane.applyMatrix4` | Billboard and LOD evaluate in `updateView()` every frame; ClipPlane needs `localClippingEnabled` and a world-space plane per frame | done | 0 |
| More core, still open: cube maps, MultiTexture, TextureProperties, Text, Inline, LineProperties, PointProperties | about 9 | `todo` | `CubeTexture`, `PMREMGenerator`, `Texture.matrix`, `Line2` for wide lines (examples) | per-group light scope (X3D `global=FALSE`; three.js has no per-light mesh list, a layers mask is the route), MultiTexture, a wide line is a different object | easy to moderate | 5 to 7 |
| 2D geometry, Rendering sets, CAD sets, lines, points (batch 2) | 19 | **drawn**, 19 fixtures; eleven needed no node-specific body code (seven run through the shared `geometry()` hook and four through `lines()`, each with one generic wrapper in the body) | `BufferGeometry`, `LineSegments`, `Points` | line width is 1 px on plain `Line` (same in X_ITE here) | done | 0 |
| Shaders: ComposedShader, PackagedShader, ProgramShader | 8 | `todo` | `ShaderMaterial` takes GLSL directly; X_ITE's shaders are GLSL ES 3.00 too. The Babylon port hand-wrote 26 WGSL programs | uniform and attribute name mapping (`x3d_*`) | easy to moderate, **easier than Babylon** | 4 to 6 |
| NURBS | 13 (7 `todo`, 6 `upstream`) | shared maths `src/nurbs.js` is engine-neutral | nothing on top of the maths | wait for the Babylon batches to land | easy once upstream exists | 2 |
| Navigation, picking, pointing and key sensors | about 15 | `todo` | `Raycaster`, DOM events, `controls` in `examples/jsm` | X3D types (WALK, FLY, LOOKAT, ANY), sensor drag maths already in the reader | moderate | 4 |
| Layering and Layout | 8 | `todo` | several cameras, `renderer.autoClear`, scissor and viewport | pixel-unit layout rules | moderate | 4 |
| HAnim | 6 | `todo` | `SkinnedMesh`, `Skeleton`, `Bone` | X3D skin weights are unlimited per vertex, three.js keeps 4 influences; same limit as Babylon | moderate | 4 to 5 |
| Text and FontStyle | 2 | `todo` | `TextGeometry` and font loaders (examples) | X_ITE draws with its own glyph renderer; layout rules (justify, spacing, maxExtent) are yours | moderate | 3 |
| Particle systems | 10 | 6 `reader`, 4 `todo` | `Points`, `InstancedMesh` | no built-in particle system; emitter and force models are in the reader | moderate to hard | 6 to 10 |
| Volume rendering, 3D textures | 13 `upstream`, 7 | waits for Babylon batch 43 | `Data3DTexture`, `RawShaderMaterial` | X_ITE's 400-slice rule (`WHY-volume-batch.md`) must be copied to match | hard | 8 to 12 |
| Rigid body physics, Geospatial, DIS | 14 + 11 + 6 | `todo` / `upstream` | nothing needed for physics (the reader owns it); body draws debug shapes only | wait for Babylon | easy for the body | 2 |

Total for the 95 `todo` nodes left after batch 2 (93 after batch 3; the rows are not re-summed, batch 3 took the texture, fog, background and camera rows): about **43 to 56 person-days** [S], the sum of the rows above (the scaffold's estimate was 45 to 65 for 119). Measured pace [C]: batch 1 drew 8 nodes, batch 2 drew 30 more by the tracker's count (27 new fixtures, the rest ride along; 11 nodes need no node-specific body code); the open nodes are the harder ones (shaders, layering, HAnim, particles, text, volume, picking). The 37 `upstream` nodes follow whatever the Babylon batches bring.

## 3. What three.js gives for free, and what it lacks [L: read from the three.js docs and examples; not every item run here]

Gives: a large loader and examples set (`GLTFLoader`, `KTX2Loader`, controls, `Line2`, `TextGeometry`, post-processing), a stable WebGL2 renderer, `ShaderMaterial` with GLSL, a physically based material with the glTF extensions (clearcoat, sheen, transmission, iridescence, anisotropy), tone mapping (Neutral, ACES, AgX), `PMREMGenerator` image-based light, and a very small core.
Lacks: an inspector and node-material editor (Babylon has both), a built-in particle system, per-light mesh lists, and a WebGPU path as settled as its WebGL2 one (`WebGPURenderer` with TSL exists; it does not take GLSL, so a shader bridge written for `ShaderMaterial` does not carry over to it) [S].

## 4. How the owner's 14 Nov fidelity ruling changes this

X_ITE lighting is a target, not a hard rule. In this scaffold:
- **Hard (X_ITE is the oracle):** every event, field and ROUTE assertion, silhouettes (IoU), geometry, camera framing. A disagreement fails the node.
- **Reference (measured, bounded, receipted):** lit colour. Bounds sit in each spec's `compare`; a quality choice that moves away from X_ITE is allowed when the spec says why (`lookNote`).
- **Where quality can beat X_ITE here:** tone mapping (`setTone`), image-based light, `MeshPhysicalMaterial` extensions, MSAA, shadows. None is on by default; the default is the classic Phong look, because it reproduces and is cheap to compare.
The numbers after batch 3: 82 compared pictures, silhouette IoU 0.90 to 1.00; PSNR 25.32 to 80.17 dB over the 59 that differ (median 50.73 dB), 23 pictures at 99 dB (identical or empty frames). Rig: Chromium 153.0.8010.12, SwiftShader, 320 x 240, X_ITE 16.6.0, three.js r187. These are software-GL numbers, not timings; no frame-rate claim is made.
