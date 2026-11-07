# X3D scenes on WebGPU: First Light and the Collider

Date 2026-11-07. Status: **working demos, not the runtime the spec describes.** Each page is one self-contained file that reads an X3D 4.0 scene, runs its events and draws it with WebGPU. They exist to show what the owner's machine does with WebGPU today (gate G1 passed there), before any of the build in [../SPEC.md](../SPEC.md) starts. X_ITE stays the reference renderer; neither page is a parity witness.

| file | what it is |
|---|---|
| [collider-v2.html](collider-v2.html) | **the showpiece, v2**: the Collider with an outside pass folded in (studio-lit glass, flash diffraction, grades, quality tiers, captioned PNG export); see [Collider v2](#collider-v2) |
| [collider.html](collider.html) | the Collider V1: the look v3 collider dijet event, its five GLSL shaders ported to WGSL, with an A/B between the authored look and HDR + bloom |
| [collider.x3d](collider.x3d) | the scene it embeds: 2,195,797 bytes, sha256 `59dfeb32e9efefebfcae2c8a716e7805e3858a06688cf74f47688345719ca400`, the same bytes as `docs/scenes/dijet.xml` in `hagopjay/dirac` and as `runs/hep-demo-v3-20261106/scenes.sha256` |
| [first-light-v1.1.html](first-light-v1.1.html) | First Light on the v1.1 core (the click fix and the review fixes below) |
| [first-light.html](first-light.html) | First Light V1, kept unchanged |
| [first-light.x3d](first-light.x3d) | the First Light scene (both First Light pages embed this text) |
| [src/](src/) | `viewer.tpl.html` and `build.py` rebuild `collider.html` and `first-light-v1.1.html` byte for byte; `viewer-v2.tpl.html` and `build-v2.py` rebuild `collider-v2.html` byte for byte |

## How to open them

Download the `.html` file and open it in Chrome or Edge 113 or later (file:// works; the G1 probe ran that way). No server, no network, no libraries. If WebGPU is missing the page says why instead of drawing.

Drag to orbit, scroll or pinch to zoom. Every page: Space pauses, R resets the view, S opens the X3D source, H hides the panels. The source panel is editable: change a value or a ROUTE, press Apply, and the page parses it again; a malformed edit is refused with the parser's message and the old scene keeps running.

## Splats (Pantheon port)

`src/viewer-v3.tpl.html` is the v2 core plus the X3D 4.1 draft `GaussianSplats` node: a GPU bitonic depth sort and quads that follow X_ITE 16.4.3's splat shader. `python3 -I src/build-v3.py SCENE.x3d OUT.html` builds a page from any X3D 4.1 file with a `GaussianSplats` node. This repository holds one splat scene, [splat-test.x3d](splat-test.x3d) (6,100 procedural splats, CC0, made by `src/gen-splat-test.py`). The Pantheon page was built from a separate 50,058-splat scene and matches X_ITE 16.4.3 at 50.2 and 51.0 dB on two views; see [the receipt](../../runs/webgpu-pantheon-splats-20261107/RECEIPT.md). Not drawn yet: spherical-harmonic degrees above 0 and `Inline url` splat files.

## Neural Canvas on Babylon WebGPU (the brain port)

Port #2 from the port map. The Brain Loom page ([x3d.brain/page](../../x3d.brain/page/README.md), "Neural Canvas") with its own HUD, data and scenes, drawn by [Babylon.js](https://www.babylonjs.com) 9.32.0 in WebGPU mode instead of X_ITE. **Babylon is the body, our own X3D reader is the brain**: the reader parses the scene, runs the TimeSensors, interpolators and ROUTEs, and keeps the node tree; a Babylon body turns that tree into meshes, materials and lights. The page's `app.js` is not edited. It calls `X3D.getBrowser()` and the scene access interface (SAI) as it does for X_ITE, and a small shim answers those calls from the reader. X_ITE 16.6.0 stays the reference renderer; this is not a parity witness.

```sh
sh x3d.brain/tools/fetch_xite.sh            # only for the X_ITE reference pages in the receipt
python3 -I x3d.webgpu/demo/src/build-brain.py --page x3d.brain/page --out /tmp/neural-webgpu.html
python3 -m http.server -d x3d.brain/page 8000   # copy the built file into that folder first, then open it over http
```

`--single` inlines the page's `data/` and `scenes/` into one file for private hosting. The built page is **not committed**: it embeds the lite cortex scene, whose source licence is graded Suspected in [NOTICE-BRAIN-DATA.md](../../x3d.brain/page/NOTICE-BRAIN-DATA.md). The page loads Babylon from the CDN at the exact version above with a subresource-integrity hash. Chrome or Edge 113 or later; without WebGPU the page says so and draws nothing.

| file | role |
|---|---|
| [src/brain/reader.js](src/brain/reader.js) | parser, node field tables, ROUTE and event model, TimeSensor, the interpolators (the v3 core, extended with Text, FontStyle, ImageTexture, IndexedLineSet, LineProperties, ClipPlane, ComposedCubeMapTexture, EnvironmentLight, Sound) |
| [src/brain/body.js](src/brain/body.js) | the Babylon body: Group, Switch, Transform, Billboard, Shape, lights, environment, materials, lines, text, ClipPlane, change handling |
| [src/brain/body-cam.js](src/brain/body-cam.js) | viewpoints and animated transitions, orbit, pan and zoom, picking and TouchSensor, billboards, the frame loop |
| [src/brain/sai.js](src/brain/sai.js) | the SAI shim (`window.X3D`, field types, `getNamedNode`, `createNode`, `addRoute`, `rootNodes`, `setBrowserOption`) |
| [src/brain/wgsl.js](src/brain/wgsl.js) | the WGSL ports and the wide-line and unlit shaders |
| [src/brain/boot.js](src/brain/boot.js), [src/build-brain.py](src/build-brain.py) | start-up and the page builder (it refuses to build if a scene carries GLSL with no port) |

### Shader ports

Same rule as the Collider: a port is chosen by the FNV-1a hash of the vertex and fragment GLSL with whitespace collapsed, so it only runs on the program it was written from.

| shader | key (vertex-fragment) | scene |
|---|---|---|
| cortex glass (fresnel, thin film) | `c89ae27e-c9456c60` | brain |
| aura (halo shell) | `c89ae27e-0afe3b95` | brain |
| torso glass | `4e142744-2250c51b` | torso CT (16 shapes) |
| torso halo | `4e142744-f37b0ce5` | torso CT |

The glass is drawn in two passes (back faces, then front) with the blend the shader expects. Wide lines (`LineProperties.linewidthScaleFactor`) are ribbons: one quad per segment, widened in screen space in the vertex shader, because WebGPU has no wide lines. The wet cortex, the deep structures and the stage sprites are Babylon PBR and unlit materials set up from the scene's PhysicalMaterial and Appearance values.

### What cost time (read before the next port)

1. **PhysicalMaterial colours are linear.** Converting them to linear again made the deep structures and the wet cortex far too dark.
2. **Counter-clockwise faces are the front in X3D; Babylon's default winding is the other one in a right-handed scene.** The wet cortex looked cool and inside-out until PBR materials were set to counter-clockwise with two-sided lighting. No light, environment or exposure setting fixes this.
3. **Babylon draws transparent meshes with `alphaIndex` default `Number.MAX_VALUE` after everything else.** The core glow sprite drew over the glass until every non-glass mesh got an explicit `alphaIndex`.
4. **Babylon's billboard mode points +Z away from the eye in a right-handed scene.** Text came out mirrored with its drop shadow on top. Billboards are now turned by the body each frame (X_ITE's rule: +Z at the eye, +Y from the viewer's up; about the axis when one is given).
5. **A material's `clipPlane` is per material; `scene.clipPlane1` clips everything.** X3D's ClipPlane clips only the shapes in its own Group.
6. **Unlit text is `emissiveColor`.** Setting the diffuse colour of a `disableLighting` StandardMaterial draws black.
7. **Do not let the test page queue frames.** On a software adapter the render loop submits frames faster than they finish and the next read-back waits for all of them; the harness slows `requestAnimationFrame` to 1.2 s.

### Not done

`Sound` and `AudioClip` (the repo build of the page has its music switched off), `Layout` and `ScreenGroup` (the page uses HTML for its HUD), a Transform's shear (a `scaleOrientation` with non-uniform scale is decomposed to translation, rotation and scale; the page logs it), bloom and HDR grading (this is the "as authored" path; the look is X_ITE's with KHR_PBR_Neutral tone mapping), and anything timed: gate G0 (timing on the owner's machine) is still open, so no frame rate is quoted. The receipt has the numbers against X_ITE: [runs/webgpu-brain-20261107/RECEIPT.md](../../runs/webgpu-brain-20261107/RECEIPT.md).

## KANSEI on Babylon WebGPU (the drift port)

Port #3 from the port map. The KANSEI drift game ([x3d.drift](../../x3d.drift/README.md)) with its own engine, HUD, five circuits, four cars, garage and tapes, drawn by [Babylon.js](https://www.babylonjs.com) 9.32.0 in WebGPU mode instead of X_ITE. Same arrangement as the brain port: **our X3D reader is the brain, Babylon is the body**, and an SAI shim answers `X3D.getBrowser()`. The game's `engine/*.js` and `main.js` run as they are; the builder makes two text edits in the COPY (the version label in `main.js`, the script tag in `index.html`). The simulation (`kansei-engine/4`, 120 Hz, deterministic) never touches the renderer: a tape replayed to the same frame gives the same sim hash in both pages (6 of 6 views, C), so the two pictures are comparable frame for frame.

```sh
python3 -I x3d.webgpu/demo/src/build-drift.py --game x3d.drift --out /tmp/kansei-webgpu
python3 -m http.server -d /tmp/kansei-webgpu 8000      # open http://localhost:8000/index.html
```

The output folder (about 14 MB with levels, cars, textures and tapes) is the game's page, so it is not committed. Babylon loads from the CDN at the exact version with a subresource-integrity hash (`--babylon FILE` points at a local copy instead). Chrome or Edge 113 or later, Safari 26, Firefox 141 or later. If `requestAdapter()` answers nothing the page says so and names the Windows fix (`chrome://flags/#enable-unsafe-webgpu`, see [the playbook](../BABYLON-BRIDGE-PLAYBOOK.md) 4.1); it asks four ways before giving up (plain, the caller's options, low-power, fallback). URL knobs for looks: `?tone=aces|neutral`, `?ls=` light scale (default 2.2), `?env=`, `?shadows=0`, `?revz=0`, plus the game's own `?tape=`, `?frame=`, `?cam=`, `?hud=0`, `?cscale=`.

| file | role |
|---|---|
| [src/drift/drift-ext.js](src/drift/drift-ext.js) | what KANSEI needs beyond the brain body: reader tables (ElevationGrid, TextureProperties, TextureTransform, PolylineEmitter, Metadata*, Background `*Url`, alphaMode, normalScale, UnlitMaterial emissive texture), per-file base URLs and node-id offsets, IndexedFaceSet/TriangleSet normals with crease angle, Spot and Point lights with shadows (Poisson), linear fog, a six-face sky, alpha MASK and BLEND, a `Cone` primitive, Babylon particle systems from ParticleSystem and PolylineEmitter, a camera whose far plane follows `visibilityLimit` |
| [src/drift/drift-boot.js](src/drift/drift-boot.js) | start-up: the Babylon body, the SAI shim, then `<x3d-canvas>` is defined so the game's own boot goes on |
| [src/shared/timing.js](src/shared/timing.js) | the opt-in Timing button, shared by KANSEI and Neural Canvas (below) |
| [src/shared/adapter.js](src/shared/adapter.js) | the `requestAdapter` retry (default, then options, then low-power, then the fallback adapter), recorded in `window.__adapter` and `window.__adapterVia` |
| [src/build-drift.py](src/build-drift.py) | the page builder: copies the game, concatenates the parts into `bundle.js`, edits only the two lines above |
| [src/brain/sai.js](src/brain/sai.js) (additive), [src/brain/body.js](src/brain/body.js) (one fix) | the shim gained `createX3DFromURL`, `createX3DFromString(xml, baseUrl)`, `replaceWorld`, `addRootNode`, `loadComponents`, the colour-RGBA and multi-field types; `body.js` read `face[0]` where it needed `face[0][0]`, so every IndexedFaceSet without a Normal node had zero normals (the Neural Canvas page is unaffected: re-checked on 9 views, 0 pixels differ before and after, see [runs/webgpu-brain-v2-20261107](../../runs/webgpu-brain-v2-20261107/RECEIPT.md)) |

The scenes are 29 node types in 10 files (no shaders, so no hash-matched ports; this page has no GLSL to port), plus what the effects code creates at run time (Transform, Switch, Shape, Cone, UnlitMaterial, SpotLight, Viewpoint, ParticleSystem, PolylineEmitter).

### The Timing button (opt-in, off by default)

A small "Timing" pill at the lower left (lower right on Neural Canvas, which has its own controls on the left). One file, [src/shared/timing.js](src/shared/timing.js), serves both pages; each boot file sets `window.__timingHooks` (name, result schema, how to read the scene, whether the page moves its own render scale) and the build sets `window.__x3dBuild`. The result is also kept in `window.__timingResult`. Nothing runs until it is pressed. Then, for about 22 s (2 s warm-up thrown away, 20 s measured), it records the interval between `requestAnimationFrame` callbacks of whatever the page is doing, and shows p50, p95, p99, max, mean fps, the 1% low and the count of frames over 33 and 50 ms. It keeps the numbers on the page: no fetch, no beacon, nothing is sent. "Copy numbers" copies a JSON block that also holds the GPU adapter (vendor, architecture, description, fallback flag, timestamp-query support), the browser string, cores, power state, the circuit, car, camera and quality tier, the canvas size and render scale, and the build id of the bundle, so a figure is never separated from the machine and the code that made it. A software adapter (SwiftShader, WARP, llvmpipe, or a fallback adapter) is labelled "these numbers do not count"; a hidden tab or fewer than 30 frames is labelled not valid. `?timing=0` hides the button; `?tsec=N` and `?twarm=N` change the windows. What it is not: it is the displayed-frame interval (a 60 Hz screen caps it near 16.7 ms) with the game physics and the Babylon draw inside it, not GPU-only time. [runs/webgpu-drift-20261107/test-timing.js](../../runs/webgpu-drift-20261107/test-timing.js) checks the statistics and the warnings with a stub DOM and the same hooks the pages set.

### What cost time (read before the next port)

1. **Babylon mixes fog in after tone mapping and sRGB encoding; X_ITE mixes it in linear.** Give Babylon the display-space fog colour (tone-mapped, encoded) or the whole distance goes orange and dark. With the fix the close view of Kessel Pass (kp-2600) reached about 26 dB.
2. **The sky box is tone mapped too, and X_ITE tone maps its sky as well**, so leave the scene's ACES on it. A cube texture drawn on a canvas must be sRGB-encoded and every face must be the same size (a 4 x 4 solid fallback beside 256 x 256 faces fails with "Error while trying to load image").
3. **A sky box 1 km out hides the far ridges.** Put it in rendering group 0 with depth write off, everything else in group 1, set `camera.maxZ` from `NavigationInfo.visibilityLimit` (9000 here) and turn on `useReverseDepthBuffer`.
4. **A node that is not a Shape child is dropped without a word.** `ElevationGrid` had no entry in the reader's container table, so the terrain vanished.
5. **Node ids collide across separately parsed files** (the car, the level, the garage), which corrupted the texture cache and the route table until each parse got an id offset.
6. **`VertexData.ComputeNormals` needs `{ useRightHandedSystem: true }`**, or the road and ground are lit from inside.
7. **Babylon's PCF shadows drew nothing visible here; Poisson did.** Every shape receives shadows, only `castShadow=true` shapes cast.
8. **Appearance `alphaMode` (MASK with a cutoff) was ignored**, so the pines were opaque boxes. `refreshPBR` resets the transparency mode: apply it again after.
9. **The plain `requestAdapter()` first** (as in PR 14) and a visible message when none answers, because the owner's Windows GPU is blocklisted until a flag is set.
10. **The test page and the frame queue** are as in the brain port: stub the swap chain and slow `requestAnimationFrame` to 1.2 s. The game then advances its own capped 0.25 s of sim per frame, so a drive takes few frames but long wall time.

### Not done, and known deviations

Same body, so Sound/AudioClip, Layout/ScreenGroup and Transform shear are still not in the Babylon body. **The game's sound is its own WebAudio synthesiser and it runs unchanged** (the page reports the audio context as running; it was not rebuilt on Babylon's audio engine and nobody has listened to it in this port). Visual deviations from X_ITE, none tuned away: the normal maps are drawn at 0.6 of their `normalScale` (full strength scored lower), the tail-light emissive texture shows stripes, the far ridges are browner than X_ITE's paler grey, the sky clouds are a little stronger. No timings were taken here: this machine has only a software adapter.

## The Collider

Two protons meet at the centre every 12 seconds. Tracks grow out from the vertex and curl in the field (colour is the particle kind, brightness and width the momentum), the calorimeter crown lights up with the energy each tower caught, and a burst of sparks leaves the vertex. The event is generated and drawn as a demo, not a measurement.

What the page reads from the scene: 75 nodes, 6 shapes on screen (backdrop haze, detector shells, muon stations, collision flash, one strip set of 456 tracks, one strip set of 168 towers; 20,340 triangles), 3 Viewpoints, 1 TimeSensor driving 5 ROUTEs into the shaders' `u_phase` fields, BlendMode and DepthMode on every appearance, and a ParticleSystem of 420 LINE sparks from a ConeEmitter.

Controls on top of the shared ones: **End-on / Three-quarter / Side** bind the scene's own Viewpoints (keys 1 2 3; PageDown or V for the next), **Tour** binds the next one every 12 s (T), **Look** switches the A/B (L), **Slow motion** runs the clock at 0.2x (M), key C jumps to the start of the next collision, the **Event** slider scrubs the cycle forward, and the **Sparks** slider sets `maxParticles` from 100 to 250,000.

### How the GLSL becomes WGSL

The scene's five ComposedShaders (tracks, towers, shells, flash, haze) are hand-ported to WGSL. A port is chosen by an FNV-1a 32-bit hash of the vertex and fragment GLSL with whitespace collapsed, so a port only runs on the exact program it was written from:

| shader | key (vertex-fragment) | fields |
|---|---|---|
| tracks | `da010848-2732de59` | `u_phase`, `u_resolutionScale` |
| towers | `e899d3ba-71ea799c` | `u_phase`, `u_e90`, `u_resolutionScale` |
| shells | `2318d20e-451c1b62` | `u_phase` |
| flash | `1bc84a9f-b6fcc411` | `u_phase` |
| haze | `07e052cf-7ecaed2f` | `u_phase` |

Edit any GLSL in the source panel and the key no longer matches: that shape is drawn as if it had no shader (19775-1 31.2.2) and the log says so. ROUTEs into shader fields are type-checked against the ComposedShader's own `<field>` declarations. BlendMode and DepthMode (X_ITE nodes, declared under `component X_ITE`) become WebGPU blend and depth state.

### The two looks

- **As authored**: each shader ends with its own tone curve (`1 - exp(-c * k)`) and writes straight to the screen, clamped to 0..1, no bloom. This matches an 8-bit WebGL canvas; by eye it matches the X_ITE frame `runs/hep-demo-v3-20261106/frames/look-v3_dijet_endon.jpg`.
- **HDR + bloom** (the default): the closing curve is dropped, the colour before it is decoded to linear light and extended above 1, added up in a 16-bit float target, bloomed, and tone-mapped per channel with `1 - exp(-c)` at exposure 1.3 before sRGB. The Background and Fog colours are linearised to match.

## Collider v2

An outside pass rebuilt the Collider page on our runtime. Its review is in [../../runs/webgpu-collider-rebuild-20261107/REBUILD-REVIEW.md](../../runs/webgpu-collider-rebuild-20261107/REBUILD-REVIEW.md). v2 keeps the scene byte for byte and "As authored" unchanged (its frames differ from V1 only in the spark burst), and takes from the pass:

- **Glass that reads as glass**, in the cinematic look only: studio reflections, an edge coat and an event light on the detector shells (at half the pass's strength, so the shells do not out-shine the tracks), a six-blade diffraction flare and corona on the flash, a veil in the haze. These are art the scene does not hold, and the page says so.
- **Filtered fine detail**: shell stripes, neutral-track dashes and track heads are filtered with screen-space derivatives, because MSAA does not filter shader patterns.
- **Bloom that does not change with size**: V1 divided the bloom by the number of bloom levels, which depends on the canvas size; v2 weights each coarser level by 0.72 and takes the bloom setting as a direct gain.
- **Grades and quality**: Luminance (the default: exponential curve at exposure 1.35, bloom 0.45, no glare), Radiant (adds a horizontal glare) and Precision (Neutral curve, little bloom), with a Light and lens panel; quality tiers Balanced (2.2 MP, the default), High (4.2 MP) and Ultra (8.3 MP).
- **A clean still**: 2K or 4K PNG read back from an offscreen GPU target (rows padded to 256 bytes, BGRA swapped), with a caption burned in ("a generated event · artistic render") and the word render in the filename. It opens in a preview with a Save link, because a page inside a frame may have its downloads blocked.
- **The first frame is the hero**: the page binds the three-quarter Viewpoint through `set_bind` and opens on a developed moment.

What we kept from V1 over the pass, and why: the exponential tone curve, because the pass's Neutral curve at exposure 1.65 turned the hot calorimeter towers pink-white (13.9 % near-white lit pixels in the crown against 1.2 % in V1), and the crown is meant to read blue to amber to red; no glare by default, because it costs 14 extra bloom reads per pixel on an integrated GPU; Balanced quality and 2K export by default; the line that nothing is recorded or sent.

Learnings carried forward:
1. In this scene almost every visible pixel comes from the five shader ports, so the look is made in the ports and the composite, not in the mesh PBR.
2. A second look must leave the first bit for bit alone: every addition is gated on the look uniform, and the authored frames were diffed.
3. A tone curve can hide meaning: check a colour-coded quantity (here the energy crown) after every change to the curve, not just the overall beauty.
4. An export button inside a hosted frame needs a visible preview and a link the viewer clicks; a scripted download click can be ignored without a word.
5. Defaults belong to the weakest target GPU; the expensive options stay one click away.

## The five event pages and a splat facade (quick wins)

`python3 -I src/build-events.py OUTDIR` writes one Collider-v2 page per HEP event (Dijet, QCD, Z to two muons, QCD in flight, exact Z to two muons). It regenerates the five look-v3 scenes from `kit/examples/hep/fixtures` with `build_event_scene.py --look v3` (three of the five reproduce the hashes in `runs/hep-demo-v3-20261106/scenes.sha256`) and fails if any scene's GLSL hash differs from the Collider's, because that scene would silently fall back to no shader. No viewer code changed; the pages are not committed (2.4 to 2.8 MB each, reproducible). A splat scene with viewpoints goes through `build-v3.py`. Receipt: `runs/webgpu-quick-wins-20261107/RECEIPT.md`.

## Renderer choices beyond the spec

Both pages state these. Ambient light is taken from the Background (a 512-step gradient table and its 9-term spherical-harmonic irradiance); bloom and tone mapping in the HDR look; additive particles with a glow gain; a particle `mass` of 0 makes the physics models do nothing. Viewpoint changes follow NavigationInfo `transitionType` and `transitionTime` (LINEAR, 1 s by default), eased with smoothstep, and keep the centre of rotation framed by interpolating the half-width there and the field of view in log space. LINE particles are drawn as screen-space streaks `particleSize.y` long. A PointEmitter with a non-zero direction spreads by `variation x 90 degrees`. The page sets the collider's `u_resolutionScale` field to the canvas height over 900 whenever the canvas resizes.

## What the v1.1 core adds and fixes

| area | in v1.1 |
|---|---|
| nodes | V1's set plus Switch, Billboard, ComposedShader, ShaderPart, BlendMode, DepthMode, IndexedTriangleSet, TriangleStripSet, IndexedFaceSet, Coordinate, Normal, FloatVertexAttribute, ConeEmitter; everything else is skipped with a note in the log |
| particles | ConeEmitter, LINE geometry, `colorKey` with a colour ramp baked in HSV, speed variation as the spec gives it, a particle buffer that grows when `maxParticles` rises |
| viewpoints | `set_bind` with `isBound` and `bindTime`, animated transitions |
| picking | a ray against every triangle (after a bounding-box test), so a TouchSensor hits the shape you see |
| the click fix | V1 drops a click when the press lasts more than one frame: `touchTime` never fires (C, headless test holding the press for 3 frames). v1.1 compares the sensor sets by content and sends the release one timestamp after the press |
| review fixes | HDR values clamped at 8192 to stay inside the 16-bit float range; a 2.2 megapixel budget at a device pixel ratio of at most 1.5; the error list capped at 200; the software-adapter check fixed; headlight on when there is no NavigationInfo; SpotLight `beamWidth` 0.589049 and `cutOffAngle` 1.570796 as 4.0 defaults; Cylinder and Cone `top`/`bottom`/`side` and the WorldInfo fields as inputOutput; an opaque source panel |

Still not implemented: ClassicVRML and JSON encodings, PROTO, Inline, Script, IMPORT/EXPORT, SAI, textures, LineSet and PointSet, more than one shadow, and light scoping (all lights are treated as global).

## Validation

- **Collider scene.** The hep-event witness passes on the look v3 run that produced these bytes (grade C, `runs/hep-demo-v3-20261106/evidence/hep-event.json`). The x3d_mcp fork semantic check (checkout 13121b6) gives 0 errors, 1 warning and 14 notes: the warning is the Shape inside the switched-off `shader_defs` Switch, which only carries the shader definitions, and the notes are unused DEFs. The X3D 4.0 DTD and XSD reject BlendMode and DepthMode because they are X_ITE nodes, not 19775-1 nodes; that is expected for a scene that declares `component X_ITE` (C, xmllint on the fork's bundled schemas at 13121b6).
- **First Light scene.** X3D 4.0 DTD: passes (xmllint). Fork semantic check at 13121b6: 0 errors, 0 warnings, 6 notes (unused DEFs). X3D 4.0 XSD: fails on the ForcePhysicsModel, and the 4.1 XSD fails the same way (C, xmllint on the files published at web3d.org on 2026-11-07 and on the fork's copies). Both schemas declare ParticleSystem `physics` as a repeating `xs:sequence` of BoundedPhysicsModel, ForcePhysicsModel, WindPhysicsModel and ProtoInstance with each child required, so any ParticleSystem with a physics model fails unless it carries all four in that order; the DTD and the object model (MFNode of X3DParticlePhysicsModelNode) accept it. The fork's repair hint for this error says to remove the ForcePhysicsModel, which would break a valid scene.

## Testing, and what was not measured

Tested in headless Chromium on a software Vulkan adapter (SwiftShader) for correctness only. Collider: zero WebGPU validation errors and zero WGSL compile errors, all five ports compile and draw, all three viewpoints in both looks, the tour, slow motion, the scrubber and the spark slider work, a drag stops the tour, a GLSL edit falls back as described, a malformed source is refused, a phone-width layout has no horizontal overflow, and a browser without WebGPU gets the message instead of a broken page. First Light v1.1: the touch cascade drives the emitter speed, light and glow, including on a press held across frames.

Frame rates from that adapter mean nothing and are not quoted. Nothing is timed for a benchmark. The pages show a frame interval on the viewer's own screen and record or send nothing; gate G0 (timing consent) is still open.

## Gobbler 3 on Babylon WebGPU (the knowledge-graph port)

Port #2 of the port map's queue (Pantheon splats was #1). The Gobbler 3 page (`gobbler-v3/` in `hagopjay/x3d.ml`: a scriptless X3D 4.0 knowledge graph, 17 ComposedShaders, 64 ROUTEs) with its **own unmodified `common.js`, explorer and tour**, drawn by Babylon 9.32.0 in WebGPU mode. The build swaps one script tag (X_ITE out, the bundle in) and one kicker line; `<x3d-canvas>` is defined by the bundle, so the page's `PX.boot` runs as written. X_ITE 16.5.1 stays the reference; this is not a parity witness.

```sh
python3 -I x3d.webgpu/demo/src/build-gobbler.py --page <gobbler-v3/build-public-candidate> --out OUT.html          # needs the page folder next to it
python3 -I x3d.webgpu/demo/src/build-gobbler.py --page <gobbler-v3/build-public-candidate> --out OUT.html --single # scene, graph, css and js inlined: one file
```

The built page and its scene are **not committed**: the public candidate names two outside maintainers and waits for its owner's "publish". The build refuses to run if the scene carries GLSL with no WGSL port (it prints the key).

| file | role |
|---|---|
| [src/gobbler/reader-ext.js](src/gobbler/reader-ext.js) | PointSet, TextureCoordinate3D, PixelTexture, VolumeEmitter, BooleanFilter, BooleanSequencer, flat RGBA and index arrays; `receive` is wrapped so the Boolean nodes run as events |
| [src/gobbler/body-gob.js](src/gobbler/body-gob.js) | wraps the brain body without editing it: port lookup by shader hash, per-corner attributes (RGBA, 3D texture coordinates), PointSet as quads, ember particles, bbox-centre sort, first Viewpoint bound at load |
| [src/gobbler/wgsl-core.js](src/gobbler/wgsl-core.js) | port registry and the one material factory the page and the test harness share |
| [src/gobbler/wgsl-sky.js](src/gobbler/wgsl-sky.js), [-eye](src/gobbler/wgsl-eye.js), [-point](src/gobbler/wgsl-point.js), [-facet](src/gobbler/wgsl-facet.js), [-line](src/gobbler/wgsl-line.js) | the six GLSL programs as WGSL (733 lines in all), term for term |
| [src/gobbler/port-test.html](src/gobbler/port-test.html), [port-test.js](src/gobbler/port-test.js) | compile-and-draw check for one port at a time; WGSL errors come back as data |
| [src/gobbler/compare-gob.html](src/gobbler/compare-gob.html) | the scene on the body without the page, for frame comparisons |
| [src/gobbler/boot-gob.js](src/gobbler/boot-gob.js) | defines `<x3d-canvas>`, starts the body, lists every fallback on screen, wires the opt-in Timing button |

Shader keys (FNV-1a of the whitespace-collapsed GLSL, vertex-fragment): sky `57378568-b3067a52`, point `8da5fec9-17c8a8f8`, facet `a2e1db0e-7e920071`, line `623a753e-ff5d9002`, hide `1a42dc70-060b0505` (draws nothing, no mesh), eye `50c500f7-7a46fca5`. Receipt, gap log and lessons: [runs/webgpu-gobbler-20261107/RECEIPT.md](../../runs/webgpu-gobbler-20261107/RECEIPT.md).
