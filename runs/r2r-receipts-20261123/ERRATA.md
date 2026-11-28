# Errata for the R2R runs of 23 November 2026

## 1. The sweep was a hand-picked sample, not "every .x3d" (found 28 Nov 2026)

**What was written.** The three manifests in `manifests/`, and the notes copied from them into
`runs/r2r-blender-io-271-20261123/run.json`, `runs/r2r-blender-io-273-20261123/run.json` and both `REPORT.md` files,
say:

> Sweep: every .x3d under the project's repositories on 23 Nov 2026 that is at most 2 MB (514 files)

**What is true.** The 514 files came from fourteen named folders, kept only if at most 400,000 bytes, with identical
contents counted once. The selector, as it was run:

| Repository | Folder |
|---|---|
| x3d.loom | `x3d.webgpu/bridge`, `x3d.threejs/bridge`, `x3d.physics`, `x3d.drift`, `runs` |
| x3d.wgpu | `conformance/scenes`, `fuzz/seeds` |
| x3d_mcp | `tests/fixtures`, `examples/semantic_twins` |
| x3d.castle | `tests/scenes-phase3` |
| x3d-blender-io | `docs/showcase` |
| x3d.mathslab | `examples/x3d` |
| x3d.chess | `examples/x3d` |
| x3d.demo | `docs/demos/fault-lab` |

**How large the difference is.** On 28 Nov 2026 the default branches of the project's sixteen repositories that hold
X3D carry 2,644 `.x3d` files of at most 2 MB, 2,300 of them distinct (counted from `git ls-tree`). The 514 are about
a fifth of that. The population on 23 Nov was not counted.

**What does not change.** Every count in the sealed runs is a count over those 514 files and stays correct: 2 import
failures and 1 export failure on 2.7.1 and 2.7.3, none on 2.7.4. What changes is the reach of the sentence "the sweep
of real files has no failure": it covered fixtures, seeds and one demo folder, not the demos, the model-written
scenes or any file over 400 KB.

**What was done.** The sealed run folders and manifests are left as they were, because their hashes are part of the
record. This file, a note in `README.md` here and a section in `LEARNINGS-r2r-engine.md` carry the correction. The
first full sweep is in `runs/r2r-weekly-20261128/`. LOOM-v1 records the slip as a failure mode: the description of a
file list was written by hand, from memory, and not by the code that made the list.
