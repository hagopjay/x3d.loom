# Learnings: the receipt-to-rule engine (R2R v0.1, 23 Nov 2026)

The engine reads failure receipts and writes candidate Loom rules, each with a two-sided proof and a grade. Spec:
[R2R.md](R2R.md). Code: `kit/loomkit/r2r/`. Sealed evidence: `runs/r2r-*`. No language model was used and nothing was
spent. Every number below names its instrument; all of it was measured on one cloud machine (15 GB, 4 cores) on
23 Nov 2026. The engine proposes and never promotes: all 37 rules below are candidates.

Instruments: x3d-blender-io **2.7.1** (commit d931551), **2.7.3** (8e56437) and **2.7.4** (0eb4809, main) in bpy 5.3.0; x3d.py 4.0.65.8
called through each add-on version's `validate.py`; X3DUOM 4.1 from the x3d_mcp fork at 4d433af; engine
loomkit.r2r 0.1.0, source sha256 `096d1ce649f8b276` for every run and for the self-test.

## Numbers

| Measured | Result | Instrument |
|---|---|---|
| Self-test: hidden rules recovered | 3 of 3 word for word; on fresh files 31 of 31; 140 of 140; 46 of 46 failing files flagged, 0 false alarms in 325 files each | `drivers/rule_tool.py` stand-in, seed 1, `kit/loom r2r selftest` |
| Self-test: a tool that fails at random | 1 rule, graded S; nothing above Suspected after 123 questions | same |
| Two-sided controls | 18 negative controls caught the intended way, 15 vocabulary words tested both ways, 2 Python modes | `kit/tests/test_r2r.py`, Python 3.13.18 |
| Receipts read, add-on 2.7.1 | 16,742 events: 232 failures (229 from 4 chaos rounds of 960 mutants, 3 from the 514-file sweep), 16,510 passes | x3d-blender-io 2.7.1 (d931551) in bpy 5.3.0, and x3d.py 4.0.65.8 through its validate.py |
| Candidate rules, add-on 2.7.1 | **28 rules from 17 clusters: 15 Confirmed, 4 Likely, 9 Suspected**; 2 of them explain two signatures each | loomkit.r2r 0.1.0, `096d1ce649f8b276` |
| Probes built and run | 2,924 (2,907 distinct files) in 33 minutes on 4 cores | x3d-blender-io 2.7.1 (d931551) in bpy 5.3.0, and x3d.py 4.0.65.8 through its validate.py, 10 GB address-space cap |
| Clusters first seen in a probe | 7 of 17: crash signatures no chaos round produced | same |
| Audit predictions of the Confirmed rules | 265 right, 0 wrong | same |
| False alarms of the Confirmed and Likely rules | 0 on the files the instruments passed, training and held out | same |
| Held-out failures, largest cluster | 35 of 35 called, 0 false alarms in 1,416 held-out passing files (`r2r-96ba3f032944`) | chaos rounds rng 23 and 101, never used for induction |
| Probes that killed the process | 5 (signal 11), all in the huge-index clusters | bpy 5.3.0 under the 10 GB cap; cause not established (S) |
| The 2.7.1 rules put to add-on 2.7.3 | **21 closed, 1 partly closed, 6 still live**, 0 not exercised | x3d-blender-io 2.7.3 (8e56437, main) in bpy 5.3.0, `kit/loom r2r replay` |
| Receipts read, add-on 2.7.3 | 9,220 events, 3 failures (0 from 2 chaos rounds, 3 from the sweep); 2 rules: 0 Confirmed, 1 Likely, 1 Suspected | same |
| The 2.7.1 rules put to add-on 2.7.4 | **0 still live**: 25 closed, 1 partly closed (the export gate, designed), 2 that pass every file they fire on but have 4 and 2 files | x3d-blender-io 2.7.4 (0eb4809, main; source tree 92a942d) in bpy 5.3.0, `kit/loom r2r replay` |
| The 514-file sweep, add-on 2.7.4 | 0 failures in 514 on each of the three instruments (2.7.3: 2 import, 1 export) | same |
| Hand files for the three thin rules | 15 of 19 fail on 2.7.3, 0 of 19 on 2.7.4 | 2.7.3 (8e56437) and 2.7.4 in bpy 5.3.0, `runs/r2r-receipts-20261123/hand-274/` |
| Fault Lab v1, 10 planted faults | 7 rules, all Suspected (a person planted them, one example each); 3 faults reported as not in the file | x3d.demo fault-lab/v1 at 8715b23; no instrument |

## Still live on add-on 2.7.3

Two chaos rounds on 2.7.3 (1,920 mutants) produced no crash. The 2.7.1 run's rules were then put to 2.7.3, with the
old failures and the probes that had confirmed each rule rebuilt from their recipes and checked against their recorded
hashes. 21 of 28 rules are closed by the fixes of 2.7.2 and 2.7.3: 2.7.3 passes every file they fire on.
6 are still live and 1 is partly closed. Counts are per rule, and one file can serve two rules:

| Grade on 2.7.1 | Rule | On 2.7.3 | Files that fail | Files that pass | How 2.7.3 fails |
|---|---|---|---:|---:|---|
| **C** | `attr[ge:index_excess:536870902 & e.child:Color & (at:IndexedTriangleSet@index \| at:IndexedTriangleStripSet@index)]` | still live | 30 | 0 | `IndexError at import_x3d.py:1991 importMesh_ApplyColors` x 30 |
| **C** | `attr[ge:index_excess:536870902 & !e.child:Normal & anc:Transform & at:IndexedTriangleStripSet@index]` | still live | 18 | 0 | `IndexError at import_x3d.py:1991 importMesh_ApplyColors` x 18 |
| **L** | `attr[ge:index_excess:19311468 & at:IndexedTriangleStripSet@index & e.child:TextureCoordinate]` | still live | 9 | 0 | `IndexError at import_x3d.py:2061 importMesh_ApplyUVs` x 9 |
| **L** | `attr[ge:ntok:20 & at:IndexedTriangleFanSet@index]` | still live | 4 | 0 | `RuntimeError at import_x3d.py:2268 importMesh_IndexedTriangleFanSet` x 4 |
| **L** | `elem[x:present & n:CoordinateDouble]` | still live | 2 | 0 | `AttributeError at import_x3d.py:2038 importMesh_ReadVertices` x 2 |
| **S** | `attr[ge:index_excess:20060965 & !v:lexical_invalid & at:IndexedFaceSet@coordIndex & e.has:creaseAngle]` | still live | 46 | 0 | `IndexError at import_x3d.py:2392 importMesh_IndexedFaceSet` x 46 |
| **C** | `attr[v:below_min & ntok:1 & (at:Cone@bottomRadius \| at:Cone@height \| ... 7 places)]` | partly closed | 23 | 28 | `ValueError at export_x3d.py:2177 _modern_writer` x 23 |

Hand checks on add-on 2.7.3 in bpy 5.3.0, six files written by hand (C):

- A scene with `<MetadataBoolean value="true false"/>` imports, and the export then stops with
  `could not convert string to float: 'true'`. Two of two such files. The message comes from the exporter's own
  validation step, so the fault is in how that step reads a MetadataBoolean value. The engine's own lead for this
  failure, from the one real file, was a `USE` written before its `DEF` (Suspected). It was wrong, which is what
  Suspected on one failure means.
- `<Sphere radius="-1"/>` and `<Cone height="-2"/>` import, and the export refuses them with "must be greater than or
  equal to zero (set X3D_EXPORT_VALIDATION=warn to export anyway)". That refusal is designed. The rule
  `v:below_min` is the engine working out the export gate's own rule from the outside.
- An `IndexedTriangleSet` with a `Color` child and index 9 into 3 points imports cleanly, as does an `IndexedFaceSet`
  with the same overshoot. The files that fail carry an index of hundreds of millions, up to 2147483647. One rebuilt
  probe per class was run again by hand: `rgb[l.vertex_index]` in `importMesh_ApplyColors`, `points[i]` in
  `importMesh_IndexedFaceSet` and `uvs[vidx]` in `importMesh_ApplyUVs` raise `IndexError: list index out of range`,
  and `importMesh_IndexedTriangleFanSet` ends in `MemoryError` under the 10 GB cap. The thresholds in those rules are
  where the engine's probes happened to land, not a measured boundary.

So three things were live on 2.7.3 and went to the Blender lane: `CoordinateDouble` stops the import (two real files in this
repository), `MetadataBoolean` stops the export (one real file in the x3d_mcp fixtures), and an index of hundreds
of millions raises `IndexError` in three mesh readers and `MemoryError` in the triangle-fan reader (built files only). The
seventh rule in the table, the export gate, is the add-on doing what it was designed to do.

## Closed on main (add-on 2.7.4)

The Blender lane took the table above and fixed it in x3d-blender-io #77 (2.7.4, merged to main as 0eb4809). The
same rules were then put to 2.7.4 with `r2r replay`, the same probes rebuilt from the same recipes
(`replay-271-rules-on-274.json`, `replay-273-rules-on-274.json`). All of this is C on add-on 2.7.4 in bpy 5.3.0:

| Rule (signature on 2.7.3) | On 2.7.3 | On 2.7.4 | Files that pass on 2.7.4 | Files that fail |
|---|---|---|---:|---:|
| `r2r-21d944367a59` (IndexError, ApplyColors) | still live | closed | 30 | 0 |
| `r2r-758326262381` (IndexError, ApplyColors) | still live | closed | 18 | 0 |
| `r2r-a2a869510561` (IndexError, ApplyUVs) | still live | closed | 9 | 0 |
| `r2r-de23254b4dea` (IndexError, IndexedFaceSet) | still live | closed | 46 | 0 |
| `r2r-88d9b63e43b3` (RuntimeError, IndexedTriangleFanSet) | still live | passes all, too few files to call | 4, and 7 hand files | 0 |
| `r2r-d261dd67c562` (AttributeError, CoordinateDouble) | still live | passes all, too few files to call | 2, and 10 hand files | 0 |
| `r2r-ac96dfe7dbc3` (the export gate) | partly closed | partly closed, as designed | 28 | 23 |

Over the whole 2.7.1 run: **25 closed, 0 still live**, 1 partly closed, 2 with fewer than the 5 passing files the
engine asks for before it writes "closed" (its label for those is `not exercised`). The sweep of 514 real files has
0 failures on 2.7.4 for the importer, the import then export, and x3d.py. The three real files that failed on 2.7.3
pass. The two rules of the 2.7.3 run have 2 files and 1 file, and those pass.

Because two rules had so few files, 19 more were written by hand and run on both versions
(`runs/r2r-receipts-20261123/hand-274/`). 15 of 19 fail on 2.7.3 and 0 of 19 on 2.7.4. They also show where two of
the engine's Likely rules were off, in ways only a varied file could show:

- **The fan rule's threshold was a stand-in.** The rule said "an `IndexedTriangleFanSet` index of at least 20
  tokens". A file of 19 tokens holding four fans fails on 2.7.3, and a file of 21 tokens holding one fan passes.
  The cause is the third fan (the Blender lane found the reader restarting it at the wrong index, which then ran for
  about 50 s into a `MemoryError`). The vocabulary has a word for the number of tokens and none for the number of
  runs closed by -1, so the engine took the nearest word it had. Every probe it built had more fans when it had
  more tokens, so the two could not be told apart (failure mode 198).
- **The CoordinateDouble rule was too wide.** It said "the node is present". Of ten hand files, the seven with a
  triangle node as parent fail on 2.7.3; under `IndexedFaceSet`, `IndexedLineSet` and `PointSet` it imports. The rule
  came from two real files with no probe behind it, which is what Likely with closure `untested` records.
- `MetadataBoolean value="true false"`: both hand files fail the 2.7.3 export and pass on 2.7.4.

Neither correction changes a verdict above: the fixes close the real cause, and the files pass. They do change how
far to trust a Likely rule's wording: its place was right both times, its condition was a first guess.

## The weekly watch: add-on 2.9.0 and every real file (28 Nov)

From 28 Nov the engine runs once a week: sweep the real files, replay the kept rules, read what is new. The first
run is the baseline, in `runs/r2r-weekly-20261128/` (its README has every number and file).

**A correction first.** The notes of 23 Nov say the sweep was "every .x3d under the project's repositories ... at
most 2 MB (514 files)". It was fourteen named folders, files of at most 400,000 bytes. The sentence was written by
hand and not by the code that made the list (`runs/r2r-receipts-20261123/ERRATA.md`, failure mode 532). The true
population on 28 Nov is 2,644 files, 2,300 distinct, and this week's list comes from `git ls-tree`.

| Measured (C) | Result | Instrument |
|---|---|---|
| Importer, 2,300 files | 2,264 pass, 36 fail | x3d-blender-io 2.9.0 (main 6bf1d15) in bpy 5.3.0 |
| Import then export | 2,256 pass, 8 with no answer in 60 s | same |
| x3d.py through validate.py | 2,300 pass | x3d.py 4.0.65.8 |
| The 28 + 2 kept rules on 2.9.0 | 28 closed, 1 partly closed (designed), 1 not exercised, **0 still live** | `kit/loom r2r replay` |
| New candidates | 4: 0 Confirmed, 1 Likely, 3 Suspected | `runs/r2r-blender-io-290-20261128/` |

**What the wider sweep met.** Nothing regressed from 2.7.4 to 2.9.0. Four things that were always there:

1. 34 files that are not well-formed XML (33 written by language models) are refused. Correct.
2. A `Sound` with no `AudioClip` or `MovieTexture` child raises `AttributeError` in `importAudio`: the source is
   used one line before the check for None. An empty `<Sound/>` is enough.
3. An `Extrusion` whose crossSection points are all equal divides by zero in `scaledLoopVertex`. A single-point
   crossSection raises a `TypeError` two lines earlier (hand file; no real file has it).
4. **Export grows a 67 KB level to 45.5 MB.** `extract.py` `_sample_animation` samples all 730 objects at all 2,161
   frames and keeps any object whose transform differs at all from frame to frame. The transforms come through a
   matrix inversion, so rounding noise counts as motion: 5 interpolators become 497, of which 12 move. 86 of 115
   profiled seconds are in that function. Three changes would remove it (L, not tried): compare with a tolerance,
   invert a parent once per frame, sample only what an action, driver, constraint or moving ancestor can move.

**What the engine did with them.** Graded by hand against nine small files (`hand-290/`): the not-well-formed rule
is right; the Extrusion rule is true and too narrow (it kept the literal value); the slow-export rule (depth, element
count, ROUTE count) is a correlate of the cause, graded Likely by the engine; the Sound rule is wrong (it blamed the
`data:` URL of an AudioClip in the same file, and that file passes alone). The engine marked three of the four
Suspected. One failing file with no known-good twin is not enough to find a cause, and the grade said so.

**Two mistakes of the run itself, both caught before sealing.**

- The judge runs import and export in one call. A file whose export gave no answer was stamped as an importer
  failure, and for an hour the slowness was blamed on the importer (failure mode 534). A profile of the import alone
  (1.3 s) showed it. Ask each instrument alone before naming one.
- The first sweep attempt stopped at file 63 of a sample: the harness's 120 s watchdog ends the whole process, and
  the files after it were never asked (failure mode 533). `tools/sweep_runner.py` gives each file its own deadline
  and writes a verdict for a file that hangs or kills the process.

## Every rule of the 2.7.1 run

Rules are candidates. The rule text is folded where its list of places is long; the full rule, its proof and its
sources are in `runs/r2r-blender-io-271-20261123/candidates/` and in that folder's `REPORT.md`.

| Grade | Rule | Instrument: signature | Failures explained | False alarms on passing files | Held out: failures called; false alarms | Audit probes right / wrong | Closure | Put to add-on 2.7.3 |
|---|---|---|---:|---:|---:|---:|---|---|
| **C** | `attr[v:bool_noncanonical & !v:case_variant & nws:1 & (at:Box@solid \| at:CollidableShape@visible \| ... 24 places)]` | Blender import: `IndexError at import_x3d.py:860 getFieldAsBool` | 133 of 133 | 0 of 1,813 | 35 of 35; 0 of 1,416 | 20 / 0 | open | closed (171 pass, 0 fail) |
| **C** | `attr[v:arity_long & !p:Scene & !v:quoted & at:Transform@translation]` | Blender import: `ValueError at import_x3d.py:1700 translateTransform` | 76 of 149 | 0 of 2,162 | 0 of 2; 0 of 1,416 | 35 / 0 | open | closed (96 pass, 0 fail) |
| **C** | `doc[ge:depth_max:1004]` | x3d.py check: `RecursionError: maximum recursion depth exceeded` | 72 of 72 | 0 of 1,831 | 1 of 1; 0 of 1,469 | 11 / 0 | open | closed (83 pass, 0 fail) |
| **C** | `attr[v:inf & !v:arity_mismatch & (at:GeoViewpoint@fieldOfView \| at:Viewpoint@fieldOfView)]` | Blender import: `ValueError at viewpoint_fov.py:42 blender_camera_angle` | 62 of 62 | 0 of 2,297 | 0 of 0; 0 of 1,416 | 20 / 0 | open | closed (82 pass, 0 fail) |
| **C** | `attr[v:number_unparseable & !p:Scene & !v:quoted & at:Transform@center]` | Blender import: `ValueError at import_x3d.py:1678 translateTransform` (first seen in a probe) | 55 of 62 | 0 of 2,444 | 0 of 0; 0 of 1,416 | 20 / 0 | open | closed (75 pass, 0 fail) |
| **C** | `attr[ge:index_excess:440304889 & ge:ntok:20 & !e.has:ccw & at:IndexedFaceSet@coordIndex & e.child:Coordinate]` | Blender import: `RuntimeError at import_x3d.py:2008 validate_points_field` | 49 of 76 | 0 of 1,887 | 11 of 14; 0 of 1,416 | 15 / 0 | open | closed (63 pass, 0 fail) |
| **C** | `attr[ge:index_max:177662200 & le:index_excess:440304889 & !v:lexical_invalid & at:IndexedFaceSet@coordIndex & e.child:Coordinate]` | Blender import: `RuntimeError at import_x3d.py:2253 importMesh_IndexedFaceSet` (first seen in a probe) | 31 of 31 | 0 of 2,352 | 0 of 0; 0 of 1,416 | 21 / 0 | open | closed (49 pass, 0 fail) |
| **C** | `attr[v:below_min & ntok:1 & (at:Cone@bottomRadius \| at:Cone@height \| ... 7 places)]` | Import, then export: `ValueError at export_x3d.py:2111 _modern_writer` | 31 of 32 | 0 of 1,962 | 0 of 0; 0 of 1,409 | 20 / 0 | open | partly closed (28 pass, 23 fail) |
| **C** | `attr[ge:max_abs:5.05e+38 & e.child:Shape & e.has:DEF & (at:Transform@scale \| at:Transform@translation)]` | Import, then export: `RuntimeError at matrix_safety.py:47 inverted64` | 29 of 119 | 0 of 1,886 | 3 of 6; 0 of 1,409 | 13 / 0 | open | closed (39 pass, 0 fail) |
| **C** | `attr[v:number_unparseable & !p:Scene & at:Transform@scale & ntok:3]` | Blender import: `IndexError at import_x3d.py:1665 translateScale`; also `IndexError at import_x3d.py:1666 translateScale` (C) | 27 of 149 | 0 of 2,024 | 0 of 2; 0 of 1,416 | 24 / 0 | open | closed (128 pass, 0 fail) |
| **C** | `attr[v:inf & !v:arity_mismatch & (at:Arc2D@startAngle \| at:ArcClose2D@startAngle)]` | Blender import: `ValueError at import_x3d.py:4437 _arc_points` (first seen in a probe) | 25 of 28 | 0 of 2,506 | 0 of 0; 0 of 1,416 | 10 / 0 | open | closed (37 pass, 0 fail) |
| **C** | `attr[ge:index_excess:536870902 & e.child:Color & (at:IndexedTriangleSet@index \| at:IndexedTriangleStripSet@index)]` | Blender import: `IndexError at import_x3d.py:1857 importMesh_ApplyColors` (first seen in a probe) | 22 of 30 | 0 of 2,315 | 0 of 0; 0 of 1,416 | 11 / 0 | closed-so-far | still live (0 pass, 30 fail) |
| **C** | `attr[v:float_overflow32 & !p:Scene & !v:lexical_invalid & at:Transform@translation]` | Import, then export: `RuntimeError at matrix_safety.py:47 inverted64` | 16 of 119 | 0 of 1,886 | 0 of 6; 0 of 1,409 | 21 / 0 | open | closed (38 pass, 0 fail) |
| **C** | `attr[ge:index_excess:536870902 & !e.child:Normal & anc:Transform & at:IndexedTriangleStripSet@index]` | Blender import: `IndexError at import_x3d.py:1857 importMesh_ApplyColors` (first seen in a probe) | 14 of 30 | 0 of 2,315 | 0 of 0; 0 of 1,416 | 10 / 0 | closed-so-far | still live (0 pass, 18 fail) |
| **C** | `attr[v:has_comma & nws:3 & (at:Arc2D@startAngle \| at:ArcClose2D@startAngle)]` | Blender import: `ValueError at import_x3d.py:4437 _arc_points` (first seen in a probe) | 3 of 28 | 0 of 2,506 | 0 of 0; 0 of 1,416 | 14 / 0 | open | closed (15 pass, 0 fail) |
| **L** | `elem[ge:nattrs:1 & child:TouchSensor & has:scale & n:Transform & p:Scene]` | Blender import: `IndexError at import_x3d.py:1665 translateScale` | 28 of 149 | 0 of 2,024 | 0 of 2; 0 of 1,416 | 0 / 0 | open | closed (28 pass, 0 fail) |
| **L** | `attr[ge:index_excess:19311468 & at:IndexedTriangleStripSet@index & e.child:TextureCoordinate]` | Blender import: `IndexError at import_x3d.py:1927 importMesh_ApplyUVs` (first seen in a probe) | 9 of 9 | 0 of 2,380 | 0 of 0; 0 of 1,416 | 2 / 0 | closed-so-far | still live (0 pass, 9 fail) |
| **L** | `attr[ge:ntok:20 & at:IndexedTriangleFanSet@index]` | Blender import: `RuntimeError at import_x3d.py:2107 importMesh_IndexedTriangleFanSet` (first seen in a probe) | 4 of 4 | 0 of 2,376 | 0 of 0; 0 of 1,416 | 1 / 0 | closed-so-far | still live (0 pass, 4 fail) |
| **L** | `elem[x:present & n:CoordinateDouble]` | Blender import: `AttributeError at import_x3d.py:1904 importMesh_ReadVertices` | 2 of 2 | 0 of 2,167 | 0 of 0; 0 of 1,416 | 0 / 0 | closed-so-far | still live (0 pass, 2 fail) |
| **S** | `attr[ge:len:19 & v:lexical_invalid & !e.child:TransformSensor & !v:tok:" & at:Transform@translation]` | Blender import: `ValueError at import_x3d.py:1700 translateTransform` | 97 of 149 | 0 of 2,162 | 0 of 2; 0 of 1,416 | 82 / 5 | open | closed (113 pass, 0 fail) |
| **S** | `attr[ge:ntok:12 & !e.child:TransformSensor & !v:quoted & at:Transform@translation]` | Blender import: `ValueError at import_x3d.py:1700 translateTransform` | 74 of 149 | 0 of 2,162 | 0 of 2; 0 of 1,416 | 58 / 4 | open | closed (100 pass, 0 fail) |
| **S** | `attr[ge:ntok:6 & !p:Scene & at:Transform@scale]` | Blender import: `IndexError at import_x3d.py:1665 translateScale`; also `IndexError at import_x3d.py:1666 translateScale` (S) | 43 of 149 | 0 of 2,024 | 0 of 2; 0 of 1,416 | 28 / 3 | open | closed (106 pass, 0 fail) |
| **S** | `attr[ge:index_excess:20060965 & !v:lexical_invalid & at:IndexedFaceSet@coordIndex & e.has:creaseAngle]` | Blender import: `IndexError at import_x3d.py:2231 importMesh_IndexedFaceSet` (first seen in a probe) | 42 of 42 | 0 of 2,359 | 0 of 0; 0 of 1,416 | 7 / 1 | open | still live (0 pass, 46 fail) |
| **S** | `attr[ge:max_abs:1e+39 & anc:Group & (at:Transform@scale \| at:Transform@translation)]` | Import, then export: `RuntimeError at matrix_safety.py:47 inverted64` | 41 of 119 | 0 of 1,886 | 0 of 6; 0 of 1,409 | 26 / 2 | open | closed (61 pass, 0 fail) |
| **S** | `attr[ge:len:10 & v:number_unparseable & at:Transform@scale & ntok:3]` | Blender import: `IndexError at import_x3d.py:1665 translateScale` | 33 of 149 | 0 of 2,024 | 0 of 2; 0 of 1,416 | 31 / 1 | open | closed (55 pass, 0 fail) |
| **S** | `attr[ge:max:5 & v:arity_mismatch & !e.has:rotation & at:Transform@translation]` | Blender import: `ValueError at import_x3d.py:1700 translateTransform` | 30 of 149 | 0 of 2,162 | 0 of 2; 0 of 1,416 | 23 / 1 | open | closed (55 pass, 0 fail) |
| **S** | `attr[v:lexical_invalid & !e.has:rotation & at:Transform@scale]` | Import, then export: `RuntimeError at matrix_safety.py:47 inverted64` | 28 of 119 | 0 of 1,886 | 0 of 6; 0 of 1,409 | 37 / 4 | open | closed (45 pass, 0 fail) |
| **S** | `attr[ge:index_excess:2147483633 & le:ntok:15 & !v:lexical_invalid & at:IndexedFaceSet@coordIndex & p:Shape]` | Blender import: `RuntimeError at import_x3d.py:2008 validate_points_field` | 27 of 76 | 0 of 1,887 | 3 of 14; 0 of 1,416 | 24 / 1 | open | closed (59 pass, 0 fail) |

## What carries over

1. **A rule earns its grade by calling outcomes it has not seen.** Explaining the failures it was shown is worth at
   most Likely. Confirmed needs predictions that came true: probes built after the rule was fixed, or receipts held
   back. This is the stretched-marks lesson of law 32 (x3d.loom #150, #151) made into a mechanism, and it is the only
   reason the noise scenario ends with nothing above Suspected (failure mode 195).
2. **Test a rule engine on a rule you hid, and on noise, before pointing it at real receipts.** The self-test caught
   a ranking bug that returned a nesting limit of 76 for a hidden 64 (failure mode 189). Nothing in the real receipts
   could have shown it, because there the right answer is not known.
3. **Vary place and value separately.** "This spelling is harmless" and "the reader never looks at this attribute"
   are the same observation until a probe holds one fixed and moves the other (failure mode 188).
4. **Confirmed and narrow are different things, so they are reported apart.** Several Confirmed rules carry a
   context word (`e.has:DEF`, `!p:Scene`) that came from the host files the probes used. Each time such a rule fires
   it is right; it does not fire everywhere it should. The grade says the first, `closure: open` says the second, and
   a person reading a candidate needs both.
5. **A cluster of one or two failures grows into several small rules.** Probing a crash seen once finds the edges of
   the crash faster than its cause. The output is useful as leads and as a pre-flight check, and its grades say so.
   A single clean cause came from the clusters that began with enough receipts to compare (61, 29 and 18 failing files here).
6. **Probes are a guided fuzzer.** 7 of the 17 clusters in the 2.7.1 run are crash signatures no
   chaos round produced; the engine's own questions found them. They are receipts like any other and were clustered
   and explained in the same run.
7. **An instrument's name carries every version on its call path** (law 15, failure mode 191). The same x3d.py
   crashed on 60 deep files through add-on 2.7.1 and on none through 2.7.3. A rule is about a tool at a version, and
   `r2r replay` is how it is retired.
8. **Some failures have no rule in the file.** Three Fault Lab faults live in the record beside the scene. The
   engine detects that the failing file is byte-identical to a passing one, says so and writes nothing (failure
   mode 192).
9. **X3D supplies the vocabulary.** Tier 1 and tier 2 words come from the X3DUOM (267 nodes, 4,342 field rows), so
   "a boolean spelt oddly" or "an index past its list" are decided by a table. Where the table has no word the rule
   is a fingerprint, graded Suspected and flagged `vocabulary_gap`. That flag is the work list for a person or a
   proposer.
10. **Stamp the code when the run starts** (failure mode 190), and run memory-heavy judges one at a time (193).
11. **Rules outlive the round that found them.** The chaos rounds on 2.7.3 were clean. The crashes still live on
    2.7.3 were found because the engine had probed 2.7.1, kept each probe as a recipe, and could ask the newer
    version the same questions. A chaos round samples; a rule with its probes is a standing question.
12. **Reconcile a run's headline against its folder before citing it.** The first full run said 30 rules and held 28
    files: a rule found under two signatures had been counted twice and its first proof overwritten (failure mode
    196), and replay had counted two files as four (197). Both were found by adding the numbers up by hand, fixed
    with controls, and every sealed run here was made again on the fixed code.
13. **A failure can be the tool working.** The export refusing a negative radius is a gate, not a crash. The engine
    cannot tell the two apart: it reports that the tool said no, and a person reads the message.
14. **The loop closed in one day.** Receipts from 2.7.1 became rules; six of the rules were still live on 2.7.3,
    where two chaos rounds had found no crash; the Blender lane fixed them in 2.7.4; the same rules, asked again,
    find none. Six replay cases now also gate the add-on's own CI (x3d-blender-io #77, `tools/chaos/hostile.py`). That is the flywheel turning once, with a receipt at each
    step.
15. **A Likely rule names the place better than the condition.** Both Likely rules that were hand-checked had the
    right node and the wrong condition (a token count standing in for a fan count; "present" standing in for
    "under a triangle node"). Before a fix is written from a Likely rule, vary the one thing its probes held fixed.

## What the engine cannot do yet

- Say anything about a failure whose cause is outside the file, or one that needs two sites compared (a `USE`
  far from its `DEF`, a ROUTE's two ends). The rule language has one site.
- Name a new idea. When the vocabulary lacks the word, it reports a fingerprint and stops, or it borrows the nearest
  word it has (failure mode 198). Words it is known to lack: the number of runs in an index list, and the parent
  node of an element as a condition on that element.
  From the weekly run of 28 Nov: a child that is absent (`Sound` without `AudioClip`), a list whose tuples are all
  equal (an `Extrusion` crossSection), and a product of two counts (timeline frames times objects).
- Find a cause from one failing file with no twin. It names the rarest thing in the file, which may be a neighbour
  of the cause (failure mode 536). Its grade for that case is Suspected, which is the right grade.
- Time an instrument. A verdict is pass or fail; "no answer in 60 s" is a signature like any other, and a rule
  drawn from it describes large files, not the reason they are slow.
- Say "closed" on fewer than 5 passing files. Its label for that case, `not exercised`, also covers a rule with no
  file at all; the two should be told apart.
- Minimise a Confirmed rule's context. It tries one generation of probes; widening the hosts is the next step.
- Split a signature. A signature is the exception type and the place it was raised. Two causes raised at one line
  share a cluster, and the smaller one is left as residue (`MetadataBoolean` inside the export gate's cluster).
- Read receipts that are not about a file: render gaps, timing, loss receipts between formats need adapters.

## The seam for a language model

`proposers.py` holds the interface, switched off. `r2r needs` lists the clusters that want a proposer (39 open questions in the
2.7.1 run), `r2r brief` writes one packet per cluster, `validate_proposal` refuses anything outside the rule
language, and `score` is computed from the proof. A model's rule runs the same probes and meets the same grade
table; reported by a model alone, a failure or a rule is never above Suspected.

## Reproduce

```sh
python3 -I kit/tests/test_r2r.py                 # controls, both Python modes, about 4 minutes
kit/loom r2r selftest                            # three hidden rules and noise
kit/loom r2r show runs/r2r-blender-io-271-20261123
python3 -I kit/tests/check_r2r_runs.py CHAOS_DIR # sealed runs against their unpacked receipts
kit/loom r2r replay runs/r2r-blender-io-271-20261123 runs/r2r-receipts-20261123/manifests/blender-io-2.7.4.json \
    --map OLD=NEW ... --root bpyenv=... --root addon-src=...   # old rules, new version (needs bpy)
```

The real instruments need bpy 5.3.0; see `runs/r2r-receipts-20261123/README.md`.
