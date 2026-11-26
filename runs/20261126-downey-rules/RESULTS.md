# The new glTF and USD rules on the Downey stack (26 Nov 2026)

**Question (HagopJay):** do the glTF-Validator parity checks (x3d_mcp #31, 88 checks) and the USD rulebook parity checks
(#32/#34, 66 rules incl. the world-place mesh-coincident pass) help or hurt a new integration? Test bed: x3d.downey,
19 rooms after Allen Downey's three books plus a hub, accepted 24 Nov under `x3d-downey/v4` with 17 of 17 witnesses.

**Answer: they helped, and cost nothing at the gate.** 0 new errors (the Loom meaning gate still passes 20/20); 12 new
findings: **1 true defect** that 17 witnesses and three blind readers had passed, 7 false alarms (fixed in x3d_mcp on
this thread, now 0), 4 profile-only advisories (info, correct, non-gating).

## Instruments
| What | Value |
|---|---|
| Stack | x3d.downey tree `550594f` (monolith kit, 15 commits replayed; tree identical to the building session's) |
| Scenes | 20 (`scenes/*.x3d`, `scenes/complexity/*.x3d`, `scenes/stats/*.x3d`) |
| Baseline | x3d_mcp `4d433af` (#30): the commit the stack was accepted on, parent of #31 |
| Current | x3d_mcp `5543a7b` (main after #31, #32, #33, #34) |
| Fix branch | x3d_mcp `claude/project-thread-c6mj9x` (this thread; 5543a7b + 2 check changes) |
| Python | CPython 3.12.3, lxml 6.1.3, xmlschema 4.3.2, x3d.py 4.0.65.8, cloud container (the v4 receipt ran 3.13.18) |
| Mode A | `semantic_diagnostics(text)`, exactly as the Loom grammar witness calls it (no files) |
| Mode B | `semantic_diagnostics_with_files(text, scene_dir)` (current only) |
| Gate | x3d.loom kit 434b580 `loom grammar` against both forks: meaning = pass iff 0 semantic errors |
| Exact reference | Gilbert's recurrence in `decimal` at 600 digits (`tools/er_exact.py`) |
| Render | X_ITE 16.8.1 (npm), Chromium 158.0.8127.36 headless, SwiftShader, 1280x720 (`tools/shoot.js`) |

## Totals (Mode A, all 20 scenes)
| Commit | XSD valid | Errors | Warnings | Infos | Semantic time, 20 scenes | Loom meaning |
|---|---|---|---|---|---|---|
| 4d433af | 20/20 | 0 | 0 | 212 (all `unused-def`) | 0.50 s | pass |
| 5543a7b | 20/20 | 0 | **1** | 223 (+11) | 1.27 s (2.5x) | pass (the warning is not read) |
| 5543a7b, Mode B | 20/20 | 0 | 1 | 223 | 1.39 s | n/a |
| fix branch | 20/20 | 0 | 1 | 216 (+4) | — | pass |

Reproduces the receipt: the v4 run's `meaning.json` (4d433af, Python 3.13.18) also has 0 errors and 0 warnings on 20.

## Every new finding, classified
| Scene | Check (level) | Since | n | Class | Grade | Evidence |
|---|---|---|---|---|---|---|
| complexity/er | coordinate-precision (warning) | #32, VG.020 / RTX 2^38 | 1 | **TRUE DEFECT** | Confirmed | n=100 P(connected) curve: y to 2.67e25 m; 49/121 points wrong vs Decimal (max err 2.23e24) |
| hub | mesh-colocated-points (info) | #32, VG.016 | 2 | idiom (false alarm) | Confirmed | closed LineSet rings, first point repeated |
| sunfall | mesh-colocated-points (info) | #32, VG.016 | 1 | idiom (false alarm) | Confirmed | closed orbit |
| penny | mesh-colocated-points (info) | #32, VG.016 | 2 | idiom (false alarm) | Confirmed | a resting penny: 54 of 91 samples at (40, 0, 0) |
| stats/confound | mesh-colocated-points (info) | #32, VG.016 | 2 | idiom (false alarm) | Confirmed | PointSet ties in NSFG data (79/1,453, 83/1,560) |
| bikeshare | interpolator-constant (info) | #32, VG.015 | 2 | profile-only | Confirmed | per-entity interpolators; bike 11 never rides |
| plague | transparent-open-mesh (info) | #32, VG.022 | 2 | profile-only | Confirmed | translucent open ribbons, solid=false, on purpose |

Nothing from #31 (glTF parity) fired; #34's world-place pass fired 0 times. Mode B added 0 (no url fields in the stack).

## The defect
`downey/complexity/er.py:p_connected` computes P_n = 1 - Σ C(n-1,k-1) P_k q^{k(n-k)} in float64. At small p the sum is
1 to within rounding while its terms reach C(99,49) ≈ 5e28, so 1 - s is noise amplified by up to 10^25.

| Curve | Points | Wrong (>1e-6) | Wrong for p ≤ | Max abs error | Drawn? |
|---|---|---|---|---|---|
| n=10 | 121 | 0 | — | 3.8e-14 | yes |
| n=30 | 121 | 0 (11 at -4.5e-8) | — | 4.5e-8 | yes |
| n=100 | 121 | **49** | 0.01585 | **2.23e24** | **yes: the streaks** |
| n=300 | 121 | 43 | 0.01122 | 1.76e203 | no (zip with 3 colours drops it; banked only) |
| live lab (JS, n 3-60) | 121 per n | 1-7 for n 51-60 | 0.00536 | values in [-1, 0) | yes, in the page |

The room's own checked numbers are right: p10, p50, p90 for n = 100 and 300 evaluate to 0.1, 0.5, 0.9 within 3e-15 in
Decimal. Why 17 witnesses passed it: XSD takes any float; the 4d433af meaning rules have no magnitude check; the behaviour
witness wants no page error, and a 2.7e25 m line raises none; Node agrees bit for bit because it runs the same recurrence;
scipy never touched this room; the blind reader computed in Decimal but only at p50/p10/p90 and n = 10, where float is fine.

Fix for x3d.downey (not applied; no x3d.downey repository in the project): log-space or Decimal recurrence, or
clamp-and-flag, plus a range check on every banked curve (a probability lies in [0, 1]). Before/after render:
`er-before-after-labelled.png` (only the 121 points of that curve changed).

## Changes made from this
- **x3d_mcp (this thread's PR):** `mesh-colocated-points` scoped to meshes, as VG.016 (`usdgeom-mesh-colocated-points`) is:
  LineSet / IndexedLineSet / PointSet are skipped unless a face set USEs their Coordinate (7 → 0 on Downey).
  `coordinate-precision` past 2^38 now says the value is suspect ("overflowed or cancelled") instead of only "the mesh
  will jitter; move the origin". 6 new tests in `tests/test_downey_findings.py`.
- **x3d.loom:** failure modes 444 to 450; the foldback kit's 29 as 415 to 443.

## Pre-registered predictions (PREDICTIONS.md, sha256 f0ee4bab…, written 16:04 UTC before any run)
| # | Prediction | Outcome |
|---|---|---|
| P1 | XSD identical, 20/20 | hit |
| P2 | baseline 0 errors, 0 warnings | hit (matches the v4 receipt) |
| P3 | 0 new errors; gate still accepts 20/20 | hit |
| P4 | new warnings in ≤ 3 scenes; candidates scale-zero, route-fan-in, coordinate-precision | hit (1 scene, coordinate-precision); scale-zero missed because the writer uses 0.001 |
| P5 | new infos in ≥ 5 scenes, mostly colocated points and mesh-coincident | half: 6 scenes, colocated 7 of 11, mesh-coincident 0 |
| P6 | true defects ≤ 2 | hit (1), but I expected a units slip, not a numerical one |
| P7 | Mode B adds 0 | hit |
| P8 | ≤ 2 s per scene | hit (max 0.24 s, smallworld) |

## Verdict for new integrations
| Effect | Count | Reading |
|---|---|---|
| Gate broken | 0 of 20 | no new error-level rule fired on a data-viz stack |
| True defect found | 1 | the most valuable result of the run; came in as a warning the gate does not read (FM 447) |
| False alarms | 7 → 0 | one rule mapped wider than its USD source; fixed |
| Profile-only infos | 4 | keep as info; label them SimReady in receipts |
| Run time | 2.5x | 0.50 s → 1.27 s for 20 scenes |

Magnitude sweep of all 19 banks (23,741 floats): 0 NaN/inf; values above 1e12 only in er's curves (76, the defect) and
sunfall's physical constants (4, e.g. M_sun 1.989e30 kg, legitimate). That is a magnitude scan, not a domain check per
quantity.

Not shown: Firefox, WebKit, a GPU; a per-quantity domain check on every bank; x3d.downey itself is not fixed.
