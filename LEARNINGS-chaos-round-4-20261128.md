# What the fourth chaos round teaches: the weekly replay finds old faults (28 Nov 2026)

Source: hagopjay/x3d-blender-io#128 (2.9.1), `docs/CHAOS.md` "Fourth round", `tests/test_chaos_round4_bpy.py`; the
receipt-to-rule weekly run, x3d.loom #240 (`runs/r2r-weekly-20261128/`). Grades: **C** = measured with the named
tool, **L** = read or reasoned, **S** = suspected. Follows [LEARNINGS-chaos-round-3-20261123.md](LEARNINGS-chaos-round-3-20261123.md).

The weekly run replayed every kept rule on add-on 2.9.0 against 2,300 real files: no regression from 2.7.4, and four
old defects, each also present in 2.7.4.

| Run (bpy 5.3.0) | 2.9.0 | 2.9.1 |
|---|---|---|
| The two real crash files (Sound.x3d, obj-05.x3d) | 2 of 2 crash | 0 of 2 (C) |
| x3d.loom `0-0-feel-lab.x3d`, export with animation | 45.5 MB, 36 s | 1.6 MB, 5 s (C) |
| `segment-sphere.x3d` import (646 Text) | 23 s | 3.1 s (C) |
| Hostile files / scene chaos rng 7, 11, 23 / export round-trip gate | – | 0 of 75 / 0 of 46 each / PASS (C) |

| # | Finding | Grade | Evidence | Rule it suggests |
|---|---|---|---|---|
| 1 | **A bigger corpus finds older faults.** Two rounds of mutants and 514 files missed four defects that 2,300 real files found. All four were in 2.7.4. | C | weekly run, loom #240 | Grow the replay corpus every week from the project's own files; real files are the mutator nobody wrote. |
| 2 | **A None check after the use is no check.** `importAudio` read the source's url and only then asked whether there was a source, so every Sound on an X3D 4 sound graph crashed. | C | AttributeError, Sound.x3d | Read the guard order, not just the guard. |
| 3 | **A language model writes the degenerate case.** An Extrusion whose crossSection is all one point came from a model's one-shot output. | C | x3d.ml obj-05.x3d | Feed model-written files to the replay: they find the shapes people never draw. |
| 4 | **Noise is the cost driver.** The export called float32 noise motion, so every child of a moving parent got its own interpolator: 497 interpolators for 5 real ones. Sampling only what can move, and calling noise still, was most of the win (45.5 MB to 1.6 MB). | C | feel-lab level | Compare with a tolerance wherever a float decides whether to write something. |
| 5 | **A size win can break a round trip.** Thinning keys that slerp rebuilds took the level to 0.66 MB, but the re-export picked slightly different keys (108, then 105 values), so the round trip stopped being a fixed point. It was dropped. | C | fixed_point.py, suite orbit child | A compression is only kept if the fixed-point gate passes. |
| 6 | **A test can encode a bug.** The behaviour-presets acceptance test expected a scale interpolator on a turning Door; it was noise. | C | test_behaviour_presets_bpy | When a fix changes a test's expectation, show the old value was noise, then change it. |
| 7 | **An operator is a scene-wide cost.** Bold Text went through edit mode, and each mode switch evaluated every text: 77 ms per Text node. Setting the character format directly took 646 texts from 23 s to 3.1 s. | C | segment-sphere.x3d | In an importer, set data directly; an operator pays for the whole scene. |

Rule for the Loom (L): the weekly replay is the flywheel's slow wheel. Rounds made from mutants find what was asked;
the weekly run on a growing corpus finds what nobody thought to ask.
