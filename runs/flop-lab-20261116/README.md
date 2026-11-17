# flop-lab-20261116

The Loom's witnesses run on [x3d.physics/flop-lab/](../../x3d.physics/flop-lab/) on 16 Nov 2026, from a clean copy of the committed files (no `node_modules`, no build scratch). All five bind the same candidate, sha256 `d5031c5ba4c0…` (`subject_sha256` in each record).

| File | Witness | Result |
|---|---|---|
| `evidence/physics.json` | `kit/loom physics x3d.physics/flop-lab --runs 'runs/*.physics.json'` | **pass**: 1 run, 12 references within their limits, 7 controls failed as they must, replays in `node` and `chromium` with 0 differing step hashes of 300, 0 waivers, no takeover claimed |
| `evidence/page-traps.json` | `kit/loom pagetraps x3d.physics/flop-lab --files 'src/*.js,index.html'` | **pass**: 7 files, 8 rules, 0 errors, 0 warnings; `seen.sim_units` 4 (three sim files and the sim script of the built page) |
| `evidence/traps.json` | `kit/loom traps x3d.physics/flop-lab --files 'level/*.x3d'` | **pass**: 1 scene, 228,633 bytes, 15 rules, 0 hits |
| `evidence/grammar.json`, `evidence/meaning.json` | `kit/loom grammar x3d.physics/flop-lab --files 'level/*.x3d' --fork <x3d_mcp checkout>` | **pass** both, x3d_mcp main `b5c9956` (clean checkout) |

This is **not a receipt**. The profile `x3d-physics/v1` also requires Behaviour, and that witness was not run through the kit: the project's own browser run (`x3d.physics/flop-lab/test/browser.mjs`, 16 checks, with and without eval) stands in for it and is cited, not judged here.

What the physics record does not show is listed in its own `not_shown`: Firefox, WebKit, a second machine, a real GPU, limits committed before the run, the hero under keyboard input, and the curator with a real model. The numbers were read by the thread that built the engine; no second reader has recomputed them (law 44).

The candidate hash does not cover folders named `receipts` or `evidence`, so `x3d.physics/flop-lab/receipts/` is not bound by it. The run record pins what it copied: the trace sha256 of the 300 step hashes, the model's sha256, and the sha256 of the three sim files.
