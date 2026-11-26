# Agent 4: Q12 residue work list

## Blocking finding (C)
The per-pair data behind 359 / 140 / 117 / 102 is not in the repo. `docs/usd-q12-blender-join-20261126.json` is the 84-fixture run 1: 1,776 pairs, 8 both, 17 X3D-only, 1 export-made, 2 "X3D missed?" (C). The real-file figures exist only as one sentence in `x3d.loom/LEARNINGS-flywheel-turn-4.md` line 12 (C). `x3d.nVidia/q12/` is not on this machine (C). So I cannot split 102 or 117 by rule or check; the tables use turn-4's prose plus fixture evidence. The fixture rows below are the only per-rule evidence available; they do not add to 102 or 117.

## Table 1: USD-only (102), by cause named in turn 4 (C for counts, L for category)
| USD rule (likely) | Pairs | Cat | Evidence |
|---|---|---|---|
| PointSet/LineSet written as faceless Meshes (rules unnamed; likely Manifold/Weld/Topology) | 38 | b | Turn-4 says "belong to the Blender leg" (C); X3D has no mesh there (L) |
| Non-manifold vertices (oav:ManifoldChecker) | 32 | b, partly a? | Turn 4: "Likely made on the Blender leg" (C). Fixture: unused-point/bad export-made, index-oob/bad repair-made (C) |
| PointSet normals length 0 (oav:NormalsValidChecker) | 6 | b | Turn 4 (C) |
| Unused points / extents (UnusedMeshTopology, ExtentsChecker) | 8 | b | Turn 4 (C); extents are computed by the exporter (L) |
| SimReady VG.008 coincident across Transforms (`scatter.x3d`) | 1+ | a | Fixed by branch `q12-coincident-world` (C); pair count not given (S: 1) |
| Unattributed | about 17 | ? | 102 minus 85 named. Turn 4 says "one miss"; may be rounding of the named groups (S) |
Category c (USD-only concept): none identified in the data (L). Parity table marks variant sets, API schemas, GeomSubset and lux inputs as "design" (C), but these never fire from a Blender export, so they should not appear in USD-only.
Check: 38+32+6+8+1 = 85, not 102. The 17 gap is unexplained; 17 coincides with run 1's X3D-only count, probably chance (S).

## Table 2: X3D-only (117) (fixture evidence only; real-file split not recoverable)
| X3D check | Fixture pairs | Cat |
|---|---|---|
| index-out-of-range (ValidateTopology) | 1 | export lost: importer repairs (C/L) |
| physics-joint-body, physics-body-shared, physics-inertia (Joint/RigidBody/Mass, usd + oav) | 5 | X3D advantage / lost in export (L) |
| normal-not-unit, bbox-too-small | 2 | lost in export (L) |
| containerfield-unknown, XSD unknown-node, type (Type/Encapsulation/LayerSpec/AttributeTypeMismatch) | 6 | XSD faults laundered by tolerant importer (C) |
| use-undefined-def, proto-undeclared | 2 | lost in export (C) |
| pbr-range, mesh-unused-value | 2 | lost in export / possible X3D-only strictness (S) |
Total 17 fixture pairs (C) vs 117 real; remaining 100 unrecoverable.

## Ranked candidate X3D checks (category a)
1. **mesh-coincident world pass** (shipped). Reads shape geometry hash plus accumulated Transform; flags equal geometry at equal world pose across parents. Converts VG.008 pairs (1+ known). Exemption: instances via USE.
2. **mesh-non-manifold** (new). Reads IndexedFaceSet/IndexedTriangleSet coordIndex; flag an edge used by more than 2 faces or a vertex whose faces form more than one fan. Potentially up to 32 pairs if they are source faults (S). Exempt PointSet/LineSet, solid=FALSE open shells (boundary edges are fine). Survey first (FM 395).
3. **pointset-zero-normal**. Reads Normal vectors attached to PointSet/IndexedFaceSet; flag length < 1e-6. Up to 6 pairs but probably Blender-made, so likely 0 (S). Existing normal-not-unit may already cover it.
4. **mesh-unused-point on non-indexed/loose primitives**. Reads coord.point count against coordIndex use; exemption for PointSet. Up to 8 pairs (S).
5. **extents-vs-points (bbox-too-small inverse)**. Reads Shape bboxSize/bboxCenter versus coord bounds; flag bbox larger than 10x points. Up to 8 pairs, probably 0 as USD extents are exporter output (S).
6. **faceless-geometry-in-mesh-target** (policy, not fault). PointSet/LineSet warn "no mesh in USD." Up to 38 pairs but it labels an export loss, not a defect; recommend EXPECTED_LOSS instead (L).

## Suspected X3D false alarms (S)
No evidence of any in the data. Candidates to audit on real files: pbr-range and mesh-unused-value (USD passes, X3D has no code in fixtures: `x3d_codes` empty for unused-value, pbr-range, type, unknown-node, so the join credits them via the MAP, not a fired code), and physics-inertia (MassChecker passes).

## Next step
Get the Q12 run-2 receipt from x3d.nVidia and group by rule; then 38+32+6+8 can be tested as export-made by rendering PointSet scenes without Blender.
