# What the HAnim dancers (x3d.dance) teach (28 Nov 2026)

Source: hagopjay/x3d.dance on `dc8b9ba` (built by hagsMac), integrated in x3d.dance pull request 1 and x3d.docs `docs/dance.md`. Grades: **C** = a named tool ran in this work, **L** = read or reasoned, **S** = suspected. Environment of every **C**: Linux x86_64, Python 3.13.18, Node 22.23.5, x3d_mcp `ca0e75c`, x3d.py 4.0.65.8, X_ITE 16.8.1 in headless Chromium with SwiftShader, no GPU.

## Findings

| # | Finding | Grade | Evidence | Rule it suggests |
|---|---|---|---|---|
| 1 | **Two judges, two layers.** The repo's `hanim.lint` passes both stages; x3d_mcp `validate_semantic` fails both on `profile-component` and adds 13 `hanim-skin-weight-zero` warnings. | C | stage-4.1 sha256 82d8c382de5c, stage-4.0 6d45089e4fe0; failure modes 516 to 518 | Run every judge; say which layer each covers. |
| 2 | **A validator's claim about a browser must be measured.** X_ITE 16.8.1 draws PhysicalMaterial under Immersive without the component statement. | C | 900x700 screenshots of stage-4.1 and the `export_perf.mjs house 6 12` performance (180 frames, 48 joints, 4,383,895 bytes, XSD valid) | Word the rule per node and per browser. |
| 3 | **The XSD passes everything here.** All four files validate with 0 errors. The only error came from the semantic layer. | C | x3d_mcp `validate_xml`, 2.1 s on 3.9 MB | A schema pass is the floor, never the receipt. |
| 4 | **The dancers' own Loom method held up.** Their FINDINGS record 74 of 80 witness checks before and 80 of 80 after the motion fixes, a failed run 1 kept, and held-out results of one win and one loss (Rex 13.55 vs 13.06, Ada 12.96 vs 13.22). Not re-run here. | L | x3d.dance `docs/FINDINGS.md`, `runs/` | Keep failed runs and report the loss beside the win. |

## Proposed additions (not applied here; each needs a run first)

* A pruning step in `hanim/mh.py` for weight-0 bindings, with the semantic check as its control.
* A capture-point balance witness (their open W6) for spins and glides.
* A bridge from the dancers' beat tracker to x3d.music scores; nothing connects them yet.
