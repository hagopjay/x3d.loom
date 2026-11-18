# d3-x3d: write D3 layouts as X3D 4.0

A dependency-free ES module (`x3d.mjs`) that turns the numbers D3 computes (positions, radii, angles, depths, colours) into X3D 4.0 XML strings. D3 owns the maths; X3D owns light, material, navigation and animation.

First used by x3d.demo `docs/demos/d3-bridge/v1/` (16 scenes, 16 of 16 valid against the X3D 4.0 XSD via x3d_mcp validate_xml fa5dccf; 16 of 16 load in headless Chromium + X_ITE 16.6.0 with 0 console errors). The full build script that uses it is that demo's `tools/build.mjs`.

| Export | What it writes |
|---|---|
| `Scene` | the document: head meta (provenance), WorldInfo, NavigationInfo (headlight off), gradient Background, look-at Viewpoints, a 3-light rig (key with optional shadows, fill, rim); `sc.app(color, opts)` caches each Appearance once and USEs it after |
| `T`, `shape`, `box`, `sphere`, `cyl` | Transform / Shape / primitives (sizes clamped above 0.001 so the XSD never sees a zero) |
| `label`, `flatText` | billboarded or plane-lying Text with UnlitMaterial |
| `lines` | one IndexedLineSet for many polylines, optional per-line Color, optional DEF on the Coordinate (for SAI updates) |
| `tube`, `revolve` | Extrusion along a path (circular section) and solids of revolution (violin) |
| `faces` | IndexedFaceSet with optional per-vertex Color (sankey ribbons, ridgelines) |
| `lookAt`, `rotY` | Viewpoint orientation from position and target; rotation that turns +Y onto a vector (spikes on a globe) |
| `rgb` | accepts `#hex` and `rgb()` strings, which is what d3-scale-chromatic returns |

Minimal use:

```js
import * as d3 from 'd3';
import { Scene, T, shape, sphere } from './x3d.mjs';
const root = d3.pack().size([10, 10])(d3.hierarchy(data).sum(d => d.value));
const sc = new Scene({ title: 'Pack', desc: 'd3.pack as spheres', views: [{ name: 'Top', pos: [0, 14, 0.01] }] });
root.leaves().forEach(n => sc.add(T([n.x - 5, n.r, n.y - 5], shape(sphere(n.r), sc.app(d3.interpolateViridis(n.depth / 3))))));
fs.writeFileSync('pack.x3d', sc.toString());
```

Live mode: name each Transform (`T(pos, kids, { def: 'N' + i })`) and the line Coordinate (`lines(..., { coordDef: 'EC' })`), run d3-force-3d in the page, and on each tick set `Transform.translation` and `Coordinate.point` through the X_ITE SAI. See the demo's `index.html` (`startLive`).

## v2 additions (18 Nov 2026, from x3d.demo d3-bridge/v2)

- **Label declutter.** `label()` now registers each label with the Scene. `toString()` projects every label through the first viewpoint (field of view and an aspect ratio of 1.4), keeps them greedily by `pri`, and wraps the losers in an `LOD` so they appear when the camera is within reach. `sc.stats` reports `overlapPairsBefore` and `overlapPairsAfter`. Use `keep: true` to force a label, and `raw: true` for labels that sit inside a moving Transform, since those positions are local and cannot be projected.
- **Patterns proven in v2** (see that demo's `tools/build2.mjs`):
  - Per-arch TouchSensors with their own Material DEFs, so the page can isolate an arch.
  - Bead loops: a TimeSensor and a PositionInterpolator per bead, with a duplicate key at the wrap so a phase-shifted bead jumps instead of streaking.
  - A time slab made of a ClipPlane in a Transform that moves with the slab, wrapping content in a counter-moving Transform. The plane moves and the content stays still, so no script runs.

## DEF hygiene (v2.2)

`hygiene.mjs` exports `defHygiene(xml, pageNames)`. Run it on the finished scene. It keeps a DEF only when the file USEs it, a ROUTE names it, or `pageNames` matches it (names the page reaches through SAI). It declares page names with `<EXPORT localDEF AS>` and replaces an empty `<Group/>` LOD far level with a `WorldInfo`. On the 16 d3-bridge scenes, the x3d_mcp semantic receipt went from 64 warnings and 1,305 info notes to 0 and 0, and nothing renders differently (headless check, 0 console errors). Keep `pageNames` in step with the page: a missed name loses its DEF, and `getNamedNode` then throws.
