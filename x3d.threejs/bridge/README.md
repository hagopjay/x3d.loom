# X3D to three.js bridge (scaffold)

A three.js drawing half for the reader that the Babylon bridge ([`../../x3d.webgpu/bridge`](../../x3d.webgpu/bridge)) already owns. Nothing under `x3d.webgpu/` is copied or changed: `tools/bundle.js` reads the reader, kit and node files from there at bundle time, so a fix to the reader reaches both bridges.

How hard is the port, group by group: [ESTIMATE.md](ESTIMATE.md). Node-by-node state: [NODES.md](NODES.md) (generated). Why each choice was made: below and in the headers of `src/body-three.js` and `tools/run-tests.js`.

## Status (14 Nov 2026, batch 2 on `x3d.loom@4835a30`, three.js r187, X_ITE 16.6.0, Chromium 153.0.8010.12 SwiftShader)

| | nodes | meaning |
|---|---|---|
| drawn | 49 | the three.js body draws it, a fixture passed against X_ITE (45 fixtures; Shape, Appearance, Material, Coordinate, Color, TextureCoordinate, NavigationInfo, Background, PixelTexture ride along) |
| reader-checked | 29 | event or logic node; a shared fixture passed in the three.js bundle and in X_ITE |
| reader | 46 | engine-free, not re-run here |
| todo | 99 | needs the three.js body |
| upstream | 37 | the Babylon bridge has not bridged it yet |

## Run it

```sh
npm ci                                   # three, x_ite; playwright is expected on the machine (NODE_PATH) or installed
node tools/run-tests.js Box Switch BooleanToggle      # one JSON line: ours vs X_ITE, per step
node tools/run-tests.js --shots .shots Sphere         # keep both pictures and the side-by-side inputs
python3 tools/driver.py check Box Sphere              # run, write receipts/NODE.json, update NODES.json and NODES.md
python3 tools/driver.py next 10                       # the next ten nodes that need the body
python3 tools/driver.py status
```
Env: `XITE_DIR` (X_ITE `dist/`), `THREE_DIR` (three `build/`), `CHROMIUM_EXECUTABLE`. Fixtures are looked up in `fixtures/` (scene fixtures for this body) and then in `../../x3d.webgpu/bridge/fixtures/` (event fixtures every body shares).

## Layout

| file | what |
|---|---|
| `src/body-three.js` | the body: world build, Transform, Switch, Billboard, LOD, ClipPlane, Shape, primitives, IndexedFaceSet (Normal, creaseAngle, per-face colour via `src/nodes/Geometry.js`), the shared bridge `geometry()` and `lines()` / `points()` hooks, LineSegments and Points, Material, UnlitMaterial and PhysicalMaterial, textures, headlight and DirectionalLight, Background, Viewpoint binding and transitions, EXAMINE orbit, frame loop. Same contract with `sai.js` as the Babylon `Body` |
| `tools/bundle.js` | concatenates reader + kit + nodes + `Geo.geometryData` (lifted from Babylon's `body.js`) + the body + `sai.js` |
| `tools/run-tests.js` | the Babylon rig's `RUNNER`, `verdict` and `judgeVisual` and `METRICS`, on a three.js page; events specs are hard, scene `compare` numbers are reference bounds |
| `src/nodes/Geometry.js` | TriangleSet, ElevationGrid (creaseAngle), TriangleStripSet and `BR.ifsExtras` (IndexedFaceSet normals and colours); written as shared-bridge nodes (`BR.node` with a `geometry()` hook) |
| `tools/driver.py` | `init`, `status`, `check`, `next`; keeps `NODES.json`, `NODES.md`, `receipts/` |
| `fixtures/` | 45 scene fixtures and specs. Batch 0: Box, Sphere, Cone, Cylinder, IndexedFaceSet, Transform, Switch, DirectionalLight, Material, Viewpoint. Batch 1: PointLight, PointLightAttenuation, SpotLight, Fog, PixelTexture, ImageTexture, TextureTransform, TexturedPrimitives. Batch 2: TriangleSet, IndexedTriangleSet, TriangleStripSet, ElevationGrid, QuadSet, IndexedQuadSet, TriangleFanSet, IndexedTriangleFanSet, IndexedTriangleStripSet, TriangleSet2D, Rectangle2D, Disk2D, Arc2D, ArcClose2D, Circle2D, Polyline2D, IndexedLineSet, LineSet, PointSet, Extrusion, IndexedFaceSetNormals, Billboard, LOD, ClipPlane, Anchor (with Collision and StaticGroup), UnlitMaterial, PhysicalMaterial |

## The choices, and why

1. **Share the reader, replace only the body.** The reader holds no engine call; the Babylon `Body` is about 1,670 lines and the three.js one about 280 for the same core (448 after batch 2, with 44 more drawn nodes). A second bridge that forked the reader would fall behind it.
2. **Colour management off, linear output.** X3D colours are authored numbers and X_ITE 16.6.0 writes them as they are. Matching that makes the comparison honest; `opts.srgb` switches to the managed path as one flag, not a hidden default. The authored-sRGB question for lighting quality is the owner's call and stays open here.
3. **Lights times PI.** since r155 three.js lights are in physical units: intensity 1 gives diffuse/PI. X3D wants diffuse x intensity x N.L, so every light carries a factor PI (`THREE_PI`).
4. **Phong exponent x4.** X_ITE evaluates Phong with the reflection vector; three.js uses Blinn-Phong, which needs about four times the exponent for the same highlight (`opts.shininessScale`). Measured: Sphere 28.2 to 37.0 dB, Box 63.8 to 70.1 dB by that change alone [C].
5. **No winding flip, no handedness flag.** X3D and three.js are both right-handed, Y up, counter-clockwise front. Babylon needs `useRightHandedSystem` and a `sideOrientation`; here `solid=FALSE` is just `DoubleSide`.
6. **Transform is one matrix.** T C R SR S -SR -C keeps a shear; the Babylon body decomposes to TRS and logs the loss.
7. **The first Viewpoint is bound at load** (19775-1 23.4.1). The first run drew at the default pose and missed X_ITE by IoU 0.34 to 0.64 on every fixture until this was added; with it, 1.00.

8. **Shader chunks patched, once, with the X3D formula** (`patchThreeShaders`; a replace that finds nothing throws, so a three.js upgrade fails loudly): point and spot `radius` is a hard edge (three.js dims with a window), the spot cone is a linear ramp in the angle (three.js: smoothstep over cosines), fog uses the distance to the eye and X_ITE's LINEAR and EXPONENTIAL formulas (three.js: view depth and smoothstep), attenuation is the polynomial normalised by a0 (`decay` carries b2 or minus b1). Measured against X_ITE: SpotLight 63.1 dB, PointLight 36.3 to 51.2 dB, Fog 46.6 to 53.4 dB, attenuation 59.2 dB.
9. **Lights are children of their parent group's object**, so a Transform above a light moves and turns it with no refresh.
10. **UV conventions, found by reading X_ITE 16.6.0 and checking the picture:** Sphere u = 0 at -Z growing toward -X; Cylinder and Cone the same, with planar cap images; TextureTransform is the matrix `-C S R C T` read as a column matrix, not the T C R S -C order of Transform (50.1 dB against 21.3 dB for the wrong order). Box needed nothing (99 dB).

## Known gaps (also in each spec's `gaps` and `scope`)

`global=FALSE` lights light the whole scene; material `ambientIntensity` is a fixed 0.2; attenuation with both a1 and a2 non-zero is a fit, not exact; MultiTexture, movie and cube-map textures, TextureProperties, Text, Inline, LineProperties (lines are one pixel wide, as in X_ITE here), PointProperties, picking and pointer sensors are not drawn yet (the Babylon fixtures NurbsCurve, NurbsPatchSurface and Polypoint2D match X_ITE in the picture, IoU 1.00 and 0.99+, but their later steps call Babylon-only helpers (`getTotalVertices`, `window.__mouse`); 32 of the Babylon fixtures probe `__body.rec`, `scene.lights` or `geometryData` and run here for their pictures only) (`body-three.js` notes `skipped <Node>`); PhysicalMaterial is the glTF model and X_ITE lights it with a default environment glow that three.js has no counterpart for (the fixture is reference-only, IoU 0.91); IndexedTriangleSet and IndexedQuadSet generated normals match X_ITE to IoU 0.95 (a dim rim, cause not isolated); ClipPlane clips meshes of the group at the time of the last rebuild (a mesh added later is clipped after the next group rebuild); Billboard and LOD evaluate against the camera each frame, not per picking ray; no real-GPU timing exists and none is claimed.

## Adding a node

`driver.py next 10`, then write a fixture and spec (copy the nearest in `fixtures/`), then add `src/nodes/NODE.js` to this tree: it registers `R.bridge.three.build.NODE(body, n, parent, chain)`, `R.bridge.three.geometry.NODE(g, body)` (return a `BufferGeometry`) and `R.bridge.three.changed.NODE(body, n, field)`. The Babylon node file is not touched; the reader half it already carries (field table, ROUTE behaviour) is reused as it is. Then `driver.py check NODE`. A node whose Babylon file only returns vertex data (`geometry` hooks, `lines`, `points`) needs nothing at all: the body calls the shared hook and wraps the arrays (batch 2 drew eleven nodes that way, seven through `geometry()` and four through `lines()`, with a fixture each). A node the reader does not define (TriangleSet, ElevationGrid here) is defined in this tree with `BR.node(...)` and its own `geometry()`; check `grep -n NODE x3d.webgpu/demo/src/*/reader*.js` first, because the Hall reader already turns Extrusion, Rectangle2D and Disk2D into an IndexedFaceSet at parse time.
