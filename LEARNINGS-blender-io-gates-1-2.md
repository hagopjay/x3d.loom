# What building the Blender I/O contract and oracles teaches (22 Nov 2026)

Source: building Gates 1 and 2 of "Blender I/O for X3D 4.0: robustness plan, v3" in hagopjay/x3d-blender-io (PR #72,
on main `47ed742` + `4f82db2`). Run record: `runs/blender-io-gates12-20261122/`. Earlier review of the plan:
`LEARNINGS-blender-io-robustness-v3.md`. Grades: **C** = measured in this work with the named tool, **L** = read or
reasoned, **S** = suspected.

## Findings

| # | Finding | Grade | Evidence | Rule it suggests |
|---|---|---|---|---|
| 1 | **Three starting states found 54 carried properties where one state found 39.** Emission, coat, transmission, ortho and panoramic cameras, quaternion and axis-angle rotation each unmask properties the factory state hides. | C | `sweep-summaries.json` | A sweep names its starting states; one state is a lower bound, not a count. |
| 2 | **The receipt and the sweep must be two implementations.** The receipt rules live in `source/receipt.py`; the sweep recomputes the expected entry with its own copy (`rule_fires`). Planting a fault in the receipt made them disagree, which is the point. | C | plant `receipt-forgets-clamp` caught | A self-report is checked by a second, independent computation of what it should say. |
| 3 | **A property whose setter does not stick fools both judges the same way.** Light `use_nodes` is deprecated: the setter is accepted, the value does not change, and RNA's default differs from the runtime value, so receipt and sweep disagreed on 12 exports until the row said "dropped, no receipt". | C | sweep before and after | Read a value back after setting it; a write that does not stick is its own row class. |
| 4 | **Rows are versioned.** Blender 4.5.14 carries `world.color` and `world.use_nodes` into Background; 5.x does not (they became editor-only). One table serves four versions with `before: {"5.0": ...}` overrides. | C | 4.5.14 stale_row before the override, PASS after | A mapping table row names the version range it was measured on. |
| 5 | **A golden file needs frozen inputs, not a canonical output alone.** Scenes built with `from_pydata` gave byte-equal canonical exports on 4.5.14, 5.1.2, 5.2.2 and 5.3.0; the plan's R8 showed operator-built primitives do not. | C | `golden.py` 12 of 12 on each | Build fixtures from data; canonicalise only what describes the run (date, generator). |
| 6 | **Metamorphic relations find what goldens cannot: a moved binding.** Reversing the outliner kept every subtree but changed the first Viewpoint in 1 of 12 scenes, so a browser opens on a different camera while Blender's active camera did not change. No golden file would flag it (nothing in the scene changed). | C | `test_r3`, all four versions | Every reorder relation pins what the format binds by position (first Viewpoint, Background, NavigationInfo). |
| 7 | **A non-converging round trip can hide in one LTS line.** Blender 4.5.14 gave a degenerate text face a normal of length 4.8e-05; the export wrote it, the import normalised it, so E1 to E2 had 10 differences on 4.5.14 only. CI ran the round trip on 5.1.2 alone. | C | `fixed_point.py` on three binaries | Run the convergence check on every supported line, not one. |
| 8 | **A text budget and a semantic invariant see different things.** The text budget counts 221 E0 to E1 differences on main; the invariant judge reduces them to 3 broken facts (materials, routes, instancing) and holds 6 (faces, world bbox, lights, viewpoints, first viewpoint, textures). | C | `invariants-broken.json` | Keep both: the text budget catches new spellings, the invariants say what a user loses. |
| 9 | **Same renderer, two exporters isolates exporter differences.** With the renderer fixed (X_ITE), 5 of 12 frozen scenes are pixel-identical between the add-on's X3D and Blender's own glb; every other difference has a named exporter cause (vertex colours, area light, default material, loose edges). | C | `same-renderer-results.json` | Compare exporters through one renderer before comparing renderers. |
| 10 | **Units across formats need a stated convention before any picture is judged.** Blender's glTF exporter by default writes a 0.8 W/m2 sun as 546.4 lux; X_ITE draws it saturated (mean delta 68). The COMPAT convention gives 0.00. | C | both runs | A cross-format judge names its unit convention in the baseline header. |
| 11 | **A judge that compares two black frames agrees about nothing.** X3D's default view saw two floors edge-on and both legs rendered black (delta 0.00). The judge now places its own Viewpoint on the export's world bounding box and fails a blank frame. | C | first and second runs | Every image judge checks coverage before delta. |
| 12 | **The upstream validator has bugs too.** The Web3D Schematron's HAnimJoint USE rule uses an absolute `//` and fires whenever a scene has two humanoids. Listed as a disagreement with a named suspect judge and a count that may only shrink. | C | `.sch` line 3674, suite x41 | A validator's error is a claim; disagreements are fixtures with a suspect. |

## Laws these confirm

Law 19 and Law 44 (every judge fails a planted fault): 6 code plants and 12 file plants, all caught in CI. Law 15 (one
version per number): every number above names its Blender build.

## Proposed (not applied to LOOM-v1.md; for the owner)

* A `perturbation` witness for any converter under the Loom: properties, starting states, carried, inert, undeclared.
* An `invariants` witness for round trips: the named facts that hold and break, with a shrink-only budget.
* A `same-renderer` witness: renderer and unit convention fixed, exporter varied, tolerance written before gating.

## What this does not prove

* The sweep covers scalar RNA properties of one probe scene (plus six structural targets), not node graphs or modifiers.
* The receipt's 195-of-195 suite agreement (decision 2) is not measured; the sidecar stays opt-in.
* The same-renderer tolerances were calibrated on Chromium 157; CI's Playwright Chromium may differ.
* The importer side has no sweep yet (Gate 3, out of scope).

## Addendum: fortifying 2.7.1 (x3d-blender-io PR #73)

Three cheap exporter fixes taken from findings 6 and 1 above: the active camera's Viewpoint is written first, an ORTHO
camera becomes an OrthoViewpoint that the import reads back, and light temperature folds into the colour.

| # | Finding | Grade | Evidence | Rule it suggests |
|---|---|---|---|---|
| 13 | **A judge's budget is a to-do list.** R3's budget (1 of 12 scenes) and the first-trip budget's `Viewpoint fieldOfView` group (1 per profile) each pointed at one fix; both went to 0 and the test now asserts 0. | C | `test_r3`, `first_trip_budget.json` | When a fix lands, shrink the budget in the same change so the gain cannot slip back. |
| 14 | **A new node can trip a validator's own bug.** The first OrthoViewpoint made the Web3D Schematron report 7 Viewpoints per file as needing Navigation level 3, which the head declared. The rule's `count(preceding::OrthoViewpoint) > 0` sits outside its parentheses (.sch line 2495); a two-node file shows it (1 error with the OrthoViewpoint first, 0 second). | C | repro, `disagreements.json` | Reduce every unexplained validator error to a minimal file before changing the export to satisfy it. |
| 15 | **Fixing one loss moves other numbers too.** Carrying three properties raised the sweep's carried count from 54 to 63. The rows for a light's `use_temperature` switch moved with it, and the file gained a Navigation component level. | C | sweep on 4 versions, `x3d_fields.json` | Regenerate the whole contract (rows, fields, parity, golden, budgets) in the PR that changes the export. |
| 16 | **Views ignore Transform scale, so view lengths need the export's scale.** Under a global scale of 2, the OrthoViewpoint extents double, as the clip distances already did; metamorphic R4 had to learn that a view's own lengths change. | C | `test_r4` | A scale relation lists the fields that scale with the scene even though they sit outside its Transform. |
