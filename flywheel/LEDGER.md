# Flywheel ledger

One row per measured turn. Written by `flywheel/turn.py measure`; do not edit by hand. The numbers are counts
of scenes, from the benchmarks named in `flywheel/README.md`. Read "52 of 53" as a fix confirmation by a rule writer who had seen
the faults (the held-out figure is the Loom arm, 17 to 20 of 25). Read "88 of 88" as 88 of the 170 Khronos codes and "66 of 66" as
66 of the 340 USD rules; the project, not an outside party, classified the rest. A pass certifies the listed checks only.

| Turn | Date | Validator | Fault Court caught | Decoys flagged | glTF-Validator codes matched | USD rules covered | After a Blender USD export: fired pairs (both / X3D only / USD only) | Rules by | Model calls | What changed |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 2026-11-26 | `x3d_mcp@4d433af` | 39 of 53 | 0 of 10 | 40 of 88 | not measured | not measured | none (baseline) | 0 | Baseline: the validator as it stood when the Fault Court ran |
| 2 | 2026-11-26 | `x3d_mcp@f0bde28` | 52 of 53 | 1 of 10 | 88 of 88 | not measured | not measured | agent, not yet reviewed by a person | 0 | 26 data checks written from the Fault Court misses and the glTF-Validator code list (x3d_mcp data_checks.py) |
| 3 | 2026-11-26 | `x3d_mcp@f0bde28` + `0001-USD-validation-parity-340-rules-from-OpenUSD-Omniver.patch` (sha256 561f06fa22ce) | 52 of 53 | 1 of 10 | 88 of 88 | 66 of 66 (of 340 rules) | not measured | agent, not yet reviewed by a person | 0 | 18 checks answering the USD rulebooks (OpenUSD 26.11, Omniverse Asset Validator 1.18.0, SimReady c3bd1d8; x3d_mcp usd_checks.py), surveyed on 1,548 real files |
| 4 | 2026-11-26 | `x3d_mcp@9e21c4c` + `0001-mesh-coincident-across-Transforms-the-X3D-miss-SimRe.patch` (sha256 295b6378e3e6) | 52 of 53 | 1 of 10 | 88 of 88 | 66 of 66 (of 340 rules) | parity 67 (17 / 32 / 18) on 84; real 359 (140 / 117 / 102) on 141, x3d_mcp@9e21c4c | agent, not yet reviewed by a person | 0 | Q12 run 2: the three USD rulebooks executed (SimReady 165 of 270 requirements) on Blender 5.3 exports of 141 real X3D files and 84 fixtures, joined per rule; the one x3d_mcp miss it found (identical shapes under different Transforms, SimReady VG.008) fixed in mesh-coincident |

## Open after the last turn

- Fault Court still missed: F03
- Decoys flagged: Z04 (interpolator-key-unreachable)
- glTF-Validator codes not matched: none
- USD rules X3D can state but does not report: 0; not a validator matter in X3D: fixed 32, convention 1, design 45, binary 5, feature 38, engine 44, policy 92, judgement 17
