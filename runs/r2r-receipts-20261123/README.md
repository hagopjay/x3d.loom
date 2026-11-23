# Receipts for the R2R runs of 23 November 2026

Everything the three sealed R2R runs read, so they can be checked and repeated. Made on a cloud machine (15 GB,
4 cores) on 23 Nov 2026. Nothing here was sent to any outside project.

| File | What it is | Made by |
|---|---|---|
| `chaos-2.7.1-rng7.tar.xz`, `-rng11`, `-rng23`, `-rng101` | Four differential chaos rounds on add-on **2.7.1** (commit d931551): `rows.json` and 960 one-edit mutants each | x3d-blender-io `tools/chaos/differential.py` at main 8e56437, add-on source pinned to 2.7.1, in bpy 5.3.0 |
| `chaos-2.7.3-rng7.tar.xz`, `-rng101` | The same two seeds on add-on **2.7.3** (commit 8e56437, main) | the same tool, add-on source at main |
| `sweep/<version>-import.jsonl`, `-reexport.jsonl`, `-x3dpy.jsonl` for 2.7.1 and 2.7.3 | 514 real `.x3d` files from the project's repositories through each instrument, one verdict per line | `kit/loomkit/r2r/drivers/blender_io.py` |
| `manifests/blender-io-2.7.1.json`, `blender-io-2.7.3.json`, `fault-lab-v1.json` | The manifests of the three runs (`loom.r2r-manifest/1`) | by hand |
| `replay-271-rules-on-273.json` | The 2.7.1 run's rules asked of add-on 2.7.3 (`loom.r2r-replay/1`) | `kit/loom r2r replay` |
| `selftest.json` | The engine's own test on the day (`loom.r2r-selftest/1`) | `kit/loom r2r selftest --json` |

**Judges of a chaos row:** the add-on's own validator, x3d.py 4.0.65.8, xmllint (libxml 20914) with `x3d-4.0.xsd` from
the x3d_mcp fork at 4d433af, the Web3D X3D Schematron through SaxonC, the bpy 5.3.0 import, and import then export.
R2R used the importer, the re-export and "did x3d.py crash" as instruments. x3d.py is reached through the add-on's
`validate.py`, so that instrument is named with the add-on version too.

**What was changed before packing:** machine paths in tracebacks were replaced by `<addon>/`, `<site-packages>/`,
`<x3d-blender-io>/` and `<tmp>/`, and sweep file names were rewritten from absolute paths to
`repos:<repository>/<path>`. The runs read the packed form, so the hashes in each `run.json` are of these files.

**Counts (C, from `rows.json` and the sweep files):**

| Add-on | Chaos mutants | Importer crashes | Import-then-export crashes | x3d.py crashes | Sweep: importer fails | Sweep: re-export fails |
|---|---:|---:|---:|---:|---:|---:|
| 2.7.1 | 3,840 | 158 | 11 | 60 | 2 of 514 | 1 of 512 |
| 2.7.3 | 1,920 | 0 | 0 | 0 | 2 of 514 | 1 of 512 |

The 60 x3d.py crashes are a `RecursionError` on files nested 1,200 deep, raised where add-on 2.7.1 walks the scene
for x3d.py; 2.7.3 walks with an explicit stack and has none. x3d.py passed all 514 swept files through both versions.
The three sweep failures are the same three files on both versions: two copies of a `CoordinateDouble` fixture and
`MetadataNodeExamplesX3D4.x3d`.

**What the runs found (C, loomkit.r2r 0.1.0):** 28 candidate rules from the 2.7.1 receipts (15 Confirmed, 4 Likely,
9 Suspected), 2 from the 2.7.3 receipts, 7 from the Fault Lab. Put to add-on 2.7.3, 21 of the 28 are closed, 6 are
still live and 1 is partly closed (`replay-271-rules-on-273.json`). The reading is in `LEARNINGS-r2r-engine.md`.

**These are the second set of runs.** The first set was made by a kit that counted a rule twice when it explained two
signatures, and whose replay could count one file twice (LOOM-v1 failure modes 196 and 197). Both were fixed and every
run here was made again; nothing of the first set is in the repository.

## Repeat a run

```sh
mkdir -p runs/r2r-receipts-20261123/chaos
for f in runs/r2r-receipts-20261123/chaos-*.tar.xz; do tar -xJf "$f" -C runs/r2r-receipts-20261123/chaos; done

# without the instrument: receipts only (no probes)
kit/loom r2r run runs/r2r-receipts-20261123/manifests/blender-io-2.7.1.json --out /tmp/r2r-again --no-probe

# with the instrument: a venv that has bpy 5.3.0 and x3d.py, and the add-on source at each version under <version>/source
kit/loom r2r run runs/r2r-receipts-20261123/manifests/blender-io-2.7.1.json --out /tmp/r2r-again \
    --root bpyenv=/path/to/venv --root addon-src=/path/to/addon-sources
```

The manifests expect the project's repositories checked out side by side (`repos` is the folder above `x3d.loom`).
Files that are not on the machine are skipped and counted. `chaos/` is ignored by git; only the archives are tracked.

CI re-checks what needs no instrument: `kit/tests/check_r2r_runs.py` unpacks the archives and confirms, for every
candidate, that each chaos source has the recorded hash, that the rule fires on it, that it fires on no more passing
files than its proof says, and that its grade recomputes.
