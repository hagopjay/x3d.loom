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
