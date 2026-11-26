# Pre-registered predictions: new x3d_mcp rules on the Downey stack

Written 2026-11-26 ~16:10 UTC, BEFORE any validator ran on the stack at either commit.
Inputs known at this point: x3d.downey tree 550594f (monolith kit, 15 commits replayed; tree identical to the
building session's), 20 scenes under scenes/, node census by grep (1954 Shape, 725 Sphere, 661 LineSet, 526 Box,
28 Cylinder, 6 ElevationGrid, 5 IndexedFaceSet, 3 PointSet, 52 ROUTE, 21+3+2 interpolators, no textures, no Inline,
no HAnim, no RigidBody). The check code at main was read (levels, triggers); no scene was run through it.

Baseline: x3d_mcp 4d433af (#30, the commit the stack was accepted on; parent of #31).
Current:  x3d_mcp 5543a7b (main after #31 glTF parity, #32 USD parity, #33 Q12, #34 world-place mesh-coincident).
Mode A = semantic_diagnostics(text) exactly as the Loom grammar witness calls it (no base_dir, no file checks).
Mode B = semantic_diagnostics_with_files(text, scene_dir) (current only; adds url/file checks).

| # | Prediction | Basis |
|---|---|---|
| P1 | XSD verdicts identical at both commits (20/20 valid) | validate.py not in the 4d433af..5543a7b diff |
| P2 | Baseline: 0 semantic errors, 0 warnings on 20/20 (as the v4 receipt says) | runs/20261124-content/evidence/meaning.json |
| P3 | Current: 0 NEW errors on all 20; the Downey gate (semantic_errors == 0) still accepts 20/20 | no textures, HAnim, physics, Tangent, PixelTexture: every new error-level check is out of scope |
| P4 | Current: new warnings in at most 3 scenes; candidates scale-zero (zero-height bars), route-fan-in, coordinate-precision | generated data viz |
| P5 | Current: new infos in at least 5 scenes, dominated by mesh-colocated-points (LineSet polylines) and mesh-coincident (repeated data points, world-place pass from #34) | data plots repeat positions |
| P6 | Most new findings are idiom / profile-only, not true defects: true defects <= 2 | stack already passed 17/17 witnesses and three blind readers |
| P7 | Mode B adds 0 findings (no url fields) | grep: no ImageTexture, Inline, AudioClip, MovieTexture |
| P8 | Runtime per scene stays under 2 s at current main on life.x3d (480 KB) | the world-place pass is O(shapes) with a dict |
