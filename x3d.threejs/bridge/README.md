# X3D to three.js bridge (scaffold)

A three.js drawing half for the reader that the Babylon bridge ([`../../x3d.webgpu/bridge`](../../x3d.webgpu/bridge)) already owns. Nothing under `x3d.webgpu/` is copied or changed: `tools/bundle.js` reads the reader, kit and node files from there at bundle time, so a fix to the reader reaches both bridges.

How hard is the port, group by group: [ESTIMATE.md](ESTIMATE.md). Node-by-node state: [NODES.md](NODES.md) (generated). Why each choice was made: below and in the headers of `src/body-three.js` and `tools/run-tests.js`.

## Status (14 Nov 2026, `x3d.loom@ed1bed8`, three.js r187, X_ITE 16.6.0, Chromium 153.0.8010.12 SwiftShader)

| | nodes | meaning |
|---|---|---|
| drawn | 15 | the three.js body draws it, a fixture passed against X_ITE (10 fixtures; Shape, Appearance, Material, Coordinate, Color, NavigationInfo ride along) |
| reader-checked | 29 | event or logic node; a shared fixture passed in the three.js bundle and in X_ITE |
| reader | 50 | engine-free, not re-run here |
| todo | 119 | needs the three.js body |
| upstream | 47 | the Babylon bridge has not bridged it yet |

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
| `src/body-three.js` | the body: world build, Transform, Switch, Shape, primitives, IndexedFaceSet and TriangleSet, Material and PhysicalMaterial, textures, headlight and DirectionalLight, Background, Viewpoint binding and transitions, EXAMINE orbit, frame loop. Same contract with `sai.js` as the Babylon `Body` |
| `tools/bundle.js` | concatenates reader + kit + nodes + `Geo.geometryData` (lifted from Babylon's `body.js`) + the body + `sai.js` |
| `tools/run-tests.js` | the Babylon rig's `RUNNER`, `verdict` and `judgeVisual` and `METRICS`, on a three.js page; events specs are hard, scene `compare` numbers are reference bounds |
| `tools/driver.py` | `init`, `status`, `check`, `next`; keeps `NODES.json`, `NODES.md`, `receipts/` |
| `fixtures/` | 10 scene fixtures and specs: Box, Sphere, Cone, Cylinder, IndexedFaceSet, Transform, Switch, DirectionalLight, Material, Viewpoint |

## The choices, and why

1. **Share the reader, replace only the body.** The reader holds no engine call; the Babylon `Body` is about 1,670 lines and the three.js one about 280 for the same core. A second bridge that forked the reader would fall behind it.
2. **Colour management off, linear output.** X3D colours are authored numbers and X_ITE 16.6.0 writes them as they are. Matching that makes the comparison honest; `opts.srgb` switches to the managed path as one flag, not a hidden default. The authored-sRGB question for lighting quality is the owner's call and stays open here.
3. **Lights times PI.** since r155 three.js lights are in physical units: intensity 1 gives diffuse/PI. X3D wants diffuse x intensity x N.L, so every light carries a factor PI (`THREE_PI`).
4. **Phong exponent x4.** X_ITE evaluates Phong with the reflection vector; three.js uses Blinn-Phong, which needs about four times the exponent for the same highlight (`opts.shininessScale`). Measured: Sphere 28.2 to 37.0 dB, Box 63.8 to 70.1 dB by that change alone [C].
5. **No winding flip, no handedness flag.** X3D and three.js are both right-handed, Y up, counter-clockwise front. Babylon needs `useRightHandedSystem` and a `sideOrientation`; here `solid=FALSE` is just `DoubleSide`.
6. **Transform is one matrix.** T C R SR S -SR -C keeps a shear; the Babylon body decomposes to TRS and logs the loss.
7. **The first Viewpoint is bound at load** (19775-1 23.4.1). The first run drew at the default pose and missed X_ITE by IoU 0.34 to 0.64 on every fixture until this was added; with it, 1.00.

## Known gaps (also in each spec's `gaps` and `scope`)

`global=FALSE` lights light the whole scene; material `ambientIntensity` is a fixed 0.2; PointLight, SpotLight, Fog, textures beyond a plain `ImageTexture`, Billboard, ClipPlane, picking and pointer sensors are not drawn yet (`body-three.js` notes `skipped <Node>`; `src/nodes/` is empty on purpose, the registry is in place); the PhysicalMaterial sphere has no environment, so it is near black in both engines; no real-GPU timing exists and none is claimed.

## Adding a node

`driver.py next 10`, then write a fixture and spec (copy the nearest in `fixtures/`), then add `src/nodes/NODE.js` to this tree: it registers `R.bridge.three.build.NODE(body, n, parent, chain)`, `R.bridge.three.geometry.NODE(g, body)` (return a `BufferGeometry`) and `R.bridge.three.changed.NODE(body, n, field)`. The Babylon node file is not touched; the reader half it already carries (field table, ROUTE behaviour) is reused as it is. Then `driver.py check NODE`. A node whose Babylon file only returns vertex data (`geometry` hooks, 15 of 15) needs only the geometry function.
