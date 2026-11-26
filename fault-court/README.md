# Fault Court (T2 of the X3D flywheel plan, with a Loom-learning arm)

One small scene, written natively by three independent writers, X3D 4.0, glTF 2.0 and USD. 60 planted faults in six format-neutral families, 10 legal-but-unusual decoys and a clean control. Each format is judged by its **own** official checkers. No file is converted from another. Pre-registered in `PREREG.md` (commit 697bf5d) before any faulty file was checked.

## Result (26 Nov 2026, grade C on the instruments named)

| | X3D | glTF | USD |
|---|---|---|---|
| Faults the format can state at all (of 60) | **53** | 48 | 44 |
| Caught by the format's own checkers | 39 of 53 (74%) | **46 of 48 (96%)** | 5 of 44 (11%) |
| False alarms: clean control / 10 decoys | 0 / 0 | 0 / 0 | 0 / 0 |
| Held-out half, own checkers | 17 of 25 | 23 of 24 | 1 of 20 |
| Held-out half, plus Loom rules learned from the other half | **20 of 25 (+12 pts)** | 23 of 24 (+0) | **10 of 20 (+45 pts)** |
| Loom rules written (budget 5) | 5 | 1 | 5 |

| Hypothesis | Verdict |
|---|---|
| H1 X3D catches 15+ points more than glTF | **Fails, and the other way round.** On the 43 faults both can state: X3D 29, glTF 41. glTF caught 12 that X3D missed; X3D caught 0 that glTF missed (exact McNemar p = 0.0005). |
| H1 X3D catches 15+ points more than USD | **Passes.** On 39 shared faults: X3D 26, USD 5, +54 points (X3D-only 23, USD-only 2, p < 0.0001). |
| H2 X3D raises no false alarms | **Passes.** 0 of 10 decoys, clean control 0. |
| H3 Loom rules transfer to held-out faults in 2 of 3 formats | **Passes.** X3D +12 points, USD +45, glTF +0 (already at 23 of 24). Rules added no false alarms. |
| H4 Which format can state the most mistakes | **X3D: 53 of 60** (glTF 48, USD 44). Only X3D can state event wiring, two materials on one surface, humanoid joint names, a declared length unit and typed metadata. |

## What it means

- **X3D is the richest language here, but its validator is not the best judge.** Most of X3D's catches are schema catches: ranges, enums, NaN and the version. glTF-Validator reads the binary data and the files, and checks values *against each other*. X3D's misses are almost all cross-field or file mistakes: counts, missing texture, a cycle, bounds (FM 318).
- **The Loom closed a good part of that gap.** Five rules written only from the learn half caught 3 more of the 8 held-out X3D misses, and 9 more of USD's 19, without a single false alarm. That is one turn of the flywheel: test, rule, better checker. With the rules, X3D reached 20 of 25 held-out faults; glTF's own validator is still ahead at 23 of 24.
- **USD's registered validators barely look at values** (FM 321).

## Turn 2 (26 Nov 2026): the misses, closed

After this run, 26 data checks were added to the X3D validator (x3d_mcp `f0bde28`), written from these misses and from the full glTF-Validator code list. Rerun on the same cases with `flywheel/turn.py`:

| | Turn 1 | Turn 2 |
|---|---|---|
| X3D caught, of 53 stateable | 39 | **52** |
| On the 43 faults glTF can also state | X3D 29, glTF 41 | X3D 42, glTF 41 |
| Decoys flagged | 0 | 1 (Z04) |

This is a **fix confirmation on a seen set**, not a new held-out result: the author of the checks had seen every fault. The remaining miss is F03, which is not a fault in X3D. The flagged decoy is legal in glTF and a real stall in X3D (FM 326). See `flywheel/README.md` and `LEARNINGS-flywheel-turn-2.md`.

## Corrections found after the run (not changed in the score)

- **F03 in X3D was not a fault.** `nearDistance = -1` means "automatic" in X3D (FM 319). Excluding it, X3D is 39 of 52; H1 against glTF still fails.
- **A01 in X3D was caught for the wrong reason.** The finding was a schema position error, not the missing DEF (FM 320).
- **glTF's NaN catches are JSON parse refusals** (FM 322).

## Files

- `court.py`: the scene and its three writers.
- `faults.py`: the 70 cases.
- `checks.py`, `gltf_check.mjs`: the checkers.
- `run.py`: builds the cases and runs the checks, sealing the held-out half.
- `rules/`: the Loom rules (commit cf0b6b4, written before the held-out half was opened).
- `score.py`: scores the results.
- `results/score.json`: every case in every format and arm, with the held-out sha256.

Rebuild:

```
X3D_MCP=../x3d_mcp python3 run.py build out && python3 run.py check out && python3 score.py
```

Needs: lxml, the x3d_mcp fork at 4d433af, usd-core 26.11, Node with gltf-validator 2.0.0-dev.3.10.

Threats: one author chose the faults and wrote the rules, one scene, kinds of mistake rather than real-world files. Next round: an independent fault list.
