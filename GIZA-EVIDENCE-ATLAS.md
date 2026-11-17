# Giza Evidence Atlas (v3): what the Loom learns from it

Fold-back from x3d.demo `docs/demos/giza-osiris-hall/v3/` (x3d.demo PR #46, merged 17 Nov 2026). Measured in a Linux container with Node 22, Python 3.13, headless Chromium on software WebGL; x3d_mcp checkout `fa5dccf` as the validator. Grades: C Confirmed (run and read here), L Likely, S Suspected. The Atlas's own findings come from an uploaded enhancement and its patch notes; they are marked *upload* and were not re-derived here except where a number is given.

IDs here are local (`GZ-n`) so they cannot collide with failure-mode numbers other fold-backs are adding to LOOM-v1.md; renumber on promotion.

## What the demo is, in one table

| Item | Value | Source |
|---|---|---|
| Scene | X3D 4.0, Immersive, 2,537,124 bytes, SHA-256 `59bce411…9aebb5` | x3d_mcp `fa5dccf`, `validation-v3.json` |
| Gate | XSD valid, 0 errors, 0 warnings, 133 info notes (unused-DEF notices for nodes the page drives by SAI) | same |
| Tests | 30 Node + 8 Python, including byte-identical regeneration of all six scene outputs | `make check`, about 3 s |
| Browser | 12 of 12 smoke checks at 1280 and 390 px, no page errors, no horizontal scroll; not timed | headless Chromium, SwiftShader |
| Content | 75 cards (32 Technical, 21 Wonder, 22 Contested), 128 source links, 125 marked opened by the research pass | `evidence-index.json` |

## Lessons (each with its counterexample)

| ID | Lesson | Counterexample or control | Grade |
|---|---|---|---|
| GZ-1 | **Keep three grades apart: the subject's evidence tier, the geometry's modelling status, the source-handling grade.** A documented subject can have schematic geometry; an opened source is not a proven proposition. The page shows all three, per view. | The v2 page let "Confirmed" on a card read as "the thing exists as drawn". `evidence-index.json` now records tier, geometry status and limitations per view (16 views). | L (upload) |
| GZ-2 | **A number carries its datum before it is compared.** The shaft-drop sum is 9.62 + 13.25 + 7.50 = 30.37 m; the published 35.45 m is a section-datum label; "41.48 m" appears in no opened source. | The depth theatre shows the three side by side with definitions. | L (upload; arithmetic checked here) |
| GZ-3 | **Layer independence needs an annotation audit, not only a mesh audit.** Hiding a geometry layer left its labels. | Khafre claim labels got their own cluster gated by the layer switch. | L (upload) |
| GZ-4 | **A receipt belongs to bytes.** The v2 `validation.json` described a 2,456,501-byte scene while the enhanced scene was 2,537,124 bytes. | `scripts/gate.sh` writes `validation-v3.json` with the scene SHA-256; `scripts/check.sh` fails when the scene changes and the receipt does not. | C |
| GZ-5 | **A bulk rename must exclude frozen baseline files.** A `sed` over the folder rewrote the scene filename inside `BASELINE-NOTICE-v2.md` and `validation.json`, which are meant to be preserved exactly. | `scripts/check_refs.py` compared `BASELINE-NOTICE-v2.md` with the SHA-256 recorded in `evidence-index.json` and failed; the two files were restored from the source archive. The hash record caught a mistake the tests would not. | C |
| GZ-6 | **Test the apply path against the real repository, not the archive the patch was built for.** `git apply --check` of the upload's patch on the repo's v2 folder failed (`HOW-TO-RUN.txt` and `run.bat` absent). | Used the delivered tree as the source and kept the patch out of the folder. | C |
| GZ-7 | **A smoke test must await async diagnostics.** `__giza.report()` returns a Promise; the first run reported a false FAIL (11 of 12) because it measured the Promise. | Fixed to `await`; 12 of 12. | C |
| GZ-8 | **A leak sweep needs a pattern list tuned on the real corpus.** The pattern `secret` matched the card id `secret-tunnels` and the title "The Secrets of the Sphinx" (13 hits, all false). | Pattern narrowed to `secret[_-]?key|token=`; zero hits afterwards. Keep the tuning in the script so the next version inherits it. | C |
| GZ-9 | **Shell packaging: `$PWD` inside a `cd` subshell points at the temp directory.** The first `package.sh` failed with FileNotFoundError. | Compute the output path before the `cd`. Verified: 170 files, 8,747,397 bytes zip. | C |
| GZ-10 | **Interpolate sky rotations, never matrix entries, and never jump to the nearest century.** Epoch display uses astronomical years (year 0 = 1 BCE). | 30 sky tests cover all 152 samples and 151 midpoints, orthonormality and horizon cases. They do not establish accuracy against new ERFA references. | L (upload) |
| GZ-11 | **Baked colour is a binary contract with the vertex layout.** 510,432 bytes, 42,536 vertices, four states. | Builder and runtime refuse a length or count mismatch; added geometry stays outside the baked meshes. | L (upload; tests pass here) |
| GZ-12 | **Observed-camera state must include the rendered zoom, the world pivot and a completed bind.** | Session export records effective FOV and transformed pivot; restore stops transitions and resets user offsets. | L (upload) |

## The dev-cycle contracts worth copying into other lanes

1. One command runs every offline check (`make check`) and CI runs exactly that command, path-filtered to the demo folder.
2. The external validator is a separate command (`make gate`) that writes a receipt tied to scene bytes; the offline check compares the receipt, so a stale green cannot pass.
3. Generated files are never hand-edited; one builder writes all six, and a test regenerates them and compares bytes.
4. Frozen baseline files are hash-recorded; a script fails if they change.
5. The roadmap lists each item with a done-when that names its instrument; "done" is not an opinion.
6. New version, new folder. v1 and v2 stayed byte-identical through this PR.

## Open, so nobody claims past it

No GPU timing, no screenshot regression, no cross-browser sweep. Sky has no proper motion, refraction or civil-time apparent place. 3 of 128 source links were never opened. Hall, Khafre cubes and ornaments are speculative drawings. The Atlas's own claims in GZ-1 to GZ-3, GZ-10 to GZ-12 rest on the upload's notes plus the tests that pass here; no independent second reader has tried to break them (law 44).

## Destinations

| Piece | Destination | Why |
|---|---|---|
| GZ-4, GZ-5 | Loom acceptance profile for demo versions (receipt binds scene bytes; frozen files hash-checked) | A rule other lanes can run |
| GZ-8, GZ-9 | Leak-sweep and packaging recipes in `kit/` templates | Both bit this build |
| GZ-1 to GZ-3 | Authored-label guidance for claim-heavy demos | Keeps imagined geometry visible as imagined |
| Rest | Stays with the demo | Project-specific |
