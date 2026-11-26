# Agent 15 report: KERNEL-GUARANTEES.md

File: agents/15/KERNEL-GUARANTEES.md

Checks found (by regex on the source, suite not run): about 116 distinct names; about 57 can emit an error, about 38 are warning-only, 21 info-only. 14 guarantees (G1 to G14, grouped schema, names, events, data, numeric, resources, physics/HAnim/geo). All 14 rest on error-level checks; every property that is only warned is listed as not guaranteed. Soundness: fixtures only for most; corpus-with-false-alarm reading only partly (downey 20 scenes, parity fixtures); G13 and unknown-tag G2 untested.

Five most important holes:
1. Behaviour holes: 9 of 20 blind faults missed (dead sensors, ROUTE cycles, Script without url, stopTime before startTime); XSD caught nothing.
2. USE checks (`_check_use_before_def`, `_check_def_use_consistency`) and `_check_duplicate_defs` ignore ProtoBody scopes, unlike the route checks; possible false alarm and false pass.
3. profile.py: unknown tags land in `report.unknown`, which `ok` ignores, so they pass the profile check.
4. File checks run only when `base_dir` is given (default `semantic_diagnostics` passes None); remote and outside-folder urls are skipped.
5. Route checks skip IMPORTed names; range and enum checks use hand-written tables (`_POSITIVE`, `_ENUMS`); the check list is the author's, with one decoy flagged and no sealed test.

Proposed sentence: "The x3d_mcp validator is a deterministic, versioned, rerunnable checker that certifies a stated list of structural guarantees about an X3D file and publishes a ledger of what it misses; it does not certify that the scene is what was meant, which separate, softer instruments judge."

Smallest additions: guarantees.json mapping each guarantee to checks and tests (with a drift test), a pass certificate naming file hash, validator commit and guarantee list, signing it, one counterexample fixture per guarantee, and scope-aware USE/DEF checks.
