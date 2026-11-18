# What the Gobbler Evidence Loom teaches (17 Nov 2026)

Source: https://github.com/hagopjay/x3d.gobbler at commit 4a24d4b (observatory over the Atlas, plus an independent replay). Rig for every number: Python 3.13.18, rdflib 7.6.0, x3d_mcp `fa5dccf`, Chromium 153.0.8010.12 on software GL (SwiftShader). None of it is a GPU measurement.

## 1. Six findings

| # | Finding | Grade | Evidence | Rule it suggests |
|---|---|---|---|---|
| 1 | **A handoff that says "the helpers are missing" may only be missing a pin to fetch.** The Atlas names `x3d.docs@ff0565e`; fetching that one commit made the six Atlas outputs rebuild byte-identical and the 17-check witness pass (19/19 with the two scene checks) | C | x3d.gobbler `receipts/witness-replay.json` | Ship a `fetch_pins` script beside every pin file; a pin you cannot fetch with one command is not reproducible |
| 2 | **A portable check that passes can hide a defect only the real validator sees.** `verify.py` was green while `atlas-world.x3d` had a viewpoint rotation `0 0 0 3.142`; x3d_mcp `fa5dccf` reports `rotation-zero-axis` (1 error, then 0 after the fix) | C | validator output before/after | A look-at helper must handle the half-turn case (read the axis from the symmetric part); run the family validator in the witness, not only XML well-formedness |
| 3 | **A single-file X_ITE export is not self-contained.** The engine lazy-loads components, a wasm tangent library and its stylesheet from sibling folders; the canvas stays hidden until the stylesheet link loads, so the page ended at "Could not open the X3D loom" | C | Playwright against the delivered file over http, then 15/15 after embedding | After building a "single file", open it in a browser from an empty directory; embed components (blob URLs), wasm (data URL) and the stylesheet byte-exact (the engine pins it with SRI) |
| 4 | **DOM-count checks missed overlapping panels.** At 1440x900 the left panel ran under the control bar and the nav intercepted clicks on a button | C | Playwright click timeout, screenshot | Drive the controls with real clicks at a laptop size; "element exists" is not "element is reachable" |
| 5 | **Hash-bound archives need a replay directory, not an edit.** Fixing finding 2 in place broke the archive's 8-hash receipt, so the corrected build ships in `out-r1/` and `?out=` selects it | C | `verify.py` failure when `out/` was edited | Fix forward into a new directory; never edit hash-bound outputs |
| 6 | **Duplicate vendored trees drift.** The ZIP carried two byte-identical 17 MB X_ITE copies | C | `diff -rq` | One `vendor/` at the root |

## 2. Reusable pieces
* `tools/browser_check.cjs` (x3d.gobbler): static server, boot wait, counters, 3 feather clicks, tab drive, search, pixel-variety check, mobile overflow, console/page/request errors, JSON receipt. `--allow-missing-assets` for single-file exports.
* `tools/fetch_pins.py`: shallow-fetch a pinned sha (or `git archive` from a local clone), extract only the wanted folders, write a `.pin` marker.
* `tools/leak_sweep.py`: tracked-file sweep for session links, key-shaped strings and home paths in code.

## 3. What this does not prove
* No hardware GPU, Firefox, Safari or phone; audio was not listened to.
* Loom patches 2 and 3 from the supplied `loom-pr/` series (law/failure joins) no longer apply: main moved to 186 failure modes. Patch 1 is in this PR.
* Findings 1-6 come from one replay; none was independently re-run by a second person.
