# Babylon.js speaking X3D

Date 2026-11-06. Status: spec section, docs only, no build.

Grades: **C** is measured here with the named instrument, **L** is read or reasoned from sources, **S** is suspected. For this section the instruments are `grep`, `ls` and `python3 -I` run on the unpacked npm tarballs (`@babylonjs/core` 9.35.0, `@babylonjs/loaders` 9.35.0, `x_ite` 16.7.0), on X3DUOM 4.1 from the Web3D SVN mirror, and on the glTF extension registry read raw from GitHub. Nothing was built or run in a browser.

**The answer.** The best route is a native one in two parts: a renderer-agnostic TypeScript X3D runtime that does the thinking (node classes generated from X3DUOM 4.1, which lists 267 concrete nodes in 37 components; three parsers; the 19775-1 event cascade; Script; an SAI shaped like X_ITE's), and a thin Babylon binding that does the drawing. The binding registers as a Babylon SceneLoader plugin and maps nodes one to one onto `TransformNode`, `Mesh`, `VertexData`, `PBRMaterial`, lights, cameras, `Skeleton` and `GaussianSplattingMesh`. glTF is not the core path. Babylon's own glTF loader takes over only where X3D already points at glTF (`Inline url='*.glb'`), and an optional export to glTF with `KHR_interactivity` can come later as an output. WebGPU then comes free with Babylon's `WebGPUEngine`, since its built-in materials ship as native WGSL, with one exception: X3D `ComposedShader` GLSL has to go through Babylon's GLSL-to-WGSL transpiler. Estimate: 17.5 to 32 person-weeks to cover the project's own scenes (M0 to M6), and 25.5 to 52 to reach roughly X_ITE's coverage (L).

## 1. Babylon.js today

| fact | value | source | grade |
|---|---|---|---|
| latest `@babylonjs/core` | 9.35.0, published 2026-11-06T19:55:58Z | registry.npmjs.org `.time` | C |
| latest `@babylonjs/loaders` | 9.35.0, published 2026-11-06T19:44:17Z | same | C |
| major line | 9.0.0 on 2026-03-26; 8.0.0 on 2025-03-27; 7.0.0 on 2024-03-28 (one major a year, in March) | same | C |
| cadence | 9.33.0 (10-29), 9.33.1 (10-29), 9.33.2 (11-02), 9.33.3 (11-05), 9.34.0 (11-05), 9.35.0 (11-06): six releases in nine days | same | C |
| license | Apache-2.0 (`license.md`); `NOTICE.md` lists the bundled third-party parts, among them Draco 1.5.6, the Basis transcoder and GLSLang | core tarball | C |
| size | 73.6 MB unpacked, 3,393 `.js` files in ES-module form with `*.pure.js` side-effect-free variants (bundle size after tree-shaking: not measured) | registry `unpackedSize`, `find` | C |
| WebGPU engine | `Engines/webgpuEngine.js`, `WebGPUEngine.IsSupportedAsync` (a getter: the sync `IsSupported` logs "You must call IsSupportedAsync"), `WebGPUEngine.CreateAsync(canvas, options)`, `_shaderPlatformName = "WEBGPU"` | `webgpuEngine.pure.js` lines 178 to 415 | C |
| native WGSL shader store | 523 files in `ShadersWGSL/` against 505 in `Shaders/` (GLSL); 338 files reference `ShadersStoreWGSL` and 141 `ShaderLanguage.WGSL`; `ShaderLanguage { GLSL = 0, WGSL = 1 }`; OpenPBR and Gaussian splatting both have WGSL shaders | `ls`, `grep -l` | C |
| GLSL-to-WGSL path | `initAsync(glslangOptions, twgslOptions)` loads glslang (GLSL to SPIR-V) and twgsl (Tint in WASM, SPIR-V to WGSL); by default twgsl comes from `${Tools._DefaultCdnUrl}/twgsl/twgsl.wasm` | `webgpuEngine.pure.js` 427 to 457, `webgpuTintWASM.js` 24 to 41 | C |
| what goes through the transpiler | built-in materials have WGSL ports and skip it; a `ShaderMaterial` written in GLSL (which is what an X3D `ComposedShader` becomes) runs only after the glslang and twgsl round trip | reasoned from the two rows above | L |
| also shipped | `FlowGraph/` (219 `.d.ts`), `Materials/PBR/openpbrMaterial`, `Meshes/GaussianSplatting/` with a WebGPU compute sorter, `Collisions/gpuPicker`, `Physics/v2`, `FrameGraph/`, `Materials/floatingOriginMatrixOverrides` | `ls` | C |
| WebGPU-first sibling | `@babylonjs/lite` 1.38.2 (2026-11-06, Apache-2.0, first published 2026-06-04): "a lightweight, tree-shakable, WebGPU-first rendering library derived from Babylon.js"; whether its API matches core's is unknown | registry | C for the metadata, S for fit |

For comparison, X_ITE 16.7.0's `dist/x_ite.js` contains 39 hits for `webgl2` and 0 for `webgpu` (C, `grep -o -i`). Babylon is the only mature, permissively licensed engine in reach that has both a retained scene graph and a shipping WebGPU backend (L).

## 2. The loader

### 2.1 Plugin API in 9.35.0 (C, `Loading/sceneLoader.d.ts`)

| name | shape |
|---|---|
| `RegisterSceneLoaderPlugin(plugin)` | module function (line 359); `SceneLoader.RegisterPlugin` remains as a static (line 526) |
| `ISceneLoaderPluginMetadata` | `name`, `extensions: string \| ISceneLoaderPluginExtensions`, `canDirectLoad?(data: string): boolean` |
| `ISceneLoaderPluginExtensions` | `{ [".ext"]: { isBinary: boolean; mimeType?: string } }` |
| `ISceneLoaderPluginFactory` | metadata plus `createPlugin(options: SceneLoaderPluginOptions)`, sync or async |
| `ISceneLoaderPluginAsync` | `importMeshAsync(meshesNames, scene, data, rootUrl, onProgress?, fileName?)`, `loadAsync(...)`, `loadAssetContainerAsync(...)`; base has `directLoad?(scene, data)` |
| `SceneLoaderPluginOptions` | `Record<string, Record<string, unknown> \| undefined>`, keyed by plugin name: this is how X3D options (script mode, profile check, a runtime callback) reach the plugin |
| entry points | `ImportMeshAsync(source, scene, options)`, `LoadSceneAsync`, `AppendSceneAsync`, `LoadAssetContainerAsync`, `ImportAnimationsAsync` |
| existing loaders | glTF, OBJ, STL, SPLAT, FBX, BVH, USD (`.usd .usda .usdc .usdz`) in `@babylonjs/loaders`; no X3D or VRML anywhere (the only `x3d` matches in core and loaders are `Matrix3D` names and one hash) |

An X3D plugin is a factory with `name: "x3d"` and extensions `.x3d` (text), `.x3dv` (text), `.x3dj` (text), `.x3dz` and `.x3dvz` (binary, gzip), and with `canDirectLoad` returning true for `<X3D`, `#X3D V` or a JSON `"X3D":` key, so that `data:` strings and pasted model output load without a file name (L).

### 2.2 Design A: convert X3D to glTF, then use Babylon's glTF loader

Babylon's glTF loader has 43 named `KHR_`/`EXT_`/`MSFT_` extension handlers, 32 of them `KHR_` (C, `ls glTF/2.0/Extensions`). The Khronos registry (main branch, read 2026-11-06) lists `KHR_interactivity`, `KHR_gaussian_splatting`, `KHR_animation_pointer`, `KHR_texture_transform`, `KHR_node_visibility`, `KHR_node_selectability`, `KHR_node_hoverability` and `EXT_mesh_gpu_instancing` as ratified (C).

| X3D feature | glTF carrier | survives? | grade |
|---|---|---|---|
| IndexedFaceSet, IndexedTriangleSet and the other polygon sets | mesh primitives (after triangulation and creaseAngle normals) | yes, but DEF/USE identity is lost | L |
| PhysicalMaterial | core metallic-roughness | yes: X3D 4.0 copied glTF's model | L |
| X_ITE material extensions (Clearcoat, Sheen, Iridescence, Transmission, Volume, IOR, Specular, Anisotropy, Dispersion, EmissiveStrength, DiffuseTransmission, VolumeScatter) | `KHR_materials_*` (all handled by Babylon) | yes | L |
| Material (Blinn-Phong), TwoSidedMaterial, backMaterial | none | approximated only | L |
| UnlitMaterial | `KHR_materials_unlit` | yes | L |
| TextureTransform | `KHR_texture_transform` | only when there is no rotation, or the scale is uniform (X3D rotates and then scales, KHR scales and then rotates, so the general case becomes a shear) | L |
| Directional, Point and Spot lights | `KHR_lights_punctual` | position and colour survive; `global=false` scoping, the three attenuation coefficients, `radius` and `ambientIntensity` are lost | L |
| EnvironmentLight (4.1) | `EXT_lights_image_based` (Babylon handles it) or `KHR_lights_environment` (X_ITE handles it; not on the ratified list) | partly | L |
| TimeSensor feeding an interpolator feeding a Transform | glTF animation, or `KHR_animation_pointer` for material fields | only if the route chain is fixed and always on | L |
| TouchSensor, Switch, a ROUTE graph | `KHR_interactivity` plus `KHR_node_selectability` and `KHR_node_visibility` | a subset; ProximitySensor, VisibilitySensor and the drag sensors have no blocks (see 3.3) | L |
| USE of a Shape under many Transforms | mesh reuse or `EXT_mesh_gpu_instancing` | yes, and instanced | L |
| Script, PROTO, Inline-as-live-node, bind stacks, NavigationInfo, Background sky gradient, Fog, Text, Sound, ParticleSystem, NURBS, Geospatial, Layering, Layout, H-Anim names and LOA, metadata | none (H-Anim joints become an anonymous glTF skin) | lost | L |
| GaussianSplats (4.1) | `KHR_gaussian_splatting` | yes, field for field (section 6) | C, both specs read |

**No tool does this conversion today.** X_ITE 16.7.0 reads glTF but has no glTF writer (C: no `toGLTF` or `GLTF2Writer` in `x_ite.js`), and `x3d-tidy` 3.2.2 writes X3D, VRML and JSON (L, its README). The converter would have to be written, and writing it costs about as much geometry work as a native mapping while keeping less. Design A is worth having only as an export (M8), never as the way in.

### 2.3 Design B: native node mapping (recommended)

| X3D | Babylon 9.35 | notes | grade |
|---|---|---|---|
| world axes | `scene.useRightHandedSystem = true` | X3D and glTF are both right-handed and Y-up; avoid the glTF loader's `__root__` flip node | L (property: C) |
| Transform, Group, Switch, Billboard, Collision, Anchor | `TransformNode`; Switch via `setEnabled`; Billboard via `billboardMode` with an axis | X3D transform order T·C·R·SR·S·(-SR)·(-C) becomes one local matrix | L |
| LOD | `Mesh.addLODLevel` or runtime selection | X3D ranges are distances from the centre | L |
| Shape | `Mesh` | `pointerEvents=false` becomes `isPickable=false`; `castShadow` becomes a shadow-caster list; `visible` becomes `isVisible` | L |
| USE of the same Shape | `createInstance` (`InstancedMesh`); X_ITE `InstancedShape` becomes thin instances (`thinInstanceSetBuffer`) | X_ITE draws once per USE (9,955 draws for 10,000 USE'd towers in the Collider study); Babylon batches instances, so this should be the largest single speed-up, to be measured | C for the X_ITE number, L for the gain |
| geometry nodes | `VertexData` (positions, normals, uvs, colors, custom attributes); Box, Sphere, Cone and Cylinder through `MeshBuilder` with X3D dimensions | concave polygons need a tessellator (X_ITE bundles libtess) | L |
| FloatVertexAttribute, Matrix3/4VertexAttribute | `mesh.setVerticesData(name, data, false, stride)` plus the `ShaderMaterial` attributes list | needed by the Collider | L |
| ComposedShader, ShaderPart, ProgramShader | `ShaderMaterial` (GLSL) with an X3D-uniform adapter (`x3d_ModelViewMatrix`, `x3d_Vertex`, ... onto Babylon's `world`, `view`, `position`) | on WebGPU it goes through glslang and twgsl; propose `language="WGSL"` as a project extension for the native path | L |
| X_ITE BlendMode and DepthMode | `material.alphaMode` (ALPHA_ADD and others), `disableDepthWrite` | the Collider's glow needs `depthMask='false'` | L |
| lights | `DirectionalLight`, `PointLight`, `SpotLight`; scoping (`global=false`, the default for DirectionalLight) via `light.includedOnlyMeshes`; `radius` via `range` | raise `maxSimultaneousLights` (default 4 in `pbrBaseMaterial.pure.js` line 585) | C for the names and the default, L for the mapping |
| Viewpoint, OrthoViewpoint | `UniversalCamera` / `TargetCamera`; ortho through `mode = ORTHOGRAPHIC_CAMERA` | X3D `fieldOfView` applies to the smaller screen side: switch `fovMode` between vertical and `FOVMODE_HORIZONTAL_FIXED` with the aspect ratio | L (constant: C) |
| NavigationInfo | EXAMINE becomes an orbit input; WALK and FLY become `UniversalCamera` with `ellipsoid` from `avatarSize`, gravity and collisions | the transition type and time are runtime logic | L |
| Background, TextureBackground | an inside-out sphere with a gradient shader; the six urls become a `CubeTexture` skybox | | L |
| Fog | `scene.fogMode` LINEAR or EXP | LocalFog needs a material plugin | L |
| Inline | `.x3d*` recurses into the runtime; `.glb`, `.gltf`, `.splat`, `.ply`, `.spz`, `.sog` go to Babylon's loaders into an `AssetContainer` parented under the Inline | a glTF with `KHR_interactivity` inside an X3D world then plays through FlowGraph at no cost | L |
| GeoLocation, SFVec3d, MFVec3d | floating origin (`floatingOriginMatrixOverrides`) | float32 GPU precision | L |

**Recommendation.** Use B everywhere and A only for Inline'd glTF assets and an optional export. Make the runtime the single source of truth, and keep the Babylon objects disposable views of it, rebuilt from dirty fields once per frame.

## 3. ROUTEs, the event cascade, Script and SAI

### 3.1 The frame loop (L, mapped from 19775-1 section 4.4.8)

| step, once per Babylon frame | hook | what the runtime does |
|---|---|---|
| 1. time | `scene.onBeforeRenderObservable` (or `onBeforeAnimationsObservable` when HAnimMotion uses Babylon AnimationGroups) | `now` = wall-clock seconds since 1970 (SFTime); one timestamp per frame |
| 2. sensors fire | queued `scene.onPointerObservable` events; camera pose | TimeSensor ticks (`fraction_changed`, `cycleTime`, `isActive`); TouchSensor, PlaneSensor, CylinderSensor, SphereSensor from the pick results; ProximitySensor (camera pose in the sensor's local box); VisibilitySensor (box against the frustum planes); KeySensor and StringSensor from DOM key events; Collision |
| 3. cascade | inside the runtime | breadth-first ROUTE propagation; each field sends at most one event per timestamp (loop breaking); fan-in order is undefined in the spec, so record X_ITE's order and match it; `prepareEvents` before, Script `eventsProcessed` after; `initialize()` on load and `shutdown()` on removal |
| 4. bind stacks | inside the runtime | Viewpoint, NavigationInfo, Background and Fog stacks (`set_bind` true pushes and false pops; `bindTime`, `isBound`); the transition is runtime-driven |
| 5. sync | dirty set | each changed field writes its Babylon property once (matrix, material colour, uniform, bone) |
| 6. render | Babylon | |

### 3.2 Picking

| need | Babylon path | grade |
|---|---|---|
| TouchSensor `hitPoint_changed`, `hitNormal_changed`, `hitTexCoord_changed` | synchronous `scene.pick` on pointer move: `pickedPoint`, `getNormal()`, `getTextureCoordinates()` | L |
| dense scenes (Collider tracks: 46% exact-track hits on 1-pixel lines in X_ITE) | `GPUPicker.pickAsync`, `multiPickAsync`, `boxPickAsync` (`enableDepthPicking`), a frame late, for hover and identity only | C for the names and the X_ITE number, L for the use |
| drag sensors | `scene.createPickingRay` intersected with the sensor plane, cylinder or sphere in the sensor's local frame | L |
| effect shapes that block picks | `isPickable=false` from `pointerEvents=false`; the trap X_ITE has with faint shapes stealing picks goes away on the CPU path (project note, 2 Nov) | S |

### 3.3 FlowGraph and KHR_interactivity: compile to them, or keep our own engine?

Babylon 9.35 ships FlowGraph, and the glTF loader registers `KHR_interactivity` (C: `NAME = "KHR_interactivity"` in `KHR_interactivity.pure.js`), which the registry now lists as ratified (C). The blocks it has (C, `ls FlowGraph/Blocks`) are these. Events: SceneReady, SceneTick, MeshPick, PointerDown, PointerUp, PointerMove, PointerOver, PointerOut, MeshIntersection, KeyDown, KeyUp, PhysicsCollision, Send/ReceiveCustomEvent, SoundEnded. Execution: Branch, Sequence, ForLoop, WhileLoop, FlipFlop, DoN, Counter, Throttle, Debounce, MultiGate, Switch, WaitAll, SetDelay, CancelDelay, SetProperty, SetVariable, Interpolation, Easing, BezierCurveEasing, Play/Pause/StopAnimation, physics and sound blocks. Data: GetProperty, the math and matrix blocks, CodeExecution.

**Keep a native X3D event engine** (L). Reasons:
- X3D is dataflow with timestamps and one event per field per timestamp, while FlowGraph is driven by execution signals.
- There are no blocks for ProximitySensor, VisibilitySensor, the drag sensors, bind stacks, PROTO or IS.
- The X3D `Script` with `directOutput` and dynamic `addRoute` cannot be expressed in KHR_interactivity, and CodeExecution is Babylon's own block, outside the Khronos spec.

Use FlowGraph twice instead: (a) for free, when an Inline'd glTF carries its own interactivity, and (b) as an export target for the subset of ROUTE graphs that fits (TimeSensor, interpolators, TouchSensor, Switch, BooleanFilter and the other EventUtilities), at M8.

### 3.4 Script and the SAI facade

| item | value | grade |
|---|---|---|
| how X_ITE runs Script source | `new Function` with `with (arguments [0]) ...` in `assets/components/ScriptingComponent.js`: the page realm, so the page CSP needs `'unsafe-eval'` | C (16.7.0 source) |
| SAI names to copy (from `x_ite.d.ts`) | `X3D.getBrowser(selector?)`, `browser.currentScene`, `createX3DFromString(x3dSyntax): Promise<X3DScene>`, `createX3DFromURL(url)` and `(url, node, fieldName)`, `getBrowserProperty`, `getBrowserOption`; the node form `addFieldCallback(key, name, callback)` with the key first, and the field form `addFieldCallback(key, callback)` | C (d.ts lines 33 to 201, 1656, 2205) |
| traps to keep in the facade | a throw escaping a host field callback froze all routing at the 13th event on X_ITE 16.5.1, so wrap every callback in try/catch; `set_bind` on a bound Viewpoint starts a one-second transition | C in the Collider study; S for the second (project note) |
| page CSP for the Babylon path | `'wasm-unsafe-eval'` if WebGPU must transpile GLSL (glslang and twgsl are WASM), and self-hosted copies of them or the Babylon CDN on the allow list | L |

Script modes, chosen per load through `pluginOptions.x3d.scripts`:

| mode | how | conformance | safety | use |
|---|---|---|---|---|
| `off` | Scripts parsed, never run; one diagnostic each | static only | total | thumbnails, validators |
| `sandbox` (default) | the Script runs in a QuickJS-in-WASM interpreter with a synchronous SAI shim, an instruction budget and no DOM | synchronous, so the cascade stays inside one timestamp | high: a written Script cannot touch the page, and a runaway loop is cut off and reported | model-written content, the tether |
| `page` | `new Function` as in X_ITE | full compatibility with X_ITE scripts that touch `window` | none: valid is not safe | trusted worlds |
| `worker` | a Web Worker with an asynchronous SAI | breaks the cascade, because events cross frames | high | not recommended |

The QuickJS route and its cost are L for the design and S for speed: a QuickJS npm build exists as far as we know, but none was opened here.

## 4. Materials and lighting

X3D 4.1 fields read from X3DUOM 4.1 (C). Babylon names checked in `pbrMaterial.pure.d.ts`, `pbrBaseMaterial.pure.d.ts` and `openpbrMaterial.pure.d.ts` (C for the names). The mapping itself is L.

### 4.1 PhysicalMaterial to PBRMaterial (or OpenPBRMaterial)

| X3D PhysicalMaterial (default) | PBRMaterial | OpenPBRMaterial | gap |
|---|---|---|---|
| baseColor (1 1 1), baseTexture | `albedoColor` (linear), `albedoTexture` (sRGB) | `baseColor`, `baseColorTexture` | none |
| metallic (1), roughness (1) | `metallic`, `roughness` | `baseMetalness`, `specularRoughness` | none |
| metallicRoughnessTexture | `metallicTexture` with `useRoughnessFromMetallicTextureGreen` and blue as metal | n/a | glTF channel layout, same as X3D |
| occlusionTexture, occlusionStrength (1) | `ambientTexture`, `ambientTextureStrength` (or `useAmbientOcclusionFromMetallicTextureRed`) | `ambientOcclusionTexture` | none |
| normalTexture, normalScale (1) | `bumpTexture`, `bumpTexture.level` | `geometryNormalTexture` | tangents: generate them (X_ITE does it in WASM) |
| emissiveColor (0 0 0), emissiveTexture | `emissiveColor`, `emissiveTexture` | `emissionColor`, `emissionLuminance` | X_ITE's EmissiveStrength extension maps to `emissiveIntensity` |
| transparency (0) | `alpha = 1 - transparency` | `geometryOpacity` | inverted sense |
| Appearance alphaMode (AUTO, OPAQUE, MASK, BLEND), alphaCutoff (0.5) | `transparencyMode` (OPAQUE, ALPHATEST, ALPHABLEND), `alphaCutOff` | same | AUTO needs a rule: the X_ITE behaviour, recorded |
| `*TextureMapping` (string) | texture `coordinatesIndex` (which UV set) | same | the runtime resolves the name to an index |
| X_ITE extensions (Clearcoat, Sheen, Iridescence, Anisotropy, Transmission, Volume, IOR, Specular, Dispersion, DiffuseTransmission, VolumeScatter) | `clearCoat`, `sheen`, `iridescence`, `anisotropy`, `subSurface`, `indexOfRefraction`, `metallicReflectance...` | OpenPBR's coat, fuzz and the rest | X_ITE-only nodes (its own X3DUOM lists 32), outside the 4.1 standard |

### 4.2 Material (Blinn-Phong), UnlitMaterial, TwoSidedMaterial

| X3D | Babylon | gap |
|---|---|---|
| Material diffuseColor (0.8), diffuseTexture | `StandardMaterial.diffuseColor`, `diffuseTexture` | none |
| specularColor (0), shininess (0.2), specularTexture, shininessTexture | `specularColor`, `specularPower = shininess × 128`, `specularTexture`; no shininess map (`useGlossinessFromSpecularMapAlpha` reads alpha) | a shininess map needs packing or a plugin |
| ambientIntensity (0.2), ambientTexture | `ambientColor = ambientIntensity × diffuseColor`, with `scene.ambientColor` set to the sum of the lights' `color × ambientIntensity` | X3D ambient is per light, Babylon's is per scene; exact only with a material plugin |
| occlusionTexture, occlusionStrength | `ambientTexture` (shared with the slot above) | X3D has both slots and Standard has one |
| emissiveColor, emissiveTexture, normalTexture, normalScale, transparency | `emissiveColor`, `emissiveTexture`, `bumpTexture` with `level`, `alpha` | none |
| UnlitMaterial emissiveColor (1 1 1), emissiveTexture, transparency | `PBRMaterial.unlit = true` with `albedoColor`, or `StandardMaterial.disableLighting` | none |
| TwoSidedMaterial (separateBackColor, back*) and Appearance.backMaterial (4.0) | `backFaceCulling=false`, `twoSidedLighting=true` when the two sides match | separate back colours need two submeshes with opposite culling |

### 4.3 Lighting equations and colour

| topic | X3D 4.x | Babylon | to match X_ITE | grade |
|---|---|---|---|---|
| attenuation | `1 / max(a0 + a1·r + a2·r², 1)`, zero beyond `radius` | falloff types (standard, physical, glTF); no three-coefficient form | a material plugin replaces the falloff function | L |
| spot cone | linear in angle between `beamWidth` and `cutOffAngle` | `angle` with `exponent`, plus an inner angle for glTF falloff, which is linear in cosine | plugin, or accept a small difference | L |
| shininess | exponent = shininess × 128 | `specularPower` | direct | L |
| headlight | NavigationInfo `headlight` (default true) | a DirectionalLight parented to the camera | runtime | L |
| colour space | X_ITE has a `ColorSpace` option whose value `LINEAR_WHEN_PHYSICAL_MATERIAL` is in 16.7.0, and `ToneMapping` and `OrderIndependentTransparency` options | PBR is linear with image processing on output; Standard lights in gamma space; tone mapping via `imageProcessingConfiguration`; depth peeling via `thinDepthPeelingRenderer` | copy X_ITE's mode per world, or pixel parity is impossible | C for the X_ITE strings, S for their exact meaning |
| TextureTransform (center, rotation, scale, translation) | `-C × S × R × C × T` | Texture `uOffset`, `vOffset`, `uScale`, `vScale`, `wAng` and rotation centres, in Babylon's own order | subclass `Texture` and override `getTextureMatrix()` with the X3D matrix: exact and cheap | L |

### 4.4 EnvironmentLight (4.1) and image-based lighting

| X3D EnvironmentLight (C, X3DUOM 4.1) | Babylon | gap |
|---|---|---|
| specularTexture (a cube map node) | `scene.environmentTexture` (a prefiltered `CubeTexture`, `.env` or HDR) | the cube must be prefiltered (Babylon can do it at load time) |
| diffuseCoefficients (MFFloat, SH) | the environment texture's `sphericalPolynomial` / SH | set directly from the coefficients |
| intensity, color | `environmentIntensity`; colour has no direct field | tint through a plugin |
| rotation (SFRotation), origin | the reflection texture matrix (full rotation), with `rotationY` as the easy case | none |
| global (true), on, shadows | `global=false` becomes a per-material `reflectionTexture` | none |

## 5. H-Anim

X3D 4.1 fields from X3DUOM 4.1 (C). Babylon names checked: `numBoneInfluencers` (default 4, "number of allowed bone influences per vertex"), `MatricesIndicesExtraKind` and `MatricesWeightsExtraKind` (for 8 influences), `computeBonesUsingShaders` (default true) (C, `abstractMesh.pure.d.ts`, `buffer.pure.d.ts`). The mapping is L.

| X3D | Babylon | notes |
|---|---|---|
| HAnimHumanoid (`skeletalConfiguration` BASIC, `loa`, `version`, `jointBindingPositions/Rotations/Scales`, `skinBindingCoords/Normals`, `skinCoord`, `skinNormal`, `skin`, `joints`, `segments`, `sites`, `viewpoints`, `motions`, `motionsEnabled`) | root `TransformNode` with a `Skeleton`; `skin` Shapes become `Mesh` objects with the skeleton set | the binding fields (4.0) give the inverse bind matrices |
| HAnimJoint (`center`, `rotation`, `translation`, `scale`, `scaleOrientation`, `llimit`, `ulimit`, `limitOrientation`, `stiffness`, `skinCoordIndex`, `skinCoordWeight`, `displacers`) | `Bone(name, skeleton, parent, localMatrix, restPose)` with the X3D transform order | limits and stiffness become metadata for IK |
| joint-centric `skinCoordIndex` and `skinCoordWeight` | vertex-centric `MatricesIndices` and `MatricesWeights` (4), plus `...Extra` (8) | invert the lists; keep the top 8 per vertex, renormalise, and report each vertex trimmed as a mapping loss |
| HAnimSegment (`mass`, `centerOfMass`, `momentsOfInertia`, `coord`) | `TransformNode.attachToBone` | segment geometry is rigid; physics data goes to metadata |
| HAnimSite | `TransformNode` attached to a bone | end effectors and site viewpoints |
| HAnimDisplacer (`coordIndex`, `displacements`, `weight`) | `MorphTarget` in a `MorphTargetManager`, influence = weight | sparse to dense deltas |
| HAnimMotion (4.0: `channels`, `values`, `frameDuration`, `frameIndex`, `loop`, `joints`, `loa`) | `AnimationGroup` with one animation per bone, or runtime playback | the channels are BVH-like, and Babylon's loaders ship a BVH reader to borrow from |
| HAnimPose (4.1: `commencePose`, `resetAllJoints`, `transitionDuration`, `set_fraction`, `loa`) | runtime blend to a target pose with `bone.setRotationQuaternion` | a 4.1 CD node, so it may change |
| interpolators routed to joint rotations (classic H-Anim) | the event engine writes bones each frame | GPU skinning by default |

The project's validator (the x3d_mcp fork) checks H-Anim joint and segment names (`l_wrist`, `r_ankle` style) since its 30 Oct merge (S, project note). Because names are kept as Babylon bone names, a humanoid that passes the validator can be retargeted onto glTF or VRM skeletons by name. A per-LOA joint-set check belongs in the validator, not the loader (L).

## 6. Gaussian splats

| X3D 4.1 GaussianSplats (C, X3DUOM 4.1 generated 2026-10-31; X_ITE 16.7.0 `GaussianSplatsComponent.js` has the same list) | KHR_gaussian_splatting (C, ratified) | Babylon 9.35 (C, names) |
|---|---|---|
| `positions` MFVec3f | POSITION | splat centres |
| `orientations` MFQuaternion | `KHR_gaussian_splatting:ROTATION` VEC4 | rotation |
| `scales` MFVec3f | `:SCALE` VEC3 | scale |
| `opacities` MFFloat | `:OPACITY` | alpha |
| `sphericalHarmonicsDegree0Coef0` to `Degree3Coef6` (16 MFVec3f: 1 + 3 + 5 + 7) | `:SH_DEGREE_l_COEF_k` VEC3 float32 | `shDegree` 0 to 3 ("1 = 3 parameters, 2 = 8, 3 = 15"), `maxShDegree` |
| `colorSpace` (`SRGB_REC709_DISPLAY`) | `colorSpace` `srgb_rec709_display` or `lin_rec709_display`, plus `kernel` "ellipse" and an optional `projection` | colour handling in the splat shader |
| `castShadow`, `pointerEvents`, `visible`, bbox; component GaussianSplats level 1, containerField `children` | n/a | `GaussianSplattingGpuPickingMaterialPlugin` for picking |

Babylon's side (C, `ls` and `d.ts`):
- The `SPLAT` loader reads `.splat`, `.ply`, `.spz`, `.sog` and SOG `.json`.
- The glTF loader reads `KHR_gaussian_splatting` and `KHR_gaussian_splatting_compression_spz`.
- Sorting runs in a worker (`gaussianSplattingSortWorker`), and a compute sorter (`GaussianSplattingGpuSorter`, constructed with a `WebGPUEngine`) runs on WebGPU.
- Streaming and residency classes ship (`gaussianSplattingStream`, `...ResidencyController`), and `GaussianSplattingCompoundMesh` sorts many parts together.
- Data goes in through `updateData(data: ArrayBuffer, sh?: Uint8Array[], options?, partIndices?, shDegree?)` and `updateDataAsync`.

The mapping (L): pack the X3D arrays into Babylon's splat buffer and the SH arrays into its SH textures. Put every GaussianSplats node of a world into one compound mesh, so that splats sort against each other across Transforms.

The gaps: Babylon quantises SH to bytes (`Uint8Array[]`) where X3D has float32 (L); `lin_rec709_display` handling is unchecked (S); and a large splat set written inline is impractical (one million splats at degree 3 is about 59 million numbers of text), so real worlds should Inline a `.spz` or a glTF, both of which Babylon already reads (L).

## 7. Reuse X_ITE, or write our own?

| question | finding | grade |
|---|---|---|
| X_ITE licence | 16.7.0 `package.json` says MIT, as do `LICENSE.md` ("Copyright (c) 2009 Holger Seelig and other contributors") and the README | C |
| the catch | `LICENSES/` also ships `Apache-2.0.txt`, `CC-BY-4.0.txt`, `CC-BY-NC-4.0.txt`, `CC0-1.0.txt` and `MIT.txt`; the tarball does not say which files the non-commercial licence covers (no REUSE file; `REUSE.toml` on raw GitHub main returns 404) | C; which files: open |
| MIT code inside an Apache-2.0 package | compatible; keep the MIT notice; leave out any non-commercial asset (fonts, images, hatching, linetype under `dist/assets`) until it is cleared | L |
| size | `x_ite.js` 2.90 MB, `x_ite.min.js` 1.31 MB, and 23 components loaded lazily from `dist/assets/components` | C |
| the parsers | webpack modules inside the bundle: `XMLParser`, `VRMLParser` (with `Grammar`, 121 refs), `JSONParser`, `GLTF2Parser`, `GLBParser`, `OBJParser`, `STLAParser`, `STLBParser`, `PLYAParser`, `PLYBParser`, `SVGParser`, `X3DOptimizer`, `libtess` | C (module names) |
| can they be separated? | not cleanly: they build X_ITE execution contexts and fields; vendoring the VRML grammar and libtess with attribution is the realistic reuse | L |
| headless brain | `x_ite-node` 2.3.2 (MIT) runs X_ITE in Node on `jsdom`, `nogl` and `skia-canvas`: usable on the build side and in tests | C (deps) |
| X_ITE as brain, Babylon as body | prototype in weeks: X_ITE gives correct events and about 95% node coverage, and a mirror copies its nodes into Babylon through `addFieldCallback`. Against it: two scene graphs and twice the memory, X_ITE's own WebGL work (or a `nogl` stub in the page), thousands of callbacks, X_ITE internals that change with weekly releases (six from 10-05 to 10-31), and its page-realm Script | L |
| X3DUOM for code generation | 4.1: 267 concrete nodes, 73 abstract node types, 7 abstract object types, 17 statements, 37 components (Interpolation 13, Followers 14, Sound 21, Rendering 16, HAnim 7, GaussianSplats 1). 4.0: 260, 72 and 36. X_ITE's own `dist/X3DUOM.xml` is an extension file of 32 nodes (BlendMode, DepthMode, InstancedShape, 13 material extensions and others) | C (`python3 -I` on the XML) |
| other tooling | X3D JSON schema (4.0) for `.x3dj`, and `x3d.py` (PyPI) for build-side normalisation; neither opened here | S |

**Verdict** (L): generate our own node layer from X3DUOM 4.1 plus X_ITE's extension file, and write our own XML and JSON readers, which are small. Port the ClassicVRML grammar and libtess from X_ITE under MIT with attribution. Use X_ITE as the oracle rather than the engine: `x_ite-node` produces reference event traces and `toXMLString` round trips in tests, and X_ITE in a browser produces reference frames. Use "X_ITE as brain" only for a two-week spike, if a demo is needed before M2.

## 8. Prior art

| what | finding | grade |
|---|---|---|
| X3D or VRML in Babylon itself | none in core or loaders 9.35.0 | C (grep) |
| npm | searches for `babylon x3d` (715 hits, top 50 read) and `x3d` (55) found no Babylon X3D loader. `3d-file-parsers` 1.0.0 (2026-03-25, MIT) has `parseX3D` for IndexedFaceSet, IndexedTriangleSet and Box with material colours, returning typed arrays "for Babylon.js": geometry only. `three-x3d-loader` 0.4.0 (2017) targets three.js | C (registry search API, 2026-11-06) |
| the names | `babylon-x3d`, `babylonjs-x3d`, `x3d-babylon` and `x3d-runtime` are all unregistered (HTTP 404) | C |
| a 2021 converter | Andreas Plesch, "taste of X3D-BabylonJS converter/viewer", x3d-public, December 2021, with an Observable notebook "x3d to bjs": it builds a Babylon scene from X3D shapes and serialises it to Babylon's JSON; no events; DEF/USE needed post-processing (needs hand fetch: web3d.org pipermail, observablehq.com/@andreasplesch/x3d-to-bjs) | S |
| Babylon forum | "Virtual Worlds - from VRML to BabylonJS" and "Import .wrl or VRML 97 mesh": no native support; the routes offered go through Castle, MeshLab and Blender to OBJ or glTF (needs hand fetch: forum.babylonjs.com) | S |
| loader-plus-runtime pattern on Babylon | `babylon-mmd` 1.3.0 (MIT, "babylon.js mmd loader and runtime", peer `@babylonjs/core ^9.15.0`) is the structural model, a format loader plus its own runtime; `babylon-vrm-loader` 2.0.0 (2023) extends glTF instead | C (registry) |
| X3DOM, Castle | X3DOM maps the X3D DOM onto its own WebGL renderer, with no release since 2023-08, and is the model for HTML embedding; Castle Game Engine uses X3D nodes as its scene graph with its own renderer, which is the model for "runtime as truth" | S (project notes) |

## 9. Recommended architecture

```
  author (a hosted model or a person)
        |  .x3d  .x3dv  .x3dj  (.x3dz .x3dvz gzip)
        v
  +-- THE TETHER (before the browser) ----------------------------------------+
  | validator: x3d_mcp fork (schema, ROUTE order and scope, colour range,     |
  | H-Anim names) + kit/loom grammar and traps --> stable codes --> repair    |
  +---------------------------------------------------------------------------+
        |  valid file
        v
  x3d-runtime  (TypeScript, renderer-agnostic, no Babylon import)
    parsers  XML | ClassicVRML | JSON  -->  one tree  -->  nodes generated from X3DUOM 4.1 (+ X_ITE ext)
    PROTO / EXTERNPROTO / IS, Inline, IMPORT / EXPORT, DEF / USE identity
    event engine: timestamps, cascade, loop breaking, initialize / shutdown
    TimeSensor, 13 interpolators, followers, sensor logic, 4 bind stacks
    Script host: off | sandbox (QuickJS WASM, default) | page
    SAI facade: X3D.getBrowser, currentScene, createX3DFromString, addFieldCallback(key, ...)
    receipt: every node mapped | approximated (code, reason) | dropped (code)
        |  dirty fields, once per frame                 ^ pointer, keys, camera pose
        v                                               |
  babylon-x3d  (binding, peer @babylonjs/core ^9)
    RegisterSceneLoaderPlugin({ name: "x3d", extensions, canDirectLoad, createPlugin })
    mappers: TransformNode | Mesh + InstancedMesh / thin instances | VertexData
             StandardMaterial | PBRMaterial (+ plugins: X3D falloff, ambient, TextureTransform)
             lights (includedOnlyMeshes scoping) | cameras (fovMode) | Background dome | Fog
             ShaderMaterial (GLSL adapter; WGSL extension) | Skeleton / Bone / MorphTarget
             GaussianSplattingMesh (compound)
    Inline *.glb *.gltf *.spz *.ply *.sog --> Babylon's own loaders (43 glTF extensions, FlowGraph)
    frame hook: scene.onBeforeRenderObservable --> runtime.tick(now)
        |
        v
  Engine (WebGL2)   or   WebGPUEngine (built-ins in WGSL; ComposedShader GLSL via glslang + twgsl)
        |
        v
  THE WITNESS (after the browser): frames + pixel statistics vs X_ITE on named scenes,
  event traces vs x_ite-node, the receipt.  Valid is not the same as visible.
```

**API surface (L):**

```ts
import { Engine, WebGPUEngine, Scene, ImportMeshAsync } from "@babylonjs/core";
import { registerX3D } from "babylon-x3d";

const engine = (await WebGPUEngine.IsSupportedAsync)
  ? await WebGPUEngine.CreateAsync(canvas) : new Engine(canvas, true);
const scene = new Scene(engine);
registerX3D();                                    // one RegisterSceneLoaderPlugin call
let rt;
await ImportMeshAsync("worlds/hall.x3d", scene, {
  pluginOptions: { x3d: { scripts: "sandbox", onRuntime: (r) => (rt = r) } } });
const browser = rt.browser;                       // X_ITE-shaped SAI
browser.currentScene.getNamedNode("Door")
       .addFieldCallback("k", "isActive", (v) => { /* page code */ });
const scene2 = await browser.createX3DFromString("<X3D>...</X3D>");
console.log(rt.receipt());                        // mapped / approximated / dropped, with codes
```

Five rules for the design:
1. The runtime owns the truth, and Babylon objects are views of it.
2. Every lossy mapping emits a stable code into the receipt, so a model is told exactly what did not become visible.
3. The default Script mode is the sandbox.
4. The binding imports only `@babylonjs/core` ES modules, so tree-shaking works and `@babylonjs/lite` stays a possible second body.
5. WebGPU is one line at engine creation; nothing in the binding depends on which engine runs.

## 10. Effort

Person-weeks for one engineer experienced in TypeScript and real-time graphics. Grade L throughout: reasoned from node counts and from the Collider and Loomsong experience, with nothing built yet.

| milestone | scope | person-weeks | gate |
|---|---|---|---|
| M0 skeleton | codegen from X3DUOM 4.1 plus X_ITE's extension (fields, defaults, access types, containerField); XML, JSON and ClassicVRML readers; DEF/USE; the receipt format | 1.5 to 3 | the three encodings of each test world give identical trees; the project's own worlds parse with 0 unknown nodes; tree diff against `x_ite-node` `toXMLString` |
| M1 static body | Shape, Appearance, the four materials, ImageTexture, TextureTransform, the polygon sets (creaseAngle, tessellation), primitives, LineSet, PointSet, grouping, LOD, Switch, Billboard, Inline (X3D and glTF), lights with scoping, one Viewpoint, NavigationInfo examine and walk, Background, Fog | 4 to 6 | pixel parity with X_ITE 16.7.0 on 12 named static scenes (mean abs. difference at most 4/255, luma within 0.01) on both Engine and WebGPUEngine |
| M2 events and time | ROUTE, the cascade, TimeSensor, 13 interpolators, 7 EventUtilities, the four bind stacks, transitions | 2 to 4 | event traces equal to `x_ite-node` on 10 animated worlds; cascade unit tests from 19775-1 section 4.4.8 |
| M3 sensors and navigation | Touch, Plane, Cylinder and Sphere sensors; Key and String sensors; Proximity, Visibility and Transform sensors; Anchor; Collision; walk and fly | 2 to 4 | recorded pointer tapes (as with `kit/loom play`) give the same sensor event sequences as X_ITE |
| M4 Script, SAI, PROTO | Script with sandbox, page and off modes; the SAI facade; PROTO, EXTERNPROTO, IMPORT and EXPORT; dynamic routes | 3 to 6 | the platformer and drift pages and a Loomsong world run unchanged on the facade; the sandbox stops a runaway loop and reports it |
| M5 shaders and the Collider | ComposedShader GLSL adapter, vertex attributes, BlendMode, DepthMode, InstancedShape as thin instances, the WGSL extension | 2 to 4 | the Collider dijet hero (456 tracks, 168 towers, 2,399 needles) and pile-up 24 (8,855 tracks, 9 programs) load with 0 errors on both engines; pixel statistics within tolerance of the look v3 frames; load time, draws and frame time recorded on a real GPU (never software GL) |
| M6 PBR extras, IBL, H-Anim, splats | X_ITE material extensions, EnvironmentLight, HAnim (skin, displacers, motion, pose), GaussianSplats | 3 to 5 | zinc-finger look v2 scenes at parity; a posed LOA-1 humanoid within 1e-4 m of X_ITE's skinned vertices; a splat world against X_ITE frames |
| M7 the long tail | Text, Sound, ParticleSystems, NURBS, Geospatial, Layering, Layout, Followers, RigidBodyPhysics (Havok), CAD, VolumeRendering, Texturing3D, Picking | 8 to 20 | a conformance subset of the Web3D example archives through the SVN mirror, counted node by node |
| M8 export (optional) | static subset to glTF, ROUTE subset to `KHR_interactivity` | 2 to 4 | round trip into Babylon's own glTF loader at pixel parity |
| **total** | M0 to M6: the project's scenes. M0 to M7: roughly X_ITE's coverage | **17.5 to 32**; **25.5 to 52** with M7 (M8 extra) | |

| risk | why | mitigation | grade |
|---|---|---|---|
| lighting parity | Babylon's PBR and IBL prefiltering differ from X_ITE's; X3D attenuation, spot falloff and per-light ambient have no Babylon equivalent | material plugins, a matched colour-space mode, parity measured per scene | L |
| GLSL on WebGPU | ComposedShader GLSL must survive glslang and twgsl, and Babylon's WebGPU uniform layout | the adapter, a `language="WGSL"` extension, and testing the Collider shaders first | S |
| dynamic worlds | `createX3DFromString`, `addRoute` and PROTO instances arrive at run time | the binding is incremental (add and dispose per node) from M1 | L |
| moving targets | Babylon released six times in nine days; X_ITE weekly; X3D 4.1 is still a CD (X3DUOM's URLs point to `ISO-IEC19775-1v4.1-CD`) | pin versions, track the SAI against X_ITE releases, generate code again on each X3DUOM update | C for the cadence and the CD |
| Script safety | page-realm Script is arbitrary JavaScript | the sandbox by default; `page` only by explicit choice | C for X_ITE's method, L for the fix |
| sync cost | per-field writes on large animated worlds | a dirty set flushed once per frame; merged geometry stays the authoring rule | L |

## 11. Open questions

1. Which X_ITE 16.7.0 files does `CC-BY-NC-4.0` cover? This needs a hand look at the X_ITE repository's licensing map (the GitHub pages are blocked here).
2. Does Babylon's WebGPU GLSL path accept X3D-style GLSL ES 3.0 with free uniforms, or does it need Babylon's uniform-block conventions? Test with the Collider's nine programs.
3. What fan-in and Script ordering does X_ITE use within one timestamp? Record it with `x_ite-node` traces so that "matches X_ITE" has one meaning.
4. What exactly does X_ITE's `LINEAR_WHEN_PHYSICAL_MATERIAL` mean, and is it the default? Read the source before writing the colour plugin.
5. Should `language="WGSL"` for ShaderPart go to the Web3D working group as a proposal?
6. QuickJS sandbox speed for the project's Script-heavy pages: measure before making it the default.
7. Is `@babylonjs/lite` API-compatible enough to be a second body?
8. Package home and scope: `babylon-x3d` and `x3d-runtime` are free on npm today; publishing is the owner's call.

## Sources

| source | how it was read | used for |
|---|---|---|
| registry.npmjs.org `@babylonjs/core`, `@babylonjs/loaders`, `@babylonjs/gui`, `babylonjs`, `@babylonjs/lite`, `x_ite`, `x_ite-node`, `x3d-tidy`, `babylon-mmd`, `3d-file-parsers` | package JSON with `curl`, parsed with `python3 -I` | versions, dates, licences, dependencies |
| `@babylonjs/core` 9.35.0 tarball | downloaded and unpacked, never executed; `grep`, `ls`, `sed` on `Engines/`, `Loading/`, `Materials/`, `Meshes/GaussianSplatting/`, `FlowGraph/`, `Collisions/`, `ShadersWGSL/` | sections 1 to 6 |
| `@babylonjs/loaders` 9.35.0 tarball | same; `glTF/2.0/Extensions/`, `SPLAT/`, `USD/`, metadata files | extensions, splat formats, KHR_interactivity |
| `x_ite` 16.7.0 tarball | same; `LICENSE.md`, `LICENSES/`, `README.md`, `dist/x_ite.js`, `dist/x_ite.d.ts`, `dist/X3DUOM.xml`, `dist/assets/components/*.js` | licence, parsers, SAI, splat fields, Script method, WebGPU absence |
| X3DUOM 4.1 and 4.0 | Web3D SVN mirror on SourceForge (`specifications/X3dUnifiedObjectModel-4.1.xml?format=raw`, generated 2026-10-31), parsed with `python3 -I` | node and component counts, field lists |
| glTF extension registry and the READMEs of `KHR_gaussian_splatting` and `KHR_animation_pointer` | raw.githubusercontent.com, KhronosGroup/glTF main, 2026-11-06 | ratified list, splat attributes |
| npm search API (`babylon x3d`, `x3d`, `babylonjs vrml`, `keywords:x3d`) and name probes | `curl`, parsed with `python3 -I` | prior art, free names |
| web search (Plesch 2021 posts and notebook; Babylon forum VRML threads; KHR status news) | a server-side search tool; paraphrase only | prior art (S), needs hand fetch |
| this repository: `docs/COLLIDER-XITE-FEASIBILITY.md`, `COLLIDER.md` | read | X_ITE draw, picking and freeze numbers; the stress scene |
| project notes (private): X_ITE SAI and picking (2 Nov), validator upgrades (30 Oct), ecosystem state (Oct) | read | traps, the H-Anim name check, X3DOM and Castle status (S) |
