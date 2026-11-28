# IFC loop: IFC → X3D → IFC with nothing lost on two models

This builds on the loss receipt in [../ifc-truss/](../ifc-truss/) (x3d.loom #234). That receipt found the
Confluence studio's X3D keeps geometry to 8.1e-9 but loses the spatial tree, 2 of 4 property keys on every
element, and the parameters of 29 extruded solids. This folder carries all three across and back.

| file | does |
|---|---|
| `ifc2x3d.py` | IFC4 → X3D 4.0 (Immersive profile, standard nodes only) |
| `x3d2ifc.py` | X3D → IFC4, reading nothing but the X3D |
| `loop_receipt.py` | A → X3D → B, compares A with B row by row, then runs planted controls that must fail |

Run: `python3 loop_receipt.py MODEL.ifc --name NAME` (needs ifcopenshell 0.9.0.post1, numpy).

## How IFC travels in X3D

| IFC | X3D |
|---|---|
| Project, Site, Building, Storey | nested `Group`, `MetadataSet name="IFC"` with GlobalId, class and every direct attribute (typed) |
| IfcRelAggregates, IfcRelContainedInSpatialStructure | the nesting, plus the relation's GlobalId |
| product | `Transform` at its world placement (metres) with the same metadata; `placementRelTo` keeps the IFC placement chain |
| IfcPropertySet | `MetadataSet reference="IfcPropertySet"`, each value typed; the IFC value type (IfcLabel, IfcBoolean, IfcReal) in `reference` |
| IfcExtrudedAreaSolid, rectangle profile | a native X3D `Extrusion`, plus every IFC number in `MetadataSet name="ifc:body"` |
| IfcExtrudedAreaSolid, other profile (for example a hollow SHS) | triangles to draw, plus every IFC number in `ifc:body` |
| IfcTriangulatedFaceSet | `IndexedTriangleSet`, coordinates copied, indices made 0-based |

Neither carrier is trusted alone. `x3d2ifc.py` checks the drawn `Extrusion` or triangles against the solid that
the `ifc:body` numbers rebuild (the extrusion witness).

## Result, 28 Nov 2026 (ifcopenshell 0.9.0.post1 on both sides, x3d_mcp 0d60c12 for validation)

| row | Confluence (#234 said lost) | Truss |
|---|---|---|
| spatial elements, every attribute | 4 / 4 (was 0 of 3 below the project) | 3 / 3 |
| aggregation edges | 3 / 3 (was lost) | 2 / 2 |
| containment edges | 111 / 111 (was lost) | 33 / 33 |
| products, every attribute | 111 / 111 | 33 / 33 |
| property values, typed | 444 / 444 (was 2 of 4 keys) | 198 / 198 |
| pset and relation GlobalIds | 111 / 111 | 33 / 33 |
| extrusions kept as parameters | 29 / 29 (was triangles only) | 33 / 33 (hollow SHS) |
| placement chain | 111 / 111 | 35 / 35 |
| triangulated face sets | 82 / 82, worst coordinate 4.8e-10 mm | none |
| worst relative volume, area | 4.5e-13, 1.8e-13 | 5.9e-14, 7.9e-15 |
| planted controls caught | 5 / 5 | 4 / 4 (1 n/a: no rectangle to widen) |
| x3d_mcp 0d60c12, XSD + semantic | valid, 0 errors, 0 warnings | valid, 0 errors, 0 warnings |

Receipts: `results/*-loop-receipt.json`, `results/receipt-validate.json`. Every row is Confirmed on these two
models only.

**Not claimed:** materials, styles, type objects, quantity sets, IfcMapConversion (neither model has them; the
writer stops and says so on a body or profile it does not know); a model written by Revit or ArchiCAD; Bonsai.

**What the validator taught.** The first scene failed the XSD in 29 places because a `MetadataSet` came after
the geometry inside `Shape`. The first GUID-to-DEF mapping (`$` as `.` then `-`) passed but drew 28 naming
warnings, since both break generated ROUTE code. `$` is now written as two characters (`__`). A 22-character
GUID cannot clash with that.

## Through Blender (28 Nov 2026): the Bonsai precondition

Bonsai (Blender BIM) works on IFC inside Blender. Before an IFC model can travel through Blender as X3D, the X3D
add-on has to carry it, so this leg sends the loop X3D through x3d-blender-io and back:

`A.ifc → ifc2x3d → X3D → x3d-blender-io import → Blender 5.3.0 → x3d-blender-io export → blender/normalize_blender.py → x3d2ifc → B.ifc`

Run: `python3 blender/blender_receipt.py MODEL.ifc --name NAME --bpy BPY_PYTHON --repo X3D_BLENDER_IO --label after`
(the bpy wheel 5.3.0 runs `blender/blender_leg.py`).

| row | Confluence, add-on 6bf1d15 (before) | Confluence, add-on fcc41e7 (after) | Truss, after |
|---|---|---|---|
| spatial elements, every attribute | 0 / 4 | 4 / 4 | 3 / 3 |
| containment edges | 0 / 111 | 111 / 111 | 33 / 33 |
| property values, typed | 0 / 444 (no tree, so nothing rebuilds) | 444 / 444 | 198 / 198 |
| extrusions kept as parameters | 0 / 29 | 29 / 29 | 33 / 33 |
| placement chain | 0 / 111 | 111 / 111 | 35 / 35 |
| triangulated face sets, same triangle count | 0 / 82 | 82 / 82 | none |
| world quantities, 1e-5 relative, bbox 0.01 mm | 0 / 111 | 111 / 111 | 33 / 33 |
| worst extrusion position drift (float32) | | 0.0019 mm | 0 mm |

**What it found.** The add-on gave a Group no Blender object. A Group's Metadata went to a scene property, and
the export wrote neither the Metadata nor the nesting. All 111 products kept their IFC metadata, but the spatial
tree arrived flat, so no IFC could be rebuilt from it. Fix: in x3d-blender-io `source/import_x3d.py`, a Group that
carries its own Metadata now gets an Empty (x3d-blender-io branch `claude/project-thread-t8ccyr`, fcc41e7,
5 new tests, 308 import, round-trip and metadata tests pass).

**What Blender changes that the normaliser undoes** (`blender/normalize_blender.py`, counts for Confluence):
every node becomes `Transform DEF="OB_…"` (5 spatial hosts back to Groups, identity checked), IndexedTriangleSet
becomes IndexedFaceSet (82 back to triangles, 0 polygons to split), and 58 extra Transforms appear between a
product and its extrusion (folded in). Blender reorders mesh vertices, so meshes are judged by triangle count and
world quantities, not by index. Receipts: `results/*-blender-{before,after}-receipt.json`.

**Not done:** Bonsai itself has not been run. That needs a full Blender with the Bonsai extension, and the bpy
wheel here cannot load it.
