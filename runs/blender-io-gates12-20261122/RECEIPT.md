# Run record: Blender I/O robustness plan v3, Gates 1 and 2 built and measured (22 Nov 2026)

The work these numbers come from: hagopjay/x3d-blender-io PR #72, branch `claude/project-thread-kndq7j`, built on main
`47ed742` and merged with `4f82db2` (the behaviour lane's #71). Lessons: `../../LEARNINGS-blender-io-gates-1-2.md`.
The plan and its review: `../blender-io-perturb-20261122/`, `../../LEARNINGS-blender-io-robustness-v3.md`.

## Instruments

| Item | Value |
|---|---|
| Blender | bpy 5.3.0 wheel (Python 3.13.18); binaries 4.5.14 LTS, 5.1.2, 5.2.2 LTS (linux x64, headless) |
| X3D validator | x3d.py 4.0.65.8; Web3D X3dSchematronValidityChecks.sch sha256 `9e728c7a…` (Last-Modified 21 Oct 2025) through the ISO skeleton on SaxonC-HE 13.1.1 |
| Renderer | X_ITE 16.7.1 (npm ci, rig lock) in Playwright's Chromium 157.0.8103.78, SwiftShader, 512 x 512 |
| glTF exporter | io_scene_gltf2 5.3.43 (ships with Blender 5.3.0), lighting mode COMPAT |
| Host | Linux x86_64 container, no GPU |

## Files

| File | What it is |
|---|---|
| `sweep-summaries.json` | perturbation sweep, 3 starting states, judged against the mapping table, per Blender version: totals, summary, verdict |
| `invariants-broken.json` | round-trip invariants that break from E0 to E1 per suite profile, per Blender binary |
| `same-renderer-results.json` | X_ITE on the add-on's X3D vs X_ITE on Blender's glb: mean delta, delta where drawn, coverage, per frozen scene |
| `same-renderer-baseline.json` | the tolerances written from that calibration run, with a reason per non-zero scene |

## Results

| Judge | 4.5.14 LTS | 5.1.2 | 5.2.2 LTS | bpy 5.3.0 |
|---|---|---|---|---|
| Sweep: properties / carried in any state | 371 / 56 | 374 / 54 | 377 / 54 | 379 / 54 |
| Sweep verdict (undeclared, silent loss, stale row, receipt disagrees) | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| Golden files (12 frozen scenes) | 12 of 12 | 12 of 12 | 12 of 12 | 12 of 12 |
| Metamorphic relations (6 x 12) | pass | pass | pass | pass |
| Fixed point E1 to E2 (main / crease / x41) | 0 / 0 / 0 (10 Normal before the fix) | 0 / 0 / 0 | 0 / 0 / 0 | n/a |
| Invariants that break E0 to E1 (main) | materials, routes, instancing | same | same | n/a |
| Schematron gate, unexplained errors | 0 | | 0 | (suite from 5.3.0: 0) |

Same renderer, two exporters (bpy 5.3.0): mean delta 0.00 on lit_cube, two_materials, uv_grid, linked_instances;
0.02 emissive_glass; 0.26 smooth_torus; 0.69 loose_edges; 2.03 hierarchy; 3.88 cameras and keyframes; 4.93 four_lights;
10.19 vertex_colours. Blender's default lighting mode (SPEC): lit_cube 67.86 (sun written as 546.4 lux).

Planted faults, each caught by its judge: roughness-dropped, spot-blend-carried, receipt-forgets-clamp (sweep);
roughness-dropped-golden (golden); translation-axes-swapped (metamorphic); basecolour-channels-swapped (same renderer);
8 file edits (invariants); 4 Schematron fixture files.

Rerun: see docs/ORACLES.md in the add-on; every command there prints the numbers above.
