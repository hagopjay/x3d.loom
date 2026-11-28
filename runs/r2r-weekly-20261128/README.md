# Weekly R2R watch, 28 November 2026: add-on 2.9.0, 2,300 real files

The first run of the weekly watch and its baseline. Every `.x3d` file of at most 2,000,000 bytes on the default branch
of the sixteen project repositories that hold X3D (2,644 files, 2,300 distinct by git blob) was put to the
x3d-blender-io add-on at **2.9.0** (main 6bf1d15, source tree 2866ac6) in bpy 5.3.0, and the rules kept from 23 Nov
were asked again. Cloud machine, 15 GB, 4 cores. No language model. Nothing here was sent to any outside project.

Grades: C Confirmed (measured here, instrument named), L Likely, S Suspected.

## Numbers

| Measured | Result | Instrument |
|---|---|---|
| Importer | **2,264 pass, 36 fail** of 2,300 | x3d-blender-io 2.9.0 importer, bpy 5.3.0 (C) |
| Import then export | **2,256 pass, 8 fail**, 36 not asked (import did not finish) | same add-on, 60 s per file (C) |
| x3d.py through the add-on's validate.py | 2,300 pass (no crash) | x3d.py 4.0.65.8 (C) |
| The 28 rules of the 2.7.1 run, asked of 2.9.0 | **27 closed, 1 partly closed** (the export gate, by design: 28 pass, 23 refused), 0 still live | `kit/loom r2r replay`, loomkit.r2r 0.1.0 (C) |
| The 2 rules of the 2.7.3 run, asked of 2.9.0 | 1 closed, 1 not exercised (1 file) | same (C) |
| New candidate rules | 4 from 4 clusters: 0 Confirmed, 1 Likely, 3 Suspected, in 212 s | `runs/r2r-blender-io-290-20261128/` (C) |
| The 4 candidates against hand files | 1 right, 1 too narrow, 1 a correlate, 1 wrong | `hand-290/`, 9 files, same importer (C) |

## What failed, and why

| Failures | Signature | Cause | Grade |
|---|---|---|---|
| 34 imports | `import returned CANCELLED` | The files are not well-formed XML: 33 written by language models (x3d.ml), 1 deliberate control (x3d.demo). A correct refusal | C |
| 1 import | `AttributeError at import_x3d.py:6538 importAudio` | A `Sound` with no `AudioClip` or `MovieTexture` child (an `OscillatorSource`, or nothing): the source is used before the None check. Same on 2.7.4 | C |
| 1 import | `ZeroDivisionError at import_x3d.py:3054 scaledLoopVertex` | An `Extrusion` whose crossSection points are all equal: the cap scale is 0. Same on 2.7.4 | C |
| 8 exports | no answer in 60 s | The exporter samples every object at every frame and writes any object whose transform differs in the last bit as an animation (below). Same on 2.7.4 | C |

Nothing regressed between 2.7.4 and 2.9.0 on these files. All four were always there; the sweep of 23 Nov was too
narrow to meet them (`../r2r-receipts-20261123/ERRATA.md`).

## The export that grows 680 times

`x3d.platformer/levels/0-0-feel-lab.x3d` (x3d.loom at fc30c89), import then export, add-on 2.9.0 and 2.7.4 alike
(`slow-export/census-feel-lab-*.json`):

| | Source | After import then export |
|---|---:|---:|
| Bytes | 66,735 | 45,547,123 |
| Position and Orientation interpolators | 5 | 497, each with 2,161 keys |
| ROUTE | 11 | 994 |
| TimeSensor | 5 | 1 |
| Seconds to export | | 49 (2.9.0), 47 (2.7.4) |

Of the 497 written interpolators, 12 move by 0.01 or more, 217 vary by less than 0.0001, and 268 hold written values
that never change. `slow-export/profile-export-feel-lab-2.9.0.txt`: 86 of 115 profiled seconds are in `extract.py`
`_sample_animation`, with 1,578,261 calls of `_matrix_transform` (730 objects times 2,161 frames) and 1,016,783 matrix
inversions (the parent's world matrix, once per child per frame). The test for "moving" at the end of that function
is an exact inequality between floats that came through an inversion.

Import alone against export, add-on 2.9.0, three at a time, export under the profiler, stopped at 420 s
(`slow-export/import-vs-export-2.9.0.jsonl`):

| File | Objects | Import s | Export s | Export size |
|---|---:|---:|---:|---:|
| `x3d.loom/x3d.platformer/levels/0-0-feel-lab.x3d` | 730 | 0.99 | 114.98 | 46 MB |
| `x3d.loom/x3d.platformer/levels/1-1-tinker-meadow.x3d` | 2,034 | 4.4 | 384.22 | 263 MB |
| `x3d.accrete/examples/demo-96/world.x3d` | 1,314 | 3.89 | 159.23 | 87 MB |
| `x3d.gobbler/gobbler-flyte/scene.x3d` | 640 | 5.58 | no answer in 420 | not finished |
| `x3d.gobbler/gobbler-flyte/observatory.x3d` | 983 | 7.21 | no answer in 420 | not finished |
| `x3d.demo/docs/demos/gobbler-worlds-within/v1/source/bird.x3d` | 793 | 4.78 | 357.51 | 276 MB |
| `x3d.demo/docs/demos/segment-sphere/v1/assets/segment-sphere.x3d` | 2,493 | 42.74 | 6.3 | 3 MB |
| `x3d.loom/x3d.platformer/levels/2-1-pendulum-gorge.x3d` | 1,948 | 4.81 | no answer in 420 | not finished |
| `x3d.loom/x3d.platformer/levels/3-1-clockwork-spire.x3d` | 1,519 | 3.33 | no answer in 420 | not finished |

`segment-sphere.x3d` is the one slow **import**: 646 Text nodes at 77 ms each in `process_font_object`
(`slow-export/profile-import-segment-sphere-2.9.0.txt`).

## The engine's four candidates, graded by hand

| Candidate | Engine's grade | Hand check | Verdict |
|---|---|---|---|
| `r2r-8fd2544c0404` the file is not well-formed XML | S | all 34 files fail an XML parse | right |
| `r2r-7a4b1260be37` Extrusion crossSection equals `0.1 0.1 0.1 0.1 0.1 0.1 0.1 0.1` under Shape | S | any crossSection whose points are all equal fails, any value, any parent | too narrow |
| `r2r-c5884565c319` depth 9 or more, 2,819 or more elements, 3 or more ROUTEs | L | the cause is timeline frames times objects; these three counts only travel with it | a correlate |
| `r2r-b1582e0e10fb` AudioClip url with a `data:` scheme and loop | S | that file passes; a Sound with no AudioClip fails, even an empty one | wrong |

`hand-290/verdicts-2.9.0.jsonl`, importer alone, add-on 2.9.0:

| Hand file | Outcome | Signature |
|---|---|---|
| `sound-oscillator-only.x3d` | fail | AttributeError at import_x3d.py:6538 importAudio |
| `sound-audioclip-data-url-loop.x3d` | pass |  |
| `sound-no-source.x3d` | fail | AttributeError at import_x3d.py:6538 importAudio |
| `extrusion-all-points-equal.x3d` | fail | ZeroDivisionError at import_x3d.py:3054 scaledLoopVertex |
| `extrusion-all-points-equal-other-value.x3d` | fail | ZeroDivisionError at import_x3d.py:3054 scaledLoopVertex |
| `extrusion-all-points-equal-in-group.x3d` | fail | ZeroDivisionError at import_x3d.py:3054 scaledLoopVertex |
| `extrusion-two-distinct-points.x3d` | pass |  |
| `extrusion-single-point.x3d` | fail | TypeError at import_x3d.py:3046 importMesh_Extrusion |
| `extrusion-default.x3d` | pass |  |

The single-point Extrusion is a further crash no real file has yet. Three words the vocabulary lacks, each of which
would have let the engine write the true rule: a child that is absent, a list whose tuples are all equal, and
timeline length times object count.

## A correction made before sealing

The judge (`tools/chaos/differential.py`, `ImportJudge.run`) runs import followed by export in one call. The sweep
runner stamped a file that gave no answer in 60 s as a failure of whichever instrument was being asked, so the eight
slow exports were first written down as eight importer failures (44 fail). The importer was asked again alone
(`tools/import_only.py`): all eight pass (`slow-export/import-alone-2.9.0.jsonl`). Those eight importer rows carry
`"asked": "import alone"`. In every other importer row `seconds` is import plus export.

## Files

| File | What it is | Made by |
|---|---|---|
| `manifest-blender-io-2.9.0.json` | The manifest (`loom.r2r-manifest/1`): the sweep, the three instruments, the commits | by hand |
| `sweep/2.9.0-import.jsonl`, `-reexport.jsonl`, `-x3dpy.jsonl` | 2,300 verdicts each, files named `week:<repository>/<path>` | `tools/sweep_runner.py` over `kit/loomkit/r2r/drivers/blender_io.py`, packed by `tools/pack_week.py` |
| `replay-271-rules-on-290.json`, `replay-273-rules-on-290.json` | The kept rules asked of 2.9.0 (`loom.r2r-replay/1`) | `kit/loom r2r replay` |
| `../r2r-blender-io-290-20261128/` | The sealed engine run on this week's failures | `kit/loom r2r run` |
| `slow-export/` | Import against export times, the census of one export on 2.9.0 and 2.7.4, two profiles | `tools/stage_times.py`, `export_census.py`, `profile_import.py`, `import_only.py` |
| `hand-290/` | Nine hand-written files and the importer's verdicts | by hand, `tools/import_only.py` |

Commits swept: x3d-blender-io 6bf1d15, x3d.accrete 3755e78, x3d.castle 5b13f70, x3d.chess d314fcf, x3d.demo a80fade, x3d.docs e702465, x3d.gamelab e0a0d97, x3d.gobbler cd95382, x3d.lab 62f3aab, x3d.loom fc30c89, x3d.mashtots 3b57769, x3d.mathslab d883fb7, x3d.ml adc7464, x3d.stem 98f79d7, x3d.wgpu 091b2be, x3d_mcp ca0e75c.

Machine paths in messages and profiles were replaced by `<addon>/`, `<site-packages>/`, `<x3d-blender-io>/`,
`<python>/` and `<tmp>/`. To repeat, see the last note in the manifest.
