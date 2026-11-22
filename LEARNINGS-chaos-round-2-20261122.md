# What the second chaos round teaches: the export side, the round trip, hostile files (22 Nov 2026)

Source: hagopjay/x3d-blender-io PR #76 (2.7.3), `tools/chaos/scene_chaos.py`, `tools/chaos/hostile.py`,
`tools/chaos/shrink.py`, `docs/CHAOS.md` "Second round". Grades: **C** = measured here with the named tool,
**L** = read or reasoned, **S** = suspected. Follows [LEARNINGS-chaos-round-20261122.md](LEARNINGS-chaos-round-20261122.md).

The first round mutated files and watched the import. This one breaks the other three sides:
- **scene chaos** applies one of 22 edits to a Blender scene and exports with random options. It runs the validators,
  then imports, exports, imports and exports again; the last two exports must be equal in canonical form;
- **hostile files** are 67 files built to hurt a reader. Each runs in its own process under memory, file-size and time
  limits, with a network-hit counter and a disclosure sentinel.

Before and after use the same judges and the same seeds: the 2.7.2 source ran through them with `X3D_ADDON_SOURCE`.

| Run | 2.7.2 | 2.7.3 |
|---|---|---|
| Scene chaos, rng 7 (bpy 5.3.0) | 35 of 276 gated | 0 of 276 |
| Scene chaos, rng 7, 11, 23, with the 4.0/4.1/3.3 XSDs | – | 0 of 828 |
| Hostile files (Blender 5.2.2) | 26 of 67 | 0 of 67 (also 0 of 67 on bpy 5.3.0) |

| # | Finding | Grade | Evidence | Rule it suggests |
|---|---|---|---|---|
| 1 | **The test harness is part of the blast radius.** In the first hostile run, a texture URL of `/dev/zero` made the re-export copy the device until a 50 GB disk was full. Blender core's `path_reference_copy` copies any path it is given, devices too. | C | hostile run 1; `source/file_safety.py` | Run hostile cases in a sandbox with a file-size limit *before* the first run, and measure what each case wrote. |
| 2 | **A refusal can still be a crash.** 2.7.2 refused billion laughs and XXE safely, but the refusal left the operator as a traceback. Truncated files, NUL bytes and gzip in gzip did the same. 18 of the 26 hostile findings were safe refusals with an unsafe exit. | C | base272-hostile | A reader's "no" is a clean cancel with a reason; judge the exit, not only the outcome. |
| 3 | **A round trip invents data a file never had.** An IndexedFaceSet without texture coordinates gets the spec's default ones on import, and the export wrote them back. That was 20 of 276 drifts, the largest class. The fix is to fingerprint what the reader made up and leave it out while it is unchanged. | C | `source/default_uv.py`, FixedPointTests | Mark every value a reader computes, as distinct from what it read, so a writer can tell them apart. |
| 4 | **One value, two spellings, endless drift.** A half turn about A equals a half turn about -A. float32 picked either one, so the file changed on every trip (6 of 276). The 3.3 and 4.0 writers also spelled DEF names differently, so a name changed one trip later and moved the receipt's hash. | C | `canonical_axis_angle`, `clean_def` | A fixed point needs one canonical spelling for every value that has several. |
| 5 | **The library's decomposition makes up what it cannot see.** With a zero scale on one axis, Blender's `decompose()` invents that axis, and the rotation moved 0.7653 → 0.4832 rad per trip. Rebuilding the flat axis from the other two keeps it exact. | C | `matrix_safety.decompose_exact` | A degenerate input to a library maths call needs its own path; test zero, not only small. |
| 6 | **A fresh seed is the honest test.** Seeds 7 and 11 reached 0 after fixes made from them. Seed 23, which no fix came from, then found 2 more (a byte-order-mark DEF, a 1e-30 parent). | C | sc6c | Hold out one seed that no fix is made from, and report it separately. |
| 7 | **The validator's limits look like the file's faults.** xmllint reported a 1,500-deep export as invalid ("Excessive depth"), which is libxml2's default limit of 256, not the XSD's. | C | sc5 export-invalid | Read a judge's error before believing it: "no verdict" is not "invalid" (same rule as Schematron's depth limit, round 1). |
| 8 | **Budgets are the other half of sanitising.** Counts in a file set allocations: ElevationGrid size, subdivision (0 divided by zero; 4,096² still crashed at 6 GB, so the clamp is 1,024), PixelTexture size, Inline count, and animation keys (a 47,000 s animation grew to 1,048,574 keys in one trip). | C | `source/budget.py`, hostile + scene runs | Every number that sets a size gets a budget, a warning that names it, and an environment variable to raise it. |
| 9 | **Per-file work multiplies under fan-out.** An Inline fan-out took 90 s or more. One full deselect and one depsgraph update per Inline file grew with the scene; doing each once per import brought it to 6 s. | C | cProfile 5.6 s → 1.3 s at 300 Inlines | Profile the case that times out before raising its budget. |
| 10 | **Not every difference is drift: name the classes.** These are listed and not gated: float32 noise (206 of 828), animation resampled over budget (3), names Blender suffixes (2), and values beyond float32 range (1). Aligning lines before comparing stops one added line from looking like every later line changed. | C | `scene_chaos.py` classes | Gate what must hold, and list what cannot hold with its reason. A class with a reason can be counted and watched. |

## Laws these confirm

- Law 19 and Law 44 (every judge fails a planted fault). Each new judge has a plant, and both are caught locally and in
  CI: `import-malformed-traceback` for the hostile judge, `export-translation-drift` for scene chaos.
- Law 15 (one version per number). Every count names bpy 5.3.0, or the Blender 4.5.14 or 5.2.2 binary it ran on.

## What this does not prove

- The scene edits touch one thing at a time, so interactions between two edits are still untested (plan item 4,
  2.7.4).
- Nesting depth is still quadratic in places: 2,000 levels take about 16 s and 5,000 about 121 s (C, listed for 2.7.4).
- The Blender-core `path_reference_copy` finding is Confirmed through this add-on and Likely for every exporter that
  uses it. The draft report is held until he says "send".
