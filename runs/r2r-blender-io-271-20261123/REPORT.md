# R2R run: x3d-blender-io 2.7.1 in bpy 5.3.0: chaos rounds and a sweep of 514 real files

Made 2026-11-23T07:03:35Z by loomkit.r2r 0.1.0 (source sha256 `096d1ce649f8b276`), X3DUOM 4.1 sha256 `4fc10e8e15c0d6cf`. No language model was used. Every rule below is a **candidate**: nothing here is promoted, and a grade is always relative to the instrument named.

**28 candidate rule(s) from 17 failure cluster(s): 15 Confirmed, 4 Likely, 9 Suspected.** 20330 events (passes and failures) over 6265 distinct files; 2006.1 s. 2 time(s) a rule was found again under a second signature: it is one candidate, counted once by its first claim, and shown under each cluster with that cluster's own proof.

How to read a grade. **C, Confirmed**: the failures were observed by a tool, the rule fires on no file the tool passed, and it called outcomes it had never seen (probes built after the rule was fixed, or held-out receipts). **L, Likely**: clean on what induction saw, but nothing unseen has tested it. **S, Suspected**: a prediction was wrong, or the rule leans on literal values, or the evidence is one failure. **Closure** is separate: `open` means failures of the same signature exist that no rule here fires on, so a Confirmed rule can still be incomplete.

Use the candidates as a pre-flight check: `kit/loom r2r check THIS_FOLDER FILE.x3d`. List what is still open: `kit/loom r2r needs THIS_FOLDER`.

## Instruments and what they said

| Instrument | Failed | Passed |
|---|---:|---:|
| x3d-blender-io 2.7.1 import then export (bpy 5.3.0) | 255 | 4568 |
| x3d-blender-io 2.7.1 importer (bpy 5.3.0) | 1396 | 5773 |
| x3d-blender-io 2.7.1 own validator (does it crash?) | 0 | 3840 |
| x3d.py 4.0.65.8 through x3d-blender-io 2.7.1 validate.py (does it crash?) | 146 | 4352 |

- Instruments: the x3d-blender-io add-on at 2.7.1 (commit d931551) inside bpy 5.3.0 (Python 3.13): its importer, and its import followed by its export. Third instrument: x3d.py 4.0.65.8 as the add-on's validate.py at 2.7.1 calls it; a crash there is a crash of that pair, not of x3d.py alone.
- Chaos rounds: tools/chaos/differential.py of x3d-blender-io at main 8e56437 with the add-on source pinned to 2.7.1, 80 mutants per golden scene, six judges (the add-on's own validator, x3d.py 4.0.65.8, xmllint 20914 with x3d-4.0.xsd from the x3d_mcp fork at 4d433af, the Web3D X3D Schematron through SaxonC, bpy 5.3.0 import, import then export). Cloud machine, 15 GB, 4 cores, no memory cap. Machine paths in the tracebacks were replaced by <addon>/, <site-packages>/ and <x3d-blender-io>/ before packing; nothing else was changed.
- Probes: the same instruments through kit/loomkit/r2r/drivers/blender_io.py under a 10 GB address-space cap. A threshold that is really a memory cliff is the cliff of that cap, not of every machine.
- Held out: the chaos rounds marked held (never used for induction), and the half of the real-file sweep whose sha256 is odd. Probe hosts come only from the other half.
- Sweep: every .x3d under the project's repositories on 23 Nov 2026 that is at most 2 MB (514 files), named as repos:<repository>/<path>.
- To repeat: unpack ../chaos-*.tar.xz into ../chaos, check the repositories out side by side, and give --root bpyenv=... (a venv with bpy 5.3.0 and x3d.py) and --root addon-src=... (the add-on source at each version under <version>/source).

## Receipts read

| Receipt | What | sha256 |
|---|---|---|
| `chaos:2.7.1-rng7/rows.json` | differential chaos round, add-on 2.7.1, rng 7: 960 one-edit mutants of the 12 golden scenes (training) | `2dd6193d86d1914a` |
| `chaos:2.7.1-rng11/rows.json` | differential chaos round, add-on 2.7.1, rng 11: 960 one-edit mutants of the 12 golden scenes (training) | `8404e4dc29b5f5b3` |
| `chaos:2.7.1-rng23/rows.json` | differential chaos round, add-on 2.7.1, rng 23: 960 one-edit mutants of the 12 golden scenes (held out) | `1717af90b34998b2` |
| `chaos:2.7.1-rng101/rows.json` | differential chaos round, add-on 2.7.1, rng 101: 960 one-edit mutants of the 12 golden scenes (held out) | `f200ba949b48c886` |
| `sweep:2.7.1-import.jsonl` | 514 real project files through the 2.7.1 importer | `9b9f9c9355382d1a` |
| `sweep:2.7.1-reexport.jsonl` | the same 514 files, import then export, add-on 2.7.1 | `4af910f89bc9be51` |
| `sweep:2.7.1-x3dpy.jsonl` | the same 514 files through x3d.py 4.0.65.8 as add-on 2.7.1 calls it | `7730129d3b5603f0` |

## Candidates at a glance

| Grade | Rule | Instrument and signature | Sources explained | Known-good false alarms | Held-out caught | Held-out false alarms | Audit probes right / wrong / missed | Closure |
|---|---|---|---:|---:|---:|---:|---:|---|
| **C** | [`r2r-96ba3f032944`](candidates/r2r-96ba3f032944.json) `attr[v:bool_noncanonical & !v:case_variant & nws:1 & (one of 24 places)]` | x3d-blender-io 2.7.1 importer (bpy 5.3.0): `IndexError at import_x3d.py:860 getFieldAsBool` | 133 of 133 | 0 of 1813 | 35 of 35 | 0 of 1416 | 20 / 0 / 9 | open |
| **C** | [`r2r-fc92485cb435`](candidates/r2r-fc92485cb435.json) `doc[ge:depth_max:1004]` | x3d.py 4.0.65.8 through x3d-blender-io 2.7.1 validate.py (does it crash?): `RecursionError: maximum recursion depth exceeded` | 72 of 72 | 0 of 1831 | 1 of 1 | 0 of 1469 | 11 / 0 / 14 | open |
| **C** | [`r2r-2a5db21f7cdd`](candidates/r2r-2a5db21f7cdd.json) `attr[ge:index_excess:440304889 & ge:ntok:20 & !e.has:ccw & at:IndexedFaceSet@coordIndex & e.child:Coordinate]` | x3d-blender-io 2.7.1 importer (bpy 5.3.0): `RuntimeError at import_x3d.py:2008 validate_points_field` | 49 of 76 | 0 of 1887 | 11 of 14 | 0 of 1416 | 15 / 0 / 1 | open |
| **S** | [`r2r-8c73ea66efdc`](candidates/r2r-8c73ea66efdc.json) `attr[ge:index_excess:2147483633 & le:ntok:15 & !v:lexical_invalid & at:IndexedFaceSet@coordIndex & p:Shape]` | x3d-blender-io 2.7.1 importer (bpy 5.3.0): `RuntimeError at import_x3d.py:2008 validate_points_field` | 27 of 76 | 0 of 1887 | 3 of 14 | 0 of 1416 | 24 / 1 / 1 | open |
| **S** | [`r2r-eac8fb7c9a21`](candidates/r2r-eac8fb7c9a21.json) `attr[ge:max_abs:1e+39 & anc:Group & (one of 2 places)]` | x3d-blender-io 2.7.1 import then export (bpy 5.3.0): `RuntimeError at matrix_safety.py:47 inverted64` | 41 of 119 | 0 of 1886 | 0 of 6 | 0 of 1409 | 26 / 2 / 7 | open |
| **C** | [`r2r-c78b17d6ccf6`](candidates/r2r-c78b17d6ccf6.json) `attr[ge:max_abs:5.05e+38 & e.child:Shape & e.has:DEF & (one of 2 places)]` | x3d-blender-io 2.7.1 import then export (bpy 5.3.0): `RuntimeError at matrix_safety.py:47 inverted64` | 29 of 119 | 0 of 1886 | 3 of 6 | 0 of 1409 | 13 / 0 / 7 | open |
| **S** | [`r2r-bd1f8384f6cd`](candidates/r2r-bd1f8384f6cd.json) `attr[v:lexical_invalid & !e.has:rotation & at:Transform@scale]` | x3d-blender-io 2.7.1 import then export (bpy 5.3.0): `RuntimeError at matrix_safety.py:47 inverted64` | 28 of 119 | 0 of 1886 | 0 of 6 | 0 of 1409 | 37 / 4 / 7 | open |
| **C** | [`r2r-4b8b7ade96af`](candidates/r2r-4b8b7ade96af.json) `attr[v:float_overflow32 & !p:Scene & !v:lexical_invalid & at:Transform@translation]` | x3d-blender-io 2.7.1 import then export (bpy 5.3.0): `RuntimeError at matrix_safety.py:47 inverted64` | 16 of 119 | 0 of 1886 | 0 of 6 | 0 of 1409 | 21 / 0 / 7 | open |
| **S** | [`r2r-61999795e8b4`](candidates/r2r-61999795e8b4.json) `attr[ge:ntok:6 & !p:Scene & at:Transform@scale]` | x3d-blender-io 2.7.1 importer (bpy 5.3.0): `IndexError at import_x3d.py:1665 translateScale` | 43 of 149 | 0 of 2024 | 0 of 2 | 0 of 1416 | 28 / 3 / 2 | open |
| **S** | [`r2r-01a07f48ec95`](candidates/r2r-01a07f48ec95.json) `attr[ge:len:10 & v:number_unparseable & at:Transform@scale & ntok:3]` | x3d-blender-io 2.7.1 importer (bpy 5.3.0): `IndexError at import_x3d.py:1665 translateScale` | 33 of 149 | 0 of 2024 | 0 of 2 | 0 of 1416 | 31 / 1 / 2 | open |
| **L** | [`r2r-0bd64577661d`](candidates/r2r-0bd64577661d.json) `elem[ge:nattrs:1 & child:TouchSensor & has:scale & n:Transform & p:Scene]` | x3d-blender-io 2.7.1 importer (bpy 5.3.0): `IndexError at import_x3d.py:1665 translateScale` | 28 of 149 | 0 of 2024 | 0 of 2 | 0 of 1416 | 0 / 0 / 2 | open |
| **C** | [`r2r-f10d90dac48f`](candidates/r2r-f10d90dac48f.json) `attr[v:number_unparseable & !p:Scene & at:Transform@scale & ntok:3]` | x3d-blender-io 2.7.1 importer (bpy 5.3.0): `IndexError at import_x3d.py:1665 translateScale` | 27 of 149 | 0 of 2024 | 0 of 2 | 0 of 1416 | 24 / 0 / 2 | open |
| **C** | [`r2r-dc3e3fa23485`](candidates/r2r-dc3e3fa23485.json) `attr[v:arity_long & !p:Scene & !v:quoted & at:Transform@translation]` | x3d-blender-io 2.7.1 importer (bpy 5.3.0): `ValueError at import_x3d.py:1700 translateTransform` | 76 of 149 | 0 of 2162 | 0 of 2 | 0 of 1416 | 35 / 0 / 0 | open |
| **S** | [`r2r-5049a0d800aa`](candidates/r2r-5049a0d800aa.json) `attr[ge:max:5 & v:arity_mismatch & !e.has:rotation & at:Transform@translation]` | x3d-blender-io 2.7.1 importer (bpy 5.3.0): `ValueError at import_x3d.py:1700 translateTransform` | 30 of 149 | 0 of 2162 | 0 of 2 | 0 of 1416 | 23 / 1 / 0 | open |
| **S** | [`r2r-018873e9ca67`](candidates/r2r-018873e9ca67.json) `attr[ge:ntok:12 & !e.child:TransformSensor & !v:quoted & at:Transform@translation]` | x3d-blender-io 2.7.1 importer (bpy 5.3.0): `ValueError at import_x3d.py:1700 translateTransform` | 74 of 149 | 0 of 2162 | 0 of 2 | 0 of 1416 | 58 / 4 / 0 | open |
| **S** | [`r2r-c0b70e49737d`](candidates/r2r-c0b70e49737d.json) `attr[ge:len:19 & v:lexical_invalid & !e.child:TransformSensor & !v:tok:" & at:Transform@translation]` | x3d-blender-io 2.7.1 importer (bpy 5.3.0): `ValueError at import_x3d.py:1700 translateTransform` | 97 of 149 | 0 of 2162 | 0 of 2 | 0 of 1416 | 82 / 5 / 0 | open |
| **C** | [`r2r-ac96dfe7dbc3`](candidates/r2r-ac96dfe7dbc3.json) `attr[v:below_min & ntok:1 & (one of 7 places)]` | x3d-blender-io 2.7.1 import then export (bpy 5.3.0): `ValueError at export_x3d.py:2111 _modern_writer` | 31 of 32 | 0 of 1962 | none to test | 0 of 1409 | 20 / 0 / 2 | open |
| **L** | [`r2r-d261dd67c562`](candidates/r2r-d261dd67c562.json) `elem[x:present & n:CoordinateDouble]` | x3d-blender-io 2.7.1 importer (bpy 5.3.0): `AttributeError at import_x3d.py:1904 importMesh_ReadVertices` | 2 of 2 | 0 of 2167 | none to test | 0 of 1416 | 0 / 0 / 0 | closed-so-far |
| **C** | [`r2r-f10d90dac48f`](candidates/r2r-f10d90dac48f.json) `attr[v:number_unparseable & !p:Scene & at:Transform@scale & ntok:3]` | x3d-blender-io 2.7.1 importer (bpy 5.3.0): `IndexError at import_x3d.py:1666 translateScale` | 50 of 89 | 0 of 2227 | 0 of 1 | 0 of 1416 | 20 / 0 / 0 | open |
| **S** | [`r2r-61999795e8b4`](candidates/r2r-61999795e8b4.json) `attr[ge:ntok:6 & !p:Scene & at:Transform@scale]` | x3d-blender-io 2.7.1 importer (bpy 5.3.0): `IndexError at import_x3d.py:1666 translateScale` | 24 of 89 | 0 of 2227 | 0 of 1 | 0 of 1416 | 25 / 4 / 0 | open |
| **C** | [`r2r-cbf17e0bb9ea`](candidates/r2r-cbf17e0bb9ea.json) `attr[v:inf & !v:arity_mismatch & (one of 2 places)]` | x3d-blender-io 2.7.1 importer (bpy 5.3.0): `ValueError at viewpoint_fov.py:42 blender_camera_angle` | 62 of 62 | 0 of 2297 | none to test | 0 of 1416 | 20 / 0 / 1 | open |
| **C** | [`r2r-21d944367a59`](candidates/r2r-21d944367a59.json) `attr[ge:index_excess:536870902 & e.child:Color & (one of 2 places)]` | x3d-blender-io 2.7.1 importer (bpy 5.3.0): `IndexError at import_x3d.py:1857 importMesh_ApplyColors` | 22 of 30 | 0 of 2315 | none to test | 0 of 1416 | 11 / 0 / 0 | closed-so-far |
| **C** | [`r2r-758326262381`](candidates/r2r-758326262381.json) `attr[ge:index_excess:536870902 & !e.child:Normal & anc:Transform & at:IndexedTriangleStripSet@index]` | x3d-blender-io 2.7.1 importer (bpy 5.3.0): `IndexError at import_x3d.py:1857 importMesh_ApplyColors` | 14 of 30 | 0 of 2315 | none to test | 0 of 1416 | 10 / 0 / 0 | closed-so-far |
| **C** | [`r2r-4c6fe8b28cb1`](candidates/r2r-4c6fe8b28cb1.json) `attr[ge:index_max:177662200 & le:index_excess:440304889 & !v:lexical_invalid & at:IndexedFaceSet@coordIndex & e.child:Coordinate]` | x3d-blender-io 2.7.1 importer (bpy 5.3.0): `RuntimeError at import_x3d.py:2253 importMesh_IndexedFaceSet` | 31 of 31 | 0 of 2352 | none to test | 0 of 1416 | 21 / 0 / 1 | open |
| **S** | [`r2r-de23254b4dea`](candidates/r2r-de23254b4dea.json) `attr[ge:index_excess:20060965 & !v:lexical_invalid & at:IndexedFaceSet@coordIndex & e.has:creaseAngle]` | x3d-blender-io 2.7.1 importer (bpy 5.3.0): `IndexError at import_x3d.py:2231 importMesh_IndexedFaceSet` | 42 of 42 | 0 of 2359 | none to test | 0 of 1416 | 7 / 1 / 3 | open |
| **L** | [`r2r-88d9b63e43b3`](candidates/r2r-88d9b63e43b3.json) `attr[ge:ntok:20 & at:IndexedTriangleFanSet@index]` | x3d-blender-io 2.7.1 importer (bpy 5.3.0): `RuntimeError at import_x3d.py:2107 importMesh_IndexedTriangleFanSet` | 4 of 4 | 0 of 2376 | none to test | 0 of 1416 | 1 / 0 / 0 | closed-so-far |
| **L** | [`r2r-a2a869510561`](candidates/r2r-a2a869510561.json) `attr[ge:index_excess:19311468 & at:IndexedTriangleStripSet@index & e.child:TextureCoordinate]` | x3d-blender-io 2.7.1 importer (bpy 5.3.0): `IndexError at import_x3d.py:1927 importMesh_ApplyUVs` | 9 of 9 | 0 of 2380 | none to test | 0 of 1416 | 2 / 0 / 0 | closed-so-far |
| **C** | [`r2r-c057e13c2f24`](candidates/r2r-c057e13c2f24.json) `attr[v:number_unparseable & !p:Scene & !v:quoted & at:Transform@center]` | x3d-blender-io 2.7.1 importer (bpy 5.3.0): `ValueError at import_x3d.py:1678 translateTransform` | 55 of 62 | 0 of 2444 | none to test | 0 of 1416 | 20 / 0 / 1 | open |
| **C** | [`r2r-b7cf987e340f`](candidates/r2r-b7cf987e340f.json) `attr[v:inf & !v:arity_mismatch & (one of 2 places)]` | x3d-blender-io 2.7.1 importer (bpy 5.3.0): `ValueError at import_x3d.py:4437 _arc_points` | 25 of 28 | 0 of 2506 | none to test | 0 of 1416 | 10 / 0 / 4 | open |
| **C** | [`r2r-616562eddf55`](candidates/r2r-616562eddf55.json) `attr[v:has_comma & nws:3 & (one of 2 places)]` | x3d-blender-io 2.7.1 importer (bpy 5.3.0): `ValueError at import_x3d.py:4437 _arc_points` | 3 of 28 | 0 of 2506 | none to test | 0 of 1416 | 14 / 0 / 4 | open |

## Clusters

### `IndexError at import_x3d.py:860 getFieldAsBool`

Instrument: x3d-blender-io 2.7.1 importer (bpy 5.3.0). 133 distinct failing file(s) in training (61 events), 55 held-out event(s). Probed with the real instrument.

#### C (Confirmed) `r2r-96ba3f032944`

> At one attribute where the value has 1 space-separated token(s): a boolean is spelt as something other than `true` or `false`, at one of 24 places (Box solid, CollidableShape visible, Cone solid, DirectionalLight global, DirectionalLight shadows, Disk2D solid, ElevationGrid solid, Group visible, HAnimHumanoid visible, IndexedFaceSet solid, IndexedTriangleFanSet solid, IndexedTriangleSet solid, IndexedTriangleStripSet solid, LOD visible, Layer visible, NavigationInfo headlight, PointLight global, PointLight shadows, RigidBody visible, Shape visible, Sphere solid, SpotLight global, TriangleFanSet solid, TriangleSet2D solid), unless the value is a legal one written in another letter case.

`{"all": ["v:bool_noncanonical", "!v:case_variant", "nws:1"], "any": ["at:Box@solid", "at:CollidableShape@visible", "at:Cone@solid", "at:DirectionalLight@global", "at:DirectionalLight@shadows", "at:Disk2D@solid", "at:ElevationGrid@solid", "at:Group@visible", "at:HAnimHumanoid@visible", "at:IndexedFaceSet@solid", "at:IndexedTriangleFanSet@solid", "at:IndexedTriangleSet@solid", "at:IndexedTriangleStripSet@solid", "at:LOD@visible", "at:Layer@visible", "at:NavigationInfo@headlight", "at:PointLight@global", "at:PointLight@shadows", "at:RigidBody@visible", "at:Shape@visible", "at:Sphere@solid", "at:SpotLight@global", "at:TriangleFanSet@solid", "at:TriangleSet2D@solid"], "kind": "attr"}`

Grade reasons: 20 audit probe(s) confirmed, 0 refuted; held-out: 35 of 35 failures caught, 0 false alarms in 1416 passing files; 0 false alarms in 1813 known-good files. Closure: **open** (9 audit probe(s) and 0+ held-out failure(s) failed with this signature where no rule of the cluster fired).

| Test | Result |
|---|---|
| Source failures explained at the changed site | 133 of 133 (133 with a known-good twin; observed by 133 tool) |
| Fires on files the instrument passed | 0 of 1813 |
| Held-out failures caught (content-disjoint) | 35 of 35 |
| Held-out false alarms | 0 of 1416 |
| Audit probes (built after the rule was fixed) | 20 predictions came true, 0 wrong, 9 failures the cluster's rules missed, 15 correctly silent, 0 failed another way |
| Degenerate files it fires on | none of 8 |
| Already covered by an existing Loom trap | 0 of 60 checked |

Probe rounds: 1: 1 alternate/confirmed, 5 alternate/silent-ok, 10 confirm/confirmed, 10 value/confirmed, 5 widen/missed, 11 widen/silent-ok; 2: 10 confirm/confirmed, 8 near/silent-ok, 10 value/confirmed, 7 widen/missed, 9 widen/silent-ok; 3: 10 confirm/confirmed, 8 near/silent-ok, 10 value/confirmed, 6 widen/missed, 10 widen/silent-ok; audit: 10 confirm/confirmed, 2 near/missed, 6 near/silent-ok, 10 value/confirmed, 7 widen/missed, 9 widen/silent-ok.

Seen at 24 place(s): Box@solid, CollidableShape@visible, Cone@solid, DirectionalLight@global, DirectionalLight@shadows, Disk2D@solid, ElevationGrid@solid, Group@visible, HAnimHumanoid@visible, IndexedFaceSet@solid, IndexedTriangleFanSet@solid, IndexedTriangleSet@solid, IndexedTriangleStripSet@solid, LOD@visible, Layer@visible, NavigationInfo@headlight, PointLight@global, PointLight@shadows, RigidBody@visible, Shape@visible, Sphere@solid, SpotLight@global, TriangleFanSet@solid, TriangleSet2D@solid.
Unfenced reading `attr[v:bool_noncanonical & !v:case_variant & nws:1]`: contradicted by passing files (30 false alarm(s) on known-good files).
Normative reading: every explained failure also has `v:bool_noncanonical` (a boolean is spelt as something other than `true` or `false`); 44 passing file(s) have it too inside the fence.
Normative reading: every explained failure also has `v:lexical_invalid` (the value does not have the written form its field type requires); 76 passing file(s) have it too inside the fence.

Alternates the receipts could not rule out (2):
- `attr[v:lexical_invalid & !v:case_variant & nws:1 & (one of 24 places)]`
- `attr[v:bool_noncanonical & !v:tok:FALSE & !v:tok:TRUE & nws:1 & (one of 24 places)]`

Ablation (drop one literal, count again):

| Dropped | Role | False alarms without it | Failures explained without it |
|---|---|---:|---:|
| `v:bool_noncanonical` | test | 1658 | 133 |
| `!v:case_variant` | guard | 21 | 133 |
| `nws:1` | context | 23 | 133 |
| `(the list of 24 places)` | fence | 30 | 133 |

How the rule was reached: `seed v:bool_noncanonical, fenced to 24 place(s): explains 133, false alarms 44`; then `+ nws:1: explains 133, false alarms 21 (gain 26.71)`; then `+ !v:case_variant: explains 133, false alarms 0 (gain 28.13)`.

Sources (133; first 5):
- `chaos:2.7.1-rng7/mutants/cameras__046__bool_spelling.x3d` (bool_spelling: X3D/Scene/Transform#OB_Key/DirectionalLight#LA_Key shadows: true -> 'yes')
- `chaos:2.7.1-rng7/mutants/cameras__048__bool_spelling.x3d` (bool_spelling: X3D/Scene/NavigationInfo headlight: false -> '0')
- `chaos:2.7.1-rng7/mutants/emissive_glass__008__text_garbage.x3d` (text_garbage: X3D/Scene/Transform#OB_Lamp/Shape/IndexedFaceSet#ME_LampMesh solid -> '1,,2')
- `chaos:2.7.1-rng7/mutants/emissive_glass__024__text_garbage.x3d` (text_garbage: X3D/Scene/NavigationInfo headlight -> '1,,2')
- `chaos:2.7.1-rng7/mutants/emissive_glass__059__bool_spelling.x3d` (bool_spelling: X3D/Scene/Transform#OB_Key/DirectionalLight#LA_Key shadows: true -> 'yes')

### `RecursionError: maximum recursion depth exceeded`

Instrument: x3d.py 4.0.65.8 through x3d-blender-io 2.7.1 validate.py (does it crash?). 72 distinct failing file(s) in training (29 events), 31 held-out event(s). Probed with the real instrument.

#### C (Confirmed) `r2r-fc92485cb435`

> For the file as a whole: the deepest nesting in the file is at least 1004.

`{"all": ["ge:depth_max:1004"], "kind": "doc"}`

Grade reasons: 11 audit probe(s) confirmed, 0 refuted; 0 false alarms in 1831 known-good files. Closure: **open** (14 audit probe(s) and 0+ held-out failure(s) failed with this signature where no rule of the cluster fired).

| Test | Result |
|---|---|
| Source failures explained at the changed site | 72 of 72 (72 with a known-good twin; observed by 72 tool) |
| Fires on files the instrument passed | 0 of 1831 |
| Held-out failures caught (content-disjoint) | 1 of 1 |
| Held-out false alarms | 0 of 1469 |
| Audit probes (built after the rule was fixed) | 11 predictions came true, 0 wrong, 14 failures the cluster's rules missed, 0 correctly silent, 0 failed another way |
| Degenerate files it fires on | none of 8 |
| Already covered by an existing Loom trap | 0 of 60 checked |

Probe rounds: 1: 4 alternate/confirmed, 1 alternate/missed, 1 alternate/silent-ok, 1 bisect/missed, 5 bisect/silent-ok, 9 confirm/confirmed, 7 near/missed; 2: 4 alternate/confirmed, 2 alternate/missed, 6 bisect/silent-ok, 9 confirm/confirmed, 6 near/missed; 3: 6 alternate/missed, 6 bisect/silent-ok, 10 confirm/confirmed, 2 near/missed; audit: 1 alternate/confirmed, 4 alternate/missed, 6 bisect/missed, 10 confirm/confirmed, 4 near/missed.

Seen at 1 place(s): (document).
Threshold `ge:depth_max:1004`: last value seen to pass 993, first seen to fail 1004.0; nothing between was tested.

Alternates the receipts could not rule out (3):
- `elem[ge:depth:1004 & (one of 56 places)]`
- `doc[ge:n_elements:1007 & le:max_children:6]`
- `doc[ge:bytes:15444 & ge:n_elements:1007 & le:n_defs:11]`

Ablation (drop one literal, count again):

| Dropped | Role | False alarms without it | Failures explained without it |
|---|---|---:|---:|

How the rule was reached: `seed ge:depth_max:1004, fenced to (anywhere): explains 72, false alarms 0`.

Sources (72; first 5):
- `chaos:2.7.1-rng7/mutants/cameras__015__deep_nest.x3d` (deep_nest: scene content nested 1200 Groups deep)
- `chaos:2.7.1-rng7/mutants/emissive_glass__001__deep_nest.x3d` (deep_nest: scene content nested 1200 Groups deep)
- `chaos:2.7.1-rng7/mutants/four_lights__000__deep_nest.x3d` (deep_nest: scene content nested 1200 Groups deep)
- `chaos:2.7.1-rng7/mutants/hierarchy__011__deep_nest.x3d` (deep_nest: scene content nested 1200 Groups deep)
- `chaos:2.7.1-rng7/mutants/keyframes__022__deep_nest.x3d` (deep_nest: scene content nested 1200 Groups deep)

### `RuntimeError at import_x3d.py:2008 validate_points_field`

Instrument: x3d-blender-io 2.7.1 importer (bpy 5.3.0). 76 distinct failing file(s) in training (18 events), 15 held-out event(s). Probed with the real instrument.

#### C (Confirmed) `r2r-2a5db21f7cdd`

> At one attribute where the place is IndexedFaceSet coordIndex and its element has a Coordinate child: how far the largest index runs past the end of its list is at least 440304889 and the number of tokens is at least 20, unless its element also has the attribute ccw.

`{"all": ["ge:index_excess:440304889", "ge:ntok:20", "!e.has:ccw", "at:IndexedFaceSet@coordIndex", "e.child:Coordinate"], "kind": "attr"}`

Grade reasons: 15 audit probe(s) confirmed, 0 refuted; 0 false alarms in 1887 known-good files. Closure: **open** (1 audit probe(s) and 0+ held-out failure(s) failed with this signature where no rule of the cluster fired).

| Test | Result |
|---|---|
| Source failures explained at the changed site | 49 of 76 (76 with a known-good twin; observed by 76 tool) |
| Fires on files the instrument passed | 0 of 1887 |
| Held-out failures caught (content-disjoint) | 11 of 14 |
| Held-out false alarms | 0 of 1416 |
| Audit probes (built after the rule was fixed) | 15 predictions came true, 0 wrong, 1 failures the cluster's rules missed, 44 correctly silent, 42 failed another way |
| Degenerate files it fires on | none of 8 |
| Already covered by an existing Loom trap | 0 of 49 checked |

Probe rounds: 1: 2 bisect/other-failure, 4 bisect/silent-ok, 7 confirm/confirmed, 3 confirm/refuted, 3 value/confirmed, 1 value/refuted, 2 widen/other-failure, 14 widen/silent-ok; 2: 12 bisect/missed, 10 confirm/confirmed, 1 confirm/other-failure, 2 confirm/refuted, 4 near/silent-ok, 10 value/confirmed, 3 widen/other-failure, 16 widen/silent-ok; 3: 2 bisect/confirmed, 1 bisect/missed, 3 bisect/other-failure, 8 confirm/confirmed, 2 confirm/other-failure, 2 near/silent-ok, 6 value/confirmed, 4 widen/other-failure, 12 widen/silent-ok; audit: 5 bisect/confirmed, 1 bisect/missed, 5 bisect/other-failure, 1 bisect/silent-ok, 18 confirm/confirmed, 1 confirm/other-failure, 1 confirm/refuted, 6 near/confirmed, 2 near/silent-ok, 10 value/confirmed, 7 widen/other-failure, 25 widen/silent-ok.

Seen at 1 place(s): IndexedFaceSet@coordIndex.
Unfenced reading `attr[ge:index_excess:440304889 & ge:ntok:20 & !e.has:ccw & e.child:Coordinate]`: contradicted by passing files (25 false alarm(s) on known-good files).
Threshold `ge:index_excess:440304889`: last value seen to pass 46340853.0, first seen to fail 440304889.0; nothing between was tested.
Threshold `ge:ntok:20`: last value seen to pass 15, first seen to fail 20.0; nothing between was tested.
Normative reading: every explained failure also has `v:index_out_of_range` (an index points past the end of the list it indexes); 61 passing file(s) have it too inside the fence.

Alternates the receipts could not rule out (2):
- `attr[ge:index_excess:440304889 & ge:ntok:20 & !anc:HAnimHumanoid & at:IndexedFaceSet@coordIndex & e.child:Coordinate]`
- `attr[ge:index_max:440304894 & ge:ntok:20 & !anc:HAnimHumanoid & at:IndexedFaceSet@coordIndex & e.child:Coordinate]`

Ablation (drop one literal, count again):

| Dropped | Role | False alarms without it | Failures explained without it |
|---|---|---:|---:|
| `ge:index_excess:440304889` | test | 1086 | 49 |
| `ge:ntok:20` | test | 8 | 76 |
| `!e.has:ccw` | guard | 2 | 49 |
| `at:IndexedFaceSet@coordIndex` | context | 25 | 49 |
| `e.child:Coordinate` | context | 2 | 49 |

How the rule was reached: `seed ge:ntok:20, fenced to at:IndexedFaceSet@coordIndex: explains 49, false alarms 1098`; then `+ ge:index_excess:440304889: explains 49, false alarms 4 (gain 156.60)`; then `+ e.child:Coordinate: explains 49, false alarms 2 (gain 2.72)`; then `+ !e.has:ccw: explains 49, false alarms 0 (gain 2.83)`.

Sources (49; first 5):
- `chaos:2.7.1-rng7/mutants/cameras__063__index_oob.x3d` (index_oob: X3D/Scene/Transform#OB_Target/Shape/IndexedFaceSet#ME_TargetMesh coordIndex: token 23 4 -> 2147483647)
- `chaos:2.7.1-rng7/mutants/hierarchy__039__index_oob.x3d` (index_oob: X3D/Scene/Transform#OB_Root/Transform#OB_Arm/Shape/IndexedFaceSet#ME_ArmMesh coordIndex: token 2 2 -> 2147483647)
- `chaos:2.7.1-rng7/mutants/hierarchy__075__index_oob.x3d` (index_oob: X3D/Scene/Transform#OB_Root/Transform#OB_Arm/Shape/IndexedFaceSet#ME_ArmMesh coordIndex: token 12 7 -> 2147483647)
- `chaos:2.7.1-rng7/mutants/linked_instances__004__index_oob.x3d` (index_oob: X3D/Scene/Transform#OB_Copy0/Group#CO_Part/Transform#OB_Part_PartSource/Shape/IndexedFaceSet#ME_PartMesh coordIndex: token 4 -1 -> 2147483647)
- `chaos:2.7.1-rng7/mutants/lit_cube__065__index_oob.x3d` (index_oob: X3D/Scene/Transform#OB_Cube/Shape/IndexedFaceSet#ME_CubeMesh coordIndex: token 13 1 -> 2147483647)

#### S (Suspected) `r2r-8c73ea66efdc`

> At one attribute where the place is IndexedFaceSet coordIndex and the parent is Shape: how far the largest index runs past the end of its list is at least 2147483633 and the number of tokens is at most 15, unless the value does not have the written form its field type requires.

`{"all": ["ge:index_excess:2147483633", "le:ntok:15", "!v:lexical_invalid", "at:IndexedFaceSet@coordIndex", "p:Shape"], "kind": "attr"}`

Grade reasons: 1 audit prediction(s) were wrong: the rule fired and the instrument passed. Closure: **open** (1 audit probe(s) and 0+ held-out failure(s) failed with this signature where no rule of the cluster fired).

| Test | Result |
|---|---|
| Source failures explained at the changed site | 27 of 76 (76 with a known-good twin; observed by 76 tool) |
| Fires on files the instrument passed | 0 of 1887 |
| Held-out failures caught (content-disjoint) | 3 of 14 |
| Held-out false alarms | 0 of 1416 |
| Audit probes (built after the rule was fixed) | 24 predictions came true, 1 wrong, 1 failures the cluster's rules missed, 43 correctly silent, 42 failed another way |
| Degenerate files it fires on | none of 8 |
| Already covered by an existing Loom trap | 0 of 27 checked |

Probe rounds: 1: 2 bisect/other-failure, 4 bisect/silent-ok, 7 confirm/confirmed, 3 confirm/refuted, 3 value/confirmed, 1 value/refuted, 2 widen/other-failure, 14 widen/silent-ok; 2: 12 bisect/missed, 10 confirm/confirmed, 1 confirm/other-failure, 2 confirm/refuted, 4 near/silent-ok, 10 value/confirmed, 3 widen/other-failure, 16 widen/silent-ok; 3: 2 bisect/confirmed, 1 bisect/missed, 3 bisect/other-failure, 8 confirm/confirmed, 2 confirm/other-failure, 2 near/silent-ok, 6 value/confirmed, 4 widen/other-failure, 12 widen/silent-ok; audit: 5 bisect/confirmed, 1 bisect/missed, 5 bisect/other-failure, 1 bisect/silent-ok, 18 confirm/confirmed, 1 confirm/other-failure, 1 confirm/refuted, 6 near/confirmed, 2 near/silent-ok, 10 value/confirmed, 7 widen/other-failure, 25 widen/silent-ok.

Seen at 1 place(s): IndexedFaceSet@coordIndex.
Unfenced reading `attr[ge:index_excess:2147483633 & le:ntok:15 & !v:lexical_invalid & p:Shape]`: contradicted by passing files (17 false alarm(s) on known-good files).
Threshold `ge:index_excess:2147483633`: last value seen to pass 46340853.0, first seen to fail 2147483633.0; nothing between was tested.
Threshold `le:ntok:15`: last value seen to pass 30, first seen to fail 15.0; nothing between was tested.
Normative reading: every explained failure also has `v:index_out_of_range` (an index points past the end of the list it indexes); 61 passing file(s) have it too inside the fence.

Alternates the receipts could not rule out (2):
- `attr[ge:index_max:2147483638 & le:ntok:15 & !v:lexical_invalid & at:IndexedFaceSet@coordIndex & p:Shape]`
- `attr[ge:max_abs:2147483638 & le:ntok:15 & !v:lexical_invalid & at:IndexedFaceSet@coordIndex & p:Shape]`

Ablation (drop one literal, count again):

| Dropped | Role | False alarms without it | Failures explained without it |
|---|---|---:|---:|
| `ge:index_excess:2147483633` | test | 460 | 27 |
| `le:ntok:15` | test | 2 | 57 |
| `!v:lexical_invalid` | guard | 7 | 27 |
| `at:IndexedFaceSet@coordIndex` | context | 17 | 27 |
| `p:Shape` | context | 1 | 27 |

How the rule was reached: `seed le:ntok:15, fenced to at:IndexedFaceSet@coordIndex: explains 27, false alarms 468`; then `+ ge:index_excess:2147483633: explains 27, false alarms 8 (gain 97.44)`; then `+ !v:lexical_invalid: explains 27, false alarms 1 (gain 8.69)`; then `+ p:Shape: explains 27, false alarms 0 (gain 1.42)`.

Sources (27; first 5):
- `chaos:2.7.1-rng7/mutants/two_materials__075__index_oob.x3d` (index_oob: X3D/Scene/Transform#OB_Split/Shape/IndexedFaceSet#ME_SplitMesh_m0 coordIndex: token 1 1 -> 2147483647)
- `chaos:2.7.1-rng11/mutants/four_lights__050__index_oob.x3d` (index_oob: X3D/Scene/Transform#OB_Floor/Shape/IndexedFaceSet#ME_FloorMesh coordIndex: token 1 1 -> 2147483647)
- `work:c003/probes/round1-369e13a9fb74.x3d` (confirm: IndexedFaceSet@coordIndex <- '0 2147483647 2 3 -1')
- `work:c003/probes/round1-57b65922db87.x3d` (confirm: IndexedFaceSet@coordIndex <- '0 2147483647 2 3 -1 0 4 5 1 -1 0 3 6 4 -1')
- `work:c003/probes/round1-88399ac4fe05.x3d` (value: IndexedFaceSet@coordIndex <- ' 0 2147483647 2 3 -1 ' (live: '0 2147483647 2 3 -1' failed here))

### `RuntimeError at matrix_safety.py:47 inverted64`

Instrument: x3d-blender-io 2.7.1 import then export (bpy 5.3.0). 119 distinct failing file(s) in training (4 events), 6 held-out event(s). Probed with the real instrument.
- **Residue: 29 failure(s) no rule explains.** `num_extreme: X3D/Scene/Transform#OB_PartSource scale: token 0 1 -> NaN`; `confirm: Transform@translation <- '0 1e39 0'`; `confirm: Transform@translation <- '0 1e39 0'`; `confirm: Transform@translation <- '0 1e39 0'`; `confirm: Transform@translation <- '0 1 INF'`

#### S (Suspected) `r2r-eac8fb7c9a21`

> At one attribute where it sits inside a Group: the largest magnitude is at least 1e+39, at one of 2 places (Transform scale, Transform translation).

`{"all": ["ge:max_abs:1e+39", "anc:Group"], "any": ["at:Transform@scale", "at:Transform@translation"], "kind": "attr"}`

Grade reasons: 2 audit prediction(s) were wrong: the rule fired and the instrument passed. Closure: **open** (7 audit probe(s) and 3+ held-out failure(s) failed with this signature where no rule of the cluster fired).

| Test | Result |
|---|---|
| Source failures explained at the changed site | 41 of 119 (119 with a known-good twin; observed by 119 tool) |
| Fires on files the instrument passed | 0 of 1886 |
| Held-out failures caught (content-disjoint) | 0 of 6 |
| Held-out false alarms | 0 of 1409 |
| Audit probes (built after the rule was fixed) | 26 predictions came true, 2 wrong, 7 failures the cluster's rules missed, 61 correctly silent, 0 failed another way |
| Degenerate files it fires on | none of 8 |
| Already covered by an existing Loom trap | 0 of 41 checked |

Probe rounds: 1: 6 alternate/confirmed, 6 bisect/silent-ok, 8 confirm/confirmed, 2 confirm/refuted, 1 near/missed, 8 value/confirmed, 2 value/no-verdict, 2 widen/missed, 14 widen/silent-ok; 2: 1 alternate/confirmed, 6 bisect/missed, 20 confirm/confirmed, 3 confirm/refuted, 2 near/missed, 19 value/confirmed, 11 value/no-verdict, 35 widen/silent-ok; 3: 1 alternate/missed, 5 alternate/no-verdict, 6 bisect/silent-ok, 20 confirm/confirmed, 4 confirm/refuted, 21 value/confirmed, 7 value/no-verdict, 2 value/refuted, 48 widen/silent-ok; audit: 2 alternate/confirmed, 4 alternate/missed, 6 bisect/confirmed, 1 bisect/missed, 2 bisect/silent-ok, 28 confirm/confirmed, 3 confirm/refuted, 6 near/no-verdict, 1 near/refuted, 1 near/silent-ok, 33 value/confirmed, 2 value/no-verdict, 1 value/refuted, 2 widen/missed, 55 widen/silent-ok.

Seen at 2 place(s): Transform@scale, Transform@translation.
Unfenced reading `attr[ge:max_abs:1e+39 & anc:Group]`: contradicted by passing files (10 false alarm(s) on known-good files).
Threshold `ge:max_abs:1e+39`: last value seen to pass 1.778279410038931e+32, first seen to fail 1e+39; nothing between was tested.

Ablation (drop one literal, count again):

| Dropped | Role | False alarms without it | Failures explained without it |
|---|---|---:|---:|
| `ge:max_abs:1e+39` | test | 213 | 45 |
| `anc:Group` | context | 14 | 90 |
| `(the list of 2 places)` | fence | 10 | 41 |

How the rule was reached: `seed ge:max_abs:1e+39, fenced to 3 place(s): explains 91, false alarms 14`; then `+ anc:Group: explains 41, false alarms 0 (gain 8.46)`.

Sources (41; first 5):
- `work:c004/probes/round1-583a29577568.x3d` (confirm: Transform@translation <- '0 1e39 0')
- `work:c004/probes/round1-2d21c994351b.x3d` (confirm: Transform@translation <- '0 INF 0')
- `work:c004/probes/round1-7ef0f787e412.x3d` (alternate:0: Transform@translation <- '"0 1e39 0"' (live: '0 1e39 0' failed here))
- `work:c004/probes/round1-d425aba4c52a.x3d` (alternate:0: Transform@translation <- '"0 INF 0"' (live: '0 INF 0' failed here))
- `work:c004/probes/round1-52a6fabfb0b2.x3d` (value: Transform@translation <- '0 1E39 0' (live: '0 1e39 0' failed here))

#### C (Confirmed) `r2r-c78b17d6ccf6`

> At one attribute where its element has a Shape child and its element also has the attribute DEF: the largest magnitude is at least 5.05e+38, at one of 2 places (Transform scale, Transform translation).

`{"all": ["ge:max_abs:5.05e+38", "e.child:Shape", "e.has:DEF"], "any": ["at:Transform@scale", "at:Transform@translation"], "kind": "attr"}`

Grade reasons: 13 audit probe(s) confirmed, 0 refuted; 0 false alarms in 1886 known-good files. Closure: **open** (7 audit probe(s) and 3+ held-out failure(s) failed with this signature where no rule of the cluster fired).

| Test | Result |
|---|---|
| Source failures explained at the changed site | 29 of 119 (119 with a known-good twin; observed by 119 tool) |
| Fires on files the instrument passed | 0 of 1886 |
| Held-out failures caught (content-disjoint) | 3 of 6 |
| Held-out false alarms | 0 of 1409 |
| Audit probes (built after the rule was fixed) | 13 predictions came true, 0 wrong, 7 failures the cluster's rules missed, 63 correctly silent, 0 failed another way |
| Degenerate files it fires on | none of 8 |
| Already covered by an existing Loom trap | 0 of 29 checked |

Probe rounds: 1: 6 alternate/confirmed, 6 bisect/silent-ok, 8 confirm/confirmed, 2 confirm/refuted, 1 near/missed, 8 value/confirmed, 2 value/no-verdict, 2 widen/missed, 14 widen/silent-ok; 2: 1 alternate/confirmed, 6 bisect/missed, 20 confirm/confirmed, 3 confirm/refuted, 2 near/missed, 19 value/confirmed, 11 value/no-verdict, 35 widen/silent-ok; 3: 1 alternate/missed, 5 alternate/no-verdict, 6 bisect/silent-ok, 20 confirm/confirmed, 4 confirm/refuted, 21 value/confirmed, 7 value/no-verdict, 2 value/refuted, 48 widen/silent-ok; audit: 2 alternate/confirmed, 4 alternate/missed, 6 bisect/confirmed, 1 bisect/missed, 2 bisect/silent-ok, 28 confirm/confirmed, 3 confirm/refuted, 6 near/no-verdict, 1 near/refuted, 1 near/silent-ok, 33 value/confirmed, 2 value/no-verdict, 1 value/refuted, 2 widen/missed, 55 widen/silent-ok.

Seen at 2 place(s): Transform@scale, Transform@translation.
Unfenced reading `attr[ge:max_abs:5.05e+38 & e.child:Shape & e.has:DEF]`: contradicted by passing files (24 false alarm(s) on known-good files).
Threshold `ge:max_abs:5.05e+38`: last value seen to pass 9.999999999999983e+20, first seen to fail 5.05e+38; nothing between was tested.

Ablation (drop one literal, count again):

| Dropped | Role | False alarms without it | Failures explained without it |
|---|---|---:|---:|
| `ge:max_abs:5.05e+38` | test | 1493 | 39 |
| `e.child:Shape` | context | 6 | 33 |
| `e.has:DEF` | context | 7 | 96 |
| `(the list of 2 places)` | fence | 24 | 29 |

How the rule was reached: `seed ge:max_abs:5.05e+38, fenced to 3 place(s): explains 101, false alarms 14`; then `+ e.child:Shape: explains 97, false alarms 7 (gain 8.41)`; then `+ e.has:DEF: explains 29, false alarms 0 (gain 2.92)`.

Sources (29; first 5):
- `chaos:2.7.1-rng7/mutants/lit_cube__004__num_extreme.x3d` (num_extreme: X3D/Scene/Transform#OB_Cube translation: token 2 0 -> INF)
- `chaos:2.7.1-rng11/mutants/lit_cube__001__num_extreme.x3d` (num_extreme: X3D/Scene/Transform#OB_Cube translation: token 1 1 -> 1e39)
- `chaos:2.7.1-rng11/mutants/lit_cube__011__num_extreme.x3d` (num_extreme: X3D/Scene/Transform#OB_Cube translation: token 1 1 -> INF)
- `work:c004/probes/round1-b8a633ebd114.x3d` (confirm: Transform@translation <- '0 1e39 0')
- `work:c004/probes/round1-62eb8e3cfc3f.x3d` (confirm: Transform@translation <- '0 1e39 0')

#### S (Suspected) `r2r-bd1f8384f6cd`

> At one attribute where the place is Transform scale: the value does not have the written form its field type requires, unless its element also has the attribute rotation.

`{"all": ["v:lexical_invalid", "!e.has:rotation", "at:Transform@scale"], "kind": "attr"}`

Grade reasons: 4 audit prediction(s) were wrong: the rule fired and the instrument passed. Closure: **open** (7 audit probe(s) and 3+ held-out failure(s) failed with this signature where no rule of the cluster fired).

| Test | Result |
|---|---|
| Source failures explained at the changed site | 28 of 119 (119 with a known-good twin; observed by 119 tool) |
| Fires on files the instrument passed | 0 of 1886 |
| Held-out failures caught (content-disjoint) | 0 of 6 |
| Held-out false alarms | 0 of 1409 |
| Audit probes (built after the rule was fixed) | 37 predictions came true, 4 wrong, 7 failures the cluster's rules missed, 59 correctly silent, 0 failed another way |
| Degenerate files it fires on | none of 8 |
| Already covered by an existing Loom trap | 0 of 28 checked |

Probe rounds: 1: 6 alternate/confirmed, 6 bisect/silent-ok, 8 confirm/confirmed, 2 confirm/refuted, 1 near/missed, 8 value/confirmed, 2 value/no-verdict, 2 widen/missed, 14 widen/silent-ok; 2: 1 alternate/confirmed, 6 bisect/missed, 20 confirm/confirmed, 3 confirm/refuted, 2 near/missed, 19 value/confirmed, 11 value/no-verdict, 35 widen/silent-ok; 3: 1 alternate/missed, 5 alternate/no-verdict, 6 bisect/silent-ok, 20 confirm/confirmed, 4 confirm/refuted, 21 value/confirmed, 7 value/no-verdict, 2 value/refuted, 48 widen/silent-ok; audit: 2 alternate/confirmed, 4 alternate/missed, 6 bisect/confirmed, 1 bisect/missed, 2 bisect/silent-ok, 28 confirm/confirmed, 3 confirm/refuted, 6 near/no-verdict, 1 near/refuted, 1 near/silent-ok, 33 value/confirmed, 2 value/no-verdict, 1 value/refuted, 2 widen/missed, 55 widen/silent-ok.

Seen at 1 place(s): Transform@scale.
Unfenced reading `attr[v:lexical_invalid & !e.has:rotation]`: contradicted by passing files (272 false alarm(s) on known-good files).
Normative reading: every explained failure also has `v:lexical_invalid` (the value does not have the written form its field type requires); 17 passing file(s) have it too inside the fence.

Alternates the receipts could not rule out (2):
- `attr[v:lexical_invalid & !e.has:rotation & a:scale & at:Transform@scale]`
- `attr[v:lexical_invalid & !a:translation & !e.has:rotation & at:Transform@scale]`

Ablation (drop one literal, count again):

| Dropped | Role | False alarms without it | Failures explained without it |
|---|---|---:|---:|
| `v:lexical_invalid` | test | 10 | 28 |
| `!e.has:rotation` | guard | 17 | 29 |
| `at:Transform@scale` | context | 272 | 69 |

How the rule was reached: `seed v:lexical_invalid, fenced to 3 place(s): explains 85, false alarms 42`; then `+ !e.has:rotation: explains 69, false alarms 6 (gain 31.67)`; then `+ at:Transform@scale: explains 28, false alarms 0 (gain 3.37)`.

Sources (28; first 5):
- `work:c004/probes/round1-cf4739c9d0dc.x3d` (widen: Transform@scale <- '0 1 INF')
- `work:c004/probes/round2-6d58896e8af2.x3d` (confirm: Transform@scale <- '0 1 INF')
- `work:c004/probes/round2-873c90dc07da.x3d` (confirm: Transform@scale <- '0 INF 0')
- `work:c004/probes/round2-07106047e186.x3d` (alternate:0: Transform@scale <- '"0 INF 0"' (live: '0 INF 0' failed here))
- `work:c004/probes/round2-951d653db114.x3d` (near: Transform@scale <- '"0 1 INF"' (live: '0 1 INF' failed here))

#### C (Confirmed) `r2r-4b8b7ade96af`

> At one attribute where the place is Transform translation: a number is larger than a 32-bit float can hold, unless the parent is Scene or the value does not have the written form its field type requires.

`{"all": ["v:float_overflow32", "!p:Scene", "!v:lexical_invalid", "at:Transform@translation"], "kind": "attr"}`

Grade reasons: 21 audit probe(s) confirmed, 0 refuted; 0 false alarms in 1886 known-good files. Closure: **open** (7 audit probe(s) and 3+ held-out failure(s) failed with this signature where no rule of the cluster fired).

| Test | Result |
|---|---|
| Source failures explained at the changed site | 16 of 119 (119 with a known-good twin; observed by 119 tool) |
| Fires on files the instrument passed | 0 of 1886 |
| Held-out failures caught (content-disjoint) | 0 of 6 |
| Held-out false alarms | 0 of 1409 |
| Audit probes (built after the rule was fixed) | 21 predictions came true, 0 wrong, 7 failures the cluster's rules missed, 63 correctly silent, 0 failed another way |
| Degenerate files it fires on | none of 8 |
| Already covered by an existing Loom trap | 0 of 16 checked |

Probe rounds: 1: 6 alternate/confirmed, 6 bisect/silent-ok, 8 confirm/confirmed, 2 confirm/refuted, 1 near/missed, 8 value/confirmed, 2 value/no-verdict, 2 widen/missed, 14 widen/silent-ok; 2: 1 alternate/confirmed, 6 bisect/missed, 20 confirm/confirmed, 3 confirm/refuted, 2 near/missed, 19 value/confirmed, 11 value/no-verdict, 35 widen/silent-ok; 3: 1 alternate/missed, 5 alternate/no-verdict, 6 bisect/silent-ok, 20 confirm/confirmed, 4 confirm/refuted, 21 value/confirmed, 7 value/no-verdict, 2 value/refuted, 48 widen/silent-ok; audit: 2 alternate/confirmed, 4 alternate/missed, 6 bisect/confirmed, 1 bisect/missed, 2 bisect/silent-ok, 28 confirm/confirmed, 3 confirm/refuted, 6 near/no-verdict, 1 near/refuted, 1 near/silent-ok, 33 value/confirmed, 2 value/no-verdict, 1 value/refuted, 2 widen/missed, 55 widen/silent-ok.

Seen at 1 place(s): Transform@translation.
Unfenced reading `attr[v:float_overflow32 & !p:Scene & !v:lexical_invalid]`: contradicted by passing files (23 false alarm(s) on known-good files).

Alternates the receipts could not rule out (6):
- `attr[v:float_overflow32 & !p:Scene & !v:arity_mismatch & at:Transform@translation]`
- `attr[v:float_overflow32 & !e.has:scale & !v:arity_mismatch & !v:eq: 0 1e39 0  & at:Transform@translation & e.child:Shape]`
- `attr[v:float_overflow32 & !e.has:center & !v:arity_mismatch & !v:eq: 0 1e39 0  & at:Transform@translation & e.child:Shape]`
- `attr[v:float_overflow32 & !v:eq: 0 1e39 0  & !v:lexical_invalid & at:Transform@translation & e.child:Shape]`

Ablation (drop one literal, count again):

| Dropped | Role | False alarms without it | Failures explained without it |
|---|---|---:|---:|
| `v:float_overflow32` | test | 428 | 21 |
| `!p:Scene` | guard | 3 | 34 |
| `!v:lexical_invalid` | guard | 1 | 20 |
| `at:Transform@translation` | context | 23 | 16 |

How the rule was reached: `seed ge:min:0, fenced to 4 place(s): explains 92, false alarms 1688`; then `+ v:float_overflow32: explains 51, false alarms 6 (gain 121.94)`; then `+ !v:lexical_invalid: explains 34, false alarms 2 (gain 2.65)`; then `+ !p:Scene: explains 16, false alarms 0 (gain 1.32)`; then `pruned ge:min:0: no false alarm returns without it`.

Sources (16; first 5):
- `work:c004/probes/round1-583a29577568.x3d` (confirm: Transform@translation <- '0 1e39 0')
- `work:c004/probes/round1-52a6fabfb0b2.x3d` (value: Transform@translation <- '0 1E39 0' (live: '0 1e39 0' failed here))
- `work:c004/probes/round1-1ac9b4e9c6ed.x3d` (value: Transform@translation <- ' 0 1e39 0 ' (live: '0 1e39 0' failed here))
- `work:c004/probes/round2-10c6c5d7ee2f.x3d` (confirm: Transform@translation <- '0 1e39 0')
- `work:c004/probes/round2-131cbf096044.x3d` (confirm: Transform@translation <- '0 1E39 0')

### `IndexError at import_x3d.py:1665 translateScale`

Instrument: x3d-blender-io 2.7.1 importer (bpy 5.3.0). 149 distinct failing file(s) in training (1 events), 2 held-out event(s). Probed with the real instrument.
- **Residue: 38 failure(s) no rule explains.** `num_extreme: X3D/Scene/Transform#OB_Key scale: token 1 1 -> 1e`; `confirm: Transform@scale <- '1 1e 1'`; `confirm: Transform@scale <- '1 1e 1'`; `confirm: Transform@scale <- '1 1e 1'`; `confirm: Transform@scale <- '1 1e 1'`

#### S (Suspected) `r2r-61999795e8b4`

> At one attribute where the place is Transform scale: the number of tokens is at least 6, unless the parent is Scene.

`{"all": ["ge:ntok:6", "!p:Scene", "at:Transform@scale"], "kind": "attr"}`

Grade reasons: 3 audit prediction(s) were wrong: the rule fired and the instrument passed. Closure: **open** (2 audit probe(s) and 2+ held-out failure(s) failed with this signature where no rule of the cluster fired).

| Test | Result |
|---|---|
| Source failures explained at the changed site | 43 of 149 (149 with a known-good twin; observed by 149 tool) |
| Fires on files the instrument passed | 0 of 2024 |
| Held-out failures caught (content-disjoint) | 0 of 2 |
| Held-out false alarms | 0 of 1416 |
| Audit probes (built after the rule was fixed) | 28 predictions came true, 3 wrong, 2 failures the cluster's rules missed, 98 correctly silent, 83 failed another way |
| Degenerate files it fires on | none of 8 |
| Already covered by an existing Loom trap | 0 of 43 checked |

Probe rounds: 1: 4 alternate/confirmed, 2 alternate/missed, 7 confirm/confirmed, 3 confirm/refuted, 16 widen/silent-ok; 2: 13 alternate/confirmed, 3 alternate/missed, 16 confirm/confirmed, 8 confirm/refuted, 30 value/confirmed, 32 widen/silent-ok; 3: 6 alternate/confirmed, 33 confirm/confirmed, 3 confirm/refuted, 34 value/confirmed, 4 value/refuted, 2 widen/other-failure, 47 widen/silent-ok; audit: 5 alternate/confirmed, 3 alternate/refuted, 1 alternate/silent-ok, 29 confirm/confirmed, 1 confirm/refuted, 3 near/confirmed, 2 near/missed, 5 near/silent-ok, 30 value/confirmed, 1 widen/other-failure, 47 widen/silent-ok.

Seen at 1 place(s): Transform@scale.
Unfenced reading `attr[ge:ntok:6 & !p:Scene]`: contradicted by passing files (1735 false alarm(s) on known-good files).
Threshold `ge:ntok:6`: last value seen to pass 5, first seen to fail 6.0; nothing between was tested.
Normative reading: every explained failure also has `v:arity_long` (the value has too many components for its field type); 14 passing file(s) have it too inside the fence.
Normative reading: every explained failure also has `v:arity_mismatch` (the value has the wrong number of components for its field type); 25 passing file(s) have it too inside the fence.
Normative reading: every explained failure also has `v:lexical_invalid` (the value does not have the written form its field type requires); 35 passing file(s) have it too inside the fence.
Normative reading: every explained failure also has `v:number_unparseable` (a token is not a number in X3D's notation); 20 passing file(s) have it too inside the fence.

Alternates the receipts could not rule out (8):
- `attr[ge:len:13 & v:number_unparseable & !p:Scene & at:Transform@scale]`
- `attr[ge:len:13 & !p:Scene & at:Transform@scale & ntok:many]`
- `attr[ge:len:13 & !p:Scene & at:Transform@scale & nws:many]`
- `attr[v:number_unparseable & !p:Scene & !v:tok:" & at:Transform@scale]`

Ablation (drop one literal, count again):

| Dropped | Role | False alarms without it | Failures explained without it |
|---|---|---:|---:|
| `ge:ntok:6` | test | 333 | 70 |
| `!p:Scene` | guard | 11 | 80 |
| `at:Transform@scale` | context | 1735 | 43 |

How the rule was reached: `seed ge:ntok:6, fenced to at:Transform@scale: explains 80, false alarms 11`; then `+ !p:Scene: explains 43, false alarms 0 (gain 7.99)`.

Sources (43; first 5):
- `work:c005/probes/round2-31ba1cd619f8.x3d` (value: Transform@scale <- '"1 1e 1","1 1e 1"' (live: '"1 1e 1"' failed here))
- `work:c005/probes/round2-82b41d976128.x3d` (alternate:2: Transform@scale <- '"1 1e 1","1 1e 1"' (live: '"1 1e 1"' failed here))
- `work:c005/probes/round2-a1f59db60464.x3d` (alternate:2: Transform@scale <- '"1 1e 1","1 1e 1"' (live: '"1 1e 1"' failed here))
- `work:c005/probes/round2-27b00f012db8.x3d` (confirm: Transform@scale <- '1 1e 1 1 1e 1')
- `work:c005/probes/round2-6373e363ef25.x3d` (value: Transform@scale <- ' 1 1e 1 1 1e 1 ' (live: '1 1e 1 1 1e 1' failed here))

#### S (Suspected) `r2r-01a07f48ec95`

> At one attribute where the place is Transform scale and the value has 3 token(s): the length of the value is at least 10 and a token is not a number in X3D's notation.

`{"all": ["ge:len:10", "v:number_unparseable", "at:Transform@scale", "ntok:3"], "kind": "attr"}`

Grade reasons: 1 audit prediction(s) were wrong: the rule fired and the instrument passed. Closure: **open** (2 audit probe(s) and 2+ held-out failure(s) failed with this signature where no rule of the cluster fired).

| Test | Result |
|---|---|
| Source failures explained at the changed site | 33 of 149 (149 with a known-good twin; observed by 149 tool) |
| Fires on files the instrument passed | 0 of 2024 |
| Held-out failures caught (content-disjoint) | 0 of 2 |
| Held-out false alarms | 0 of 1416 |
| Audit probes (built after the rule was fixed) | 31 predictions came true, 1 wrong, 2 failures the cluster's rules missed, 100 correctly silent, 83 failed another way |
| Degenerate files it fires on | none of 8 |
| Already covered by an existing Loom trap | 0 of 33 checked |

Probe rounds: 1: 4 alternate/confirmed, 2 alternate/missed, 7 confirm/confirmed, 3 confirm/refuted, 16 widen/silent-ok; 2: 13 alternate/confirmed, 3 alternate/missed, 16 confirm/confirmed, 8 confirm/refuted, 30 value/confirmed, 32 widen/silent-ok; 3: 6 alternate/confirmed, 33 confirm/confirmed, 3 confirm/refuted, 34 value/confirmed, 4 value/refuted, 2 widen/other-failure, 47 widen/silent-ok; audit: 5 alternate/confirmed, 3 alternate/refuted, 1 alternate/silent-ok, 29 confirm/confirmed, 1 confirm/refuted, 3 near/confirmed, 2 near/missed, 5 near/silent-ok, 30 value/confirmed, 1 widen/other-failure, 47 widen/silent-ok.

Seen at 1 place(s): Transform@scale.
Unfenced reading `attr[ge:len:10 & v:number_unparseable & ntok:3]`: contradicted by passing files (10 false alarm(s) on known-good files).
Threshold `ge:len:10`: last value seen to pass 8, first seen to fail 10.0; nothing between was tested.
Normative reading: every explained failure also has `v:lexical_invalid` (the value does not have the written form its field type requires); 35 passing file(s) have it too inside the fence.
Normative reading: every explained failure also has `v:number_unparseable` (a token is not a number in X3D's notation); 20 passing file(s) have it too inside the fence.

Alternates the receipts could not rule out (2):
- `attr[ge:len:10 & v:lexical_invalid & at:Transform@scale & ntok:3]`
- `attr[ge:len:10 & v:lexical_invalid & at:Transform@scale & nws:3]`

Ablation (drop one literal, count again):

| Dropped | Role | False alarms without it | Failures explained without it |
|---|---|---:|---:|
| `ge:len:10` | test | 6 | 69 |
| `v:number_unparseable` | test | 37 | 33 |
| `at:Transform@scale` | context | 10 | 33 |
| `ntok:3` | context | 13 | 113 |

How the rule was reached: `seed ge:len:10, fenced to 2 place(s): explains 116, false alarms 178`; then `+ v:number_unparseable: explains 113, false alarms 14 (gain 132.57)`; then `+ ntok:3: explains 33, false alarms 0 (gain 5.56)`.

Sources (33; first 5):
- `work:c005/probes/round2-1f0c9eb1771b.x3d` (value: Transform@scale <- ' "1 1e 1" ' (live: '"1 1e 1"' failed here))
- `work:c005/probes/round2-7465cfa7f6b0.x3d` (value: Transform@scale <- '  1 1e 1  ' (live: ' 1 1e 1 ' failed here))
- `work:c005/probes/round2-f6c461f9eceb.x3d` (value: Transform@scale <- '""1 1e 1""' (live: '"1 1e 1"' failed here))
- `work:c005/probes/round2-c042aecd7663.x3d` (alternate:2: Transform@scale <- '""1 1e 1""' (live: '"1 1e 1"' failed here))
- `work:c005/probes/round2-036190c113a5.x3d` (value: Transform@scale <- ' "1 1e 1" ' (live: '"1 1e 1"' failed here))

#### L (Likely) `r2r-0bd64577661d`

> At one element where it has a TouchSensor child and it has the attribute scale and the node is Transform and the parent is Scene: the number of attributes is at least 1.

`{"all": ["ge:nattrs:1", "child:TouchSensor", "has:scale", "n:Transform", "p:Scene"], "kind": "elem"}`

Grade reasons: nothing unseen has confirmed it: 0 audit probe(s) confirmed (need 5); 2 held-out failure(s) (need 5). Closure: **open** (2 audit probe(s) and 2+ held-out failure(s) failed with this signature where no rule of the cluster fired).

| Test | Result |
|---|---|
| Source failures explained at the changed site | 28 of 149 (149 with a known-good twin; observed by 149 tool) |
| Fires on files the instrument passed | 0 of 2024 |
| Held-out failures caught (content-disjoint) | 0 of 2 |
| Held-out false alarms | 0 of 1416 |
| Audit probes (built after the rule was fixed) | 0 predictions came true, 0 wrong, 2 failures the cluster's rules missed, 101 correctly silent, 83 failed another way |
| Degenerate files it fires on | none of 8 |
| Already covered by an existing Loom trap | 0 of 28 checked |

Probe rounds: 1: 4 alternate/confirmed, 2 alternate/missed, 7 confirm/confirmed, 3 confirm/refuted, 16 widen/silent-ok; 2: 13 alternate/confirmed, 3 alternate/missed, 16 confirm/confirmed, 8 confirm/refuted, 30 value/confirmed, 32 widen/silent-ok; 3: 6 alternate/confirmed, 33 confirm/confirmed, 3 confirm/refuted, 34 value/confirmed, 4 value/refuted, 2 widen/other-failure, 47 widen/silent-ok; audit: 5 alternate/confirmed, 3 alternate/refuted, 1 alternate/silent-ok, 29 confirm/confirmed, 1 confirm/refuted, 3 near/confirmed, 2 near/missed, 5 near/silent-ok, 30 value/confirmed, 1 widen/other-failure, 47 widen/silent-ok.

Seen at 1 place(s): Transform.
Unfenced reading `elem[ge:nattrs:1 & child:TouchSensor & has:scale & p:Scene]`: untested beyond the fence (0 false alarm(s) on known-good files).
Threshold `ge:nattrs:1`: last value seen to pass None, first seen to fail 1.0; nothing between was tested.

Alternates the receipts could not rule out (2):
- `elem[ge:nattrs:1 & !cf:children & child:TouchSensor & has:scale & n:Transform]`
- `elem[ge:nattrs:1 & !p:Collision & !p:Layer & child:TouchSensor & has:scale & n:Transform]`
Literals whose removal changes nothing on this evidence: `ge:nattrs:1`.

Ablation (drop one literal, count again):

| Dropped | Role | False alarms without it | Failures explained without it |
|---|---|---:|---:|
| `ge:nattrs:1` | test | 0 | 28 |
| `child:TouchSensor` | context | 1476 | 78 |
| `has:scale` | context | 16 | 28 |
| `n:Transform` | context | 0 | 28 |
| `p:Scene` | context | 2 | 40 |

How the rule was reached: `seed ge:nattrs:1, fenced to n:Transform: explains 148, false alarms 1802`; then `+ child:TouchSensor: explains 40, false alarms 25 (gain 66.24)`; then `+ has:scale: explains 40, false alarms 2 (gain 25.20)`; then `+ p:Scene: explains 28, false alarms 0 (gain 1.97)`.

Sources (28; first 5):
- `work:c005/probes/round1-ef58bc2220ad.x3d` (confirm: Transform@scale <- '1 1e 1')
- `work:c005/probes/round1-45ee9b1d76f6.x3d` (alternate:1: Transform@scale <- '"1 1e 1"' (live: '1 1e 1' failed here))
- `work:c005/probes/round2-a8efd1b9084b.x3d` (confirm: Transform@scale <- '1 1e 1')
- `work:c005/probes/round2-86fd594fc31c.x3d` (confirm: Transform@scale <- ' 1 1e 1 ')
- `work:c005/probes/round2-cdb3af281310.x3d` (confirm: Transform@scale <- '1 1e 1')

#### C (Confirmed) `r2r-f10d90dac48f`

> At one attribute where the place is Transform scale and the value has 3 token(s): a token is not a number in X3D's notation, unless the parent is Scene.

`{"all": ["v:number_unparseable", "!p:Scene", "at:Transform@scale", "ntok:3"], "kind": "attr"}`

Grade reasons: 24 audit probe(s) confirmed, 0 refuted; 0 false alarms in 2024 known-good files. Closure: **open** (2 audit probe(s) and 2+ held-out failure(s) failed with this signature where no rule of the cluster fired).

| Test | Result |
|---|---|
| Source failures explained at the changed site | 27 of 149 (149 with a known-good twin; observed by 149 tool) |
| Fires on files the instrument passed | 0 of 2024 |
| Held-out failures caught (content-disjoint) | 0 of 2 |
| Held-out false alarms | 0 of 1416 |
| Audit probes (built after the rule was fixed) | 24 predictions came true, 0 wrong, 2 failures the cluster's rules missed, 101 correctly silent, 83 failed another way |
| Degenerate files it fires on | none of 8 |
| Already covered by an existing Loom trap | 0 of 27 checked |

Probe rounds: 1: 4 alternate/confirmed, 2 alternate/missed, 7 confirm/confirmed, 3 confirm/refuted, 16 widen/silent-ok; 2: 13 alternate/confirmed, 3 alternate/missed, 16 confirm/confirmed, 8 confirm/refuted, 30 value/confirmed, 32 widen/silent-ok; 3: 6 alternate/confirmed, 33 confirm/confirmed, 3 confirm/refuted, 34 value/confirmed, 4 value/refuted, 2 widen/other-failure, 47 widen/silent-ok; audit: 5 alternate/confirmed, 3 alternate/refuted, 1 alternate/silent-ok, 29 confirm/confirmed, 1 confirm/refuted, 3 near/confirmed, 2 near/missed, 5 near/silent-ok, 30 value/confirmed, 1 widen/other-failure, 47 widen/silent-ok.

Seen at 1 place(s): Transform@scale.
Unfenced reading `attr[v:number_unparseable & !p:Scene & ntok:3]`: contradicted by passing files (27 false alarm(s) on known-good files).
Normative reading: every explained failure also has `v:lexical_invalid` (the value does not have the written form its field type requires); 35 passing file(s) have it too inside the fence.
Normative reading: every explained failure also has `v:number_unparseable` (a token is not a number in X3D's notation); 20 passing file(s) have it too inside the fence.

Alternates the receipts could not rule out (5):
- `attr[le:ntok:3 & v:lexical_invalid & !e.has:DEF & !p:Scene & at:Transform@scale]`
- `attr[v:number_unparseable & !p:Scene & !v:tok:" & at:Transform@scale]`
- `attr[v:number_unparseable & !p:Scene & !v:tok:" & a:scale & at:Transform@scale]`
- `attr[v:number_unparseable & !p:Scene & !v:eq:" "1 1e 1" " & !v:eq:" 1 1e 1 " & at:Transform@scale]`

Ablation (drop one literal, count again):

| Dropped | Role | False alarms without it | Failures explained without it |
|---|---|---:|---:|
| `v:number_unparseable` | test | 330 | 27 |
| `!p:Scene` | guard | 6 | 69 |
| `at:Transform@scale` | context | 27 | 27 |
| `ntok:3` | context | 3 | 70 |

How the rule was reached: `seed ge:len:8, fenced to 3 place(s): explains 140, false alarms 1743`; then `+ v:number_unparseable: explains 135, false alarms 24 (gain 257.23)`; then `+ ntok:3: explains 55, false alarms 3 (gain 8.77)`; then `+ !p:Scene: explains 23, false alarms 0 (gain 1.76)`; then `pruned ge:len:8: no false alarm returns without it`.

Sources (27; first 5):
- `work:c005/probes/round1-0b3cb15c985e.x3d` (confirm: Transform@scale <- '1 1e 1')
- `work:c005/probes/round1-d7bd885308ac.x3d` (confirm: Transform@scale <- '1 1e 1')
- `work:c005/probes/round1-a90da885f2d5.x3d` (alternate:3: Transform@scale <- ' 1 1e 1 ' (live: '1 1e 1' failed here))
- `work:c005/probes/round2-d29f5e4a1743.x3d` (confirm: Transform@scale <- '"1 1e 1"')
- `work:c005/probes/round2-ac100c16e49c.x3d` (alternate:1: Transform@scale <- '"1 1E 1"' (live: '"1 1e 1"' failed here))

### `ValueError at import_x3d.py:1700 translateTransform`

Instrument: x3d-blender-io 2.7.1 importer (bpy 5.3.0). 149 distinct failing file(s) in training (2 events), 2 held-out event(s). Probed with the real instrument.
- **Residue: 19 failure(s) no rule explains.** `text_garbage: X3D/Scene/Transform#OB_Key translation -> '1 2 3 4 5 6 7'`; `widen: Transform@translation <- ' 1 1e 1 , 1 1e 1 '`; `confirm: Transform@translation <- ' 1 1e 1 , 1 1e 1 '`; `confirm: Transform@translation <- ' 1 1e 1 , 1 1e 1 '`; `confirm: Transform@translation <- '1 2 3 4 5 6 7'`

#### C (Confirmed) `r2r-dc3e3fa23485`

> At one attribute where the place is Transform translation: the value has too many components for its field type, unless the parent is Scene or a token is wrapped in quotation marks where the field is not a string.

`{"all": ["v:arity_long", "!p:Scene", "!v:quoted", "at:Transform@translation"], "kind": "attr"}`

Grade reasons: 35 audit probe(s) confirmed, 0 refuted; 0 false alarms in 2162 known-good files. Closure: **open** (0 audit probe(s) and 2+ held-out failure(s) failed with this signature where no rule of the cluster fired).

| Test | Result |
|---|---|
| Source failures explained at the changed site | 76 of 149 (149 with a known-good twin; observed by 149 tool) |
| Fires on files the instrument passed | 0 of 2162 |
| Held-out failures caught (content-disjoint) | 0 of 2 |
| Held-out false alarms | 0 of 1416 |
| Audit probes (built after the rule was fixed) | 35 predictions came true, 0 wrong, 0 failures the cluster's rules missed, 190 correctly silent, 153 failed another way |
| Degenerate files it fires on | none of 8 |
| Already covered by an existing Loom trap | 0 of 60 checked |

Probe rounds: 1: 8 confirm/confirmed, 2 confirm/refuted, 8 value/confirmed, 2 value/refuted, 1 widen/other-failure, 15 widen/silent-ok; 2: 4 alternate/confirmed, 2 alternate/silent-ok, 25 confirm/confirmed, 4 confirm/refuted, 9 near/missed, 3 near/silent-ok, 27 value/confirmed, 3 value/refuted, 1 widen/other-failure, 38 widen/silent-ok; 3: 6 alternate/confirmed, 6 bisect/missed, 27 confirm/confirmed, 3 confirm/refuted, 12 near/silent-ok, 27 value/confirmed, 1 widen/other-failure, 47 widen/silent-ok; audit: 6 alternate/confirmed, 6 bisect/confirmed, 35 confirm/confirmed, 5 confirm/refuted, 21 near/silent-ok, 40 value/confirmed, 1 widen/other-failure, 63 widen/silent-ok.

Seen at 1 place(s): Transform@translation.
Unfenced reading `attr[v:arity_long & !p:Scene & !v:quoted]`: contradicted by passing files (136 false alarm(s) on known-good files).
Normative reading: every explained failure also has `v:arity_long` (the value has too many components for its field type); 31 passing file(s) have it too inside the fence.
Normative reading: every explained failure also has `v:arity_mismatch` (the value has the wrong number of components for its field type); 42 passing file(s) have it too inside the fence.
Normative reading: every explained failure also has `v:lexical_invalid` (the value does not have the written form its field type requires); 49 passing file(s) have it too inside the fence.

Alternates the receipts could not rule out (8):
- `attr[ge:ntok:6 & !p:Scene & !v:quoted & at:Transform@translation]`
- `attr[v:lexical_invalid & !e.has:scale & !p:Scene & !v:quoted & at:Transform@translation]`
- `attr[ge:min:1 & !p:Scene & !v:quoted & at:Transform@translation & ntok:many]`
- `attr[ge:min:1 & !p:Scene & !v:quoted & at:Transform@translation & nws:many]`

Ablation (drop one literal, count again):

| Dropped | Role | False alarms without it | Failures explained without it |
|---|---|---:|---:|
| `v:arity_long` | test | 501 | 76 |
| `!p:Scene` | guard | 7 | 120 |
| `!v:quoted` | guard | 18 | 85 |
| `at:Transform@translation` | context | 136 | 76 |

How the rule was reached: `seed v:arity_long, fenced to at:Transform@translation: explains 149, false alarms 31`; then `+ !v:quoted: explains 120, false alarms 7 (gain 22.91)`; then `+ !p:Scene: explains 76, false alarms 0 (gain 6.22)`.

Sources (76; first 5):
- `work:c006/probes/round1-26b1bfa4dffc.x3d` (confirm: Transform@translation <- '1 2 3 4 5 6 7')
- `work:c006/probes/round1-d69122306679.x3d` (confirm: Transform@translation <- ' 1 1e 1 , 1 1e 1 ')
- `work:c006/probes/round1-81fa9078469a.x3d` (confirm: Transform@translation <- ' 1 1e 1 , 1 1e 1 ')
- `work:c006/probes/round1-616aac101942.x3d` (value: Transform@translation <- ' 1 1e 1 , 1 1e 1 , 1 1e 1 , 1 1e 1 ' (live: ' 1 1e 1 , 1 1e 1 ' failed here))
- `work:c006/probes/round1-2a0065f831e9.x3d` (value: Transform@translation <- ' 1 1e 1 , 1 1e 1   1 1e 1 , 1 1e 1 ' (live: ' 1 1e 1 , 1 1e 1 ' failed here))

#### S (Suspected) `r2r-5049a0d800aa`

> At one attribute where the place is Transform translation: the largest component is at least 5 and the value has the wrong number of components for its field type, unless its element also has the attribute rotation.

`{"all": ["ge:max:5", "v:arity_mismatch", "!e.has:rotation", "at:Transform@translation"], "kind": "attr"}`

Grade reasons: 1 audit prediction(s) were wrong: the rule fired and the instrument passed. Closure: **open** (0 audit probe(s) and 2+ held-out failure(s) failed with this signature where no rule of the cluster fired).

| Test | Result |
|---|---|
| Source failures explained at the changed site | 30 of 149 (149 with a known-good twin; observed by 149 tool) |
| Fires on files the instrument passed | 0 of 2162 |
| Held-out failures caught (content-disjoint) | 0 of 2 |
| Held-out false alarms | 0 of 1416 |
| Audit probes (built after the rule was fixed) | 23 predictions came true, 1 wrong, 0 failures the cluster's rules missed, 189 correctly silent, 153 failed another way |
| Degenerate files it fires on | none of 8 |
| Already covered by an existing Loom trap | 0 of 30 checked |

Probe rounds: 1: 8 confirm/confirmed, 2 confirm/refuted, 8 value/confirmed, 2 value/refuted, 1 widen/other-failure, 15 widen/silent-ok; 2: 4 alternate/confirmed, 2 alternate/silent-ok, 25 confirm/confirmed, 4 confirm/refuted, 9 near/missed, 3 near/silent-ok, 27 value/confirmed, 3 value/refuted, 1 widen/other-failure, 38 widen/silent-ok; 3: 6 alternate/confirmed, 6 bisect/missed, 27 confirm/confirmed, 3 confirm/refuted, 12 near/silent-ok, 27 value/confirmed, 1 widen/other-failure, 47 widen/silent-ok; audit: 6 alternate/confirmed, 6 bisect/confirmed, 35 confirm/confirmed, 5 confirm/refuted, 21 near/silent-ok, 40 value/confirmed, 1 widen/other-failure, 63 widen/silent-ok.

Seen at 1 place(s): Transform@translation.
Unfenced reading `attr[ge:max:5 & v:arity_mismatch & !e.has:rotation]`: contradicted by passing files (42 false alarm(s) on known-good files).
Threshold `ge:max:5`: last value seen to pass 1.0, first seen to fail 5.0; nothing between was tested.
Normative reading: every explained failure also has `v:arity_long` (the value has too many components for its field type); 31 passing file(s) have it too inside the fence.
Normative reading: every explained failure also has `v:arity_mismatch` (the value has the wrong number of components for its field type); 42 passing file(s) have it too inside the fence.
Normative reading: every explained failure also has `v:lexical_invalid` (the value does not have the written form its field type requires); 49 passing file(s) have it too inside the fence.

Alternates the receipts could not rule out (8):
- `attr[ge:max_abs:5 & v:arity_mismatch & !e.has:rotation & at:Transform@translation]`
- `attr[ge:max:5 & !e.has:rotation & at:Transform@translation & ntok:many]`
- `attr[ge:max:5 & !e.has:rotation & at:Transform@translation & nws:many]`
- `attr[ge:max_abs:5 & !e.has:rotation & at:Transform@translation & ntok:many]`

Ablation (drop one literal, count again):

| Dropped | Role | False alarms without it | Failures explained without it |
|---|---|---:|---:|
| `ge:max:5` | test | 20 | 112 |
| `v:arity_mismatch` | test | 92 | 30 |
| `!e.has:rotation` | guard | 5 | 42 |
| `at:Transform@translation` | context | 42 | 30 |

How the rule was reached: `seed ge:max:5, fenced to at:Transform@translation: explains 42, false alarms 1409`; then `+ v:arity_mismatch: explains 42, false alarms 5 (gain 142.61)`; then `+ !e.has:rotation: explains 30, false alarms 0 (gain 4.87)`.

Sources (30; first 5):
- `work:c006/probes/round1-26b1bfa4dffc.x3d` (confirm: Transform@translation <- '1 2 3 4 5 6 7')
- `work:c006/probes/round2-f1be773f3ec5.x3d` (confirm: Transform@translation <- '1 2 3 4 5 6 7 1 2 3 4 5 6 7')
- `work:c006/probes/round2-a9b0bc973233.x3d` (confirm: Transform@translation <- '1 2 3 4 5 6 7 1 2 3 4 5 6 7')
- `work:c006/probes/round2-cb5c1fa277c8.x3d` (confirm: Transform@translation <- '1 2 3 4 5 6 7')
- `work:c006/probes/round2-8a58888829ec.x3d` (value: Transform@translation <- ' 1 2 3 4 5 6 7 1 2 3 4 5 6 7 ' (live: '1 2 3 4 5 6 7 1 2 3 4 5 6 7' failed here))

#### S (Suspected) `r2r-018873e9ca67`

> At one attribute where the place is Transform translation: the number of tokens is at least 12, unless its element has a TransformSensor child or a token is wrapped in quotation marks where the field is not a string.

`{"all": ["ge:ntok:12", "!e.child:TransformSensor", "!v:quoted", "at:Transform@translation"], "kind": "attr"}`

Grade reasons: 4 audit prediction(s) were wrong: the rule fired and the instrument passed. Closure: **open** (0 audit probe(s) and 2+ held-out failure(s) failed with this signature where no rule of the cluster fired).

| Test | Result |
|---|---|
| Source failures explained at the changed site | 74 of 149 (149 with a known-good twin; observed by 149 tool) |
| Fires on files the instrument passed | 0 of 2162 |
| Held-out failures caught (content-disjoint) | 0 of 2 |
| Held-out false alarms | 0 of 1416 |
| Audit probes (built after the rule was fixed) | 58 predictions came true, 4 wrong, 0 failures the cluster's rules missed, 186 correctly silent, 153 failed another way |
| Degenerate files it fires on | none of 8 |
| Already covered by an existing Loom trap | 0 of 60 checked |

Probe rounds: 1: 8 confirm/confirmed, 2 confirm/refuted, 8 value/confirmed, 2 value/refuted, 1 widen/other-failure, 15 widen/silent-ok; 2: 4 alternate/confirmed, 2 alternate/silent-ok, 25 confirm/confirmed, 4 confirm/refuted, 9 near/missed, 3 near/silent-ok, 27 value/confirmed, 3 value/refuted, 1 widen/other-failure, 38 widen/silent-ok; 3: 6 alternate/confirmed, 6 bisect/missed, 27 confirm/confirmed, 3 confirm/refuted, 12 near/silent-ok, 27 value/confirmed, 1 widen/other-failure, 47 widen/silent-ok; audit: 6 alternate/confirmed, 6 bisect/confirmed, 35 confirm/confirmed, 5 confirm/refuted, 21 near/silent-ok, 40 value/confirmed, 1 widen/other-failure, 63 widen/silent-ok.

Seen at 1 place(s): Transform@translation.
Unfenced reading `attr[ge:ntok:12 & !e.child:TransformSensor & !v:quoted]`: contradicted by passing files (1803 false alarm(s) on known-good files).
Threshold `ge:ntok:12`: last value seen to pass 7, first seen to fail 12.0; nothing between was tested.
Normative reading: every explained failure also has `v:arity_long` (the value has too many components for its field type); 31 passing file(s) have it too inside the fence.
Normative reading: every explained failure also has `v:arity_mismatch` (the value has the wrong number of components for its field type); 42 passing file(s) have it too inside the fence.
Normative reading: every explained failure also has `v:lexical_invalid` (the value does not have the written form its field type requires); 49 passing file(s) have it too inside the fence.

Alternates the receipts could not rule out (5):
- `attr[ge:len:19 & v:lexical_invalid & !e.child:TransformSensor & !v:tok:" & at:Transform@translation]`
- `attr[ge:len:19 & !e.child:TransformSensor & !v:tok:" & at:Transform@translation & ntok:many]`
- `attr[ge:len:19 & !e.child:TransformSensor & !v:tok:" & at:Transform@translation & nws:many]`
- `attr[ge:ntok:12 & !v:tok:" & at:Transform@translation & e.child:Shape]`

Ablation (drop one literal, count again):

| Dropped | Role | False alarms without it | Failures explained without it |
|---|---|---:|---:|
| `ge:ntok:12` | test | 1856 | 120 |
| `!e.child:TransformSensor` | guard | 1 | 74 |
| `!v:quoted` | guard | 11 | 79 |
| `at:Transform@translation` | context | 1803 | 74 |

How the rule was reached: `seed ge:ntok:12, fenced to at:Transform@translation: explains 79, false alarms 12`; then `+ !v:quoted: explains 74, false alarms 1 (gain 13.66)`; then `+ !e.child:TransformSensor: explains 74, false alarms 0 (gain 1.43)`.

Sources (74; first 5):
- `work:c006/probes/round1-a95506bfc2a0.x3d` (value: Transform@translation <- '1 2 3 4 5 6 7 1 2 3 4 5 6 7' (live: '1 2 3 4 5 6 7' failed here))
- `work:c006/probes/round1-616aac101942.x3d` (value: Transform@translation <- ' 1 1e 1 , 1 1e 1 , 1 1e 1 , 1 1e 1 ' (live: ' 1 1e 1 , 1 1e 1 ' failed here))
- `work:c006/probes/round1-2a0065f831e9.x3d` (value: Transform@translation <- ' 1 1e 1 , 1 1e 1   1 1e 1 , 1 1e 1 ' (live: ' 1 1e 1 , 1 1e 1 ' failed here))
- `work:c006/probes/round1-2dd4462c701a.x3d` (value: Transform@translation <- ' 1 1e 1 , 1 1e 1 , 1 1e 1 , 1 1e 1 ' (live: ' 1 1e 1 , 1 1e 1 ' failed here))
- `work:c006/probes/round2-f489f3c151ba.x3d` (value: Transform@translation <- ' 1 1E 1 , 1 1E 1 , 1 1E 1 , 1 1E 1 ' (live: ' 1 1E 1 , 1 1E 1 ' failed here))

#### S (Suspected) `r2r-c0b70e49737d`

> At one attribute where the place is Transform translation: the length of the value is at least 19 and the value does not have the written form its field type requires, unless its element has a TransformSensor child or the value has the token `"`.

`{"all": ["ge:len:19", "v:lexical_invalid", "!e.child:TransformSensor", "!v:tok:\"", "at:Transform@translation"], "kind": "attr"}`

Grade reasons: 5 audit prediction(s) were wrong: the rule fired and the instrument passed; leans on literal values (a fingerprint): the vocabulary lacks a word for what they share. Closure: **open** (0 audit probe(s) and 2+ held-out failure(s) failed with this signature where no rule of the cluster fired).

| Test | Result |
|---|---|
| Source failures explained at the changed site | 97 of 149 (149 with a known-good twin; observed by 149 tool) |
| Fires on files the instrument passed | 0 of 2162 |
| Held-out failures caught (content-disjoint) | 0 of 2 |
| Held-out false alarms | 0 of 1416 |
| Audit probes (built after the rule was fixed) | 82 predictions came true, 5 wrong, 0 failures the cluster's rules missed, 185 correctly silent, 153 failed another way |
| Degenerate files it fires on | none of 8 |
| Already covered by an existing Loom trap | 0 of 60 checked |

Probe rounds: 1: 8 confirm/confirmed, 2 confirm/refuted, 8 value/confirmed, 2 value/refuted, 1 widen/other-failure, 15 widen/silent-ok; 2: 4 alternate/confirmed, 2 alternate/silent-ok, 25 confirm/confirmed, 4 confirm/refuted, 9 near/missed, 3 near/silent-ok, 27 value/confirmed, 3 value/refuted, 1 widen/other-failure, 38 widen/silent-ok; 3: 6 alternate/confirmed, 6 bisect/missed, 27 confirm/confirmed, 3 confirm/refuted, 12 near/silent-ok, 27 value/confirmed, 1 widen/other-failure, 47 widen/silent-ok; audit: 6 alternate/confirmed, 6 bisect/confirmed, 35 confirm/confirmed, 5 confirm/refuted, 21 near/silent-ok, 40 value/confirmed, 1 widen/other-failure, 63 widen/silent-ok.

Seen at 1 place(s): Transform@translation.
Unfenced reading `attr[ge:len:19 & v:lexical_invalid & !e.child:TransformSensor & !v:tok:"]`: contradicted by passing files (92 false alarm(s) on known-good files).
Threshold `ge:len:19`: last value seen to pass 17, first seen to fail 19.0; nothing between was tested.
Normative reading: every explained failure also has `v:arity_long` (the value has too many components for its field type); 31 passing file(s) have it too inside the fence.
Normative reading: every explained failure also has `v:arity_mismatch` (the value has the wrong number of components for its field type); 42 passing file(s) have it too inside the fence.
Normative reading: every explained failure also has `v:lexical_invalid` (the value does not have the written form its field type requires); 49 passing file(s) have it too inside the fence.

Alternates the receipts could not rule out (2):
- `attr[ge:len:19 & !e.child:TransformSensor & !v:tok:" & at:Transform@translation & ntok:many]`
- `attr[ge:len:19 & !e.child:TransformSensor & !v:tok:" & at:Transform@translation & nws:many]`

Ablation (drop one literal, count again):

| Dropped | Role | False alarms without it | Failures explained without it |
|---|---|---:|---:|
| `ge:len:19` | test | 25 | 149 |
| `v:lexical_invalid` | test | 33 | 97 |
| `!e.child:TransformSensor` | guard | 2 | 97 |
| `!v:tok:"` | guard | 22 | 97 |
| `at:Transform@translation` | context | 92 | 97 |

How the rule was reached: `seed ge:len:19, fenced to at:Transform@translation: explains 97, false alarms 57`; then `+ v:lexical_invalid: explains 97, false alarms 24 (gain 33.75)`; then `+ !v:tok:": explains 97, false alarms 2 (gain 28.08)`; then `+ !e.child:TransformSensor: explains 97, false alarms 0 (gain 2.86)`.

Sources (97; first 5):
- `work:c006/probes/round1-a95506bfc2a0.x3d` (value: Transform@translation <- '1 2 3 4 5 6 7 1 2 3 4 5 6 7' (live: '1 2 3 4 5 6 7' failed here))
- `work:c006/probes/round1-dd0896ec3cc8.x3d` (value: Transform@translation <- '  1 1e 1 , 1 1e 1  ' (live: ' 1 1e 1 , 1 1e 1 ' failed here))
- `work:c006/probes/round1-616aac101942.x3d` (value: Transform@translation <- ' 1 1e 1 , 1 1e 1 , 1 1e 1 , 1 1e 1 ' (live: ' 1 1e 1 , 1 1e 1 ' failed here))
- `work:c006/probes/round1-2a0065f831e9.x3d` (value: Transform@translation <- ' 1 1e 1 , 1 1e 1   1 1e 1 , 1 1e 1 ' (live: ' 1 1e 1 , 1 1e 1 ' failed here))
- `work:c006/probes/round1-2dd4462c701a.x3d` (value: Transform@translation <- ' 1 1e 1 , 1 1e 1 , 1 1e 1 , 1 1e 1 ' (live: ' 1 1e 1 , 1 1e 1 ' failed here))

### `ValueError at export_x3d.py:2111 _modern_writer`

Instrument: x3d-blender-io 2.7.1 import then export (bpy 5.3.0). 32 distinct failing file(s) in training (2 events), 0 held-out event(s). Probed with the real instrument.
- **Residue: 1 failure(s) no rule explains.** `repos:x3d_mcp/tests/fixtures/scene_rdf/MetadataNodeExamplesX3D4.x3d`

#### C (Confirmed) `r2r-ac96dfe7dbc3`

> At one attribute where the value has 1 token(s): a component is below the minimum the X3DUOM declares, at one of 7 places (Cone bottomRadius, Cone height, GeoViewpoint fieldOfView, PointLight radius, Sphere radius, SpotLight radius, Viewpoint fieldOfView).

`{"all": ["v:below_min", "ntok:1"], "any": ["at:Cone@bottomRadius", "at:Cone@height", "at:GeoViewpoint@fieldOfView", "at:PointLight@radius", "at:Sphere@radius", "at:SpotLight@radius", "at:Viewpoint@fieldOfView"], "kind": "attr"}`

Grade reasons: 20 audit probe(s) confirmed, 0 refuted; 0 false alarms in 1962 known-good files. Closure: **open** (2 audit probe(s) and 0+ held-out failure(s) failed with this signature where no rule of the cluster fired).

| Test | Result |
|---|---|
| Source failures explained at the changed site | 31 of 32 (31 with a known-good twin; observed by 32 tool) |
| Fires on files the instrument passed | 0 of 1962 |
| Held-out failures caught (content-disjoint) | none to test |
| Held-out false alarms | 0 of 1409 |
| Audit probes (built after the rule was fixed) | 20 predictions came true, 0 wrong, 2 failures the cluster's rules missed, 85 correctly silent, 76 failed another way |
| Degenerate files it fires on | none of 8 |
| Already covered by an existing Loom trap | 0 of 31 checked |

Probe rounds: 1: 1 confirm/refuted, 16 widen/silent-ok; 2: 2 confirm/confirmed, 2 near/silent-ok, 2 value/confirmed, 4 value/refuted, 5 widen/missed, 11 widen/silent-ok; 3: 10 confirm/confirmed, 8 near/silent-ok, 10 value/confirmed, 1 widen/missed, 15 widen/silent-ok; audit: 10 confirm/confirmed, 2 near/missed, 6 near/silent-ok, 10 value/confirmed, 16 widen/silent-ok.

Seen at 7 place(s): Cone@bottomRadius, Cone@height, GeoViewpoint@fieldOfView, PointLight@radius, Sphere@radius, SpotLight@radius, Viewpoint@fieldOfView.
Unfenced reading `attr[v:below_min & ntok:1]`: contradicted by passing files (31 false alarm(s) on known-good files).
Normative reading: every explained failure also has `v:below_min` (a component is below the minimum the X3DUOM declares); 10 passing file(s) have it too inside the fence.
Normative reading: every explained failure also has `v:out_of_range` (a component is outside the range the X3DUOM declares); 11 passing file(s) have it too inside the fence.

Alternates the receipts could not rule out (8):
- `attr[le:ntok:1 & v:below_min & (one of 7 places)]`
- `attr[v:out_of_range & ntok:1 & (one of 7 places)]`
- `attr[le:ntok:1 & v:out_of_range & (one of 7 places)]`
- `attr[v:below_min & !v:lexical_invalid & (one of 7 places)]`

Ablation (drop one literal, count again):

| Dropped | Role | False alarms without it | Failures explained without it |
|---|---|---:|---:|
| `v:below_min` | test | 452 | 31 |
| `ntok:1` | context | 10 | 31 |
| `(the list of 7 places)` | fence | 31 | 31 |

How the rule was reached: `seed v:below_min, fenced to 7 place(s): explains 31, false alarms 10`; then `+ ntok:1: explains 31, false alarms 0 (gain 12.50)`.

Sources (31; first 5):
- `chaos:2.7.1-rng11/mutants/four_lights__045__num_extreme.x3d` (num_extreme: X3D/Scene/Transform#OB_Point/PointLight#LA_Point radius: token 0 40 -> -1)
- `work:c007/probes/round2-f158c9031314.x3d` (confirm: PointLight@radius <- '-1')
- `work:c007/probes/round2-e57c2320121b.x3d` (confirm: PointLight@radius <- '-1')
- `work:c007/probes/round2-512e6606ce66.x3d` (widen: SpotLight@radius <- '-1')
- `work:c007/probes/round2-19f5f46c21d8.x3d` (widen: Sphere@radius <- '-1')

### `AttributeError at import_x3d.py:1904 importMesh_ReadVertices`

Instrument: x3d-blender-io 2.7.1 importer (bpy 5.3.0). 2 distinct failing file(s) in training (2 events), 0 held-out event(s). Probed with the real instrument.

#### L (Likely) `r2r-d261dd67c562`

> At one element where the node is CoordinateDouble: the node is present.

`{"all": ["x:present", "n:CoordinateDouble"], "kind": "elem"}`

Grade reasons: nothing unseen has confirmed it: 0 audit probe(s) confirmed (need 5); 0 held-out failure(s) (need 5). Closure: **closed-so-far** (190 audit probe(s) outside the rule all passed).

| Test | Result |
|---|---|
| Source failures explained at the changed site | 2 of 2 (0 with a known-good twin; observed by 2 tool) |
| Fires on files the instrument passed | 0 of 2167 |
| Held-out failures caught (content-disjoint) | none to test |
| Held-out false alarms | 0 of 1416 |
| Audit probes (built after the rule was fixed) | 0 predictions came true, 0 wrong, 0 failures the cluster's rules missed, 190 correctly silent, 240 failed another way |
| Degenerate files it fires on | none of 8 |
| Already covered by an existing Loom trap | 0 of 2 checked |

Probe rounds: 1: ; audit: .

Seen at 1 place(s): CoordinateDouble.
Unfenced reading `elem[x:present]`: contradicted by passing files (2167 false alarm(s) on known-good files).

Alternates the receipts could not rule out (6):
- `attr[v:present & at:CoordinateDouble@point & t:MFVec3d]`
- `elem[x:present & isa:X3DCoordinateNode & n:CoordinateDouble]`
- `attr[v:present & isa:X3DCoordinateNode & (one of 2 places)]`
- `elem[x:present & isa:X3DGeometricPropertyNode & n:CoordinateDouble]`
Literals whose removal changes nothing on this evidence: `x:present`.

Ablation (drop one literal, count again):

| Dropped | Role | False alarms without it | Failures explained without it |
|---|---|---:|---:|
| `x:present` | test | 0 | 2 |
| `n:CoordinateDouble` | context | 2167 | 2 |

How the rule was reached: `seed x:present, fenced to 15 place(s): explains 2, false alarms 2167`; then `+ n:CoordinateDouble: explains 2, false alarms 0 (gain 15.30)`.

Sources (2; first 2):
- `repos:x3d.loom/x3d.webgpu/bridge/fixtures/CoordinateDouble.x3d` ()
- `repos:x3d.loom/x3d.threejs/bridge/fixtures/CoordinateDouble.x3d` ()

### `IndexError at import_x3d.py:1666 translateScale`

Instrument: x3d-blender-io 2.7.1 importer (bpy 5.3.0). 89 distinct failing file(s) in training (1 events), 1 held-out event(s). Probed with the real instrument.
- **Residue: 15 failure(s) no rule explains.** `num_extreme: X3D/Scene/Transform#OB_Floor scale: token 2 1 -> --1`; `confirm: Transform@scale <- '1 1 --1'`; `confirm: Transform@scale <- '1 1 --1'`; `confirm: Transform@scale <- '1 1 --1'`; `confirm: Transform@scale <- '1 1 --1'`

#### C (Confirmed) `r2r-f10d90dac48f`

> At one attribute where the place is Transform scale and the value has 3 token(s): a token is not a number in X3D's notation, unless the parent is Scene.

`{"all": ["v:number_unparseable", "!p:Scene", "at:Transform@scale", "ntok:3"], "kind": "attr"}`

Grade reasons: 20 audit probe(s) confirmed, 0 refuted; 0 false alarms in 2227 known-good files. Closure: **open** (0 audit probe(s) and 1+ held-out failure(s) failed with this signature where no rule of the cluster fired).

| Test | Result |
|---|---|
| Source failures explained at the changed site | 50 of 89 (89 with a known-good twin; observed by 89 tool) |
| Fires on files the instrument passed | 0 of 2227 |
| Held-out failures caught (content-disjoint) | 0 of 1 |
| Held-out false alarms | 0 of 1416 |
| Audit probes (built after the rule was fixed) | 20 predictions came true, 0 wrong, 0 failures the cluster's rules missed, 228 correctly silent, 241 failed another way |
| Degenerate files it fires on | none of 8 |
| Already covered by an existing Loom trap | 0 of 50 checked |

Probe rounds: 1: 6 alternate/missed, 7 confirm/confirmed, 3 confirm/refuted, 7 near/missed, 16 widen/silent-ok; 2: 6 alternate/missed, 4 confirm/confirmed, 6 confirm/refuted, 8 value/confirmed, 16 widen/silent-ok; 3: 6 alternate/confirmed, 5 alternate/missed, 1 alternate/silent-ok, 20 confirm/confirmed, 19 value/confirmed, 1 value/refuted, 17 widen/silent-ok; audit: 6 alternate/confirmed, 20 confirm/confirmed, 6 near/silent-ok, 19 value/confirmed, 1 value/refuted, 1 widen/other-failure, 31 widen/silent-ok.

Seen at 1 place(s): Transform@scale.
Unfenced reading `attr[v:number_unparseable & !p:Scene & ntok:3]`: contradicted by passing files (62 false alarm(s) on known-good files).
Normative reading: every explained failure also has `v:lexical_invalid` (the value does not have the written form its field type requires); 46 passing file(s) have it too inside the fence.
Normative reading: every explained failure also has `v:number_unparseable` (a token is not a number in X3D's notation); 31 passing file(s) have it too inside the fence.

Alternates the receipts could not rule out (3):
- `attr[le:ntok:3 & v:number_unparseable & !p:Scene & at:Transform@scale]`
- `attr[le:ntok:3 & v:number_unparseable & !p:Scene & a:scale & at:Transform@scale]`
- `attr[v:number_unparseable & !p:Scene & !v:tok:" & at:Transform@scale]`

Ablation (drop one literal, count again):

| Dropped | Role | False alarms without it | Failures explained without it |
|---|---|---:|---:|
| `v:number_unparseable` | test | 330 | 50 |
| `!p:Scene` | guard | 15 | 61 |
| `at:Transform@scale` | context | 62 | 50 |
| `ntok:3` | context | 5 | 74 |

How the rule was reached: `seed le:ntok:3, fenced to 2 place(s): explains 88, false alarms 1899`; then `+ v:number_unparseable: explains 61, false alarms 24 (gain 138.64)`; then `+ !p:Scene: explains 50, false alarms 1 (gain 22.50)`; then `+ ntok:3: explains 50, false alarms 0 (gain 1.43)`; then `pruned le:ntok:3: no false alarm returns without it`.

Sources (50; first 5):
- `work:c009/probes/round1-7462cf1c6bb2.x3d` (confirm: Transform@scale <- '1 1 --1')
- `work:c009/probes/round1-7389c9719a3f.x3d` (confirm: Transform@scale <- '1 1 --1')
- `work:c009/probes/round1-e9a7f7abad18.x3d` (alternate:0: Transform@scale <- ' 1 1 --1 ' (live: '1 1 --1' failed here))
- `work:c009/probes/round1-f3ded46a8dd0.x3d` (alternate:0: Transform@scale <- ' 1 1 --1 ' (live: '1 1 --1' failed here))
- `work:c009/probes/round1-7f1adf79cae4.x3d` (near: Transform@scale <- '"1 1 --1"' (live: '1 1 --1' failed here))

#### S (Suspected) `r2r-61999795e8b4`

> At one attribute where the place is Transform scale: the number of tokens is at least 6, unless the parent is Scene.

`{"all": ["ge:ntok:6", "!p:Scene", "at:Transform@scale"], "kind": "attr"}`

Grade reasons: 4 audit prediction(s) were wrong: the rule fired and the instrument passed. Closure: **open** (0 audit probe(s) and 1+ held-out failure(s) failed with this signature where no rule of the cluster fired).

| Test | Result |
|---|---|
| Source failures explained at the changed site | 24 of 89 (89 with a known-good twin; observed by 89 tool) |
| Fires on files the instrument passed | 0 of 2227 |
| Held-out failures caught (content-disjoint) | 0 of 1 |
| Held-out false alarms | 0 of 1416 |
| Audit probes (built after the rule was fixed) | 25 predictions came true, 4 wrong, 0 failures the cluster's rules missed, 224 correctly silent, 241 failed another way |
| Degenerate files it fires on | none of 8 |
| Already covered by an existing Loom trap | 0 of 24 checked |

Probe rounds: 1: 6 alternate/missed, 7 confirm/confirmed, 3 confirm/refuted, 7 near/missed, 16 widen/silent-ok; 2: 6 alternate/missed, 4 confirm/confirmed, 6 confirm/refuted, 8 value/confirmed, 16 widen/silent-ok; 3: 6 alternate/confirmed, 5 alternate/missed, 1 alternate/silent-ok, 20 confirm/confirmed, 19 value/confirmed, 1 value/refuted, 17 widen/silent-ok; audit: 6 alternate/confirmed, 20 confirm/confirmed, 6 near/silent-ok, 19 value/confirmed, 1 value/refuted, 1 widen/other-failure, 31 widen/silent-ok.

Seen at 1 place(s): Transform@scale.
Unfenced reading `attr[ge:ntok:6 & !p:Scene]`: contradicted by passing files (1890 false alarm(s) on known-good files).
Threshold `ge:ntok:6`: last value seen to pass 5, first seen to fail 6.0; nothing between was tested.
Normative reading: every explained failure also has `v:arity_long` (the value has too many components for its field type); 16 passing file(s) have it too inside the fence.
Normative reading: every explained failure also has `v:arity_mismatch` (the value has the wrong number of components for its field type); 27 passing file(s) have it too inside the fence.
Normative reading: every explained failure also has `v:lexical_invalid` (the value does not have the written form its field type requires); 46 passing file(s) have it too inside the fence.
Normative reading: every explained failure also has `v:number_unparseable` (a token is not a number in X3D's notation); 31 passing file(s) have it too inside the fence.

Alternates the receipts could not rule out (7):
- `attr[ge:len:19 & v:lexical_invalid & !p:Scene & at:Transform@scale]`
- `attr[ge:len:19 & !p:Scene & at:Transform@scale & ntok:many]`
- `attr[ge:len:19 & !p:Scene & at:Transform@scale & nws:many]`
- `attr[ge:ntok:6 & v:number_unparseable & !v:tok:1e & at:Transform@scale]`

Ablation (drop one literal, count again):

| Dropped | Role | False alarms without it | Failures explained without it |
|---|---|---:|---:|
| `ge:ntok:6` | test | 335 | 74 |
| `!p:Scene` | guard | 11 | 28 |
| `at:Transform@scale` | context | 1890 | 24 |

How the rule was reached: `seed ge:ntok:6, fenced to at:Transform@scale: explains 28, false alarms 11`; then `+ !p:Scene: explains 24, false alarms 0 (gain 11.47)`.

Sources (24; first 5):
- `work:c009/probes/round2-486a263576b2.x3d` (alternate:1: Transform@scale <- '"1 1 --1","1 1 --1"' (live: '"1 1 --1"' failed here))
- `work:c009/probes/round2-53d3a6c8f7ae.x3d` (alternate:1: Transform@scale <- '"1 1 --1" "1 1 --1"' (live: '"1 1 --1"' failed here))
- `work:c009/probes/round2-b204848a29b5.x3d` (alternate:1: Transform@scale <- '"1 1 --1","1 1 --1"' (live: '"1 1 --1"' failed here))
- `work:c009/probes/round2-f6006c822384.x3d` (alternate:1: Transform@scale <- '"1 1 --1","1 1 --1"' (live: '"1 1 --1"' failed here))
- `work:c009/probes/round2-904932a78e1d.x3d` (alternate:1: Transform@scale <- '"1 1 --1","1 1 --1"' (live: '"1 1 --1"' failed here))

### `ValueError at viewpoint_fov.py:42 blender_camera_angle`

Instrument: x3d-blender-io 2.7.1 importer (bpy 5.3.0). 62 distinct failing file(s) in training (1 events), 0 held-out event(s). Probed with the real instrument.

#### C (Confirmed) `r2r-cbf17e0bb9ea`

> At one attribute: a number is infinite, at one of 2 places (GeoViewpoint fieldOfView, Viewpoint fieldOfView), unless the value has the wrong number of components for its field type.

`{"all": ["v:inf", "!v:arity_mismatch"], "any": ["at:GeoViewpoint@fieldOfView", "at:Viewpoint@fieldOfView"], "kind": "attr"}`

Grade reasons: 20 audit probe(s) confirmed, 0 refuted; 0 false alarms in 2297 known-good files. Closure: **open** (1 audit probe(s) and 0+ held-out failure(s) failed with this signature where no rule of the cluster fired).

| Test | Result |
|---|---|
| Source failures explained at the changed site | 62 of 62 (62 with a known-good twin; observed by 62 tool) |
| Fires on files the instrument passed | 0 of 2297 |
| Held-out failures caught (content-disjoint) | none to test |
| Held-out false alarms | 0 of 1416 |
| Audit probes (built after the rule was fixed) | 20 predictions came true, 0 wrong, 1 failures the cluster's rules missed, 251 correctly silent, 286 failed another way |
| Degenerate files it fires on | none of 8 |
| Already covered by an existing Loom trap | 0 of 60 checked |

Probe rounds: 1: 4 alternate/refuted, 2 alternate/silent-ok, 10 confirm/confirmed, 10 value/confirmed, 16 widen/silent-ok; 2: 10 confirm/confirmed, 8 near/silent-ok, 10 value/confirmed, 1 widen/other-failure, 15 widen/silent-ok; 3: 10 confirm/confirmed, 8 near/silent-ok, 10 value/confirmed, 1 widen/missed, 1 widen/other-failure, 14 widen/silent-ok; audit: 10 confirm/confirmed, 1 near/missed, 7 near/silent-ok, 10 value/confirmed, 16 widen/silent-ok.

Seen at 2 place(s): GeoViewpoint@fieldOfView, Viewpoint@fieldOfView.
Unfenced reading `attr[v:inf & !v:arity_mismatch]`: contradicted by passing files (41 false alarm(s) on known-good files).
Normative reading: every explained failure also has `v:lexical_invalid` (the value does not have the written form its field type requires); 25 passing file(s) have it too inside the fence.

Alternates the receipts could not rule out (8):
- `attr[ge:max_abs:inf & !v:arity_mismatch & (one of 2 places)]`
- `attr[v:inf & ntok:1 & (one of 2 places)]`
- `attr[v:nonfinite & !v:arity_mismatch & (one of 2 places)]`
- `attr[ge:max_abs:inf & ntok:1 & (one of 2 places)]`

Ablation (drop one literal, count again):

| Dropped | Role | False alarms without it | Failures explained without it |
|---|---|---:|---:|
| `v:inf` | test | 186 | 62 |
| `!v:arity_mismatch` | guard | 14 | 62 |
| `(the list of 2 places)` | fence | 41 | 62 |

How the rule was reached: `seed v:inf, fenced to 2 place(s): explains 62, false alarms 14`; then `+ !v:arity_mismatch: explains 62, false alarms 0 (gain 18.21)`.

Sources (62; first 5):
- `chaos:2.7.1-rng11/mutants/cameras__047__num_extreme.x3d` (num_extreme: X3D/Scene/Transform#OB_Persp/Viewpoint#CA_Persp fieldOfView: token 0 0.5632 -> INF)
- `work:c010/probes/round1-336bdf4be829.x3d` (confirm: Viewpoint@fieldOfView <- 'INF')
- `work:c010/probes/round1-1495ade9f94b.x3d` (confirm: Viewpoint@fieldOfView <- 'INF')
- `work:c010/probes/round1-a31a410a7374.x3d` (confirm: Viewpoint@fieldOfView <- 'INF')
- `work:c010/probes/round1-02cf788dad78.x3d` (confirm: Viewpoint@fieldOfView <- 'INF')

### `IndexError at import_x3d.py:1857 importMesh_ApplyColors`

**No receipt showed this failure. A probe of another cluster ran into it.**

Instrument: x3d-blender-io 2.7.1 importer (bpy 5.3.0). 30 distinct failing file(s) in training (6 events), 0 held-out event(s). Probed with the real instrument.
- One root cause? Rule `r2r-758326262381` also explains 2/1 failures of `IndexError at import_x3d.py:1927 importMesh_ApplyUVs`.

#### C (Confirmed) `r2r-21d944367a59`

> At one attribute where its element has a Color child: how far the largest index runs past the end of its list is at least 536870902, at one of 2 places (IndexedTriangleSet index, IndexedTriangleStripSet index).

`{"all": ["ge:index_excess:536870902", "e.child:Color"], "any": ["at:IndexedTriangleSet@index", "at:IndexedTriangleStripSet@index"], "kind": "attr"}`

Grade reasons: 11 audit probe(s) confirmed, 0 refuted; 0 false alarms in 2315 known-good files. Closure: **closed-so-far** (266 audit probe(s) outside the rule all passed).

| Test | Result |
|---|---|
| Source failures explained at the changed site | 22 of 30 (30 with a known-good twin; observed by 30 tool) |
| Fires on files the instrument passed | 0 of 2315 |
| Held-out failures caught (content-disjoint) | none to test |
| Held-out false alarms | 0 of 1416 |
| Audit probes (built after the rule was fixed) | 11 predictions came true, 0 wrong, 0 failures the cluster's rules missed, 266 correctly silent, 308 failed another way |
| Degenerate files it fires on | none of 8 |
| Already covered by an existing Loom trap | 0 of 22 checked |

Probe rounds: 1: 3 bisect/confirmed, 6 bisect/missed, 4 confirm/confirmed, 3 value/confirmed, 1 value/other-failure, 1 widen/other-failure, 4 widen/silent-ok; 2: 2 confirm/confirmed, 1 confirm/other-failure, 1 widen/missed, 3 widen/other-failure, 12 widen/silent-ok; 3: 6 bisect/confirmed, 2 confirm/confirmed, 3 widen/silent-ok; audit: 9 bisect/confirmed, 3 confirm/confirmed, 1 confirm/other-failure, 4 widen/other-failure, 15 widen/silent-ok.

Seen at 2 place(s): IndexedTriangleSet@index, IndexedTriangleStripSet@index.
Unfenced reading `attr[ge:index_excess:536870902 & e.child:Color]`: contradicted by passing files (15 false alarm(s) on known-good files).
Threshold `ge:index_excess:536870902`: last value seen to pass 0.0, first seen to fail 536870902.0; nothing between was tested.
Normative reading: every explained failure also has `v:index_out_of_range` (an index points past the end of the list it indexes); 21 passing file(s) have it too inside the fence.

Alternates the receipts could not rule out (8):
- `attr[ge:index_max:536870907 & e.child:Color & (one of 2 places)]`
- `attr[ge:max:536870907 & e.child:Color & (one of 2 places)]`
- `attr[ge:max_abs:536870907 & e.child:Color & (one of 2 places)]`
- `attr[v:index_out_of_range & e.child:Color & (one of 2 places)]`

Ablation (drop one literal, count again):

| Dropped | Role | False alarms without it | Failures explained without it |
|---|---|---:|---:|
| `ge:index_excess:536870902` | test | 22 | 22 |
| `e.child:Color` | context | 21 | 30 |
| `(the list of 2 places)` | fence | 15 | 22 |

How the rule was reached: `seed ge:index_excess:536870902, fenced to 2 place(s): explains 30, false alarms 21`; then `+ e.child:Color: explains 22, false alarms 0 (gain 16.84)`.

Sources (22; first 5):
- `work:c003/probes/round1-2cdc9259680f.x3d` (widen: IndexedTriangleStripSet@index <- '0 1 2 3 -1 1 4 5 2 -1 4 6 7 5 -1 6 8 9 7 -1 3 2 10 11 -1 2 5 12 10 -1 5 7 13 12 -1 7 9 14 13 -1 11 10 15 16 -1 10 12 17 15 -1 2147483647 13 18 17 -1 13 14 19 18 -1 16)
- `work:c003/probes/round2-b6004ee3654a.x3d` (widen: IndexedTriangleStripSet@index <- '0 2147483647 2 3 -1 0 2147483647 2 3 -1')
- `work:c003/probes/round3-5a79869a35d1.x3d` (widen: IndexedTriangleSet@index <- '0 2147483647 2 3 -1 0 2147483647 2 3 -1 0 2147483647 2 3 -1 0 2147483647 2 3 -1')
- `work:c003/probes/round3-dcd0d6f0eca2.x3d` (widen: IndexedTriangleStripSet@index <- '0 1 2 3 -1 4 5 6 7 -1 0 4 7 2147483634 -1 3 2 6 5 -1 0 3 5 4 -1 1 7 6 2 -1')
- `work:c011/probes/round1-f3c29e12d28a.x3d` (confirm: IndexedTriangleSet@index <- '0 1 2 3 -1 4 5 6 7 -1 0 4 7 2147483634 -1 3 2 6 5 -1 0 3 5 4 -1 1 7 6 2 -1')

#### C (Confirmed) `r2r-758326262381`

> At one attribute where it sits inside a Transform and the place is IndexedTriangleStripSet index: how far the largest index runs past the end of its list is at least 536870902, unless its element has a Normal child.

`{"all": ["ge:index_excess:536870902", "!e.child:Normal", "anc:Transform", "at:IndexedTriangleStripSet@index"], "kind": "attr"}`

Grade reasons: 10 audit probe(s) confirmed, 0 refuted; 0 false alarms in 2315 known-good files. Closure: **closed-so-far** (266 audit probe(s) outside the rule all passed).

| Test | Result |
|---|---|
| Source failures explained at the changed site | 14 of 30 (30 with a known-good twin; observed by 30 tool) |
| Fires on files the instrument passed | 0 of 2315 |
| Held-out failures caught (content-disjoint) | none to test |
| Held-out false alarms | 0 of 1416 |
| Audit probes (built after the rule was fixed) | 10 predictions came true, 0 wrong, 0 failures the cluster's rules missed, 266 correctly silent, 308 failed another way |
| Degenerate files it fires on | none of 8 |
| Already covered by an existing Loom trap | 0 of 14 checked |

Probe rounds: 1: 3 bisect/confirmed, 6 bisect/missed, 4 confirm/confirmed, 3 value/confirmed, 1 value/other-failure, 1 widen/other-failure, 4 widen/silent-ok; 2: 2 confirm/confirmed, 1 confirm/other-failure, 1 widen/missed, 3 widen/other-failure, 12 widen/silent-ok; 3: 6 bisect/confirmed, 2 confirm/confirmed, 3 widen/silent-ok; audit: 9 bisect/confirmed, 3 confirm/confirmed, 1 confirm/other-failure, 4 widen/other-failure, 15 widen/silent-ok.

Seen at 1 place(s): IndexedTriangleStripSet@index.
Unfenced reading `attr[ge:index_excess:536870902 & !e.child:Normal & anc:Transform]`: contradicted by passing files (38 false alarm(s) on known-good files).
Threshold `ge:index_excess:536870902`: last value seen to pass 0.0, first seen to fail 536870902.0; nothing between was tested.
Normative reading: every explained failure also has `v:index_out_of_range` (an index points past the end of the list it indexes); 6 passing file(s) have it too inside the fence.

Alternates the receipts could not rule out (8):
- `attr[ge:index_max:536870907 & !e.child:Normal & anc:Transform & at:IndexedTriangleStripSet@index]`
- `attr[ge:index_excess:536870907 & !e.child:Normal & !e.has:DEF & at:IndexedTriangleStripSet@index]`
- `attr[ge:index_max:536870910 & !e.child:Normal & !e.has:DEF & at:IndexedTriangleStripSet@index]`
- `attr[v:index_out_of_range & !e.child:Normal & !e.has:DEF & at:IndexedTriangleStripSet@index]`

Ablation (drop one literal, count again):

| Dropped | Role | False alarms without it | Failures explained without it |
|---|---|---:|---:|
| `ge:index_excess:536870902` | test | 16 | 14 |
| `!e.child:Normal` | guard | 3 | 14 |
| `anc:Transform` | context | 3 | 21 |
| `at:IndexedTriangleStripSet@index` | context | 38 | 23 |

How the rule was reached: `seed ge:index_excess:536870902, fenced to 2 place(s): explains 30, false alarms 21`; then `+ at:IndexedTriangleStripSet@index: explains 21, false alarms 6 (gain 8.46)`; then `+ !e.child:Normal: explains 21, false alarms 3 (gain 3.57)`; then `+ anc:Transform: explains 14, false alarms 0 (gain 2.70)`.

Sources (14; first 5):
- `work:c003/probes/round1-2cdc9259680f.x3d` (widen: IndexedTriangleStripSet@index <- '0 1 2 3 -1 1 4 5 2 -1 4 6 7 5 -1 6 8 9 7 -1 3 2 10 11 -1 2 5 12 10 -1 5 7 13 12 -1 7 9 14 13 -1 11 10 15 16 -1 10 12 17 15 -1 2147483647 13 18 17 -1 13 14 19 18 -1 16)
- `work:c003/probes/round2-d591833cb923.x3d` (widen: IndexedTriangleStripSet@index <- '0 2147483647 2 3 -1')
- `work:c003/probes/round3-dcd0d6f0eca2.x3d` (widen: IndexedTriangleStripSet@index <- '0 1 2 3 -1 4 5 6 7 -1 0 4 7 2147483634 -1 3 2 6 5 -1 0 3 5 4 -1 1 7 6 2 -1')
- `work:c003/probes/round3-bdfc843d7613.x3d` (widen: IndexedTriangleStripSet@index <- '0 2147483647 2 3 -1,0 2147483647 2 3 -1')
- `work:c011/probes/round1-5de09b73ce03.x3d` (confirm: IndexedTriangleStripSet@index <- '0 2147483647 2 3 -1 0 2147483647 2 3 -1 0 2147483647 2 3 -1 0 2147483647 2 3 -1')

### `RuntimeError at import_x3d.py:2253 importMesh_IndexedFaceSet`

**No receipt showed this failure. A probe of another cluster ran into it.**

Instrument: x3d-blender-io 2.7.1 importer (bpy 5.3.0). 31 distinct failing file(s) in training (5 events), 0 held-out event(s). Probed with the real instrument.

#### C (Confirmed) `r2r-4c6fe8b28cb1`

> At one attribute where the place is IndexedFaceSet coordIndex and its element has a Coordinate child: the largest index is at least 177662200 and how far the largest index runs past the end of its list is at most 440304889, unless the value does not have the written form its field type requires.

`{"all": ["ge:index_max:177662200", "le:index_excess:440304889", "!v:lexical_invalid", "at:IndexedFaceSet@coordIndex", "e.child:Coordinate"], "kind": "attr"}`

Grade reasons: 21 audit probe(s) confirmed, 0 refuted; 0 false alarms in 2352 known-good files. Closure: **open** (1 audit probe(s) and 0+ held-out failure(s) failed with this signature where no rule of the cluster fired).

| Test | Result |
|---|---|
| Source failures explained at the changed site | 31 of 31 (31 with a known-good twin; observed by 31 tool) |
| Fires on files the instrument passed | 0 of 2352 |
| Held-out failures caught (content-disjoint) | none to test |
| Held-out false alarms | 0 of 1416 |
| Audit probes (built after the rule was fixed) | 21 predictions came true, 0 wrong, 1 failures the cluster's rules missed, 283 correctly silent, 329 failed another way |
| Degenerate files it fires on | none of 8 |
| Already covered by an existing Loom trap | 0 of 31 checked |

Probe rounds: 1: 5 bisect/other-failure, 1 bisect/silent-ok, 4 confirm/confirmed, 4 confirm/other-failure, 2 confirm/refuted, 3 value/confirmed, 1 value/refuted, 2 widen/other-failure, 14 widen/silent-ok; 2: 4 bisect/other-failure, 2 bisect/silent-ok, 9 confirm/confirmed, 1 confirm/other-failure, 4 near/silent-ok, 10 value/confirmed, 4 widen/other-failure, 12 widen/silent-ok; audit: 3 bisect/confirmed, 3 bisect/other-failure, 7 confirm/confirmed, 3 confirm/other-failure, 3 near/silent-ok, 9 value/confirmed, 2 widen/other-failure, 14 widen/silent-ok.

Seen at 1 place(s): IndexedFaceSet@coordIndex.
Unfenced reading `attr[ge:index_max:177662200 & le:index_excess:440304889 & !v:lexical_invalid & e.child:Coordinate]`: contradicted by passing files (24 false alarm(s) on known-good files).
Threshold `ge:index_max:177662200`: last value seen to pass 128416656.0, first seen to fail 177662200.0; nothing between was tested.
Threshold `le:index_excess:440304889`: last value seen to pass 2147483632.0, first seen to fail 440304889.0; nothing between was tested.
Normative reading: every explained failure also has `v:index_out_of_range` (an index points past the end of the list it indexes); 72 passing file(s) have it too inside the fence.

Alternates the receipts could not rule out (8):
- `attr[ge:max:177662200 & le:index_excess:440304889 & !v:lexical_invalid & at:IndexedFaceSet@coordIndex & e.child:Coordinate]`
- `attr[ge:max_abs:177662200 & le:index_excess:440304889 & !v:lexical_invalid & at:IndexedFaceSet@coordIndex & e.child:Coordinate]`
- `attr[ge:index_max:177662200 & le:index_excess:440304889 & !v:number_unparseable & at:IndexedFaceSet@coordIndex & e.child:Coordinate]`
- `attr[ge:index_max:177662200 & le:index_excess:440304889 & !e.child:GeoCoordinate & !v:lexical_invalid & at:IndexedFaceSet@coordIndex]`

Ablation (drop one literal, count again):

| Dropped | Role | False alarms without it | Failures explained without it |
|---|---|---:|---:|
| `ge:index_max:177662200` | test | 1496 | 31 |
| `le:index_excess:440304889` | test | 3 | 31 |
| `!v:lexical_invalid` | guard | 5 | 31 |
| `at:IndexedFaceSet@coordIndex` | context | 24 | 31 |
| `e.child:Coordinate` | context | 2 | 31 |

How the rule was reached: `seed ge:index_max:177662200, fenced to at:IndexedFaceSet@coordIndex: explains 31, false alarms 20`; then `+ le:index_excess:440304889: explains 31, false alarms 7 (gain 13.16)`; then `+ !v:lexical_invalid: explains 31, false alarms 2 (gain 6.31)`; then `+ e.child:Coordinate: explains 31, false alarms 0 (gain 2.80)`.

Sources (31; first 5):
- `work:c003/probes/round1-c4f7df53db71.x3d` (bisect: IndexedFaceSet@coordIndex <- index_excess near 3.15462e+08)
- `work:c003/probes/round1-579c31229ba4.x3d` (bisect: IndexedFaceSet@coordIndex <- index_excess near 3.15462e+08)
- `work:c003/probes/round3-5076e0489d08.x3d` (bisect: IndexedFaceSet@coordIndex <- index_excess near 4.40305e+08)
- `work:c003/probes/round3-94a35e6ce918.x3d` (bisect: IndexedFaceSet@coordIndex <- index_excess near 3.08984e+08)
- `work:c003/probes/round3-6cc4551f885a.x3d` (bisect: IndexedFaceSet@coordIndex <- index_excess near 1.77662e+08)

### `IndexError at import_x3d.py:2231 importMesh_IndexedFaceSet`

**No receipt showed this failure. A probe of another cluster ran into it.**

Instrument: x3d-blender-io 2.7.1 importer (bpy 5.3.0). 42 distinct failing file(s) in training (5 events), 0 held-out event(s). Probed with the real instrument.

#### S (Suspected) `r2r-de23254b4dea`

> At one attribute where the place is IndexedFaceSet coordIndex and its element also has the attribute creaseAngle: how far the largest index runs past the end of its list is at least 20060965, unless the value does not have the written form its field type requires.

`{"all": ["ge:index_excess:20060965", "!v:lexical_invalid", "at:IndexedFaceSet@coordIndex", "e.has:creaseAngle"], "kind": "attr"}`

Grade reasons: 1 audit prediction(s) were wrong: the rule fired and the instrument passed. Closure: **open** (3 audit probe(s) and 0+ held-out failure(s) failed with this signature where no rule of the cluster fired).

| Test | Result |
|---|---|
| Source failures explained at the changed site | 42 of 42 (42 with a known-good twin; observed by 42 tool) |
| Fires on files the instrument passed | 0 of 2359 |
| Held-out failures caught (content-disjoint) | none to test |
| Held-out false alarms | 0 of 1416 |
| Audit probes (built after the rule was fixed) | 7 predictions came true, 1 wrong, 3 failures the cluster's rules missed, 284 correctly silent, 348 failed another way |
| Degenerate files it fires on | none of 8 |
| Already covered by an existing Loom trap | 0 of 42 checked |

Probe rounds: 1: 3 bisect/confirmed, 3 bisect/missed, 3 confirm/confirmed, 3 value/confirmed, 1 value/refuted, 2 widen/silent-ok; 2: 3 bisect/confirmed, 3 bisect/missed, 2 confirm/confirmed, 1 confirm/other-failure, 2 near/silent-ok, 6 value/confirmed; 3: 6 bisect/confirmed, 2 confirm/confirmed, 1 confirm/other-failure, 2 near/silent-ok, 6 value/confirmed; audit: 3 bisect/missed, 1 confirm/confirmed, 1 confirm/refuted, 1 near/silent-ok, 3 value/confirmed.

Seen at 1 place(s): IndexedFaceSet@coordIndex.
Unfenced reading `attr[ge:index_excess:20060965 & !v:lexical_invalid & e.has:creaseAngle]`: untested beyond the fence (0 false alarm(s) on known-good files).
Threshold `ge:index_excess:20060965`: last value seen to pass 999872.0, first seen to fail 20060965.0; nothing between was tested.
Normative reading: every explained failure also has `v:index_out_of_range` (an index points past the end of the list it indexes); 77 passing file(s) have it too inside the fence.

Alternates the receipts could not rule out (8):
- `attr[ge:index_max:20061278 & !v:lexical_invalid & at:IndexedFaceSet@coordIndex & e.has:creaseAngle]`
- `attr[ge:max:20061278 & !v:lexical_invalid & at:IndexedFaceSet@coordIndex & e.has:creaseAngle]`
- `attr[ge:max_abs:20061278 & !v:lexical_invalid & at:IndexedFaceSet@coordIndex & e.has:creaseAngle]`
- `attr[v:index_out_of_range & !v:lexical_invalid & at:IndexedFaceSet@coordIndex & e.child:TextureCoordinateGenerator]`

Ablation (drop one literal, count again):

| Dropped | Role | False alarms without it | Failures explained without it |
|---|---|---:|---:|
| `ge:index_excess:20060965` | test | 139 | 42 |
| `!v:lexical_invalid` | guard | 6 | 42 |
| `at:IndexedFaceSet@coordIndex` | context | 0 | 42 |
| `e.has:creaseAngle` | context | 13 | 42 |

How the rule was reached: `seed ge:index_excess:20060965, fenced to at:IndexedFaceSet@coordIndex: explains 42, false alarms 30`; then `+ e.has:creaseAngle: explains 42, false alarms 6 (gain 24.57)`; then `+ !v:lexical_invalid: explains 42, false alarms 0 (gain 8.09)`.

Sources (42; first 5):
- `work:c003/probes/round2-0725dc0fb2c7.x3d` (confirm: IndexedFaceSet@coordIndex <- '0 1 2 3 -1 1 4 5 2 -1 4 6 7 5 -1 6 8 9 7 -1 3 2 10 11 2147483647 2 5 12 10 -1 5 7 13 12 -1 7 9 14 13 -1 11 10 15 16 -1 10 12 17 15 -1 12 13 18 17 -1 13 14 19 18 -1 16 15 )
- `work:c003/probes/round3-154bb9c7f367.x3d` (confirm: IndexedFaceSet@coordIndex <- '0 2147483638 2 3 -1')
- `work:c003/probes/round3-374d37c45aac.x3d` (confirm: IndexedFaceSet@coordIndex <- '0 2147483647 2 3 -1,0 2147483647 2 3 -1')
- `work:c012/probes/round1-5a36aeab1cf2.x3d` (confirm: IndexedFaceSet@coordIndex <- '0 1 2 3 -1 1 4 5 2 -1 4 6 7 5 -1 6 8 9 7 -1 3 2 10 11 308983547 2 5 12 10 -1 5 7 13 12 -1 7 9 14 13 -1 11 10 15 16 -1 10 12 17 15 -1 12 13 18 17 -1 13 14 19 18 -1 16 15 2)
- `work:c012/probes/round2-b9d92ade41da.x3d` (confirm: IndexedFaceSet@coordIndex <- '0 315461922 2 3 -1 0 315461922 2 3 -1')

### `RuntimeError at import_x3d.py:2107 importMesh_IndexedTriangleFanSet`

**No receipt showed this failure. A probe of another cluster ran into it.**

Instrument: x3d-blender-io 2.7.1 importer (bpy 5.3.0). 4 distinct failing file(s) in training (4 events), 0 held-out event(s). Probed with the real instrument.

#### L (Likely) `r2r-88d9b63e43b3`

> At one attribute where the place is IndexedTriangleFanSet index: the number of tokens is at least 20.

`{"all": ["ge:ntok:20", "at:IndexedTriangleFanSet@index"], "kind": "attr"}`

Grade reasons: nothing unseen has confirmed it: 1 audit probe(s) confirmed (need 5); 0 held-out failure(s) (need 5). Closure: **closed-so-far** (299 audit probe(s) outside the rule all passed).

| Test | Result |
|---|---|
| Source failures explained at the changed site | 4 of 4 (4 with a known-good twin; observed by 4 tool) |
| Fires on files the instrument passed | 0 of 2376 |
| Held-out failures caught (content-disjoint) | none to test |
| Held-out false alarms | 0 of 1416 |
| Audit probes (built after the rule was fixed) | 1 predictions came true, 0 wrong, 0 failures the cluster's rules missed, 299 correctly silent, 359 failed another way |
| Degenerate files it fires on | none of 8 |
| Already covered by an existing Loom trap | 0 of 4 checked |

Probe rounds: 1: 16 widen/silent-ok; audit: 2 widen/other-failure, 14 widen/silent-ok.

Seen at 1 place(s): IndexedTriangleFanSet@index.
Unfenced reading `attr[ge:ntok:20]`: contradicted by passing files (1496 false alarm(s) on known-good files).
Threshold `ge:ntok:20`: last value seen to pass 11, first seen to fail 20.0; nothing between was tested.
Normative reading: every explained failure also has `v:index_out_of_range` (an index points past the end of the list it indexes); 1 passing file(s) have it too inside the fence.

Alternates the receipts could not rule out (8):
- `doc[ge:bytes:842 & ge:depth_max:6 & le:n_defs:0 & le:n_elements:12]`
- `doc[ge:bytes:842 & le:max_children:2 & le:max_nattrs:3 & le:n_elements:12]`
- `doc[ge:bytes:842 & le:max_children:2 & le:n_defs:0 & le:n_elements:12]`
- `attr[ge:len:79 & at:IndexedTriangleFanSet@index]`

Ablation (drop one literal, count again):

| Dropped | Role | False alarms without it | Failures explained without it |
|---|---|---:|---:|
| `ge:ntok:20` | test | 4 | 4 |
| `at:IndexedTriangleFanSet@index` | context | 1496 | 4 |

How the rule was reached: `seed ge:ntok:20, fenced to at:IndexedTriangleFanSet@index: explains 4, false alarms 0`.

Sources (4; first 4):
- `work:c003/probes/round1-f7821ed16c6d.x3d` (widen: IndexedTriangleFanSet@index <- '0 1 2 3 -1 1 4 5 2 -1 4 6 7 5 -1 6 8 9 7 -1 3 2 10 11 -1 2 5 12 10 -1 5 7 13 12 -1 7 9 14 13 -1 11 10 15 16 -1 10 12 17 15 -1 2147483647 13 18 17 -1 13 14 19 18 -1 16 1)
- `work:c003/probes/round3-3f3219460474.x3d` (widen: IndexedTriangleFanSet@index <- '0 1 2 3 -1 3 2 4 5 -1 5 4 6 7 -1 7 6 8 9 -1 9 8 10 11 -1 11 10 12 13 -1 13 12 14 15 -1 15 14 1622197949 0 -1 1 16 17 2 -1 2 17 18 4 -1 4 18 19 6 -1 6 19 20 8 -1 8 20 21)
- `work:c011/probes/round2-d379d130b36c.x3d` (widen: IndexedTriangleFanSet@index <- '0 1073741814 2 3 -1 0 2147483647 2 3 -1 0 2147483647 2 3 -1 0 2147483647 2 3 -1')
- `work:c012/probes/round1-4c7edc3ec45c.x3d` (widen: IndexedTriangleFanSet@index <- '0 1 2 3 -1 1 4 5 2 -1 4 6 7 5 -1 6 8 9 7 -1 3 2 10 11 308983547 2 5 12 10 -1 5 7 13 12 -1 7 9 14 13 -1 11 10 15 16 -1 10 12 17 15 -1 12 13 18 17 -1 13 14 19 18 -1 16 15)

### `IndexError at import_x3d.py:1927 importMesh_ApplyUVs`

**No receipt showed this failure. A probe of another cluster ran into it.**

Instrument: x3d-blender-io 2.7.1 importer (bpy 5.3.0). 9 distinct failing file(s) in training (3 events), 0 held-out event(s). Probed with the real instrument.

#### L (Likely) `r2r-a2a869510561`

> At one attribute where the place is IndexedTriangleStripSet index and its element has a TextureCoordinate child: how far the largest index runs past the end of its list is at least 19311468.

`{"all": ["ge:index_excess:19311468", "at:IndexedTriangleStripSet@index", "e.child:TextureCoordinate"], "kind": "attr"}`

Grade reasons: nothing unseen has confirmed it: 2 audit probe(s) confirmed (need 5); 0 held-out failure(s) (need 5). Closure: **closed-so-far** (300 audit probe(s) outside the rule all passed).

| Test | Result |
|---|---|
| Source failures explained at the changed site | 9 of 9 (9 with a known-good twin; observed by 9 tool) |
| Fires on files the instrument passed | 0 of 2380 |
| Held-out failures caught (content-disjoint) | none to test |
| Held-out false alarms | 0 of 1416 |
| Audit probes (built after the rule was fixed) | 2 predictions came true, 0 wrong, 0 failures the cluster's rules missed, 300 correctly silent, 358 failed another way |
| Degenerate files it fires on | none of 8 |
| Already covered by an existing Loom trap | 0 of 9 checked |

Probe rounds: 1: 3 bisect/missed, 1 confirm/confirmed, 1 widen/silent-ok; 2: 3 bisect/missed, 1 confirm/confirmed, 1 widen/other-failure, 1 widen/silent-ok; 3: 1 widen/silent-ok; audit: 1 widen/silent-ok.

Seen at 1 place(s): IndexedTriangleStripSet@index.
Unfenced reading `attr[ge:index_excess:19311468 & e.child:TextureCoordinate]`: contradicted by passing files (8 false alarm(s) on known-good files).
Threshold `ge:index_excess:19311468`: last value seen to pass 0.0, first seen to fail 19311468.0; nothing between was tested.
Normative reading: every explained failure also has `v:index_out_of_range` (an index points past the end of the list it indexes); 9 passing file(s) have it too inside the fence.

Alternates the receipts could not rule out (8):
- `attr[ge:index_max:19311471 & at:IndexedTriangleStripSet@index & e.child:TextureCoordinate]`
- `attr[ge:max:19311471 & at:IndexedTriangleStripSet@index & e.child:TextureCoordinate]`
- `attr[ge:max_abs:19311471 & at:IndexedTriangleStripSet@index & e.child:TextureCoordinate]`
- `attr[v:index_out_of_range & at:IndexedTriangleStripSet@index & e.child:TextureCoordinate]`

Ablation (drop one literal, count again):

| Dropped | Role | False alarms without it | Failures explained without it |
|---|---|---:|---:|
| `ge:index_excess:19311468` | test | 19 | 9 |
| `at:IndexedTriangleStripSet@index` | context | 8 | 9 |
| `e.child:TextureCoordinate` | context | 9 | 9 |

How the rule was reached: `seed ge:index_excess:19311468, fenced to at:IndexedTriangleStripSet@index: explains 9, false alarms 9`; then `+ e.child:TextureCoordinate: explains 9, false alarms 0 (gain 9.00)`.

Sources (9; first 5):
- `work:c003/probes/round2-ae20c73f891d.x3d` (widen: IndexedTriangleStripSet@index <- '0 1 2 3 -1 4 5 6 7 -1 0 4 7 2147483647 -1 3 2 6 5 -1 0 3 5 4 -1 1 7 6 2 -1')
- `work:c011/probes/round2-8fa5808011ab.x3d` (confirm: IndexedTriangleStripSet@index <- '0 1 2 3 -1 1 4 5 2 -1 4 6 7 5 -1 6 8 9 7 -1 3 2 10 11 -1 2 5 12 10 -1 5 7 13 12 -1 7 9 14 13 -1 11 10 15 16 -1 10 12 17 15 -1 2147483647 13 18 17 -1 13 14 19 18 -1 16)
- `work:c012/probes/round2-7e75d3f4707b.x3d` (widen: IndexedTriangleStripSet@index <- '0 1 2 3 -1 1 4 5 2 -1 4 6 7 5 -1 6 8 9 7 -1 3 2 10 11 308983547 2 5 12 10 -1 5 7 13 12 -1 7 9 14 13 -1 11 10 15 16 -1 10 12 17 15 -1 12 13 18 17 -1 13 14 19 18 -1 16 )
- `work:c015/probes/round1-dd0fbb0cae21.x3d` (bisect: IndexedTriangleStripSet@index <- index_excess near 2.31738e+08)
- `work:c015/probes/round1-11f8938a1422.x3d` (bisect: IndexedTriangleStripSet@index <- index_excess near 7.72459e+07)

### `ValueError at import_x3d.py:1678 translateTransform`

**No receipt showed this failure. A probe of another cluster ran into it.**

Instrument: x3d-blender-io 2.7.1 importer (bpy 5.3.0). 62 distinct failing file(s) in training (1 events), 0 held-out event(s). Probed with the real instrument.
- **Residue: 7 failure(s) no rule explains.** `confirm: Transform@center <- ' 1 1e 1 , 1 1e 1 '`; `confirm: Transform@center <- ' 1 1e 1 , 1 1e 1 '`; `confirm: Transform@center <- ' 1 1e 1 , 1 1e 1 '`; `confirm: Transform@center <- ' 1 1e 1 , 1 1e 1 '`; `alternate:3: Transform@center <- '  1 1e 1 , 1 1e 1  ' (live: ' 1 1e 1 , 1 1e 1 ' failed here)`

#### C (Confirmed) `r2r-c057e13c2f24`

> At one attribute where the place is Transform center: a token is not a number in X3D's notation, unless the parent is Scene or a token is wrapped in quotation marks where the field is not a string.

`{"all": ["v:number_unparseable", "!p:Scene", "!v:quoted", "at:Transform@center"], "kind": "attr"}`

Grade reasons: 20 audit probe(s) confirmed, 0 refuted; 0 false alarms in 2444 known-good files. Closure: **open** (1 audit probe(s) and 0+ held-out failure(s) failed with this signature where no rule of the cluster fired).

| Test | Result |
|---|---|
| Source failures explained at the changed site | 55 of 62 (62 with a known-good twin; observed by 62 tool) |
| Fires on files the instrument passed | 0 of 2444 |
| Held-out failures caught (content-disjoint) | none to test |
| Held-out false alarms | 0 of 1416 |
| Audit probes (built after the rule was fixed) | 20 predictions came true, 0 wrong, 1 failures the cluster's rules missed, 321 correctly silent, 359 failed another way |
| Degenerate files it fires on | none of 8 |
| Already covered by an existing Loom trap | 0 of 55 checked |

Probe rounds: 1: 6 alternate/confirmed, 8 confirm/confirmed, 2 confirm/refuted, 7 value/confirmed, 3 value/refuted, 1 widen/other-failure, 15 widen/silent-ok; 2: 10 confirm/confirmed, 8 near/silent-ok, 10 value/confirmed, 16 widen/silent-ok; 3: 10 confirm/confirmed, 5 near/silent-ok, 10 value/confirmed, 16 widen/silent-ok; audit: 10 confirm/confirmed, 5 near/silent-ok, 10 value/confirmed, 16 widen/silent-ok.

Seen at 1 place(s): Transform@center.
Unfenced reading `attr[v:number_unparseable & !p:Scene & !v:quoted]`: contradicted by passing files (169 false alarm(s) on known-good files).
Normative reading: every explained failure also has `v:arity_long` (the value has too many components for its field type); 18 passing file(s) have it too inside the fence.
Normative reading: every explained failure also has `v:arity_mismatch` (the value has the wrong number of components for its field type); 18 passing file(s) have it too inside the fence.
Normative reading: every explained failure also has `v:lexical_invalid` (the value does not have the written form its field type requires); 20 passing file(s) have it too inside the fence.
Normative reading: every explained failure also has `v:number_unparseable` (a token is not a number in X3D's notation); 20 passing file(s) have it too inside the fence.

Alternates the receipts could not rule out (8):
- `attr[v:arity_long & !p:Scene & !v:quoted & at:Transform@center]`
- `attr[v:arity_mismatch & !p:Scene & !v:quoted & at:Transform@center]`
- `attr[v:lexical_invalid & !p:Scene & !v:quoted & at:Transform@center]`
- `attr[v:has_comma & !p:Scene & !v:quoted & at:Transform@center]`
Literals whose removal changes nothing on this evidence: `v:number_unparseable`.

Ablation (drop one literal, count again):

| Dropped | Role | False alarms without it | Failures explained without it |
|---|---|---:|---:|
| `v:number_unparseable` | test | 0 | 55 |
| `!p:Scene` | guard | 4 | 62 |
| `!v:quoted` | guard | 16 | 55 |
| `at:Transform@center` | context | 169 | 55 |

How the rule was reached: `seed v:number_unparseable, fenced to at:Transform@center: explains 62, false alarms 20`; then `+ !v:quoted: explains 62, false alarms 4 (gain 19.42)`; then `+ !p:Scene: explains 55, false alarms 0 (gain 4.96)`.

Sources (55; first 5):
- `work:c005/probes/round3-d07df3a91007.x3d` (widen: Transform@center <- ' 1 1e 1 , 1 1e 1 ')
- `work:c016/probes/round1-41272f7a2a8b.x3d` (confirm: Transform@center <- ' 1 1e 1 , 1 1e 1 ')
- `work:c016/probes/round1-3e9c1acaf146.x3d` (confirm: Transform@center <- ' 1 1e 1 , 1 1e 1 ')
- `work:c016/probes/round1-ddcadb3fdd1e.x3d` (confirm: Transform@center <- ' 1 1e 1 , 1 1e 1 ')
- `work:c016/probes/round1-eead00b5580c.x3d` (confirm: Transform@center <- ' 1 1e 1 , 1 1e 1 ')

### `ValueError at import_x3d.py:4437 _arc_points`

**No receipt showed this failure. A probe of another cluster ran into it.**

Instrument: x3d-blender-io 2.7.1 importer (bpy 5.3.0). 28 distinct failing file(s) in training (1 events), 0 held-out event(s). Probed with the real instrument.

#### C (Confirmed) `r2r-b7cf987e340f`

> At one attribute: a number is infinite, at one of 2 places (Arc2D startAngle, ArcClose2D startAngle), unless the value has the wrong number of components for its field type.

`{"all": ["v:inf", "!v:arity_mismatch"], "any": ["at:Arc2D@startAngle", "at:ArcClose2D@startAngle"], "kind": "attr"}`

Grade reasons: 10 audit probe(s) confirmed, 0 refuted; 0 false alarms in 2506 known-good files. Closure: **open** (4 audit probe(s) and 0+ held-out failure(s) failed with this signature where no rule of the cluster fired).

| Test | Result |
|---|---|
| Source failures explained at the changed site | 25 of 28 (28 with a known-good twin; observed by 28 tool) |
| Fires on files the instrument passed | 0 of 2506 |
| Held-out failures caught (content-disjoint) | none to test |
| Held-out false alarms | 0 of 1416 |
| Audit probes (built after the rule was fixed) | 10 predictions came true, 0 wrong, 4 failures the cluster's rules missed, 359 correctly silent, 382 failed another way |
| Degenerate files it fires on | none of 8 |
| Already covered by an existing Loom trap | 0 of 25 checked |

Probe rounds: 1: 3 alternate/confirmed, 1 alternate/refuted, 2 alternate/silent-ok, 3 confirm/confirmed, 1 widen/missed, 15 widen/silent-ok; 2: 3 confirm/confirmed, 1 near/missed, 7 near/silent-ok, 8 value/confirmed, 16 widen/silent-ok; 3: 2 confirm/confirmed, 2 near/missed, 4 near/silent-ok, 5 value/confirmed, 16 widen/silent-ok; audit: 4 alternate/missed, 2 alternate/silent-ok, 6 confirm/confirmed, 2 near/confirmed, 6 near/silent-ok, 16 value/confirmed, 2 widen/other-failure, 30 widen/silent-ok.

Seen at 2 place(s): Arc2D@startAngle, ArcClose2D@startAngle.
Unfenced reading `attr[v:inf & !v:arity_mismatch]`: contradicted by passing files (81 false alarm(s) on known-good files).
Normative reading: every explained failure also has `v:lexical_invalid` (the value does not have the written form its field type requires); 14 passing file(s) have it too inside the fence.

Alternates the receipts could not rule out (8):
- `attr[ge:max_abs:inf & !v:arity_mismatch & (one of 2 places)]`
- `attr[v:nonfinite & !v:arity_mismatch & (one of 2 places)]`
- `attr[v:inf & ntok:1 & (one of 2 places)]`
- `attr[ge:max_abs:inf & ntok:1 & (one of 2 places)]`

Ablation (drop one literal, count again):

| Dropped | Role | False alarms without it | Failures explained without it |
|---|---|---:|---:|
| `v:inf` | test | 21 | 25 |
| `!v:arity_mismatch` | guard | 11 | 28 |
| `(the list of 2 places)` | fence | 81 | 25 |

How the rule was reached: `seed v:inf, fenced to 2 place(s): explains 28, false alarms 11`; then `+ !v:arity_mismatch: explains 25, false alarms 0 (gain 11.95)`.

Sources (25; first 5):
- `work:c010/probes/round3-8afe650cc415.x3d` (widen: Arc2D@startAngle <- 'INF')
- `work:c017/probes/round1-b93f02903ab2.x3d` (confirm: Arc2D@startAngle <- 'INF')
- `work:c017/probes/round1-1d02caeb886a.x3d` (confirm: Arc2D@startAngle <- 'INF')
- `work:c017/probes/round1-d89400a84424.x3d` (widen: ArcClose2D@startAngle <- 'INF')
- `work:c017/probes/round1-101097c36dfd.x3d` (alternate:3: Arc2D@startAngle <- ' INF ' (live: 'INF' failed here))

#### C (Confirmed) `r2r-616562eddf55`

> At one attribute where the value has 3 space-separated token(s): the value has a comma, at one of 2 places (Arc2D startAngle, ArcClose2D startAngle).

`{"all": ["v:has_comma", "nws:3"], "any": ["at:Arc2D@startAngle", "at:ArcClose2D@startAngle"], "kind": "attr"}`

Grade reasons: 14 audit probe(s) confirmed, 0 refuted; 0 false alarms in 2506 known-good files. Closure: **open** (4 audit probe(s) and 0+ held-out failure(s) failed with this signature where no rule of the cluster fired).

| Test | Result |
|---|---|
| Source failures explained at the changed site | 3 of 28 (28 with a known-good twin; observed by 28 tool) |
| Fires on files the instrument passed | 0 of 2506 |
| Held-out failures caught (content-disjoint) | none to test |
| Held-out false alarms | 0 of 1416 |
| Audit probes (built after the rule was fixed) | 14 predictions came true, 0 wrong, 4 failures the cluster's rules missed, 359 correctly silent, 382 failed another way |
| Degenerate files it fires on | none of 8 |
| Already covered by an existing Loom trap | 0 of 3 checked |

Probe rounds: 1: 3 alternate/confirmed, 1 alternate/refuted, 2 alternate/silent-ok, 3 confirm/confirmed, 1 widen/missed, 15 widen/silent-ok; 2: 3 confirm/confirmed, 1 near/missed, 7 near/silent-ok, 8 value/confirmed, 16 widen/silent-ok; 3: 2 confirm/confirmed, 2 near/missed, 4 near/silent-ok, 5 value/confirmed, 16 widen/silent-ok; audit: 4 alternate/missed, 2 alternate/silent-ok, 6 confirm/confirmed, 2 near/confirmed, 6 near/silent-ok, 16 value/confirmed, 2 widen/other-failure, 30 widen/silent-ok.

Seen at 2 place(s): Arc2D@startAngle, ArcClose2D@startAngle.
Unfenced reading `attr[v:has_comma & nws:3]`: contradicted by passing files (6 false alarm(s) on known-good files).
Normative reading: every explained failure also has `v:arity_long` (the value has too many components for its field type); 11 passing file(s) have it too inside the fence.
Normative reading: every explained failure also has `v:arity_mismatch` (the value has the wrong number of components for its field type); 11 passing file(s) have it too inside the fence.
Normative reading: every explained failure also has `v:lexical_invalid` (the value does not have the written form its field type requires); 14 passing file(s) have it too inside the fence.

Alternates the receipts could not rule out (8):
- `attr[v:has_comma & !nws:1 & (one of 2 places)]`
- `attr[ge:len:11 & v:has_comma & (one of 2 places)]`
- `attr[v:arity_mismatch & ntok:2 & nws:3 & (one of 2 places)]`
- `attr[v:arity_long & ntok:2 & nws:3 & (one of 2 places)]`

Ablation (drop one literal, count again):

| Dropped | Role | False alarms without it | Failures explained without it |
|---|---|---:|---:|
| `v:has_comma` | test | 3 | 3 |
| `nws:3` | context | 3 | 3 |
| `(the list of 2 places)` | fence | 6 | 3 |

How the rule was reached: `seed v:has_comma, fenced to 2 place(s): explains 3, false alarms 3`; then `+ nws:3: explains 3, false alarms 0 (gain 3.00)`.

Sources (3; first 3):
- `work:c017/probes/round2-5a8691755958.x3d` (near: Arc2D@startAngle <- ' INF , INF ' (live: ' INF ' failed here))
- `work:c017/probes/round3-f4d043d6e376.x3d` (near: ArcClose2D@startAngle <- ' INF , INF ' (live: ' INF ' failed here))
- `work:c017/probes/round3-3a5a9faf210f.x3d` (near: ArcClose2D@startAngle <- '  INF  ,  INF  ' (live: '  INF  ' failed here))
