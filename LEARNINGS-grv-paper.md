# Learnings: generate, refine, verify (pilot, 24 Nov 2026)

Lane: the generate-refine-verify paper. Claim: a world model generates (World Labs Atlas), refinement improves it (Blender, scripted splat passes) and X3D plus the Loom verify it; all three beat any subset. Kit and receipts: `grv-study/`. Failure modes 247 to 251 in LOOM-v1.

## What ran

- Three new X3D 4.1 worlds (cross-hall, stairwell, courtyard; 92, 93, 136 solids), each with 12 sent and 12 held-out cameras. Valid under x3d_mcp 4d433af. Bridge camera vs Atlas camera 0 m / 0 deg on 36 frames; bridge depth vs analytic ray cast median 0.08 to 0.17 mm (three r187, Chromium 158 SwiftShader).
- Atlas atlasChisel, 12 frames with X3D depth, seed 7, prompt unenhanced, one ring per world; then posedImages2Splats draft from Atlas's own returned depth (so the splat is generated geometry, not X3D's). Run by the Atlas bridge thread's guarded client.
- Four arms scored on the same splat (`build/score_arms.py`), on held-out cameras and hidden trap regions only.

## Results (C, one seed each)

| World | Chisel depth vs X3D (median, p90) | G splat error | G+R | G+R+V | Held-out holes G / G+R+V | Trap defects left G / G+R+V |
|---|---|---|---|---|---|---|
| Cross-hall | 2.17%, 8.2% | 55.8 mm | 55.3 mm | 26.4 mm | 67.3% / 32.5% | 2 / 0 of 4 |
| Stairwell | 1.27%, 7.3% | 40.2 mm | 40.2 mm | 31.7 mm | 41.9% / 12.9% | 4 / 1 of 4 |
| Courtyard | 2.15%, 26.0% | 76.8 mm | 72.7 mm | 38.5 mm | 65.2% / 23.8% | 2 / 1 of 4 |

Pre-registered thresholds (20% better than the best other arm on error and on holes) pass on 3 of 3 worlds, the stairwell only just (21%). n = 3: no significance claimed.

**But the pictures got worse (C by eye, no reference metric).** Held-out renders (Spark 2.4.0, Chromium SwiftShader, 6 held-out cameras) of G against G+R+V: the fill pass scatters speckled 4 cm dots coloured from the nearest splat, and the carve pass deleted the courtyard sky, because the X3D has no sky and every sky splat counted as open air; the statue became a blob. PSNR between the arms 5.6 to 23.1 dB per view. So the pilot supports the claim on geometry only and fails it on appearance (FM 252).

## Lessons

1. **Blind refinement is inert or harmful.** Gate every pass on a verify check (FM 247).
2. **The ruler must be held out.** Without held-out cameras and hidden traps, verify wins by construction (FM 248).
3. **Geometry cannot see meaning.** Atlas turned a statue's arms into a staff; every geometric check passed (FM 249).
4. **Distance-based carving misses junk near surfaces.** Use X3D free-space volumes (FM 250).
5. **Scaffold coverage drives fidelity.** 1 to 2% depth error when X3D fills the frame, 3.8% when it fills a tenth (FM 251).
6. **A geometry-only gate is Goodhart's law.** It rewarded edits that wreck the picture. Every pass needs a picture gate too, carving must stay inside the volume the X3D encloses (never sky), and fill colour must come from the generated views (FM 252).
7. **The fill pass copies X3D shape.** Part of the G+R+V geometry gain is by construction; picture quality and a blind rating are the next tests before any strong claim.
8. **Exploratory v2 (after seeing the pictures, so not confirmatory).** Fill coloured from the generated view that sees each point removed the speckle (PSNR to the unrefined picture up in 5 of 6 held-out views; cross-hall 15.2 to 29.9 dB), but carving inside the X3D bounding box still deleted the courtyard sky, because Atlas puts sky splats inside that box (FM 259). Geometry error near 0 mm in v2 measures the copied fill, not the generator. Verdict unchanged: wins on geometry, not yet on pictures.

## Not done

Pictures (PSNR/FLIP against a Cycles reference of the X3D), blind human rating, prompt-only arm, more seeds and scenes. Atlas outputs are World Labs' under developer terms and are not stored in this repo.
