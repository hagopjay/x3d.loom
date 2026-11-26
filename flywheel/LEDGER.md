# Flywheel ledger

One row per measured turn. Written by `flywheel/turn.py measure`; do not edit by hand. The numbers are counts
of scenes, from the benchmarks named in `flywheel/README.md`.

| Turn | Date | Validator | Fault Court caught | Decoys flagged | glTF-Validator codes matched | Rules by | Model calls | What changed |
|---|---|---|---|---|---|---|---|---|
| 1 | 2026-11-26 | `x3d_mcp@4d433af` | 39 of 53 | 0 of 10 | 40 of 88 | none (baseline) | 0 | Baseline: the validator as it stood when the Fault Court ran |
| 2 | 2026-11-26 | `x3d_mcp@f0bde28` | 52 of 53 | 1 of 10 | 88 of 88 | agent, not yet reviewed by a person | 0 | 26 data checks written from the Fault Court misses and the glTF-Validator code list (x3d_mcp data_checks.py) |

## Open after the last turn

- Fault Court still missed: F03
- Decoys flagged: Z04 (interpolator-key-unreachable)
- glTF-Validator codes not matched: none
