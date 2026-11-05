# Mashtots2 under the Loom (5 Nov 2026)

The Mashtots2 delivery was checked here: the slide show (X3D, X_ITE 16.5.1) and the living-alphabet constellation (three.js). Nothing in either project was changed. The one fix is a patch in `foldback/`, not applied.

## What arrived

| Item | sha256 |
|---|---|
| `mashtots2-20261105T212259Z-1-001.zip` (Downloads) | `ff39d49459e183b5c0ed8deaad82f972b0feac69836f69e00c2b5d7041c6bb40` |
| `mashtots-slideshow.zip` | `3a9f83b033d0b5c83178eeeb935721b5e9c4f9689c35ef50b3b75bcf8f1a45b3` |
| `mashtots-constellation.zip` | `c9fe609006bbd0151efcd3fb70a187c3f1e67a61b0e23f176468204a92c201bf` |
| `REPORT.md` (dated 3 Nov) | `df179df1091cfe848d67d44e1938d46e1937b44df2c86edb62558e8fd1a7149d` |

- **Extraction:** the delivery was extracted into `incoming-mashtots2/`, and the two projects were unpacked to `projects/mashtots-slideshow` and `projects/mashtots-constellation`.
- **Serving:** `projects/run_all.sh` serves the slide show at 8834 (`node serve.mjs`) and the constellation at 8835 in recorded mode. It strips any key from the constellation's environment, so the demo page cannot make a paid call.
- **Candidate:** slide-show sha256 `03273f0d…792d`, 205 files.

## Checked here

All browser checks ran in headless Chromium through Playwright, on this Mac (C, L3).

| Check | Result |
|---|---|
| Slide show: start card, then "Begin silently" | Console clean, 0 failed requests, 60 X3D frames/s |
| Slide show: delivered `tools/feature-test.js` | **150 of 150**, console clean (the delivered result file, dated 3 Nov, says 148 of 148) |
| Constellation: `?deck=1` | Recorded mode ("the server has no key"); [cost withheld] and 0 calls; the only API request was `/api/health` |
| Constellation: delivered `tools/feature-test.js` | **74 of 74**, console clean, no request off the machine |
| Constellation: "MSAA 4x (diagnostic)" | Stage mean brightness **61.4 → 3.9 → 61.7** (off, on, off). The delivery measured 55.2 → 1.1 → 54.6 |
| All eight demo-page modes (start card, deck, approved cut, slide 1, classic, score lab, constellation, its deck) | Console clean, 0 failed requests |
| Grammar and meaning (`app/*.x3d`, fork fa0b389) | Pass: 3 scenes, XSD 4.0 valid, 0 semantic errors |
| Traps (11 rules) | Pass: 0 hits |
| Page traps, first run (`app/*.js`) | **Pass, but over nothing relevant:** 6 files, 0 hits, 0 field callbacks seen |
| Page traps, after the witness learned inline scripts and named callbacks (15 files: every .js and .html outside vendor/) | **Fail:** `app/stage.html:378` and `app/explore/director/index.html:202`, `onFrame` passed by name without try. 2 field callbacks and 9 inline scripts seen |
| Page traps on the constellation (27 files: `public/js/**`, `public/*.js`, `index.html`, `server.mjs`) | Pass. Everything parses; 0 field callbacks (three.js, not X_ITE), so the X_ITE rules had nothing to judge |
| Provenance: the zips carry no `.git`; the source repos are on this Mac at `~/Projects/x3d/work/mashtots-standalones/` | Both carry the commits the report names (slide show `d148f8f` → `809600a`, constellation `a7703ef` → `4de89d0`), with clean working trees that match the delivery file for file, logs aside. The slide show has 205 tracked files (the candidate's 205); `git diff d148f8f HEAD` is 31 files, +1245 −16 |

## The freeze, reproduced

The resilience probe used on the six x3d.STEM studies was applied to the slide show. The conductor's `step` was made to throw once, at section 20 s with dazzle on and the piece playing.

| | Delivered page | Patched copy |
|---|---|---|
| Clock before the throw | 1.5 s in 1.5 s | 1.5 s in 1.5 s |
| Clock after the throw | **0 s in 2 s**; the TimeSensor stopped, a new callback was never called, and a seek moved the playhead, which then stood still | **2.0 s in 2.0 s**; the TimeSensor advanced 2.0 s |
| Console | One uncaught page error | The probe's error, logged by the guard |
| Feature test | 150 of 150 (the failure path is not exercised) | 150 of 150 |
| Page traps | Fail (2) | Pass (`foldback/page-traps-after-patch.json`, subject is the scratch copy) |

The patch is `foldback/stage-onframe-guard.patch` (sha256 `e2321435…4950`). It wraps the body of `onFrame` in try/catch in `app/stage.html` and `app/explore/director/index.html`, and applies cleanly with `patch -p1 --dry-run` in `projects/mashtots-slideshow`. The patched director page loads with a clean console, and its clock advances.

**To apply** (your decision):

```
cd ~/Projects/x3d/loom/projects/mashtots-slideshow && patch -p1 < ~/Projects/x3d/loom/v1/runs/mashtots2-20261105/foldback/stage-onframe-guard.patch
```

## What the Loom learned

These became law 36, the Authored label, and failure modes 93 to 101 in [LOOM-v1.md](../../LOOM-v1.md); the plain-language versions are lessons 24 to 30 in [LESSONS-v1.0.md](../../LESSONS-v1.0.md).

### The witness changes in `kit/loomkit`

- **Inline scripts:** page traps read the inline `<script>` blocks of HTML files. Hits carry the HTML line number, and shader and JSON blocks are skipped.
- **Named callbacks:** a callback passed by name is resolved to its definition in the same source and judged like an inline one.
- **Module scope:** window-name checks skip module code. The first HTML run flagged a module's `frames`, a false positive.
- **Inventory:** each record carries `seen`, counting field callbacks, world loads and inline scripts.
- **Several globs:** `--files` accepts several globs, separated by commas.
- **Line numbers on macOS:** js-syntax reports the line. It had reported `?` since it shipped, because Node prints `/private/var/…` for a `/var/…` temp file.
- **Tests:** 6 two-sided reading forms were added. The 44 negative controls and the 11 + 6 rules still pass, normal and under `python -O`.
- **The six studies:** re-run under the new reader with `src/*.js,index.html`, all six still pass, with their `seen` counts as expected. Their receipts are unchanged and record the instrument that judged them.

## Not checked

- Listening.
- The live voice: no paid call was made.
- A microphone.
- Safari and Firefox.
- The Armenian text, which the delivery flags for a native reader.
- Whether the first commits are verbatim copies of `mashtots-demo-site-eval` at `eaa7d37`. The repos and their history were checked against the delivery, not against that source (failure mode 99).
- The hidden-tab behaviour is the delivery's own report; it was not reproduced here (failure mode 101).
