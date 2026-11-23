# R2R run: x3d-blender-io 2.7.3 in bpy 5.3.0: chaos rounds and a sweep of 514 real files

Made 2026-11-23T06:30:08Z by loomkit.r2r 0.1.0 (source sha256 `096d1ce649f8b276`), X3DUOM 4.1 sha256 `4fc10e8e15c0d6cf`. No language model was used. Every rule below is a **candidate**: nothing here is promoted, and a grade is always relative to the instrument named.

**2 candidate rule(s) from 2 failure cluster(s): 0 Confirmed, 1 Likely, 1 Suspected.** 9252 events (passes and failures) over 2120 distinct files; 18.0 s.

How to read a grade. **C, Confirmed**: the failures were observed by a tool, the rule fires on no file the tool passed, and it called outcomes it had never seen (probes built after the rule was fixed, or held-out receipts). **L, Likely**: clean on what induction saw, but nothing unseen has tested it. **S, Suspected**: a prediction was wrong, or the rule leans on literal values, or the evidence is one failure. **Closure** is separate: `open` means failures of the same signature exist that no rule here fires on, so a Confirmed rule can still be incomplete.

Use the candidates as a pre-flight check: `kit/loom r2r check THIS_FOLDER FILE.x3d`. List what is still open: `kit/loom r2r needs THIS_FOLDER`.

## Instruments and what they said

| Instrument | Failed | Passed |
|---|---:|---:|
| x3d-blender-io 2.7.3 import then export (bpy 5.3.0) | 1 | 2463 |
| x3d-blender-io 2.7.3 importer (bpy 5.3.0) | 2 | 2432 |
| x3d-blender-io 2.7.3 own validator (does it crash?) | 0 | 1920 |
| x3d.py 4.0.65.8 through x3d-blender-io 2.7.3 validate.py (does it crash?) | 0 | 2434 |

- Instruments: the x3d-blender-io add-on at 2.7.3 (commit 8e56437) inside bpy 5.3.0 (Python 3.13): its importer, and its import followed by its export. Third instrument: x3d.py 4.0.65.8 as the add-on's validate.py at 2.7.3 calls it; a crash there is a crash of that pair, not of x3d.py alone.
- Chaos rounds: tools/chaos/differential.py of x3d-blender-io at main 8e56437 with the add-on source pinned to 2.7.3, 80 mutants per golden scene, six judges (the add-on's own validator, x3d.py 4.0.65.8, xmllint 20914 with x3d-4.0.xsd from the x3d_mcp fork at 4d433af, the Web3D X3D Schematron through SaxonC, bpy 5.3.0 import, import then export). Cloud machine, 15 GB, 4 cores, no memory cap. Machine paths in the tracebacks were replaced by <addon>/, <site-packages>/ and <x3d-blender-io>/ before packing; nothing else was changed.
- Probes: the same instruments through kit/loomkit/r2r/drivers/blender_io.py under a 10 GB address-space cap. A threshold that is really a memory cliff is the cliff of that cap, not of every machine.
- Held out: the chaos rounds marked held (never used for induction), and the half of the real-file sweep whose sha256 is odd. Probe hosts come only from the other half.
- Sweep: every .x3d under the project's repositories on 23 Nov 2026 that is at most 2 MB (514 files), named as repos:<repository>/<path>.
- To repeat: unpack ../chaos-*.tar.xz into ../chaos, check the repositories out side by side, and give --root bpyenv=... (a venv with bpy 5.3.0 and x3d.py) and --root addon-src=... (the add-on source at each version under <version>/source).

## Receipts read

| Receipt | What | sha256 |
|---|---|---|
| `chaos:2.7.3-rng7/rows.json` | differential chaos round, add-on 2.7.3, rng 7: 960 one-edit mutants of the 12 golden scenes (training) | `a0e4486676fa50ad` |
| `chaos:2.7.3-rng101/rows.json` | differential chaos round, add-on 2.7.3, rng 101: 960 one-edit mutants of the 12 golden scenes (held out) | `f9a7abac1c77b0cc` |
| `sweep:2.7.3-import.jsonl` | 514 real project files through the 2.7.3 importer | `aee06e03ad5181e5` |
| `sweep:2.7.3-reexport.jsonl` | the same 514 files, import then export, add-on 2.7.3 | `7e05463972e02382` |
| `sweep:2.7.3-x3dpy.jsonl` | the same 514 files through x3d.py 4.0.65.8 as add-on 2.7.3 calls it | `b170f514aa2929c7` |

## Candidates at a glance

| Grade | Rule | Instrument and signature | Sources explained | Known-good false alarms | Held-out caught | Held-out false alarms | Audit probes right / wrong / missed | Closure |
|---|---|---|---:|---:|---:|---:|---:|---|
| **L** | [`r2r-d261dd67c562`](candidates/r2r-d261dd67c562.json) `elem[x:present & n:CoordinateDouble]` | x3d-blender-io 2.7.3 importer (bpy 5.3.0): `AttributeError at import_x3d.py:2038 importMesh_ReadVertices` | 2 of 2 | 0 of 1109 | none to test | 0 of 965 | 0 / 0 / 0 | untested |
| **S** | [`r2r-dc636828c7f3`](candidates/r2r-dc636828c7f3.json) `attr[v:use_before_def & (one of 3 places)]` | x3d-blender-io 2.7.3 import then export (bpy 5.3.0): `ValueError at export_x3d.py:2177 _modern_writer` | 1 of 1 | 0 of 1141 | none to test | 0 of 964 | 0 / 0 / 0 | untested |

## Clusters

### `AttributeError at import_x3d.py:2038 importMesh_ReadVertices`

Instrument: x3d-blender-io 2.7.3 importer (bpy 5.3.0). 2 distinct failing file(s) in training (2 events), 0 held-out event(s). Probed with the real instrument.

#### L (Likely) `r2r-d261dd67c562`

> At one element where the node is CoordinateDouble: the node is present.

`{"all": ["x:present", "n:CoordinateDouble"], "kind": "elem"}`

Grade reasons: nothing unseen has confirmed it: the prober has no experiment for a rule of this shape; 0 held-out failure(s) (need 5). Closure: **untested** (too few probes outside the rule to say).

| Test | Result |
|---|---|
| Source failures explained at the changed site | 2 of 2 (0 with a known-good twin; observed by 2 tool) |
| Fires on files the instrument passed | 0 of 1109 |
| Held-out failures caught (content-disjoint) | none to test |
| Held-out false alarms | 0 of 965 |
| Degenerate files it fires on | none of 8 |
| Already covered by an existing Loom trap | 0 of 2 checked |

Probe rounds: 1: ; audit: .

Seen at 1 place(s): CoordinateDouble.
Unfenced reading `elem[x:present]`: contradicted by passing files (1109 false alarm(s) on known-good files).

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
| `n:CoordinateDouble` | context | 1109 | 2 |

How the rule was reached: `seed x:present, fenced to 15 place(s): explains 2, false alarms 1109`; then `+ n:CoordinateDouble: explains 2, false alarms 0 (gain 15.30)`.

Sources (2; first 2):
- `repos:x3d.loom/x3d.webgpu/bridge/fixtures/CoordinateDouble.x3d` ()
- `repos:x3d.loom/x3d.threejs/bridge/fixtures/CoordinateDouble.x3d` ()

### `ValueError at export_x3d.py:2177 _modern_writer`

Instrument: x3d-blender-io 2.7.3 import then export (bpy 5.3.0). 1 distinct failing file(s) in training (1 events), 0 held-out event(s). Probed with the real instrument.

#### S (Suspected) `r2r-dc636828c7f3`

> At one attribute: a USE comes before its DEF, at one of 3 places (MetadataFloat USE, MetadataInteger USE, MetadataString USE).

`{"all": ["v:use_before_def"], "any": ["at:MetadataFloat@USE", "at:MetadataInteger@USE", "at:MetadataString@USE"], "kind": "attr"}`

Grade reasons: rests on one failure and no confirmed probe. Closure: **untested** (too few probes outside the rule to say).

| Test | Result |
|---|---|
| Source failures explained at the changed site | 1 of 1 (0 with a known-good twin; observed by 1 tool) |
| Fires on files the instrument passed | 0 of 1141 |
| Held-out failures caught (content-disjoint) | none to test |
| Held-out false alarms | 0 of 964 |
| Degenerate files it fires on | none of 8 |
| Already covered by an existing Loom trap | 1 of 1 checked (metadata-containerfield 1) |

Probe rounds: 1: 1 confirm/refuted, 16 widen/silent-ok; 2: ; audit: .

Seen at 3 place(s): MetadataFloat@USE, MetadataInteger@USE, MetadataString@USE.
Unfenced reading `attr[v:use_before_def]`: contradicted by passing files (66 false alarm(s) on known-good files).
Normative reading: every explained failure also has `v:use_before_def` (a USE comes before its DEF); 0 passing file(s) have it too inside the fence.

Alternates the receipts could not rule out (8):
- `elem[x:present & n:MetadataFloat]`
- `attr[v:enum_violation & anc:Anchor & at:FontStyle@justify]`
- `attr[v:extclass:other & at:Anchor@url & e.child:Shape]`
- `attr[v:extclass:other & at:Anchor@url & e.has:parameter]`
Literals whose removal changes nothing on this evidence: `v:use_before_def`.

Ablation (drop one literal, count again):

| Dropped | Role | False alarms without it | Failures explained without it |
|---|---|---:|---:|
| `v:use_before_def` | test | 0 | 1 |
| `(the list of 3 places)` | fence | 66 | 1 |

How the rule was reached: `seed v:use_before_def, fenced to 3 place(s): explains 1, false alarms 0`.

Sources (1; first 1):
- `repos:x3d_mcp/tests/fixtures/scene_rdf/MetadataNodeExamplesX3D4.x3d` ()
