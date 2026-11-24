# Generate, refine, verify: the ablation study kit

Claim under test (H-all): a world built by a generative world model (World Labs Atlas or Marble), refined (Blender and scripted splat passes) and verified against X3D (schema, analytic depth, render and topology checks, Loom receipts) beats any one or two of those stages. Pre-registered 24 Nov 2026, before any pilot data came back.

## Arms

All arms start from the same generated splat, so every comparison is paired and only generation costs money.

| Arm | What happens to the generated splat |
|---|---|
| G | nothing (one similarity alignment, fitted on the SENT cameras only) |
| G+R | blind refinement: drop alpha < 0.03, drop sparse floaters (3 or fewer neighbours within 0.25 m), clamp scales at 0.5 m |
| G+V | unchanged; the verify report is attached |
| G+R+V | passes chosen and gated by verify from sent-camera geometry only: P1 hygiene, P2 carve (remove visible splats in X3D open air, 0.15 m or more from any surface), P3 fill (add flat splats on X3D surface seen by sent cameras where none lies within 50 mm). A pass is kept only if sent-side air share, hole share and median error do not get worse |

Deviation recorded before data: the 35 dB render gate from the Athens refine loop stays for blind hygiene only; carve and fill change pixels by design, so their gate is geometric.

## Keeping the ruler honest

X3D both conditions the generator and scores it. Three rules stop the V arms winning by construction:

1. Every world has 12 SENT cameras (Cam00-Cam11) and 12 HELD-OUT cameras (Hold00-Hold11). Hold cameras are never sent and never used by any arm.
2. Scores are computed on held-out surface samples and on hidden trap regions (`TRAPS` in `build/score_arms.py`), which no arm reads.
3. A blind human rating of held-out views is part of the full study (not the pilot).

## Worlds (`kit/paper_scenes.py`, CC0, valid X3D 4.1 under x3d_mcp 4d433af)

| Slug | Stratum | Solids | Traps |
|---|---|---|---|
| grv-cross-hall | interior | 92 | floor under every arm, niche backs, high crossing ceiling |
| grv-stairwell | topology trap | 93 | open stairwell, alcove behind a partition, descending treads, 25 mm railing |
| grv-courtyard | object | 136 | open air under the statue's arms, open arcade walkways, space under benches, plinth faces |

## Run

```
python3 kit/paper_scenes.py worlds
node build/render_x3d.mjs worlds/<slug>.x3d out/bridge          # three r187 bridge, picture + depth per Viewpoint
python3 build/prepare.py <slug>                                  # depth EXR + cameras for the SENT cameras, gate receipt
# (the Atlas calls run through the guarded client of the Atlas bridge kit in x3d.demo)
python3 build/analyze_chisel.py <slug> chisel                    # Atlas depth vs X3D depth
python3 build/score_arms.py <slug> <draft.spz>                   # the four arms
python3 build/synth_test.py <slug>                               # scorer self-test on a synthetic splat
```

Needs numpy, scipy, lxml, Pillow, OpenEXR; Node with playwright, three 0.187.0, x_ite 16.7.1, @sparkjsdev/spark 2.4.0; the x3d.threejs bridge in this repo.

## Receipts

- `receipts/prepare-grv-*.json`: camera 0 m / 0 deg on 36 frames; bridge depth vs analytic cast median 0.08 to 0.17 mm (three r187, Chromium 158 SwiftShader).
- `receipts/selftest-grv-stairwell-arms.json`: a synthetic splat built from X3D truth, scaled 1.05 with planted defects; the aligner recovers 1.050; fill restores the deleted alcove and stair surfaces (40% to 61%, 42% to 88% covered); carve removes 78% of the planted stairwell junk (3,051 to 672 splats), the rest sits within 0.15 m of a surface.
- `receipts/penrose-chisel-depth.json`: Atlas Chisel on the real-geometry Penrose stairs (op 54a48a5f), median depth error 3.81% (p90 23.2%) where the scaffold filled 4 to 23% of the frame.
- Pilot results (24 Nov, 3 worlds, 1 seed): `receipts/grv-*-chisel.json` (Atlas depth vs X3D, median 1.27 to 2.17%) and `receipts/grv-*-arms.json` (G+R+V cuts splat error 21 to 52% and held-out holes 52 to 69% against the best other arm). Held-out renders show the G+R+V worlds look WORSE (sky carved away, speckled fill): geometry passes, pictures fail (`receipts/grv-heldout-renders.json`, FM 252). See `../LEARNINGS-grv-paper.md`.

Atlas outputs are World Labs' under its developer terms (personal, non-commercial) and are not stored here.
