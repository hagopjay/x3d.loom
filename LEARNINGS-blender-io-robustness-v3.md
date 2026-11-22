# What reviewing the Blender I/O robustness plan teaches (22 Nov 2026)

Source: a review of "Blender I/O for X3D 4.0: robustness plan, v2" against hagopjay/x3d-blender-io main at `47ed742`,
x3d.loom at `eb1db1e`, x3d.wgpu at `86f39bd` and the Demo 57 coverage board. Run record with scripts and data:
`runs/blender-io-perturb-20261122/`. Grades: **C** = a named tool ran in this work or the file was read at the named commit,
**L** = read or reasoned, **S** = suspected. Environment of every measured **C**: Linux x86_64, Blender 5.3.0 `bpy` wheel,
Python 3.13.18, x3d.py 4.0.65.8, no GPU.

## Findings

| # | Finding | Grade | Evidence | Rule it suggests |
|---|---|---|---|---|
| 1 | **A scanner of what a converter reads cannot find what it never reads.** One-at-a-time perturbation of 363 scalar Blender properties changed the X3D 4.0 export for 39; 324 left it byte-identical, and none of the 324 has a declared class anywhere. | C | `perturb-result.json` | Find silent loss by perturbing the input and diffing the output. A declared-mapping gate needs rows for the source side, not only for the elements written. |
| 2 | **Single-factor perturbation under-counts.** Emission Color is inert while Emission Strength is 0; `ortho_scale` while the camera is perspective. | C | same run | A sweep states its starting states, uses at least three, and pairs known switches. "Inert" is a claim about a state, not about a property. |
| 3 | **Nondeterminism belongs to a named step.** Four processes that built a UV sphere gave four files; four that opened one saved .blend gave one. The writer was blamed; the primitive operator was the cause. | C | `det.py`, `det2.py` | Law 42 for converters: before fixing nondeterminism, bisect it across build, convert and write. Freeze fixtures as files. |
| 4 | **Sorting geometry for stable bytes is a risky fix.** Vertex order is referenced by skinCoordIndex and CoordinateInterpolator keys. | L | X3D 4.0 field semantics | Prefer frozen inputs to canonicalising outputs when an index is shared between fields. |
| 5 | **A budget of differences hides its largest group unless someone reads it.** ROUTE is 62 of 221 first-trip differences in the main profile (toNode 29, fromNode 16, toField 13, extra 4); the plan's summary named other causes. | C for counts, L for cause (DEF renaming) | `tools/io_sync/first_trip_budget.json` at `47ed742` | A budget file ships with a generated ranking by element; a plan quotes the ranking, not a memory of it. |
| 6 | **"Declared" is not "measured".** 13 of 49 declared nodes are marked `unmeasured`: Material, Box, Sphere, Cone, Cylinder, Color, LineProperties, Circle2D, Rectangle2D, BooleanFilter, ProximitySensor, TouchSensor, MetadataSet. | C | `tools/io_sync/parity.json` | A class that means "no evidence" is allowed in a table only with a date by which it must go. |
| 7 | **Thresholds copied from a requirements note became a gate in a plan.** Mean delta-E 2000 below 2.0 and SSIM above 0.95 are in profile `x3d-blender-fidelity/v1`, which says no comparator exists and the thresholds are unmeasured. The glTF Loom measured Cycles failing 4 of 7 assets against raster engines on shadows alone. | C | `kit/profiles/x3d-blender-fidelity.json`, `formats/gltf/SPEC.md` | Law 43 applied early: a plan may not gate on a threshold until a calibration run has written it. A path tracer is a witness, not a candidate. |
| 8 | **Remove the renderer from an exporter comparison.** Build once in Blender, export X3D with the add-on and glb with Blender's own exporter, draw both in X_ITE (which reads glb through Inline). Any difference is an exporter difference. | L (design; not run) | glTF Loom already drives X_ITE with glb through an X3D 4.0 Inline | Same renderer, two converters, before two renderers, one converter. |
| 9 | **Four Blender versions stood behind four numbers** in one plan: tests on 4.5.14, 5.1.2, 5.2.2; round-trip gate on 5.1.2; render gate on 5.3.0; coverage on 5.1.0. | C | `.github/workflows/ci.yml`, `gate-baseline.json`, the plan | Law 15 at plan level: one instruments table per repository, checked by CI, and every number cites a row. |
| 10 | **A waiver list is a budget.** 27 of 43 baselined render scenes pass under a recorded known defect (D11, Text, on 14). | C | `tools/fidelity_rig/gate-baseline.json` | Count waivers in CI and let the count only shrink. |
| 11 | **The product's default was the legacy path.** `x3d_version` defaults to `X3D33` while the plan names 4.0 the product. | C | `source/__init__.py` at `47ed742` | A plan that names a product path checks what the default button does. |
| 12 | **A receipt in the file header can break the properties it reports on.** Head meta already change on every export (asymmetry A11). | C for A11, L for the conflict | `parity.json` | Put the full receipt beside the file and one content-derived hash line inside it. |

## Proposed additions (not applied here; each needs a run first, law 8)

* Profile `x3d-blender-fidelity/v1`: add a `calibration` block (engines, scenes, measured spread) and refuse acceptance on
  colour and structure gates while it is empty.
* A new witness, `perturbation`, for any converter under the Loom: source properties changed, outputs changed, undeclared
  inert count. glTF and USD converters can run the same sweep.
* A converter loss receipt that shares its header with `loom.render-receipt/1` (subject hash, tools, host, prev, seal) and its
  vocabulary with x3d.wgpu's loss report (skipped, approximated, warnings), so one query spans render and conversion losses.
* Every receipt failure carries a locus, a mapping row id and a rule link, so receipts can be mined for rules later.

## What this does not prove

* The probe is export-side, one scene, one starting state, scalar properties only.
* No import-side sweep, no render and no calibration were run.
* The cause of the ROUTE differences is read from the budget keys and earlier lane notes, not reproduced.
* The plan's branch-coverage table and its Blender 5.1.0 failing test were not re-run.
