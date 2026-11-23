# What the third chaos round teaches: replaying the rules a machine wrote (23 Nov 2026)

Source: hagopjay/x3d-blender-io 2.7.4 (`docs/CHAOS.md` "Third round", `tests/test_chaos_round3_bpy.py`, the
`replay` cases in `tools/chaos/hostile.py`), and the receipt-to-rule engine (`kit/loomkit/r2r`, x3d.loom #164).
Grades: **C** = measured here with the named tool, **L** = read or reasoned, **S** = suspected.
Follows [LEARNINGS-chaos-round-2-20261122.md](LEARNINGS-chaos-round-2-20261122.md).

This round had no new mutator. The engine had turned the 2.7.1 crash receipts into 28 candidate rules and replayed
them on 2.7.3. Six rules still crashed, and its sweep of 514 real files found two failing files. Each was reproduced
on 2.7.3 main (8e56437), fixed, and turned into a gated hostile case and a test.

| Run (bpy 5.3.0) | 2.7.3 | 2.7.4 |
|---|---|---|
| The 8 repro files, import then re-export, each under a 6 GB limit | 8 of 8 crash | 0 of 8 (C) |
| The 6 `replay` hostile cases | 6 of 6 findings | 0 of 6 (C) |
| All 73 hostile files | – | 0 of 73 (C) |
| Scene chaos rng 7, 11, 23 (per-op 2) | – | rng 11 found 1 more, fixed; then 0 of 46 each (C) |

| # | Finding | Grade | Evidence | Rule it suggests |
|---|---|---|---|---|
| 1 | **A rule replayed on the next release is a regression test that writes itself.** Six of 28 rules from 2.7.1 receipts still crashed 2.7.3, two releases and two chaos rounds later. None of the earlier rounds' seeds happened to hit them. | C | r2r replay, loom #164; r3 repros | Replay every induced rule on every release, as a gate, not once. |
| 2 | **One fault can hide behind four names.** The colour pass, the texture-coordinate pass, the strip set and the triangle set crashed in four places for one cause: an index past the points went to Blender as it was. The face set already had the fix (`validate_points_field`); the triangle sets never got it. | C | IndexError at ApplyColors / ApplyUVs, 2.7.3 | When a guard is added to one reader, list its siblings and add it there too. |
| 3 | **A bug can look like a resource limit.** The three-fan IndexedTriangleFanSet took 35 s and 4.4 GB before raising RuntimeError. The cause was one wrong restart index (`i = j + 2`, not `i + j + 2`), not the file's size. | C | hostile `r2r_itfs_three_fans`, 2.7.3 | Read the stack before raising a budget. |
| 4 | **The judge was the bug.** Every MetadataBoolean was refused by the export: our own semantic check read MFBool `true false` as numbers. BooleanSequencer keyValue had the same fault. The file was valid. | C | ValueError at `_modern_writer`, 2.7.3 | Test a validator with one valid value of every field type it claims. |
| 5 | **One file behind a rule cannot say which feature is the cause.** The MetadataBoolean file was also explained by a second rule ("a USE before its DEF"), which the engine graded Suspected. The fix closed both. | C | r2r-dc636828c7f3 | Do not promote a rule from one file; the Suspected grade is the honest one. |
| 6 | **A node the reader never names is a crash, not a skip.** CoordinateDouble under a triangle set raised AttributeError, because only `Coordinate` was looked up and the result was not checked for None. | C | 2 real files in the project | Look up every spec a field can hold, and check for None. |
| 7 | **The held-out seed found one more.** Scene chaos rng 11 found an Alpha of 1e39 written as transparency -3.4e38 by the X3D 3.3 writer, which has no gate. The 4.0 writer is gated. | C | scene chaos rng 11, `hierarchy__027__material_values` | A writer without a gate needs a clamp for every bounded field. |

Rule for the Loom (L): receipts → rules → replay is a flywheel only if the replay runs on every release. A rule that
stops crashing is a pass to keep; a rule that crashes again is a regression with its repro already attached.
