# Babylon / WebGPU bridge playbook, v2

Status: v2, 8 Nov 2026. A new file; v1 (`BABYLON-BRIDGE-PLAYBOOK.md`, 7 Nov) is unchanged. v2 adds what ports #3 to #9 and the Material Odyssey port (8 Nov) taught us, as a trap table by area, so the next port starts from the list instead of finding each one again. Docs only, $0 spend.
Grades: C = Confirmed, L = Likely, S = Suspected. Every number names its reference (X_ITE version, Babylon version, rig).

## 0. Standing rules (owner's words, 7 and 8 Nov)

- Not pixel perfect. The aim is good, valid Babylon.js engineering, with every gap logged in the run's `GAPS.md` for later receipts. "As authored" should look right next to X_ITE; it does not have to match to the pixel.
- Loom laws 38 to 40 hold: the `.x3d` is the master; a look may add but never assert and must switch off to "As authored"; a fallback must say so on screen.
- Every render claim names the X_ITE version, Babylon 9.32.0 and the rig. SwiftShader numbers are correctness evidence only. No timings until the owner pastes real-GPU Timing blocks (gate G0).
- Never overwrite a demo or a doc: new versioned file each time. Only the site-owner thread pushes `x3d.demo`.

## 1. Where each trap bites (one table, grouped by area)

### 1.1 Scene graph and reader

| Trap | Fix | Port |
|---|---|---|
| A USE is a placement, not the node. State keyed by node id is overwritten by the second placement (74 Babylon lights for 62 placements). | Keep state per Babylon object; `lightsOf` map, never key by id. | Odyssey (C) |
| The reader lets an output fire once per timestamp, so a seek that writes `set_fraction` twice at one timestamp only lands once. | `R.events.begin(ts + 1e-6)` before each seek (`newTimestamp()`). | Odyssey (C) |
| `events.emit` only queued ROUTEs and never ran `addFieldCallback`, so nothing animated. | `R.hooks.cb`. | Manifold (C) |
| Big MF arrays (263k numbers) through the SAI. | Non-copying `fieldView`, typed `MFVec4f` / `MFFloat` parse. | Manifold (C) |
| `geometryData` and `babylonGeometry` shared one cache key; the second rebuild of a non-glass set drew 0 vertices. | Suffix the key with the colour variant; dispose both. | Cloud F5 (C) |
| The same scene may bind a Viewpoint inside a rotated Transform. | Apply the parent rotation. | Collider (C) |

### 1.2 Materials, textures and colour

| Trap | Fix | Port |
|---|---|---|
| PBR colours are linear. | Convert authored sRGB before assigning. | Brain (C) |
| StandardMaterial adds an emissive texture to the emissive colour; X3D multiplies it. With `disableLighting` the colour becomes (emissive + ambient) x diffuse texture. The corridor flooded pink. | Put the texture in `diffuseTexture`, keep the colour in `emissiveColor`. Setting `diffuseColor` instead goes black (drops out when lighting is off). | Odyssey (C) |
| Coplanar textured glow panel and floor z-fight. | `zOffset 4`, `zOffsetUnits 8` on the panel. | Odyssey (C) |
| glTF-style packed maps. | `metallicRoughnessTexture` (roughness in G, metallic in B); data textures `gammaSpace = false`; normal maps `invertNormalY = true` in a right-handed scene; anisotropy 8. | Odyssey (C) |
| Metals dark and speckled. | `enableSpecularAntiAliasing` and an environment floor. | Odyssey (C) |
| The final `imageProcessing` post process converts linear to gamma; display-referred shader output looks washed out. | Switch off `fromLinearSpace` for hand-written shaders. | Manifold (C) |
| A Background node's sky gradient is drawn sRGB-encoded by Babylon and almost black by X_ITE headless. | Logged as a gap, not tuned. | Chirp, Cloud (C) |
| Cube map with `noMipmap = true` raises WebGPU mip validation errors. | `noMipmap = false`. | Odyssey (C) |

### 1.3 Meshes and draw order

| Trap | Fix | Port |
|---|---|---|
| X3D counter-clockwise is front; PBR looks inside-out. | `sideOrientation = CounterClockWise`. | Brain (C) |
| MeshBuilder primitives (Box, Sphere, Cylinder, Cone) are turned inside out by the body's CCW flag. | `material.sideOrientation = null` on primitives. | Odyssey (C) |
| `alphaIndex` defaults to MAX_VALUE; sprites draw over glass. | Explicit alpha indices. | Brain (C) |
| Billboards face the wrong way in a right-handed scene. | Orient each frame. | Brain (C) |
| A mesh whose first `setVerticesData` call is a custom attribute silently drops it. | Set the position first. | Manifold (C) |
| Blended glow sorts differently from X_ITE. | Feed `bboxCenter` to `mesh.setBoundingInfo`. | Gobbler (C) |
| Text colour. | `emissiveColor`. | Brain (C) |

### 1.4 Lights (the budget is a scope, not a count)

| Trap | Fix | Port |
|---|---|---|
| 59 of 60 lights have `global=false`. Babylon lights light everything; scenes go bright and the material 8-light cap is hit. | For each light: `includedOnlyMeshes` = `tn.getChildMeshes(false)` of its parent group's TransformNode. A shape then sees at most 6 lights. Cap hit: never. | Odyssey (C) |
| Lights and units. | glTF punctual: `falloffType = FALLOFF_GLTF`, `range = radius`, spot `angle = 2 x cutOffAngle`, `innerAngle = 2 x beamWidth`, intensity unchanged (the hall at 33 s was within 1 grey level of X_ITE). Parent directional lights to the group TransformNode. | Odyssey (C) |
| Scoping needs the meshes to exist. | Apply scopes after the world has built, again on change. | Odyssey (C) |

### 1.5 Shaders (hand ports)

| Trap | Fix | Port |
|---|---|---|
| No `gl_PointSize` in WGSL. | Quad expansion with a `corner` attribute; derive the offset once. | Manifold, Gobbler (C) |
| `pow(x, 2.0)` on a possibly negative `x` is undefined. `smoothstep` with reversed edges fails for constants. | Write the square; use a helper. | Gobbler (C) |
| `select(false, true, cond)` argument order. | Reviewer re-derives every `select()`. | Gobbler (C) |
| WGSL compile errors come out as console warnings. | The harness listens to warnings and errors. | Gobbler (C) |
| A `*/` inside a `/* */` comment in an inline script ends the comment. | `node --check` every inline script. | Gobbler (C) |

### 1.6 Page integration

| Trap | Fix | Port |
|---|---|---|
| Loading Babylon replaces `window.X3D`; the X_ITE engine stops working. | Restore `window.X3D` after the bundle loads; the adapter takes types from the bundle's namespace. Engines switch both ways. | Odyssey (C) |
| Page code that calls `X3D.getBrowser()`. | Keep `app.js` unchanged against the SAI shim; or a custom `<x3d-canvas>` element. | Gobbler (C) |
| The page's own canvas box (2.39:1 picture). | Canvas class `bjs` placed by the page CSS; page-side fade overlay. | Odyssey (C) |
| First frame shows half-built pipelines. | `scene.whenReadyAsync()` before the first frame; a render loop gated by a `need` counter. | Odyssey (C) |
| A slowed `requestAnimationFrame` makes time-driven code age wrong. | `opts.maxDt` as a parameter. | Gobbler (C) |
| Controls auto-hide; a headless click on a hidden control is intercepted by the poster. | Move the mouse first in the test script (not a page bug). | Odyssey (C) |

## 2. Look layer recipe (Loom law 39)

Odyssey is the template: `OD.on` switches a layer that only adds, with a button (Look, key L) and `?look=0`.

1. A generated cube environment (reflections only, HDR filtering, 8-bit sRGB carrying value/6), intensity following the film's light level.
2. `DefaultRenderingPipeline`: MSAA 4, bloom, grain, vignette, neutral tone map.
3. Dust as a `ParticleSystem` anchored to the camera.
4. Up to three spot shadow generators for the key lights.
5. A switch to "As authored", reachable from the page, and an on-screen line saying which one is showing.

## 3. Measuring

Use the v1 method (section 3 there) unchanged: same file, viewpoint and resolution; Look off; PSNR on 8-bit RGB; the rig named; no timings. For animated films, pin the time (`seek`) in both renderers and capture from the Babylon offscreen readback (`__snap`). The three.js WebGPU canvas screenshots white in this rig (Odyssey gap G10); capture X_ITE by stage screenshot.

Odyssey numbers (C, Babylon 9.32.0 against X_ITE 16.4.3, SwiftShader): As authored 25.5 to 30.7 dB across six film times, mean grey within about 2.

## 4. Checklist for the next port

- [ ] Census against the bridge; list missing nodes (S).
- [ ] Lights: read `global`; scope each non-global light; check that a shape sees at most 6.
- [ ] USE audit: nothing keyed by node id.
- [ ] Textured unlit shapes: texture in diffuse, colour in emissive.
- [ ] Primitives: `sideOrientation = null`.
- [ ] Cube maps: mipmaps on.
- [ ] Babylon pinned with SRI; `window.X3D` restored; `node --check` on inline scripts.
- [ ] Look layer switchable, labelled; "As authored" compared with X_ITE (version named).
- [ ] GAPS.md written; RECEIPT.md names rig and versions; Hear (audio), Timing and a real-GPU pass listed as open.
- [ ] Leak sweep on the served bytes; new versioned folder; route to the site-owner thread.

## 5. Sources

x3d.loom PRs #7 to #22; `runs/webgpu-*/RECEIPT.md` and `GAPS.md` (brain, brain v2, drift, chirp, cloud, gobbler, manifold, odyssey); v1 of this playbook.
