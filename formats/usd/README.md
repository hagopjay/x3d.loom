# X3D ⇄ OpenUSD with the semantics kept (v0.1, 28 Nov 2026)

`x3dusd.py` converts X3D to USD and back. It keeps X3D Metadata as typed, namespaced USD attributes, so meaning a
domain wrote into X3D (here IFC) crosses into USD and comes back. It is the USD leg of the IFC loop
([../../x3d.engineering/ifc-loop/](../../x3d.engineering/ifc-loop/)), and it is the first lane that measures what a
USD carrier keeps. The rulebook work (`x3d_mcp` USD parity: 66 plus 20 of 340 rules) measures what USD
validators would say about X3D content. This lane is different: it reads the semantics back out of the USD file.

`IFC A → ifc2x3d → X3D → x3dusd to-usd → .usda → x3dusd to-x3d → X3D′ → x3d2ifc → IFC B`, compared with A.

## How it maps

| X3D | USD (usd-core 26.11) |
|---|---|
| Group, Transform | `Xform`; a Transform becomes one `xformOp:transform` (matrix4d); customData `x3d_node`, `x3d_DEF` |
| Metadata* on a node | `custom` attributes `x3d:meta:<set>:<name>`, typed (`bool[]`, `int[]`, `double[]`, `float[]`, `string[]`); customData holds the node type, the original name, `reference` and the order |
| MetadataSet | a token attribute `<path>:__set` carrying the set's own name and reference |
| IFC class | also `SemanticsLabelsAPI:ifc`, so USD-native tools can read it without knowing X3D |
| IndexedTriangleSet | `Mesh` (point3f) |
| Extrusion | `Mesh` of its tessellation for the eye, plus `x3d:extrusion:crossSection` / `spine` so the parametric node comes back |
| head meta, WorldInfo | layer `customLayerData` |

Stage: `metersPerUnit = 1`, `upAxis = Y`, `defaultPrim = World`. Any node outside this set is refused, not guessed.

## Result (usd-core 26.11 `UsdValidation`, 30 validators; ifcopenshell 0.9.0.post1)

| row | Confluence | Truss |
|---|---|---|
| spatial elements, every attribute | 4 / 4 | 3 / 3 |
| containment edges | 111 / 111 | 33 / 33 |
| property values, typed | 444 / 444 | 198 / 198 |
| pset and relation GlobalIds | 111 / 111 | 33 / 33 |
| extrusions kept as parameters | 29 / 29 | 33 / 33 |
| placement chain | 111 / 111 | 35 / 35 |
| triangulated face sets, same indices, coordinates within 0.001 mm | 82 / 82 (worst 0.00039 mm) | none |
| USD validators: errors | 0 | 0 |
| validator control (stage metadata removed) | 3 errors (MissingMetersPerUnit, MissingUpAxis, MissingDefaultPrim) | 3 errors |

**Baseline: Blender 5.3.0's own USD export** of the same X3D (imported with x3d-blender-io fcc41e7, then
`wm.usd_export(export_custom_properties=True)`):

| | Confluence | Truss |
|---|---|---|
| property values present | **0 of 444** | **0 of 198** |
| IFC class names present | 0 of 114 | 0 of 35 |
| GlobalIds | 115 of 115, but only inside DEF names (`x3d_def`), which no USD tool reads as an id | 36 of 36, same |

The add-on keeps Metadata as nested dict custom properties. Blender's USD exporter writes only simple custom
properties, so the IFC meaning stays in the .blend and never reaches the .usdc (Confirmed by these counts; the
cause is read from the property types, Likely).

**What USD costs.** `Mesh.points` is point3f (float32). At 10 m in millimetres that costs up to 0.00039 mm.
Everything else is exact, because metadata, transforms (matrix4d) and extrusion fields are all doubles or strings.

Run: `python3 usd_loop_receipt.py NAME A.ifc LOOP.x3d [--blender-usd BLENDER.usdc]` → `results/NAME-usd-loop-receipt.json`.

**Not claimed:** UsdShade materials (only `displayColor`), UsdPhysics, instancing, variants, payloads, any USD file
not written by this tool, and Omniverse/Isaac loading (not run).
