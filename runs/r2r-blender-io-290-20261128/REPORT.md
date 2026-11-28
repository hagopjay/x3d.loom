# R2R run: x3d-blender-io 2.9.0 in bpy 5.3.0: weekly sweep of 2,300 real files (28 Nov 2026)

Made 2026-11-28T07:26:28Z by loomkit.r2r 0.1.0 (source sha256 `096d1ce649f8b276`), X3DUOM 4.1 sha256 `4fc10e8e15c0d6cf`. No language model was used. Every rule below is a **candidate**: nothing here is promoted, and a grade is always relative to the instrument named.

**4 candidate rule(s) from 4 failure cluster(s): 0 Confirmed, 1 Likely, 3 Suspected.** 7040 events (passes and failures) over 2470 distinct files; 211.5 s.

How to read a grade. **C, Confirmed**: the failures were observed by a tool, the rule fires on no file the tool passed, and it called outcomes it had never seen (probes built after the rule was fixed, or held-out receipts). **L, Likely**: clean on what induction saw, but nothing unseen has tested it. **S, Suspected**: a prediction was wrong, or the rule leans on literal values, or the evidence is one failure. **Closure** is separate: `open` means failures of the same signature exist that no rule here fires on, so a Confirmed rule can still be incomplete.

Use the candidates as a pre-flight check: `kit/loom r2r check THIS_FOLDER FILE.x3d`. List what is still open: `kit/loom r2r needs THIS_FOLDER`.

## Instruments and what they said

| Instrument | Failed | Passed |
|---|---:|---:|
| x3d-blender-io 2.9.0 import then export (bpy 5.3.0) | 8 | 2329 |
| x3d-blender-io 2.9.0 importer (bpy 5.3.0) | 36 | 2367 |
| x3d.py 4.0.65.8 through x3d-blender-io 2.9.0 validate.py (does it crash?) | 0 | 2300 |

- Instruments: the x3d-blender-io add-on at 2.9.0 (main 6bf1d15, source tree 2866ac6) inside bpy 5.3.0 (Python 3.13): its importer, and its import followed by its export. Third instrument: x3d.py 4.0.65.8 as the add-on's validate.py at 2.9.0 calls it.
- The judge is the same as for the runs of 23 Nov: kit/loomkit/r2r/drivers/blender_io.py with tools/chaos of x3d-blender-io at 8e56437, the add-on source pinned to the version named, under a 10 GB address-space cap. Cloud machine, 15 GB, 4 cores, four files at a time.
- Sweep: every .x3d file of at most 2,000,000 bytes on the default branch of the sixteen project repositories that hold X3D, identical contents counted once (by git blob): 2,644 files, 2,300 distinct. The list was made by `git ls-tree -r -l` and is the first column of each sweep file. Commits: x3d-blender-io 6bf1d15, x3d.accrete 3755e78, x3d.castle 5b13f70, x3d.chess d314fcf, x3d.demo a80fade, x3d.docs e702465, x3d.gamelab e0a0d97, x3d.gobbler cd95382, x3d.lab 62f3aab, x3d.loom fc30c89, x3d.mashtots 3b57769, x3d.mathslab d883fb7, x3d.ml adc7464, x3d.stem 98f79d7, x3d.wgpu 091b2be, x3d_mcp ca0e75c.
- A file is named week:<repository>/<path>. A file that gave no answer within 60 seconds has the signature 'no answer in 60 s (sweep runner stopped the process)'; the harness's own watchdog is 120 seconds. tools/sweep_runner.py made the sweep and tools/pack_week.py packed it; machine paths in messages were replaced by <addon>/, <site-packages>/, <x3d-blender-io>/ and <tmp>/.
- Correction made before sealing: the judge runs import followed by export in one call, so the eight files whose EXPORT gave no answer in 60 s were first stamped as importer failures. The importer was asked again alone (tools/import_only.py) and passed all eight; those eight importer rows carry "asked": "import alone". In every other importer row 'seconds' is import plus export.
- Held out: the half of the sweep whose sha256 is odd. Probe hosts come only from the other half, files of at most 60 KB.
- To repeat: check the repositories out side by side at the commits above and give --root week=<that folder>, --root bpyenv=<a venv with bpy 5.3.0 and x3d.py>, --root addon-src=<the add-on source at each version under <version>/source>. Replaying the rules of 23 Nov also needs --root repos=<checkouts at the 23 Nov commits: x3d-blender-io 8e56437, x3d.castle 5b13f70, x3d.chess 17e0d05, x3d.demo 8715b23, x3d.loom 32a33f4, x3d.mathslab d883fb7, x3d.wgpu 86f39bd, x3d_mcp 4d433af> and --root chaos=<../r2r-receipts-20261123/chaos-*.tar.xz unpacked>.

## Receipts read

| Receipt | What | sha256 |
|---|---|---|
| `sweep:2.9.0-import.jsonl` | 2,300 real project files through the 2.9.0 importer | `8bb00db3d5d249b7` |
| `sweep:2.9.0-reexport.jsonl` | the same files, import then export, add-on 2.9.0 | `3412612a95cdb9e0` |
| `sweep:2.9.0-x3dpy.jsonl` | the same files through x3d.py 4.0.65.8 as add-on 2.9.0 calls it | `e6c8ef829d869a9a` |

## Candidates at a glance

| Grade | Rule | Instrument and signature | Sources explained | Known-good false alarms | Held-out caught | Held-out false alarms | Audit probes right / wrong / missed | Closure |
|---|---|---|---:|---:|---:|---:|---:|---|
| **S** | [`r2r-8fd2544c0404`](candidates/r2r-8fd2544c0404.json) `doc[x:not_wellformed]` | x3d-blender-io 2.9.0 importer (bpy 5.3.0): `import returned CANCELLED` | 34 of 34 | 0 of 1152 | none to test | 0 of 1112 | 0 / 0 / 0 | untested |
| **L** | [`r2r-c5884565c319`](candidates/r2r-c5884565c319.json) `doc[ge:depth_max:9 & ge:n_elements:2819 & ge:n_routes:3]` | x3d-blender-io 2.9.0 import then export (bpy 5.3.0): `no answer in 60 s (sweep runner stopped the process)` | 8 of 8 | 0 of 1199 | none to test | 0 of 1108 | 0 / 0 / 0 | closed-so-far |
| **S** | [`r2r-b1582e0e10fb`](candidates/r2r-b1582e0e10fb.json) `attr[v:scheme:data & at:AudioClip@url & e.has:loop]` | x3d-blender-io 2.9.0 importer (bpy 5.3.0): `AttributeError at import_x3d.py:6538 importAudio` | 1 of 1 | 0 of 1192 | none to test | 0 of 1112 | 0 / 0 / 0 | untested |
| **S** | [`r2r-7a4b1260be37`](candidates/r2r-7a4b1260be37.json) `attr[v:eq:0.1 0.1 0.1 0.1 0.1 0.1 0.1 0.1 & at:Extrusion@crossSection & p:Shape]` | x3d-blender-io 2.9.0 importer (bpy 5.3.0): `ZeroDivisionError at import_x3d.py:3054 scaledLoopVertex` | 1 of 1 | 0 of 1247 | none to test | 0 of 1112 | 0 / 0 / 0 | untested |

## Clusters

### `import returned CANCELLED`

Instrument: x3d-blender-io 2.9.0 importer (bpy 5.3.0). 34 distinct failing file(s) in training (34 events), 0 held-out event(s). Probed with the real instrument.

#### S (Suspected) `r2r-8fd2544c0404`

> For the file as a whole: the file is not well-formed XML.

`{"all": ["x:not_wellformed"], "kind": "doc"}`

Grade reasons: fires on degenerate files: empty file, whitespace, not XML, truncated. Closure: **untested** (too few probes outside the rule to say).

| Test | Result |
|---|---|
| Source failures explained at the changed site | 34 of 34 (0 with a known-good twin; observed by 34 tool) |
| Fires on files the instrument passed | 0 of 1152 |
| Held-out failures caught (content-disjoint) | none to test |
| Held-out false alarms | 0 of 1112 |
| Degenerate files it fires on | empty file, whitespace, not XML, truncated |
| Already covered by an existing Loom trap | 0 of 34 checked |

Probe rounds: 1: ; audit: .

Seen at 1 place(s): (document).
Normative reading: every explained failure also has `x:not_wellformed` (the file is not well-formed XML); 0 passing file(s) have it too inside the fence.

Alternates the receipts could not rule out (4):
- `doc[le:depth_max:0]`
- `doc[le:max_children:0]`
- `doc[le:max_nattrs:0]`
- `doc[le:n_elements:0]`

Ablation (drop one literal, count again):

| Dropped | Role | False alarms without it | Failures explained without it |
|---|---|---:|---:|

How the rule was reached: `seed x:not_wellformed, fenced to (anywhere): explains 34, false alarms 0`.

Sources (34; first 5):
- `week:x3d.demo/tools/assurance/controls/malformed/scenes/b.x3d` ()
- `week:x3d.ml/runs/gpu-phase/gpt-oss-20b/oneshot/hanim-03.x3d` ()
- `week:x3d.ml/runs/gpu-phase/qwen2.5-coder-14b-awq/grounded/anim-01.x3d` ()
- `week:x3d.ml/runs/gpu-phase/qwen2.5-coder-14b-awq/oneshot/int-05.x3d` ()
- `week:x3d.ml/runs/gpu-phase/qwen3-8b/oneshot/anim-02.x3d` ()

### `no answer in 60 s (sweep runner stopped the process)`

Instrument: x3d-blender-io 2.9.0 import then export (bpy 5.3.0). 8 distinct failing file(s) in training (8 events), 0 held-out event(s). Probed with the real instrument.

#### L (Likely) `r2r-c5884565c319`

> For the file as a whole: the deepest nesting in the file is at least 9 and the number of elements is at least 2819 and the number of ROUTEs is at least 3.

`{"all": ["ge:depth_max:9", "ge:n_elements:2819", "ge:n_routes:3"], "kind": "doc"}`

Grade reasons: nothing unseen has confirmed it: 0 audit probe(s) confirmed (need 5); 0 held-out failure(s) (need 5). Closure: **closed-so-far** (14 audit probe(s) outside the rule all passed).

| Test | Result |
|---|---|
| Source failures explained at the changed site | 8 of 8 (0 with a known-good twin; observed by 8 tool) |
| Fires on files the instrument passed | 0 of 1199 |
| Held-out failures caught (content-disjoint) | none to test |
| Held-out false alarms | 0 of 1108 |
| Audit probes (built after the rule was fixed) | 0 predictions came true, 0 wrong, 0 failures the cluster's rules missed, 14 correctly silent, 0 failed another way |
| Degenerate files it fires on | none of 8 |
| Already covered by an existing Loom trap | 3 of 8 checked (color-keys-sparse 2, loop-seam 3) |

Probe rounds: 1: 2 alternate/refuted, 6 bisect/silent-ok, 8 near/silent-ok; 2: 6 bisect/silent-ok, 8 near/silent-ok; audit: 6 bisect/silent-ok, 8 near/silent-ok.

Seen at 1 place(s): (document).
Threshold `ge:depth_max:9`: last value seen to pass 8, first seen to fail 9.0; nothing between was tested.
Threshold `ge:n_elements:2819`: last value seen to pass 2065, first seen to fail 2819.0; nothing between was tested.
Threshold `ge:n_routes:3`: last value seen to pass 2, first seen to fail 3.0; nothing between was tested.

Alternates the receipts could not rule out (2):
- `doc[ge:bytes:125021 & ge:depth_max:9 & ge:max_children:100 & ge:n_elements:2819]`
- `doc[ge:depth_max:9 & ge:max_children:100 & ge:n_defs:61 & ge:n_elements:2819]`

Ablation (drop one literal, count again):

| Dropped | Role | False alarms without it | Failures explained without it |
|---|---|---:|---:|
| `ge:depth_max:9` | test | 4 | 8 |
| `ge:n_elements:2819` | test | 35 | 8 |
| `ge:n_routes:3` | test | 3 | 8 |

How the rule was reached: `seed ge:depth_max:9, fenced to (anywhere): explains 8, false alarms 144`; then `+ ge:n_elements:2819: explains 8, false alarms 3 (gain 30.31)`; then `+ ge:n_routes:3: explains 8, false alarms 0 (gain 3.68)`.

Sources (8; first 5):
- `week:x3d.accrete/examples/demo-96/world.x3d` ()
- `week:x3d.demo/docs/demos/gobbler-worlds-within/v1/source/bird.x3d` ()
- `week:x3d.demo/docs/demos/segment-sphere/v1/assets/segment-sphere.x3d` ()
- `week:x3d.gobbler/gobbler-flyte/observatory.x3d` ()
- `week:x3d.gobbler/gobbler-flyte/scene.x3d` ()

### `AttributeError at import_x3d.py:6538 importAudio`

Instrument: x3d-blender-io 2.9.0 importer (bpy 5.3.0). 1 distinct failing file(s) in training (1 events), 0 held-out event(s). Probed with the real instrument.

#### S (Suspected) `r2r-b1582e0e10fb`

> At one attribute where the place is AudioClip url and its element also has the attribute loop: a URL uses the scheme `data`.

`{"all": ["v:scheme:data", "at:AudioClip@url", "e.has:loop"], "kind": "attr"}`

Grade reasons: rests on one failure and no confirmed probe. Closure: **untested** (too few probes outside the rule to say).

| Test | Result |
|---|---|
| Source failures explained at the changed site | 1 of 1 (0 with a known-good twin; observed by 1 tool) |
| Fires on files the instrument passed | 0 of 1192 |
| Held-out failures caught (content-disjoint) | none to test |
| Held-out false alarms | 0 of 1112 |
| Degenerate files it fires on | none of 8 |
| Already covered by an existing Loom trap | 0 of 1 checked |

Probe rounds: 1: 10 confirm/refuted, 16 widen/silent-ok; 2: ; audit: .

Seen at 1 place(s): AudioClip@url.
Unfenced reading `attr[v:scheme:data & e.has:loop]`: untested beyond the fence (0 false alarm(s) on known-good files).

Alternates the receipts could not rule out (8):
- `attr[v:present & t:SFBool & (one of 2 places)]`
- `attr[v:present & tc:bool & (one of 2 places)]`
- `attr[v:eq:-3 0 6 & at:Transform@translation]`
- `attr[v:eq:AC & at:AudioClip@DEF]`
Literals whose removal changes nothing on this evidence: `v:scheme:data`.

Ablation (drop one literal, count again):

| Dropped | Role | False alarms without it | Failures explained without it |
|---|---|---:|---:|
| `v:scheme:data` | test | 0 | 1 |
| `at:AudioClip@url` | context | 0 | 1 |
| `e.has:loop` | context | 10 | 1 |

How the rule was reached: `seed v:scheme:data, fenced to at:AudioClip@url: explains 1, false alarms 10`; then `+ e.has:loop: explains 1, false alarms 0 (gain 3.46)`.

Sources (1; first 1):
- `week:x3d.loom/x3d.threejs/bridge/fixtures/Sound.x3d` ()

### `ZeroDivisionError at import_x3d.py:3054 scaledLoopVertex`

Instrument: x3d-blender-io 2.9.0 importer (bpy 5.3.0). 1 distinct failing file(s) in training (1 events), 0 held-out event(s). Probed with the real instrument.

#### S (Suspected) `r2r-7a4b1260be37`

> At one attribute where the place is Extrusion crossSection and the parent is Shape: the value is exactly `0.1 0.1 0.1 0.1 0.1 0.1 0.1 0.1`.

`{"all": ["v:eq:0.1 0.1 0.1 0.1 0.1 0.1 0.1 0.1", "at:Extrusion@crossSection", "p:Shape"], "kind": "attr"}`

Grade reasons: leans on literal values (a fingerprint): the vocabulary lacks a word for what they share; rests on one failure and no confirmed probe. Closure: **untested** (too few probes outside the rule to say).

| Test | Result |
|---|---|
| Source failures explained at the changed site | 1 of 1 (0 with a known-good twin; observed by 1 tool) |
| Fires on files the instrument passed | 0 of 1247 |
| Held-out failures caught (content-disjoint) | none to test |
| Held-out false alarms | 0 of 1112 |
| Audit probes (built after the rule was fixed) | 0 predictions came true, 0 wrong, 0 failures the cluster's rules missed, 4 correctly silent, 0 failed another way |
| Degenerate files it fires on | none of 8 |
| Already covered by an existing Loom trap | 0 of 1 checked |

Probe rounds: 1: 2 widen/silent-ok; 2: 10 confirm/refuted, 16 widen/silent-ok; 3: 3 widen/silent-ok; audit: 4 widen/silent-ok.

Seen at 1 place(s): Extrusion@crossSection.
Unfenced reading `attr[v:eq:0.1 0.1 0.1 0.1 0.1 0.1 0.1 0.1 & p:Shape]`: contradicted by passing files (5 false alarm(s) on known-good files).

Alternates the receipts could not rule out (2):
- `attr[v:eq:0.1 0.1 0.1 0.1 0.1 0.1 0.1 0.1 & anc:Shape & at:Extrusion@crossSection]`
- `attr[v:eq:0.1 0.1 0.1 0.1 0.1 0.1 0.1 0.1 & !p:Group & at:Extrusion@crossSection]`

Ablation (drop one literal, count again):

| Dropped | Role | False alarms without it | Failures explained without it |
|---|---|---:|---:|
| `v:eq:0.1 0.1 0.1 0.1 0.1 0.1 0.1 0.1` | test | 44 | 1 |
| `at:Extrusion@crossSection` | context | 5 | 1 |
| `p:Shape` | context | 1 | 1 |

How the rule was reached: `seed v:eq:0.1 0.1 0.1 0.1 0.1 0.1 0.1 0.1, fenced to at:Extrusion@crossSection: explains 1, false alarms 1`; then `+ p:Shape: explains 1, false alarms 0 (gain 1.00)`.

Sources (1; first 1):
- `week:x3d.ml/runs/gpu-phase/qwen3-8b/oneshot/obj-05.x3d` ()
